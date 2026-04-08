from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
SCRIPTS = ROOT / "scripts"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from aim_rl.data import SessionRecorder, canvas_to_world, world_to_canvas
from human_data_collection import run_headless_demo


class DataHelpersTest(unittest.TestCase):
    def test_canvas_world_roundtrip_is_stable(self) -> None:
        world_x, world_y = canvas_to_world(225, 675, 900, 900, 1.0, 1.0)
        pixel_x, pixel_y = world_to_canvas(world_x, world_y, 900, 900, 1.0, 1.0)
        self.assertAlmostEqual(pixel_x, 225, delta=1)
        self.assertAlmostEqual(pixel_y, 675, delta=1)

    def test_session_recorder_writes_jsonl(self) -> None:
        recorder = SessionRecorder(source="unit-test")
        recorder.next_episode()
        recorder.record(
            {
                "episode": 1,
                "step": 1,
                "t": 0.0167,
                "cursor_x": 0.0,
                "cursor_y": 0.0,
                "cursor_vx": 0.0,
                "cursor_vy": 0.0,
                "target_x": 0.1,
                "target_y": -0.2,
                "target_vx": 0.01,
                "target_vy": -0.02,
                "lead_x": 0.12,
                "lead_y": -0.21,
                "action_x": 0.2,
                "action_y": -0.1,
                "distance": 0.3,
                "lead_distance": 0.25,
                "forward_offset": 0.05,
                "desired_forward_offset": 0.04,
                "reward": 1.2,
            }
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            path = recorder.write_jsonl(Path(temp_dir) / "sample.jsonl")
            lines = path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(lines), 1)
            payload = json.loads(lines[0])
            self.assertEqual(payload["source"], "unit-test")
            self.assertEqual(payload["episode"], 1)

    def test_headless_demo_produces_frames(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path, summary_path = run_headless_demo(
                episodes=2,
                output_path=Path(temp_dir) / "headless.jsonl",
            )
            self.assertTrue(output_path.exists())
            self.assertTrue(summary_path.exists())
            lines = output_path.read_text(encoding="utf-8").splitlines()
            self.assertGreater(len(lines), 10)
            payload = json.loads(lines[0])
            self.assertEqual(payload["source"], "headless-demo")


if __name__ == "__main__":
    unittest.main()
