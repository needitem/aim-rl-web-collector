from __future__ import annotations

from dataclasses import dataclass
import math
import random


@dataclass
class EnvironmentConfig:
    dt: float = 1.0 / 60.0
    episode_steps: int = 360
    world_x: float = 1.0
    world_y: float = 1.0
    max_action: float = 0.09
    max_cursor_speed: float = 1.4
    target_radius: float = 0.07
    hit_radius: float = 0.03
    target_max_speed: float = 0.42
    target_accel_noise: float = 0.11
    action_smooth_penalty: float = 0.12
    time_penalty: float = 0.01
    reward_lead_time: float = 0.18
    reward_lead_weight: float = 0.45
    reward_forward_weight: float = 0.3
    reward_forward_scale: float = 0.8


@dataclass
class EnvironmentState:
    step_count: int
    cursor_x: float
    cursor_y: float
    cursor_vx: float
    cursor_vy: float
    target_x: float
    target_y: float
    target_vx: float
    target_vy: float
    previous_action_x: float
    previous_action_y: float
    consecutive_hits: int


class AimTrackingEnv:
    """
    Small continuous-control environment for target acquisition.

    Observation:
    - relative target position
    - target velocity
    - cursor velocity
    - previous action
    - normalized time left

    Action:
    - 2D delta in normalized screen space, clipped to [-1, 1] then scaled
    """

    def __init__(self, config: EnvironmentConfig | None = None, seed: int | None = None):
        self.config = config or EnvironmentConfig()
        self._random = random.Random(seed)
        self.state: EnvironmentState | None = None

    def reset(self) -> dict[str, float]:
        cfg = self.config
        target_x = self._random.uniform(-0.6, 0.6)
        target_y = self._random.uniform(-0.4, 0.4)
        angle = self._random.uniform(0.0, math.tau)
        speed = self._random.uniform(0.15, cfg.target_max_speed)
        self.state = EnvironmentState(
            step_count=0,
            cursor_x=0.0,
            cursor_y=0.0,
            cursor_vx=0.0,
            cursor_vy=0.0,
            target_x=target_x,
            target_y=target_y,
            target_vx=math.cos(angle) * speed,
            target_vy=math.sin(angle) * speed,
            previous_action_x=0.0,
            previous_action_y=0.0,
            consecutive_hits=0,
        )
        return self._observation()

    def step(self, action: tuple[float, float]) -> tuple[dict[str, float], float, bool, dict[str, float]]:
        if self.state is None:
            raise RuntimeError("Call reset() before step().")

        cfg = self.config
        state = self.state

        ax = self._clip(action[0]) * cfg.max_action
        ay = self._clip(action[1]) * cfg.max_action

        state.cursor_vx = self._clip_speed(state.cursor_vx + ax, cfg.max_cursor_speed)
        state.cursor_vy = self._clip_speed(state.cursor_vy + ay, cfg.max_cursor_speed)
        state.cursor_x = self._clip_position(state.cursor_x + state.cursor_vx * cfg.dt, cfg.world_x)
        state.cursor_y = self._clip_position(state.cursor_y + state.cursor_vy * cfg.dt, cfg.world_y)
        return self._finish_step(ax, ay)

    def step_cursor_control(self, cursor_x: float, cursor_y: float) -> tuple[dict[str, float], float, bool, dict[str, float]]:
        if self.state is None:
            raise RuntimeError("Call reset() before step().")

        cfg = self.config
        state = self.state

        previous_vx = state.cursor_vx
        previous_vy = state.cursor_vy
        previous_x = state.cursor_x
        previous_y = state.cursor_y

        next_x = self._clip_position(cursor_x, cfg.world_x)
        next_y = self._clip_position(cursor_y, cfg.world_y)
        next_vx = self._clip_speed((next_x - previous_x) / cfg.dt, cfg.max_cursor_speed)
        next_vy = self._clip_speed((next_y - previous_y) / cfg.dt, cfg.max_cursor_speed)

        state.cursor_x = next_x
        state.cursor_y = next_y
        state.cursor_vx = next_vx
        state.cursor_vy = next_vy

        implied_ax = self._clip_speed(next_vx - previous_vx, cfg.max_action)
        implied_ay = self._clip_speed(next_vy - previous_vy, cfg.max_action)
        return self._finish_step(implied_ax, implied_ay)

    def _finish_step(self, applied_ax: float, applied_ay: float) -> tuple[dict[str, float], float, bool, dict[str, float]]:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")

        cfg = self.config
        state = self.state

        noise_x = self._random.uniform(-cfg.target_accel_noise, cfg.target_accel_noise)
        noise_y = self._random.uniform(-cfg.target_accel_noise, cfg.target_accel_noise)
        state.target_vx = self._clip_speed(state.target_vx + noise_x * cfg.dt, cfg.target_max_speed)
        state.target_vy = self._clip_speed(state.target_vy + noise_y * cfg.dt, cfg.target_max_speed)
        state.target_x, state.target_vx = self._bounce_axis(state.target_x, state.target_vx, cfg.world_x)
        state.target_y, state.target_vy = self._bounce_axis(state.target_y, state.target_vy, cfg.world_y)

        distance = self._distance()
        lead_distance = self._lead_distance()
        forward_offset = self._forward_offset()
        desired_forward_offset = self._desired_forward_offset()
        in_track_zone = distance <= cfg.target_radius
        hit_zone = distance <= cfg.hit_radius
        if hit_zone:
            state.consecutive_hits += 1
        else:
            state.consecutive_hits = 0

        smooth_delta = math.hypot(applied_ax - state.previous_action_x, applied_ay - state.previous_action_y)
        reward = 0.0
        reward += max(0.0, 1.0 - distance / cfg.world_x)
        reward += cfg.reward_lead_weight * max(0.0, 1.0 - lead_distance / cfg.world_x)
        reward += cfg.reward_forward_weight * max(
            0.0,
            1.0 - (abs(forward_offset - desired_forward_offset) / cfg.world_x),
        )
        reward -= cfg.time_penalty
        reward -= smooth_delta * cfg.action_smooth_penalty
        if in_track_zone:
            reward += 0.5
        if hit_zone:
            reward += 1.5
        if state.consecutive_hits >= 8:
            reward += 2.0

        state.previous_action_x = applied_ax
        state.previous_action_y = applied_ay
        state.step_count += 1

        done = state.step_count >= cfg.episode_steps or state.consecutive_hits >= 8
        info = {
            "distance": distance,
            "lead_distance": lead_distance,
            "forward_offset": forward_offset,
            "desired_forward_offset": desired_forward_offset,
            "in_track_zone": 1.0 if in_track_zone else 0.0,
            "hit_zone": 1.0 if hit_zone else 0.0,
            "consecutive_hits": float(state.consecutive_hits),
            "action_x": applied_ax / cfg.max_action if cfg.max_action else 0.0,
            "action_y": applied_ay / cfg.max_action if cfg.max_action else 0.0,
        }
        return self._observation(), reward, done, info

    def _observation(self) -> dict[str, float]:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")
        state = self.state
        cfg = self.config
        lead_x, lead_y = self._projected_target()
        return {
            "rel_x": state.target_x - state.cursor_x,
            "rel_y": state.target_y - state.cursor_y,
            "lead_rel_x": lead_x - state.cursor_x,
            "lead_rel_y": lead_y - state.cursor_y,
            "target_vx": state.target_vx,
            "target_vy": state.target_vy,
            "cursor_vx": state.cursor_vx,
            "cursor_vy": state.cursor_vy,
            "prev_action_x": state.previous_action_x / cfg.max_action if cfg.max_action else 0.0,
            "prev_action_y": state.previous_action_y / cfg.max_action if cfg.max_action else 0.0,
            "time_left": 1.0 - (state.step_count / cfg.episode_steps),
        }

    def _distance(self) -> float:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")
        state = self.state
        return math.hypot(state.target_x - state.cursor_x, state.target_y - state.cursor_y)

    def _lead_distance(self) -> float:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")
        state = self.state
        lead_x, lead_y = self._projected_target()
        return math.hypot(lead_x - state.cursor_x, lead_y - state.cursor_y)

    def _forward_offset(self) -> float:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")
        state = self.state
        speed = math.hypot(state.target_vx, state.target_vy)
        if speed < 1e-8:
            return 0.0
        direction_x = state.target_vx / speed
        direction_y = state.target_vy / speed
        cursor_offset_x = state.cursor_x - state.target_x
        cursor_offset_y = state.cursor_y - state.target_y
        return (cursor_offset_x * direction_x) + (cursor_offset_y * direction_y)

    def _projected_target(self) -> tuple[float, float]:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")
        state = self.state
        cfg = self.config
        lead_x = self._clip_position(state.target_x + (state.target_vx * cfg.reward_lead_time), cfg.world_x)
        lead_y = self._clip_position(state.target_y + (state.target_vy * cfg.reward_lead_time), cfg.world_y)
        return lead_x, lead_y

    def _desired_forward_offset(self) -> float:
        if self.state is None:
            raise RuntimeError("Environment is not initialized.")
        state = self.state
        cfg = self.config
        target_speed = math.hypot(state.target_vx, state.target_vy)
        return target_speed * cfg.reward_lead_time * cfg.reward_forward_scale

    @staticmethod
    def _clip(value: float) -> float:
        return max(-1.0, min(1.0, value))

    @staticmethod
    def _clip_position(value: float, bound: float) -> float:
        return max(-bound, min(bound, value))

    @staticmethod
    def _clip_speed(value: float, limit: float) -> float:
        return max(-limit, min(limit, value))

    def _bounce_axis(self, position: float, velocity: float, bound: float) -> tuple[float, float]:
        next_position = position + velocity * self.config.dt
        if next_position > bound:
            return bound, -abs(velocity)
        elif next_position < -bound:
            return -bound, abs(velocity)
        return next_position, velocity
