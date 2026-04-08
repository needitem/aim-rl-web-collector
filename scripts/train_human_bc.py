from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
SCRIPTS = ROOT / "scripts"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from aim_rl.env import AimTrackingEnv, EnvironmentConfig
from aim_rl.human_bc import (
    find_latest_human_session,
    group_rows_by_episode,
    load_trace_rows,
    split_episodes,
    traces_to_next_cursor_offset_tensors,
)
from aim_rl.rl import OBSERVATION_KEYS
from render_trajectory import render_animation, render_overview


ARTIFACTS_DIR = ROOT / "artifacts"
HUMAN_SESSIONS_DIR = ARTIFACTS_DIR / "human_sessions"
CHECKPOINT_PATH = ARTIFACTS_DIR / "human_bc_policy.pt"
SUMMARY_PATH = ARTIFACTS_DIR / "human_bc_summary.json"
TRAJECTORY_PATH = ARTIFACTS_DIR / "human_bc_trajectory.jsonl"
PLOT_PATH = ARTIFACTS_DIR / "human_bc_overview.png"
GIF_PATH = ARTIFACTS_DIR / "human_bc_animation.gif"


@dataclass
class HumanBCConfig:
    seed: int = 23
    epochs: int = 180
    batch_size: int = 64
    lr: float = 8e-4
    weight_decay: float = 1e-5
    validation_ratio: float = 0.2
    eval_episodes: int = 18


class OffsetRegressor(nn.Module):
    def __init__(self, obs_dim: int, hidden_size: int = 64) -> None:
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(obs_dim, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 2),
            nn.Tanh(),
        )

    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        return self.network(observations)


def make_env(seed: int | None = None) -> AimTrackingEnv:
    return AimTrackingEnv(
        config=EnvironmentConfig(
            episode_steps=240,
            target_max_speed=0.55,
            target_accel_noise=0.14,
            reward_lead_time=0.18,
            reward_lead_weight=0.85,
            reward_forward_weight=0.45,
            reward_forward_scale=0.7,
        ),
        seed=seed,
    )


def evaluate_model_in_simulator(model: OffsetRegressor, device: torch.device, episodes: int, env_seed_base: int) -> dict[str, float]:
    rewards: list[float] = []
    min_distances: list[float] = []
    lead_distances: list[float] = []
    forward_offsets: list[float] = []
    hit_frames: list[float] = []

    for offset in range(episodes):
        env = make_env(seed=env_seed_base + offset)
        observation = env.reset()

        total_reward = 0.0
        episode_min_distance = float("inf")
        episode_lead_distances: list[float] = []
        episode_forward_offsets: list[float] = []
        episode_hit_frames = 0.0

        done = False
        while not done:
            if env.state is None:
                raise RuntimeError("Environment state missing during simulator evaluation.")
            features = torch.tensor([observation[key] for key in OBSERVATION_KEYS], dtype=torch.float32, device=device).unsqueeze(0)
            with torch.no_grad():
                next_offset = model(features).squeeze(0).cpu()

            desired_cursor_x = env.state.target_x + float(next_offset[0])
            desired_cursor_y = env.state.target_y + float(next_offset[1])
            observation, reward, done, info = env.step_cursor_control(desired_cursor_x, desired_cursor_y)

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


def evaluate_offset_error(model: OffsetRegressor, observations: torch.Tensor, labels: torch.Tensor, device: torch.device) -> dict[str, float]:
    with torch.no_grad():
        predicted = model(observations.to(device))
        error = torch.abs(predicted - labels.to(device))
        mse = nn.functional.mse_loss(predicted, labels.to(device))
    return {
        "mse": round(float(mse.item()), 6),
        "mae_x": round(float(error[:, 0].mean().item()), 6),
        "mae_y": round(float(error[:, 1].mean().item()), 6),
    }


