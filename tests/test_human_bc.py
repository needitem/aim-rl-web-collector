from __future__ import annotations

import sys
import tempfile
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from aim_rl.human_bc import (
    find_latest_human_session,
    group_rows_by_episode,
    row_to_observation,
    split_episodes,
    traces_to_next_cursor_offset_tensors,
    traces_to_tensors,
)


class HumanBCHelpersTest(unittest.TestCase):
    def test_find_latest_human_session_filters_by_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "demo.jsonl").write_text('{"source":"headless-demo"}\n', encoding="utf-8")
            human = root / "human.jsonl"
            human.write_text('{"source":"human-mouse"}\n', encoding="utf-8")
            self.assertEqual(find_latest_human_session(root), human)

    def test_row_to_observation_builds_expected_fields(self) -> None:
        row = {
            "cursor_x": 0.1,
            "cursor_y": -0.2,
            "target_x": 0.3,
            "target_y": -0.1,
            "lead_x": 0.35,
            "lead_y": -0.05,
            "target_vx": 0.01,
            "target_vy": -0.02,
            "cursor_vx": 0.03,
            "cursor_vy": 0.04,
        }
        observation = row_to_observation(row, prev_action_x=0.5, prev_action_y=-0.5, time_left=0.75)
        self.assertAlmostEqual(observation["rel_x"], 0.2)
        self.assertAlmostEqual(observation["lead_rel_y"], 0.15)
        self.assertEqual(observation["prev_action_x"], 0.5)
        self.assertEqual(observation["time_left"], 0.75)

    def test_trace_conversion_preserves_frame_count(self) -> None:
        rows = [
            {
                "episode": 1,
                "cursor_x": 0.0,
                "cursor_y": 0.0,
                "target_x": 0.1,
                "target_y": 0.2,
                "lead_x": 0.11,
                "lead_y": 0.21,
                "target_vx": 0.01,
                "target_vy": 0.02,
                "cursor_vx": 0.0,
                "cursor_vy": 0.0,
                "action_x": 0.2,
                "action_y": 0.3,
            },
            {
                "episode": 1,
                "cursor_x": 0.05,
                "cursor_y": 0.03,
                "target_x": 0.1,
                "target_y": 0.2,
                "lead_x": 0.11,
                "lead_y": 0.21,
                "target_vx": 0.01,
                "target_vy": 0.02,
                "cursor_vx": 0.2,
                "cursor_vy": 0.1,
                "action_x": 0.1,
                "action_y": 0.1,
            },
            {
                "episode": 2,
                "cursor_x": -0.1,
                "cursor_y": 0.0,
                "target_x": 0.0,
                "target_y": 0.2,
                "lead_x": 0.01,
                "lead_y": 0.22,
                "target_vx": 0.02,
                "target_vy": 0.01,
                "cursor_vx": 0.0,
                "cursor_vy": 0.0,
                "action_x": -0.2,
                "action_y": 0.4,
            },
        ]
        episodes = group_rows_by_episode(rows)
        train_episodes, validation_episodes = split_episodes(episodes, validation_ratio=0.5)
        self.assertEqual(len(train_episodes), 1)
        self.assertEqual(len(validation_episodes), 1)
        observations, actions = traces_to_tensors(episodes)
        self.assertEqual(observations.shape[0], 3)
        self.assertEqual(actions.shape[0], 3)
        next_observations, next_offsets = traces_to_next_cursor_offset_tensors(episodes)
        self.assertEqual(next_observations.shape[0], 1)
        self.assertEqual(next_offsets.shape[0], 1)


if __name__ == "__main__":
    unittest.main()
