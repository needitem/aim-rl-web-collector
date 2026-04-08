from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
from torch import nn
from torch.distributions import Normal


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from aim_rl.controllers import HumanizedAimController, LeadHumanizedAimController
from aim_rl.env import AimTrackingEnv, EnvironmentConfig
from aim_rl.rl import ActorCritic, OBSERVATION_KEYS, TorchPolicyController, observation_to_tensor
from render_trajectory import render_animation, render_overview


ARTIFACTS_DIR = ROOT / "artifacts"
CHECKPOINT_PATH = ARTIFACTS_DIR / "lead_ppo_policy.pt"
SUMMARY_PATH = ARTIFACTS_DIR / "lead_ppo_summary.json"
TRAJECTORY_PATH = ARTIFACTS_DIR / "lead_policy_trajectory.jsonl"
PLOT_PATH = ARTIFACTS_DIR / "lead_policy_overview.png"
GIF_PATH = ARTIFACTS_DIR / "lead_policy_animation.gif"


@dataclass
class TrainConfig:
    seed: int = 17
    rollout_steps: int = 768
    updates: int = 18
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_ratio: float = 0.2
    lr: float = 1e-4
    entropy_weight: float = 0.003
    value_weight: float = 0.5
    ppo_epochs: int = 5
    minibatch_size: int = 128
    eval_episodes: int = 18
    bc_epochs: int = 18
    bc_batch_size: int = 256
    bc_lr: float = 1e-3
    bc_dataset_episodes: int = 64
    ppo_bc_weight: float = 0.12


def make_env(seed: int | None = None) -> AimTrackingEnv:
    config = EnvironmentConfig(
        episode_steps=240,
        target_max_speed=0.55,
        target_accel_noise=0.14,
        reward_lead_time=0.18,
        reward_lead_weight=0.85,
        reward_forward_weight=0.45,
        reward_forward_scale=0.7,
    )
    return AimTrackingEnv(config=config, seed=seed)


def evaluate_controller(controller, episodes: int, env_seed_base: int) -> dict[str, float]:
    rewards: list[float] = []
    min_distances: list[float] = []
    lead_distances: list[float] = []
    forward_offsets: list[float] = []
    hit_frames: list[float] = []

    for offset in range(episodes):
        env = make_env(seed=env_seed_base + offset)
        observation = env.reset()
        controller.reset()

        total_reward = 0.0
        episode_min_distance = float("inf")
        episode_lead_distances: list[float] = []
        episode_forward_offsets: list[float] = []
        episode_hit_frames = 0.0

        done = False
        while not done:
            action = controller.act(observation)
            observation, reward, done, info = env.step(action)
            total_reward += reward
            episode_min_distance = min(episode_min_distance, info["distance"])
            episode_lead_distances.append(info["lead_distance"])
            episode_forward_offsets.append(info["forward_offset"])
            episode_hit_frames += info["hit_zone"]

        rewards.append(total_reward)
        min_distances.append(episode_min_distance)
        lead_distances.append(sum(episode_lead_distances) / len(episode_lead_distances))
        forward_offsets.append(sum(episode_forward_offsets) / len(episode_forward_offsets))
        hit_frames.append(episode_hit_frames)

    return {
        "avg_reward": round(sum(rewards) / len(rewards), 3),
        "avg_min_distance": round(sum(min_distances) / len(min_distances), 4),
        "avg_lead_distance": round(sum(lead_distances) / len(lead_distances), 4),
        "avg_forward_offset": round(sum(forward_offsets) / len(forward_offsets), 4),
        "avg_hit_frames": round(sum(hit_frames) / len(hit_frames), 2),
    }


def metric_score(metrics: dict[str, float]) -> float:
    return (
        (40.0 * metrics["avg_hit_frames"])
        - (320.0 * metrics["avg_lead_distance"])
        + (260.0 * metrics["avg_forward_offset"])
        - (180.0 * metrics["avg_min_distance"])
    )