def train_human_bc(input_path: Path) -> dict[str, object]:
    cfg = HumanBCConfig()
    torch.manual_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    rows = load_trace_rows(input_path)
    episodes = group_rows_by_episode(rows)
    train_episodes, val_episodes = split_episodes(episodes, validation_ratio=cfg.validation_ratio)
    train_observations, train_labels = traces_to_next_cursor_offset_tensors(train_episodes)
    val_observations, val_labels = traces_to_next_cursor_offset_tensors(val_episodes)

    model = OffsetRegressor(obs_dim=len(OBSERVATION_KEYS)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)

    train_observations = train_observations.to(device)
    train_labels = train_labels.to(device)
    val_observations = val_observations.to(device)
    val_labels = val_labels.to(device)

    best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
    best_val_loss = float("inf")
    progress: list[dict[str, float]] = []

    sample_count = train_observations.shape[0]
    for epoch in range(1, cfg.epochs + 1):
        permutation = torch.randperm(sample_count, device=device)
        epoch_loss = 0.0
        minibatches = 0

        for start in range(0, sample_count, cfg.batch_size):
            indices = permutation[start : start + cfg.batch_size]
            predicted = model(train_observations[indices])
            loss = nn.functional.mse_loss(predicted, train_labels[indices])

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            epoch_loss += float(loss.item())
            minibatches += 1

        with torch.no_grad():
            val_prediction = model(val_observations)
            val_loss = nn.functional.mse_loss(val_prediction, val_labels)

        if float(val_loss.item()) < best_val_loss:
            best_val_loss = float(val_loss.item())
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

        if epoch == 1 or epoch % 20 == 0 or epoch == cfg.epochs:
            progress.append(
                {
                    "epoch": float(epoch),
                    "train_loss": round(epoch_loss / max(1, minibatches), 6),
                    "val_loss": round(float(val_loss.item()), 6),
                }
            )

    model.load_state_dict(best_state)

    train_error = evaluate_offset_error(model, train_observations.cpu(), train_labels.cpu(), device)
    validation_error = evaluate_offset_error(model, val_observations.cpu(), val_labels.cpu(), device)
    simulator_metrics = evaluate_model_in_simulator(model, device, episodes=cfg.eval_episodes, env_seed_base=1700)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "model_type": "offset-regressor",
            "obs_keys": OBSERVATION_KEYS,
            "input_session": str(input_path),
            "train_config": asdict(cfg),
        },
        CHECKPOINT_PATH,
    )

    record_policy_trajectory(model, device, output_path=TRAJECTORY_PATH, seed=1701)
    trajectory_rows = [json.loads(line) for line in TRAJECTORY_PATH.read_text(encoding="utf-8").splitlines() if line]
    render_overview(trajectory_rows, PLOT_PATH, title="Human BC policy")
    render_animation(trajectory_rows, GIF_PATH, title="Human BC policy")

    summary: dict[str, object] = {
        "device": str(device),
        "input_session": str(input_path),
        "train_episodes": [trace.episode for trace in train_episodes],
        "validation_episodes": [trace.episode for trace in val_episodes],
        "train_frames": int(train_observations.shape[0]),
        "validation_frames": int(val_observations.shape[0]),
        "progress": progress,
        "train_error": train_error,
        "validation_error": validation_error,
        "simulator_metrics": simulator_metrics,
        "checkpoint": str(CHECKPOINT_PATH),
        "trajectory": str(TRAJECTORY_PATH),
        "plot": str(PLOT_PATH),
        "gif": str(GIF_PATH),
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def record_policy_trajectory(model: OffsetRegressor, device: torch.device, output_path: Path, seed: int) -> None:
    env = make_env(seed=seed)
    observation = env.reset()
    rows: list[dict[str, float | int | str]] = []

    done = False
    while not done:
        if env.state is None:
            raise RuntimeError("Environment state missing during trajectory recording.")
        features = torch.tensor([observation[key] for key in OBSERVATION_KEYS], dtype=torch.float32, device=device).unsqueeze(0)
        with torch.no_grad():
            next_offset = model(features).squeeze(0).cpu()

        desired_cursor_x = env.state.target_x + float(next_offset[0])
        desired_cursor_y = env.state.target_y + float(next_offset[1])
        observation, reward, done, info = env.step_cursor_control(desired_cursor_x, desired_cursor_y)
        lead_x = env.state.cursor_x + observation["lead_rel_x"]
        lead_y = env.state.cursor_y + observation["lead_rel_y"]
        rows.append(
            {
                "episode": 1,
                "step": env.state.step_count,
                "t": round(env.state.step_count * env.config.dt, 6),
                "cursor_x": round(env.state.cursor_x, 6),
                "cursor_y": round(env.state.cursor_y, 6),
                "target_x": round(env.state.target_x, 6),
                "target_y": round(env.state.target_y, 6),
                "lead_x": round(lead_x, 6),
                "lead_y": round(lead_y, 6),
                "action_x": round(float(info["action_x"]), 6),
                "action_y": round(float(info["action_y"]), 6),
                "distance": round(float(info["distance"]), 6),
                "reward": round(float(reward), 6),
                "source": "human-bc-policy",
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = args.input or find_latest_human_session(HUMAN_SESSIONS_DIR)
    summary = train_human_bc(input_path)
    print("input_session:", summary["input_session"])
    print("train_error:", json.dumps(summary["train_error"]))
    print("validation_error:", json.dumps(summary["validation_error"]))
    print("simulator_metrics:", json.dumps(summary["simulator_metrics"]))
    print("checkpoint:", summary["checkpoint"])
    print("summary:", SUMMARY_PATH)
    print("gif:", summary["gif"])


if __name__ == "__main__":
    main()
