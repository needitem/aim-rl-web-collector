from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import torch
from torch import nn


OBSERVATION_KEYS = (
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
)


def observation_to_tensor(observation: dict[str, float]) -> torch.Tensor:
    return torch.tensor([observation[key] for key in OBSERVATION_KEYS], dtype=torch.float32)


class Controller(Protocol):
    def reset(self) -> None:
        ...

    def act(self, observation: dict[str, float]) -> tuple[float, float]:
        ...


class ActorCritic(nn.Module):
    def __init__(self, obs_dim: int, hidden_size: int = 64) -> None:
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(obs_dim, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
        )
        self.policy_head = nn.Linear(hidden_size, 2)
        self.value_head = nn.Linear(hidden_size, 1)
        self.log_std = nn.Parameter(torch.full((2,), -0.35))

    def forward(self, observations: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        features = self.backbone(observations)
        mean = torch.tanh(self.policy_head(features))
        value = self.value_head(features).squeeze(-1)
        std = torch.exp(self.log_std).expand_as(mean)
        return mean, std, value


@dataclass
class EpisodeMetrics:
    reward: float
    min_distance: float
    mean_lead_distance: float
    mean_forward_offset: float
    hit_frames: float
    steps: int


class TorchPolicyController:
    def __init__(self, model: ActorCritic, device: torch.device) -> None:
        self.model = model
        self.device = device

    def reset(self) -> None:
        return None

    def act(self, observation: dict[str, float]) -> tuple[float, float]:
        with torch.no_grad():
            obs_tensor = observation_to_tensor(observation).to(self.device).unsqueeze(0)
            mean, _, _ = self.model(obs_tensor)
        action = mean.squeeze(0).cpu().tolist()
        return float(action[0]), float(action[1])
