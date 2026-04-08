from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any


@dataclass
class TraceFrame:
    episode: int
    step: int
    t: float
    cursor_x: float
    cursor_y: float
    cursor_vx: float
    cursor_vy: float
    target_x: float
    target_y: float
    target_vx: float
    target_vy: float
    lead_x: float
    lead_y: float
    action_x: float
    action_y: float
    distance: float
    lead_distance: float
    forward_offset: float
    desired_forward_offset: float
    reward: float
    source: str

    def to_json(self) -> str:
        return json.dumps(asdict(self))


def canvas_to_world(
    pixel_x: float,
    pixel_y: float,
    width: int,
    height: int,
    world_x: float,
    world_y: float,
) -> tuple[float, float]:
    normalized_x = (pixel_x / max(1, width)) * 2.0 - 1.0
    normalized_y = 1.0 - (pixel_y / max(1, height)) * 2.0
    return normalized_x * world_x, normalized_y * world_y


def world_to_canvas(
    world_pos_x: float,
    world_pos_y: float,
    width: int,
    height: int,
    world_x: float,
    world_y: float,
) -> tuple[int, int]:
    px = int(((world_pos_x / world_x) + 1.0) * 0.5 * width)
    py = int((1.0 - ((world_pos_y / world_y) + 1.0) * 0.5) * height)
    return px, py


class SessionRecorder:
    def __init__(self, source: str) -> None:
        self.source = source
        self._episode_index = 0
        self._rows: list[TraceFrame] = []

    @property
    def episode_index(self) -> int:
        return self._episode_index

    @property
    def rows(self) -> list[TraceFrame]:
        return list(self._rows)

    def next_episode(self) -> int:
        self._episode_index += 1
        return self._episode_index

    def record(self, payload: dict[str, Any]) -> None:
        frame = TraceFrame(source=self.source, **payload)
        self._rows.append(frame)

    def write_jsonl(self, output_path: Path) -> Path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            for row in self._rows:
                handle.write(row.to_json() + "\n")
        return output_path
