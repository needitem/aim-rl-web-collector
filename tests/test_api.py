from __future__ import annotations

import sys
import tempfile
from pathlib import Path
import unittest

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app import main as api_main


class ApiTest(unittest.TestCase):
    def test_create_and_list_session(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            api_main.DATA_DIR = Path(temp_dir)
            api_main.ensure_storage()
            client = TestClient(api_main.app)

            payload = {
                "source": "unit-test",
                "frames": [
                    {
                        "episode": 1,
                        "step": 1,
                        "t": 0.0167,
                        "cursor_x": 0.0,
                        "cursor_y": 0.0,
                        "cursor_vx": 0.0,
                        "cursor_vy": 0.0,
                        "target_x": 0.1,
                        "target_y": -0.1,
                        "target_vx": 0.01,
                        "target_vy": 0.02,
                        "lead_x": 0.11,
                        "lead_y": -0.08,
                        "action_x": 0.2,
                        "action_y": -0.1,
                        "distance": 0.3,
                        "lead_distance": 0.2,
                        "forward_offset": 0.05,
                        "desired_forward_offset": 0.04,
                        "reward": 1.2,
                        "source": "unit-test",
                    }
                ],
                "meta": {"tag": "smoke"},
            }

            create_response = client.post("/api/sessions", json=payload)
            self.assertEqual(create_response.status_code, 200)
            metadata = create_response.json()
            self.assertEqual(metadata["source"], "unit-test")
            self.assertEqual(metadata["frame_count"], 1)

            list_response = client.get("/api/sessions")
            self.assertEqual(list_response.status_code, 200)
            listed = list_response.json()["sessions"]
            self.assertEqual(len(listed), 1)
            self.assertEqual(listed[0]["session_id"], metadata["session_id"])

            session_response = client.get(f"/api/sessions/{metadata['session_id']}")
            self.assertEqual(session_response.status_code, 200)

            trace_response = client.get(f"/api/sessions/{metadata['session_id']}/jsonl")
            self.assertEqual(trace_response.status_code, 200)
            self.assertIn("\"source\":\"unit-test\"", trace_response.json()["content"])


if __name__ == "__main__":
    unittest.main()
