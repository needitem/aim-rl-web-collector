from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
import tkinter as tk


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from aim_rl.controllers import LeadHumanizedAimController
from aim_rl.data import SessionRecorder, canvas_to_world, world_to_canvas
from aim_rl.env import AimTrackingEnv, EnvironmentConfig


ARTIFACTS_DIR = ROOT / "artifacts" / "human_sessions"


def build_env(seed: int | None = None) -> AimTrackingEnv:
    return AimTrackingEnv(
        config=EnvironmentConfig(
            episode_steps=300,
            target_max_speed=0.55,
            target_accel_noise=0.14,
            reward_lead_time=0.18,
            reward_lead_weight=0.85,
            reward_forward_weight=0.45,
            reward_forward_scale=0.7,
        ),
        seed=seed,
    )


def trace_row(env: AimTrackingEnv, recorder: SessionRecorder, reward: float, info: dict[str, float]) -> dict[str, float | int | str]:
    if env.state is None:
        raise RuntimeError("Environment state missing while recording.")
    state = env.state
    observation = env._observation()
    lead_x = state.cursor_x + observation["lead_rel_x"]
    lead_y = state.cursor_y + observation["lead_rel_y"]
    return {
        "episode": recorder.episode_index,
        "step": state.step_count,
        "t": round(state.step_count * env.config.dt, 6),
        "cursor_x": round(state.cursor_x, 6),
        "cursor_y": round(state.cursor_y, 6),
        "cursor_vx": round(state.cursor_vx, 6),
        "cursor_vy": round(state.cursor_vy, 6),
        "target_x": round(state.target_x, 6),
        "target_y": round(state.target_y, 6),
        "target_vx": round(state.target_vx, 6),
        "target_vy": round(state.target_vy, 6),
        "lead_x": round(lead_x, 6),
        "lead_y": round(lead_y, 6),
        "action_x": round(info["action_x"], 6),
        "action_y": round(info["action_y"], 6),
        "distance": round(info["distance"], 6),
        "lead_distance": round(info["lead_distance"], 6),
        "forward_offset": round(info["forward_offset"], 6),
        "desired_forward_offset": round(info["desired_forward_offset"], 6),
        "reward": round(reward, 6),
    }


def default_output_path(prefix: str = "session") -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return ARTIFACTS_DIR / f"{prefix}-{stamp}.jsonl"


def save_summary(output_path: Path, recorder: SessionRecorder) -> Path:
    summary_path = output_path.with_suffix(".summary.json")
    rows = recorder.rows
    episode_count = len({row.episode for row in rows})
    payload = {
        "path": str(output_path),
        "frames": len(rows),
        "episodes": episode_count,
        "source": recorder.source,
    }
    summary_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return summary_path


def run_headless_demo(episodes: int, output_path: Path) -> tuple[Path, Path]:
    recorder = SessionRecorder(source="headless-demo")
    controller = LeadHumanizedAimController(seed=11)

    for episode_seed in range(episodes):
        env = build_env(seed=400 + episode_seed)
        recorder.next_episode()
        observation = env.reset()
        controller.reset()

        done = False
        while not done:
            action = controller.act(observation)
            observation, reward, done, info = env.step(action)
            recorder.record(trace_row(env, recorder, reward, info))

    output_path = recorder.write_jsonl(output_path)
    summary_path = save_summary(output_path, recorder)
    return output_path, summary_path


