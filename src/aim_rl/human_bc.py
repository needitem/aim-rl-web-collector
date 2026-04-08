from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

import torch

from aim_rl.rl import OBSERVATION_KEYS


@dataclass
class EpisodeTrace:
    episode: int
    rows: list[dict[str, float | int | str]]


def find_latest_human_session(directory: Path) -> Path:
    candidates: list[Path] = []
    for path in directory.glob("*.jsonl"):
        try:
            first_line = path.read_text(encoding="utf-8").splitlines()[0]
        except IndexError:
            continue
        payload = json.loads(first_line)
        if payload.get("source") == "human-mouse":
            candidates.append(path)
    if not candidates:
        raise FileNotFoundError(f"No human-mouse JSONL sessions found in {directory}")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def load_trace_rows(path: Path) -> list[dict[str, float | int | str]]:
    rows: list[dict[str, float | int | str]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    if not rows:
        raise ValueError(f"Trace file is empty: {path}")
    return rows


def group_rows_by_episode(rows: list[dict[str, float | int | str]]) -> list[EpisodeTrace]:
    grouped: dict[int, list[dict[str, float | int | str]]] = {}
    for row in rows:
        episode = int(row["episode"])
        grouped.setdefault(episode, []).append(row)
    return [EpisodeTrace(episode=episode, rows=grouped[episode]) for episode in sorted(grouped)]


def row_to_observation(
    row: dict[str, float | int | str],
    prev_action_x: float,
    prev_action_y: float,
    time_left: float,
) -> dict[str, float]:
    cursor_x = float(row["cursor_x"])
    cursor_y = float(row["cursor_y"])
    target_x = float(row["target_x"])
    target_y = float(row["target_y"])
    lead_x = float(row["lead_x"])
    lead_y = float(row["lead_y"])
    return {
        "rel_x": target_x - cursor_x,
        "rel_y": target_y - cursor_y,
        "lead_rel_x": lead_x - cursor_x,
        "lead_rel_y": lead_y - cursor_y,
        "target_vx": float(row["target_vx"]),
        "target_vy": float(row["target_vy"]),
        "cursor_vx": float(row["cursor_vx"]),
        "cursor_vy": float(row["cursor_vy"]),
        "prev_action_x": prev_action_x,
        "prev_action_y": prev_action_y,
        "time_left": time_left,
    }


def traces_to_tensors(episodes: list[EpisodeTrace]) -> tuple[torch.Tensor, torch.Tensor]:
    observations: list[list[float]] = []
    actions: list[list[float]] = []

    for episode_trace in episodes:
        episode_length = max(1, len(episode_trace.rows))
        prev_action_x = 0.0
        prev_action_y = 0.0
        for index, row in enumerate(episode_trace.rows):
            time_left = 1.0 - (index / episode_length)
            observation = row_to_observation(row, prev_action_x, prev_action_y, time_left)
            observations.append([observation[key] for key in OBSERVATION_KEYS])

            action_x = float(row["action_x"])
            action_y = float(row["action_y"])
            actions.append([action_x, action_y])

            prev_action_x = action_x
            prev_action_y = action_y

    return torch.tensor(observations, dtype=torch.float32), torch.tensor(actions, dtype=torch.float32)


def traces_to_next_cursor_offset_tensors(episodes: list[EpisodeTrace]) -> tuple[torch.Tensor, torch.Tensor]:
    observations: list[list[float]] = []
    labels: list[list[float]] = []

    for episode_trace in episodes:
        if len(episode_trace.rows) < 2:
            continue
        episode_length = max(1, len(episode_trace.rows))
        prev_action_x = 0.0
        prev_action_y = 0.0

        for index in range(len(episode_trace.rows) - 1):
            current = episode_trace.rows[index]
            nxt = episode_trace.rows[index + 1]
            time_left = 1.0 - (index / episode_length)
            observation = row_to_observation(current, prev_action_x, prev_action_y, time_left)
            observations.append([observation[key] for key in OBSERVATION_KEYS])

            next_cursor_offset_x = float(nxt["cursor_x"]) - float(current["target_x"])
            next_cursor_offset_y = float(nxt["cursor_y"]) - float(current["target_y"])
            labels.append([next_cursor_offset_x, next_cursor_offset_y])

            prev_action_x = float(current["action_x"])
            prev_action_y = float(current["action_y"])

    if not observations:
        raise ValueError("Not enough sequential frames to build next-cursor-offset tensors.")
    return torch.tensor(observations, dtype=torch.float32), torch.tensor(labels, dtype=torch.float32)


def split_episodes(
    episodes: list[EpisodeTrace],
    validation_ratio: float = 0.2,
) -> tuple[list[EpisodeTrace], list[EpisodeTrace]]:
    if len(episodes) < 2:
        return episodes, episodes
    validation_count = max(1, int(round(len(episodes) * validation_ratio)))
    validation = episodes[-validation_count:]
    training = episodes[:-validation_count]
    if not training:
        training = validation
    return training, validation