def collect_imitation_dataset(controller: LeadHumanizedAimController, episodes: int, seed_base: int) -> tuple[torch.Tensor, torch.Tensor]:
    observations: list[torch.Tensor] = []
    actions: list[torch.Tensor] = []

    for offset in range(episodes):
        env = make_env(seed=seed_base + offset)
        observation = env.reset()
        controller.reset()
        done = False
        while not done:
            action = controller.act(observation)
            observations.append(observation_to_tensor(observation))
            actions.append(torch.tensor(action, dtype=torch.float32))
            observation, _, done, _ = env.step(action)

    return torch.stack(observations), torch.stack(actions)


def behavior_clone(model: ActorCritic, device: torch.device, cfg: TrainConfig) -> list[dict[str, float]]:
    teacher = LeadHumanizedAimController(seed=cfg.seed)
    observations, actions = collect_imitation_dataset(teacher, episodes=cfg.bc_dataset_episodes, seed_base=1200)
    observations = observations.to(device)
    actions = actions.to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.bc_lr)
    progress: list[dict[str, float]] = []

    sample_count = observations.shape[0]
    for epoch in range(1, cfg.bc_epochs + 1):
        permutation = torch.randperm(sample_count, device=device)
        epoch_loss = 0.0
        minibatches = 0

        for start in range(0, sample_count, cfg.bc_batch_size):
            indices = permutation[start : start + cfg.bc_batch_size]
            mean, _, _ = model(observations[indices])
            loss = nn.functional.mse_loss(mean, actions[indices])

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            epoch_loss += float(loss.item())
            minibatches += 1

        if epoch == 1 or epoch % 6 == 0 or epoch == cfg.bc_epochs:
            progress.append(
                {
                    "epoch": float(epoch),
                    "bc_loss": round(epoch_loss / max(1, minibatches), 6),
                }
            )

    return progress


def collect_teacher_batch(
    observations: torch.Tensor,
    actions: torch.Tensor,
    batch_size: int,
    device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor]:
    indices = torch.randint(0, observations.shape[0], (batch_size,), device=device)
    return observations[indices], actions[indices]


def collect_rollout(
    env: AimTrackingEnv,
    model: ActorCritic,
    device: torch.device,
    cfg: TrainConfig,
) -> dict[str, torch.Tensor]:
    observations: list[torch.Tensor] = []
    actions: list[torch.Tensor] = []
    log_probs: list[torch.Tensor] = []
    rewards: list[float] = []
    dones: list[float] = []
    values: list[torch.Tensor] = []

    observation = env.reset()

    for _ in range(cfg.rollout_steps):
        obs_tensor = observation_to_tensor(observation).to(device)
        mean, std, value = model(obs_tensor.unsqueeze(0))
        distribution = Normal(mean.squeeze(0), std.squeeze(0))
        action = distribution.sample()
        clipped_action = torch.clamp(action, -1.0, 1.0)

        next_observation, reward, done, _ = env.step((float(clipped_action[0]), float(clipped_action[1])))

        observations.append(obs_tensor.detach())
        actions.append(clipped_action.detach())
        log_probs.append(distribution.log_prob(action).sum().detach())
        rewards.append(reward)
        dones.append(float(done))
        values.append(value.squeeze(0).detach())

        observation = env.reset() if done else next_observation

    with torch.no_grad():
        last_value = model(observation_to_tensor(observation).to(device).unsqueeze(0))[2].squeeze(0)

    rewards_tensor = torch.tensor(rewards, dtype=torch.float32, device=device)
    dones_tensor = torch.tensor(dones, dtype=torch.float32, device=device)
    values_tensor = torch.stack(values)
    advantages = torch.zeros_like(rewards_tensor)
    gae = torch.zeros((), dtype=torch.float32, device=device)

    for step in reversed(range(cfg.rollout_steps)):
        next_value = last_value if step == cfg.rollout_steps - 1 else values_tensor[step + 1]
        mask = 1.0 - dones_tensor[step]
        delta = rewards_tensor[step] + (cfg.gamma * next_value * mask) - values_tensor[step]
        gae = delta + (cfg.gamma * cfg.gae_lambda * mask * gae)
        advantages[step] = gae

    returns = advantages + values_tensor
    advantages = (advantages - advantages.mean()) / (advantages.std(unbiased=False) + 1e-8)

    return {
        "observations": torch.stack(observations),
        "actions": torch.stack(actions),
        "log_probs": torch.stack(log_probs),
        "returns": returns.detach(),
        "advantages": advantages.detach(),
    }


