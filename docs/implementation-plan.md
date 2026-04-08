# Implementation Plan

## Objective

Build a policy that receives structured target coordinates and emits smooth
mouse movement deltas that look human while still converging on the target.

This project intentionally separates:

- perception: another model extracts target coordinates
- control: this sandbox learns how to move the cursor

## Test Environment

### Scope

Start with a synthetic 2D environment instead of a live game.

- cursor position is normalized to `[-1, 1]`
- target moves with bounded velocity and light acceleration noise
- episodes end after a fixed horizon or sustained lock-on
- the environment produces structured observations, not pixels

### Observation vector

- relative target position: `rel_x`, `rel_y`
- target velocity: `target_vx`, `target_vy`
- cursor velocity: `cursor_vx`, `cursor_vy`
- previous control output: `prev_action_x`, `prev_action_y`
- normalized time left in the episode

### Action space

Continuous 2D action:

- `action_x` in `[-1, 1]`
- `action_y` in `[-1, 1]`

These are scaled into simulated mouse acceleration. This is better than issuing
absolute coordinates because it forces the policy to learn motion dynamics.

### Reward design

Current reward is shaped for stable acquisition:

- positive reward for reducing distance to the target
- bonus for entering a wider tracking zone
- larger bonus for staying inside a tight hit zone
- penalty for time
- penalty for abrupt changes in control output

This reward is intentionally imperfect. It is only good enough for a first
training loop and baseline comparison.

## Implementation Stages

### Stage 1: Baseline and instrumentation

Deliverables:

- deterministic simulator
- heuristic humanized controller
- episode metrics: reward, minimum distance, hit-zone dwell time

Purpose:

- prove the environment is learnable
- establish a floor before RL

### Stage 2: Human trace collection

Add a local trace format for real mouse trajectories collected in the same
normalized coordinate system.

Suggested schema per frame:

```json
{
  "t": 0.0167,
  "rel_x": -0.23,
  "rel_y": 0.14,
  "target_vx": 0.08,
  "target_vy": -0.02,
  "cursor_vx": 0.01,
  "cursor_vy": -0.03,
  "action_x": -0.12,
  "action_y": 0.07
}
```

Use this for behavior cloning before RL.

### Stage 3: Behavior cloning

Train a supervised policy to imitate human trajectories.

Model shape:

- input: observation vector
- hidden layers: small MLP
- output: mean action delta

Success criteria:

- low validation error on human traces
- trajectory metrics close to held-out human clips

### Stage 4: RL fine-tuning

Fine-tune the cloned policy in the simulator.

Recommended starting algorithms:

- PPO for simple continuous control
- SAC if sample efficiency becomes a problem

Optimization targets:

- improve convergence speed
- retain smoothness
- avoid robotic perfect snaps

Add explicit regularizers for:

- jerk
- overshoot count
- reaction-time realism

### Stage 5: Domain randomization

Before any real integration, increase simulator diversity:

- target speed ranges
- acceleration noise
- target size
- simulated sensor latency
- dropped observations
- coordinate jitter

This is the main defense against overfitting to the toy environment.

### Stage 6: Safety wrapper for real output

Keep the live-output adapter separate from the learning loop.

- policy emits normalized deltas
- adapter scales by sensitivity and DPI
- adapter enforces hard caps on speed and acceleration
- adapter can be disabled independently

## Evaluation Plan

Evaluate more than hit quality. The main goal is plausible motion.

Primary metrics:

- time-to-target
- minimum distance achieved
- hit-zone dwell frames
- overshoot count
- peak velocity
- mean jerk
- path efficiency

Human-likeness metrics:

- distribution distance between policy and human peak velocity
- distribution distance between policy and human correction count
- reaction-delay histogram similarity

## Risks

- reward hacking: the policy may oscillate in the hit zone to farm reward
- simulator bias: the learned style may look natural only in the toy world
- over-smoothing: a policy can look human but fail to acquire targets quickly
- under-observed state: if recoil or latency exists later, the current state is insufficient

## Immediate next build steps

1. Add per-step trace logging to the simulator.
2. Add a simple MLP policy training script with PPO.
3. Add offline behavior-cloning training from JSONL traces.
4. Add replay visualization so trajectories can be inspected before real integration.
