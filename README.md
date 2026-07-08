# Aim RL Sandbox

Offline and web-based sandbox for training, evaluating, and collecting
human-like mouse aiming traces without touching a real game client.

## What is included

- `src/aim_rl/env.py`: 2D aiming simulator with moving targets and shaped reward
- `src/aim_rl/controllers.py`: baseline and lead-aware heuristic controllers
- `src/aim_rl/data.py`: coordinate conversion and JSONL trace recording helpers
- `src/aim_rl/rl.py`: observation encoding and actor-critic model
- `demo.py`: runs a few episodes and prints aggregate metrics
- `scripts/train_lead_ppo.py`: behavior cloning bootstrap + PPO fine-tuning
- `scripts/train_human_bc.py`: trains a policy from recorded `human-mouse` sessions
- `scripts/render_trajectory.py`: renders saved trajectory into PNG/GIF
- `scripts/human_data_collection.py`: interactive mouse simulator and data collector
- `web/`: browser aim game + high-resolution data collector (static, GitHub Pages)
- `tests/test_env.py`: regression tests for core environment behavior
- `tests/test_data.py`: regression tests for recorder and data-collection helpers
- `docs/implementation-plan.md`: staged plan for imitation learning + RL

## Quick start

```bash
python demo.py
python scripts/train_lead_ppo.py
python scripts/train_human_bc.py
python scripts/render_trajectory.py
python scripts/human_data_collection.py
python -m unittest discover -s tests -p "test_*.py"
```

## Web Collector (static — no backend)

A browser canvas game that records human aim traces. There is **no server**: the
player plays, then downloads the whole session as one JSON file and sends it
back. Deployed as a static site on GitHub Pages.

Dev:

```bash
cd web
npm install
npm run dev      # http://127.0.0.1:5173
```

Each session records:

- **60Hz sim frames** — cursor + moving-target kinematics, tracking error, reward
- **discrete target jumps** (`perturbed` flag + `target_jump` events): a clean
  stimulus onset for reaction-time (L2) and evoked-tracking (L6) analysis, which
  the continuous random walk alone can't provide
- **high-resolution mouse trace** at the device's native rate (**240Hz+** on
  gaming mice) via `getCoalescedEvents`, each sample with a real `wall_t`
  (`performance.now()`) timestamp — keeps the L1 micro-structure the 60Hz sim
  would discard
- **event log** — pointerdown/up + keydown/up (cross-modal, L5), wall-clock timed
- **meta** — dpr, viewport, and a measured `mouse_hz_estimate`

Controls: `Space` start/pause, `R` reset, `D` (or the button) download JSON.

### Deploy (GitHub Pages)

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) builds `web/`
and publishes to Pages. In repo settings, set **Pages → Source: GitHub Actions**
once. Static only — no server, no keys, no rate limits. Data collection is
players downloading their JSON and sending it to you. (Adjust `base` in
`web/vite.config.ts` if you use a user page or custom domain.)

## Human data collection

Interactive collector:

```bash
python scripts/human_data_collection.py
```

Controls:

- `Space`: start or pause recording
- `R`: reset current episode
- `N`: start the next episode immediately
- `S`: save session to `artifacts/human_sessions/`
- `Esc`: save and quit

Headless verification:

```bash
python scripts/human_data_collection.py --headless-demo --episodes 2
```

## Why this exists

The immediate goal is not to automate a live game. The goal is to create a
repeatable test harness where policies can learn:

- smooth cursor motion
- bounded acceleration
- target acquisition
- recovery from overshoot

The simulator exposes structured target coordinates, which matches the stated
assumption that visual perception is solved by a separate model.

Training artifacts are written to `artifacts/`:

- `lead_ppo_policy.pt`
- `lead_ppo_summary.json`
- `last_trajectory.jsonl`
- `lead_policy_trajectory.jsonl`
- `lead_policy_overview.png`
- `lead_policy_animation.gif`
- `trajectory_overview.png`
- `trajectory_animation.gif`
- `human_sessions/*.jsonl`

Web sessions are collected as downloaded JSON files (the static collector has no
server-side storage).
