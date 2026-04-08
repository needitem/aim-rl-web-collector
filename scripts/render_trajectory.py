from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "artifacts"
TRAJECTORY_PATH = ARTIFACTS_DIR / "last_trajectory.jsonl"
PLOT_PATH = ARTIFACTS_DIR / "trajectory_overview.png"
GIF_PATH = ARTIFACTS_DIR / "trajectory_animation.gif"

WORLD_MIN = -1.0
WORLD_MAX = 1.0
CANVAS = 640
PADDING = 40


def load_rows(path: Path) -> list[dict[str, float]]:
    rows: list[dict[str, float]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            rows.append(json.loads(line))
    if not rows:
        raise ValueError(f"No rows found in {path}")
    return rows


def to_pixel(x: float, y: float) -> tuple[int, int]:
    usable = CANVAS - (2 * PADDING)
    px = int(PADDING + ((x - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * usable)
    py = int(PADDING + ((WORLD_MAX - y) / (WORLD_MAX - WORLD_MIN)) * usable)
    return px, py


def render_overview(rows: list[dict[str, float]], output_path: Path, title: str = "Aim RL trajectory") -> None:
    steps = [row["step"] for row in rows]
    cursor_x = [row["cursor_x"] for row in rows]
    cursor_y = [row["cursor_y"] for row in rows]
    target_x = [row["target_x"] for row in rows]
    target_y = [row["target_y"] for row in rows]
    distances = [row["distance"] for row in rows]
    has_lead = "lead_x" in rows[0] and "lead_y" in rows[0]
    lead_x = [row["lead_x"] for row in rows] if has_lead else []
    lead_y = [row["lead_y"] for row in rows] if has_lead else []

    fig, axes = plt.subplots(1, 2, figsize=(12, 5), dpi=140)

    axes[0].plot(target_x, target_y, color="#d62728", linewidth=2, label="target path")
    axes[0].plot(cursor_x, cursor_y, color="#1f77b4", linewidth=2, label="cursor path")
    if has_lead:
        axes[0].plot(lead_x, lead_y, color="#2ca02c", linewidth=1.5, linestyle="--", label="lead path")
    axes[0].scatter([cursor_x[0]], [cursor_y[0]], color="#1f77b4", s=30)
    axes[0].scatter([target_x[0]], [target_y[0]], color="#d62728", s=30)
    axes[0].set_title(f"{title}: paths")
    axes[0].set_xlim(WORLD_MIN, WORLD_MAX)
    axes[0].set_ylim(WORLD_MIN, WORLD_MAX)
    axes[0].set_aspect("equal")
    axes[0].grid(True, alpha=0.25)
    axes[0].legend()

    axes[1].plot(steps, distances, color="#2ca02c", linewidth=2)
    axes[1].axhline(0.07, color="#ff7f0e", linestyle="--", linewidth=1.5, label="track zone")
    axes[1].axhline(0.03, color="#9467bd", linestyle="--", linewidth=1.5, label="hit zone")
    axes[1].set_title(f"{title}: distance")
    axes[1].set_xlabel("Step")
    axes[1].set_ylabel("Distance")
    axes[1].grid(True, alpha=0.25)
    axes[1].legend()

    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path)
    plt.close(fig)


def render_animation(rows: list[dict[str, float]], output_path: Path, title: str = "Aim RL trajectory") -> None:
    frames: list[Image.Image] = []
    step_stride = max(1, len(rows) // 120)
    has_lead = "lead_x" in rows[0] and "lead_y" in rows[0]

    for index in range(0, len(rows), step_stride):
        row = rows[index]
        frame = Image.new("RGB", (CANVAS, CANVAS), "white")
        draw = ImageDraw.Draw(frame)

        draw.rectangle((PADDING, PADDING, CANVAS - PADDING, CANVAS - PADDING), outline="#333333", width=2)

        for prev in rows[: index + 1]:
            px, py = to_pixel(prev["target_x"], prev["target_y"])
            draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill="#d62728")
        for prev in rows[: index + 1]:
            px, py = to_pixel(prev["cursor_x"], prev["cursor_y"])
            draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill="#1f77b4")
        if has_lead:
            for prev in rows[: index + 1]:
                px, py = to_pixel(prev["lead_x"], prev["lead_y"])
                draw.ellipse((px - 1, py - 1, px + 1, py + 1), fill="#2ca02c")

        tx, ty = to_pixel(row["target_x"], row["target_y"])
        cx, cy = to_pixel(row["cursor_x"], row["cursor_y"])
        draw.ellipse((tx - 8, ty - 8, tx + 8, ty + 8), outline="#d62728", width=3)
        draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), outline="#1f77b4", width=3)
        if has_lead:
            lx, ly = to_pixel(row["lead_x"], row["lead_y"])
            draw.ellipse((lx - 6, ly - 6, lx + 6, ly + 6), outline="#2ca02c", width=2)

        info = (
            f"step={row['step']}  "
            f"distance={row['distance']:.3f}  "
            f"action=({row['action_x']:.2f}, {row['action_y']:.2f})"
        )
        draw.text((PADDING, 10), title, fill="#111111")
        draw.text((PADDING, CANVAS - 24), info, fill="#111111")

        frames.append(frame)

    if not frames:
        raise ValueError("No frames were generated.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=50,
        loop=0,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=TRAJECTORY_PATH)
    parser.add_argument("--plot", type=Path, default=PLOT_PATH)
    parser.add_argument("--gif", type=Path, default=GIF_PATH)
    parser.add_argument("--title", type=str, default="Aim RL trajectory")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = load_rows(args.input)
    render_overview(rows, args.plot, title=args.title)
    render_animation(rows, args.gif, title=args.title)
    print(f"plot: {args.plot}")
    print(f"gif: {args.gif}")


if __name__ == "__main__":
    main()
