from __future__ import annotations

import sys
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from aim_rl.controllers import HumanizedAimController, LeadHumanizedAimController
from aim_rl.env import AimTrackingEnv, EnvironmentConfig


class AimTrackingEnvTest(unittest.TestCase):
    def test_reset_returns_expected_fields(self) -> None:
        env = AimTrackingEnv(seed=1)
        observation = env.reset()
        self.assertEqual(
            set(observation.keys()),
            {
                "rel_x",
                "rel_y",
                "lead_rel_x",
                "lead_rel_y",
                "target_vx",
                "target_vy",
                "cursor_vx",
                "cursor_vy",
                "prev_action_x",
                "prev_action_y",
                "time_left",
            },
        )

    def test_step_advances_and_terminates(self) -> None:
        env = AimTrackingEnv(EnvironmentConfig(episode_steps=5), seed=1)
        env.reset()
        done = False
        steps = 0
        while not done:
            _, _, done, _ = env.step((0.0, 0.0))
            steps += 1
        self.assertEqual(steps, 5)

    def test_controller_outputs_bounded_actions(self) -> None:
        env = AimTrackingEnv(seed=5)
        observation = env.reset()
        controller = HumanizedAimController(seed=5)
        for _ in range(15):
            action = controller.act(observation)
            self.assertGreaterEqual(action[0], -1.0)
            self.assertLessEqual(action[0], 1.0)
            self.assertGreaterEqual(action[1], -1.0)
            self.assertLessEqual(action[1], 1.0)
            observation, _, done, _ = env.step(action)
            if done:
                observation = env.reset()
                controller.reset()

    def test_baseline_can_enter_tracking_zone(self) -> None:
        env = AimTrackingEnv(seed=9)
        controller = HumanizedAimController(seed=9)
        observation = env.reset()
        entered_tracking_zone = False
        for _ in range(120):
            action = controller.act(observation)
            observation, _, done, info = env.step(action)
            if info["in_track_zone"]:
                entered_tracking_zone = True
                break
            if done:
                break
        self.assertTrue(entered_tracking_zone)

    def test_step_reports_lead_metrics(self) -> None:
        env = AimTrackingEnv(seed=3)
        env.reset()
        _, _, _, info = env.step((0.0, 0.0))
        self.assertIn("lead_distance", info)
        self.assertIn("forward_offset", info)
        self.assertIn("action_x", info)
        self.assertIn("action_y", info)

    def test_cursor_control_step_tracks_external_cursor(self) -> None:
        env = AimTrackingEnv(seed=13)
        env.reset()
        observation, _, _, info = env.step_cursor_control(0.2, -0.1)
        self.assertAlmostEqual(observation["rel_x"], env.state.target_x - env.state.cursor_x)
        self.assertAlmostEqual(env.state.cursor_x, 0.2, delta=1e-6)
        self.assertAlmostEqual(env.state.cursor_y, -0.1, delta=1e-6)
        self.assertGreaterEqual(info["action_x"], -1.0)
        self.assertLessEqual(info["action_x"], 1.0)

    def test_lead_controller_has_better_forward_offset_than_plain_baseline(self) -> None:
        plain_scores: list[float] = []
        lead_scores: list[float] = []

        for seed in range(4):
            plain_env = AimTrackingEnv(
                EnvironmentConfig(
                    episode_steps=120,
                    target_max_speed=0.55,
                    target_accel_noise=0.14,
                    reward_lead_time=0.22,
                ),
                seed=seed,
            )
            lead_env = AimTrackingEnv(
                EnvironmentConfig(
                    episode_steps=120,
                    target_max_speed=0.55,
                    target_accel_noise=0.14,
                    reward_lead_time=0.22,
                ),
                seed=seed,
            )

            plain_controller = HumanizedAimController(seed=seed)
            lead_controller = LeadHumanizedAimController(seed=seed)

            plain_observation = plain_env.reset()
            lead_observation = lead_env.reset()

            plain_offset_sum = 0.0
            lead_offset_sum = 0.0

            for _ in range(80):
                plain_action = plain_controller.act(plain_observation)
                plain_observation, _, plain_done, plain_info = plain_env.step(plain_action)
                plain_offset_sum += plain_info["forward_offset"]

                lead_action = lead_controller.act(lead_observation)
                lead_observation, _, lead_done, lead_info = lead_env.step(lead_action)
                lead_offset_sum += lead_info["forward_offset"]

                if plain_done or lead_done:
                    break

            plain_scores.append(plain_offset_sum)
            lead_scores.append(lead_offset_sum)

        self.assertGreater(sum(lead_scores), sum(plain_scores))


if __name__ == "__main__":
    unittest.main()
