from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from aim_rl.controllers import HumanizedAimController
from aim_rl.env import AimTrackingEnv


ARTIFACTS_DIR = ROOT / "artifacts"
TRAJECTORY_PATH = ARTIFACTS_DIR / "last_trajectory.jsonl"


def _record_step(
    env: AimTrackingEnv,
    action: tuple[float, float],
    reward: float,
    info: dict[str, float],
) -> dict[str, float]:
    if env.state is None:
        raise RuntimeError("Environment state is not available.")
    state = env.state
    return {
        "step": state.step_count,
        "cursor_x": round(state.cursor_x, 6),
        "cursor_y": round(state.cursor_y, 6),
        "cursor_vx": round(state.cursor_vx, 6),
        "cursor_vy": round(state.cursor_vy, 6),
        "target_x": round(state.target_x, 6),
        "target_y": round(state.target_y, 6),
        "target_vx": round(state.target_vx, 6),
        "target_vy": round(state.target_vy, 6),
        "action_x": round(action[0], 6),
        "action_y": round(action[1], 6),
        "distance": round(info["distance"], 6),
        "reward": round(reward, 6),
        "track_zone": int(info["in_track_zone"]),
        "hit_zone": int(info["hit_zone"]),
    }


def run_episode(
    env: AimTrackingEnv,
    controller: HumanizedAimController,
    trajectory_path: Path | None = None,
) -> dict[str, float]:
    observation = env.reset()
    controller.reset()

    total_reward = 0.0
    min_distance = float("inf")
    hit_frames = 0
    trace_rows: list[dict[str, float]] = []

    done = False
    while not done:
        action = controller.act(observation)
        observation, reward, done, info = env.step(action)
        total_reward += reward
        min_distance = min(min_distance, info["distance"])
        if info["hit_zone"]:
            hit_frames += 1
        if trajectory_path is not None:
            trace_rows.append(_record_step(env, action, reward, info))

    if trajectory_path is not None:
        trajectory_path.parent.mkdir(parents=True, exist_ok=True)
        with trajectory_path.open("w", encoding="utf-8") as handle:
            for row in trace_rows:
                handle.write(json.dumps(row) + "\n")

    return {
        "reward": total_reward,
        "min_distance": min_distance,
        "hit_frames": float(hit_frames),
        "steps": float(len(trace_rows)) if trajectory_path is not None else 0.0,
    }


def main() -> None:
    env = AimTrackingEnv(seed=7)
    controller = HumanizedAimController(seed=7)

    results = [run_episode(env, controller, TRAJECTORY_PATH if index == 0 else None) for index in range(8)]
    print("episodes:", len(results))
    print("avg_reward:", round(statistics.fmean(item["reward"] for item in results), 3))
    print("avg_min_distance:", round(statistics.fmean(item["min_distance"] for item in results), 4))
    print("avg_hit_frames:", round(statistics.fmean(item["hit_frames"] for item in results), 2))
    print("trajectory_log:", TRAJECTORY_PATH)

    if TRAJECTORY_PATH.exists():
        sample_lines = TRAJECTORY_PATH.read_text(encoding="utf-8").splitlines()[:5]
        print("trajectory_sample:")
        for line in sample_lines:
            row = json.loads(line)
            print(
                "  "
                f"step={row['step']} "
                f"cursor=({row['cursor_x']:.3f},{row['cursor_y']:.3f}) "
                f"target=({row['target_x']:.3f},{row['target_y']:.3f}) "
                f"action=({row['action_x']:.3f},{row['action_y']:.3f}) "
                f"distance={row['distance']:.3f}"
            )


if __name__ == "__main__":
    main()