def ppo_update(
    model: ActorCritic,
    optimizer: torch.optim.Optimizer,
    batch: dict[str, torch.Tensor],
    teacher_observations: torch.Tensor,
    teacher_actions: torch.Tensor,
    cfg: TrainConfig,
) -> None:
    sample_count = batch["observations"].shape[0]
    for _ in range(cfg.ppo_epochs):
        permutation = torch.randperm(sample_count, device=batch["observations"].device)
        for start in range(0, sample_count, cfg.minibatch_size):
            indices = permutation[start : start + cfg.minibatch_size]
            observations = batch["observations"][indices]
            actions = batch["actions"][indices]
            old_log_probs = batch["log_probs"][indices]
            returns = batch["returns"][indices]
            advantages = batch["advantages"][indices]

            mean, std, values = model(observations)
            distribution = Normal(mean, std)
            new_log_probs = distribution.log_prob(actions).sum(dim=-1)
            entropy = distribution.entropy().sum(dim=-1).mean()

            ratio = torch.exp(new_log_probs - old_log_probs)
            unclipped = ratio * advantages
            clipped = torch.clamp(ratio, 1.0 - cfg.clip_ratio, 1.0 + cfg.clip_ratio) * advantages

            policy_loss = -torch.min(unclipped, clipped).mean()
            value_loss = nn.functional.mse_loss(values, returns)
            teacher_obs_batch, teacher_action_batch = collect_teacher_batch(
                teacher_observations,
                teacher_actions,
                observations.shape[0],
                observations.device,
            )
            teacher_mean, _, _ = model(teacher_obs_batch)
            bc_anchor_loss = nn.functional.mse_loss(teacher_mean, teacher_action_batch)

            loss = (
                policy_loss
                + (cfg.value_weight * value_loss)
                + (cfg.ppo_bc_weight * bc_anchor_loss)
                - (cfg.entropy_weight * entropy)
            )

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()


