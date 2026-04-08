from __future__ import annotations

from collections import deque
import random


class HumanizedAimController:
    """
    Heuristic baseline that intentionally avoids perfect robotic motion.

    Design:
    - reaction delay via small observation queue
    - spring-like movement toward the target
    - damped correction using current cursor velocity
    - tiny noise for imperfect micro-adjustment
    """

    def __init__(
        self,
        gain: float = 3.2,
        damping: float = 1.1,
        reaction_frames: int = 3,
        noise_scale: float = 0.035,
        lead_blend: float = 0.0,
        velocity_gain: float = 0.0,
        seed: int | None = None,
    ) -> None:
        self.gain = gain
        self.damping = damping
        self.noise_scale = noise_scale
        self.lead_blend = lead_blend
        self.velocity_gain = velocity_gain
        self._random = random.Random(seed)
        self._history: deque[dict[str, float]] = deque(maxlen=max(1, reaction_frames))

    def reset(self) -> None:
        self._history.clear()

    def act(self, observation: dict[str, float]) -> tuple[float, float]:
        self._history.append(dict(observation))
        delayed = self._history[0]

        target_x = ((1.0 - self.lead_blend) * delayed["rel_x"]) + (self.lead_blend * delayed["lead_rel_x"])
        target_y = ((1.0 - self.lead_blend) * delayed["rel_y"]) + (self.lead_blend * delayed["lead_rel_y"])

        desired_x = (
            target_x * self.gain
            + (delayed["target_vx"] * self.velocity_gain)
            - delayed["cursor_vx"] * self.damping
        )
        desired_y = (
            target_y * self.gain
            + (delayed["target_vy"] * self.velocity_gain)
            - delayed["cursor_vy"] * self.damping
        )

        noise_x = self._random.uniform(-self.noise_scale, self.noise_scale)
        noise_y = self._random.uniform(-self.noise_scale, self.noise_scale)

        return (
            self._clip(desired_x + noise_x),
            self._clip(desired_y + noise_y),
        )

    @staticmethod
    def _clip(value: float) -> float:
        return max(-1.0, min(1.0, value))


class LeadHumanizedAimController(HumanizedAimController):
    """Heuristic baseline that explicitly tracks a short projection of target motion."""

    def __init__(
        self,
        gain: float = 4.2,
        damping: float = 0.7,
        reaction_frames: int = 1,
        noise_scale: float = 0.01,
        lead_blend: float = 1.0,
        velocity_gain: float = 0.8,
        seed: int | None = None,
    ) -> None:
        super().__init__(
            gain=gain,
            damping=damping,
            reaction_frames=reaction_frames,
            noise_scale=noise_scale,
            lead_blend=lead_blend,
            velocity_gain=velocity_gain,
            seed=seed,
        )