class HumanTrackingApp:
    def __init__(self, output_path: Path) -> None:
        self.output_path = output_path
        self.env = build_env(seed=17)
        self.recorder = SessionRecorder(source="human-mouse")
        self.mouse_x = 450
        self.mouse_y = 450
        self.running = False
        self.last_saved_path: Path | None = None
        self.summary_path: Path | None = None
        self.last_info: dict[str, float] = {"distance": 0.0, "forward_offset": 0.0}
        self.last_reward = 0.0

        self.root = tk.Tk()
        self.root.title("Aim RL Human Data Collection")
        self.canvas_size = 900
        self.canvas = tk.Canvas(self.root, width=self.canvas_size, height=self.canvas_size, bg="#fcfcfc")
        self.canvas.pack(fill=tk.BOTH, expand=False)
        self.status_var = tk.StringVar()
        self.status = tk.Label(self.root, textvariable=self.status_var, anchor="w", justify="left")
        self.status.pack(fill=tk.X, padx=8, pady=8)

        self.canvas.bind("<Motion>", self.on_mouse_move)
        self.root.bind("<space>", self.toggle_running)
        self.root.bind("r", self.reset_episode)
        self.root.bind("s", self.save_session)
        self.root.bind("n", self.next_episode)
        self.root.bind("<Escape>", self.close)

        self._begin_episode()
        self._tick()

    def on_mouse_move(self, event: tk.Event) -> None:
        self.mouse_x = event.x
        self.mouse_y = event.y

    def toggle_running(self, _event: tk.Event | None = None) -> None:
        self.running = not self.running
        self._update_status()

    def reset_episode(self, _event: tk.Event | None = None) -> None:
        self._begin_episode()

    def next_episode(self, _event: tk.Event | None = None) -> None:
        self._begin_episode()
        self.running = True
        self._update_status()

    def save_session(self, _event: tk.Event | None = None) -> None:
        self.last_saved_path = self.recorder.write_jsonl(self.output_path)
        self.summary_path = save_summary(self.last_saved_path, self.recorder)
        self._update_status()

    def close(self, _event: tk.Event | None = None) -> None:
        if self.recorder.rows:
            self.save_session()
        self.root.destroy()

    def _begin_episode(self) -> None:
        self.recorder.next_episode()
        self.env.reset()
        self.running = False
        self.last_reward = 0.0
        self.last_info = {"distance": 0.0, "forward_offset": 0.0}
        self._update_status()

    def _tick(self) -> None:
        if self.running:
            world_x, world_y = canvas_to_world(
                self.mouse_x,
                self.mouse_y,
                self.canvas_size,
                self.canvas_size,
                self.env.config.world_x,
                self.env.config.world_y,
            )
            _, reward, done, info = self.env.step_cursor_control(world_x, world_y)
            self.last_reward = reward
            self.last_info = info
            self.recorder.record(trace_row(self.env, self.recorder, reward, info))
            if done:
                self._begin_episode()
                self.running = True

        self._draw_scene()
        self._update_status()
        self.root.after(int(self.env.config.dt * 1000), self._tick)

    def _draw_scene(self) -> None:
        self.canvas.delete("all")
        self.canvas.create_rectangle(5, 5, self.canvas_size - 5, self.canvas_size - 5, outline="#333333", width=2)

        if self.env.state is None:
            return

        state = self.env.state
        observation = self.env._observation()
        lead_x = state.cursor_x + observation["lead_rel_x"]
        lead_y = state.cursor_y + observation["lead_rel_y"]

        cx, cy = world_to_canvas(state.cursor_x, state.cursor_y, self.canvas_size, self.canvas_size, self.env.config.world_x, self.env.config.world_y)
        tx, ty = world_to_canvas(state.target_x, state.target_y, self.canvas_size, self.canvas_size, self.env.config.world_x, self.env.config.world_y)
        lx, ly = world_to_canvas(lead_x, lead_y, self.canvas_size, self.canvas_size, self.env.config.world_x, self.env.config.world_y)

        track_radius = int(self.env.config.target_radius / self.env.config.world_x * 0.5 * self.canvas_size)
        hit_radius = int(self.env.config.hit_radius / self.env.config.world_x * 0.5 * self.canvas_size)

        self.canvas.create_oval(tx - track_radius, ty - track_radius, tx + track_radius, ty + track_radius, outline="#ff9800", width=2)
        self.canvas.create_oval(tx - hit_radius, ty - hit_radius, tx + hit_radius, ty + hit_radius, outline="#8e44ad", width=2)
        self.canvas.create_oval(tx - 8, ty - 8, tx + 8, ty + 8, fill="#d62728", outline="")
        self.canvas.create_oval(lx - 6, ly - 6, lx + 6, ly + 6, outline="#2ca02c", width=2)
        self.canvas.create_line(cx - 10, cy, cx + 10, cy, fill="#1f77b4", width=2)
        self.canvas.create_line(cx, cy - 10, cx, cy + 10, fill="#1f77b4", width=2)

    def _update_status(self) -> None:
        mode = "RUNNING" if self.running else "PAUSED"
        save_line = str(self.last_saved_path) if self.last_saved_path else "not saved yet"
        self.status_var.set(
            "\n".join(
                [
                    "Controls: Space start/pause | R reset episode | N next episode | S save | Esc save+quit",
                    f"mode={mode}  episode={self.recorder.episode_index}  frames={len(self.recorder.rows)}",
                    f"distance={self.last_info.get('distance', 0.0):.4f}  forward_offset={self.last_info.get('forward_offset', 0.0):.4f}  reward={self.last_reward:.3f}",
                    f"save_path={save_line}",
                ]
            )
        )

    def run(self) -> None:
        self.root.mainloop()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--headless-demo", action="store_true")
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--output", type=Path, default=default_output_path())
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.headless_demo:
        output_path, summary_path = run_headless_demo(episodes=args.episodes, output_path=args.output)
        print(f"jsonl: {output_path}")
        print(f"summary: {summary_path}")
        return

    app = HumanTrackingApp(output_path=args.output)
    print(f"recording to: {args.output}")
    app.run()


if __name__ == "__main__":
    main()