def train() -> dict[str, object]:
    cfg = TrainConfig()
    torch.manual_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = ActorCritic(obs_dim=len(OBSERVATION_KEYS)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.lr)
    env = make_env(seed=cfg.seed)
    teacher_observations, teacher_actions = collect_imitation_dataset(
        LeadHumanizedAimController(seed=cfg.seed),
        episodes=cfg.bc_dataset_episodes,
        seed_base=1200,
    )
    teacher_observations = teacher_observations.to(device)
    teacher_actions = teacher_actions.to(device)

    bc_progress = behavior_clone(model, device, cfg)
    progress: list[dict[str, float]] = []
    best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
    best_metrics = evaluate_controller(TorchPolicyController(model, device), episodes=cfg.eval_episodes, env_seed_base=800)
    best_score = metric_score(best_metrics)
    progress.append({"phase": "bc", **best_metrics})
    print(
        f"phase=bc "
        f"reward={best_metrics['avg_reward']:.2f} "
        f"lead_dist={best_metrics['avg_lead_distance']:.4f} "
        f"forward={best_metrics['avg_forward_offset']:.4f}"
    )

    for update in range(1, cfg.updates + 1):
        batch = collect_rollout(env, model, device, cfg)
        ppo_update(model, optimizer, batch, teacher_observations, teacher_actions, cfg)

        if update == 1 or update % 5 == 0 or update == cfg.updates:
            controller = TorchPolicyController(model, device)
            metrics = evaluate_controller(controller, episodes=8, env_seed_base=300 + update)
            metrics["phase"] = "ppo"
            metrics["update"] = float(update)
            progress.append(metrics)
            print(
                f"update={update:02d} "
                f"reward={metrics['avg_reward']:.2f} "
                f"lead_dist={metrics['avg_lead_distance']:.4f} "
                f"forward={metrics['avg_forward_offset']:.4f}"
            )

            eval_metrics = evaluate_controller(controller, episodes=cfg.eval_episodes, env_seed_base=800)
            score = metric_score(eval_metrics)
            if score > best_score:
                best_score = score
                best_metrics = eval_metrics
                best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    model.load_state_dict(best_state)

    learned_controller = TorchPolicyController(model, device)
    learned_metrics = evaluate_controller(learned_controller, episodes=cfg.eval_episodes, env_seed_base=800)
    base_metrics = evaluate_controller(HumanizedAimController(seed=cfg.seed), episodes=cfg.eval_episodes, env_seed_base=800)
    lead_metrics = evaluate_controller(LeadHumanizedAimController(seed=cfg.seed), episodes=cfg.eval_episodes, env_seed_base=800)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "obs_keys": OBSERVATION_KEYS,
            "train_config": asdict(cfg),
        },
        CHECKPOINT_PATH,
    )

    summary: dict[str, object] = {
        "device": str(device),
        "train_config": asdict(cfg),
        "bc_progress": bc_progress,
        "progress": progress,
        "baseline": base_metrics,
        "lead_baseline": lead_metrics,
        "learned_policy": learned_metrics,
        "best_score": round(best_score, 4),
        "checkpoint": str(CHECKPOINT_PATH),
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    record_policy_trajectory(learned_controller, seed=801, output_path=TRAJECTORY_PATH)
    rows = [json.loads(line) for line in TRAJECTORY_PATH.read_text(encoding="utf-8").splitlines() if line]
    render_overview(rows, PLOT_PATH, title="Learned lead policy")
    render_animation(rows, GIF_PATH, title="Learned lead policy")
    return summary


def record_policy_trajectory(controller, seed: int, output_path: Path) -> None:
    env = make_env(seed=seed)
    observation = env.reset()
    controller.reset()
    rows: list[dict[str, float]] = []
    done = False
    while not done:
        action = controller.act(observation)
        observation, reward, done, info = env.step(action)
        if env.state is None:
            raise RuntimeError("Environment state missing during trajectory recording.")
        lead_x = env.state.cursor_x + observation["lead_rel_x"]
        lead_y = env.state.cursor_y + observation["lead_rel_y"]
        rows.append(
            {
                "step": env.state.step_count,
                "cursor_x": round(env.state.cursor_x, 6),
                "cursor_y": round(env.state.cursor_y, 6),
                "target_x": round(env.state.target_x, 6),
                "target_y": round(env.state.target_y, 6),
                "lead_x": round(lead_x, 6),
                "lead_y": round(lead_y, 6),
                "action_x": round(float(action[0]), 6),
                "action_y": round(float(action[1]), 6),
                "distance": round(info["distance"], 6),
                "lead_distance": round(info["lead_distance"], 6),
                "forward_offset": round(info["forward_offset"], 6),
                "desired_forward_offset": round(info["desired_forward_offset"], 6),
                "reward": round(float(reward), 6),
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")


def main() -> None:
    summary = train()
    print("baseline:", json.dumps(summary["baseline"]))
    print("lead_baseline:", json.dumps(summary["lead_baseline"]))
    print("learned_policy:", json.dumps(summary["learned_policy"]))
    print("checkpoint:", summary["checkpoint"])
    print("summary:", SUMMARY_PATH)
    print("trajectory:", TRAJECTORY_PATH)
    print("plot:", PLOT_PATH)
    print("gif:", GIF_PATH)


if __name__ == "__main__":
    main()
