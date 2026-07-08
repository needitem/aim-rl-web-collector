# aim-rl-web-collector

A static browser game that collects **high-resolution human mouse-tracking data**
for behavioral-realism research. Players continuously chase a moving target that
**jumps at random intervals**; the page records the cursor at the device's native
rate (240Hz+ on gaming mice) together with the target, discrete stimulus events,
and input events. No backend — players download their session as one JSON file
and send it back.

**Play:** https://needitem.github.io/aim-rl-web-collector/

This is the data source for the layers *above* single-trajectory realism (see the
companion [mouse-bot-detector](https://github.com/needitem/mouse-bot-detector),
which maps out the trajectory layer). A replayed real stroke is indistinguishable
from a human *as a static path*, but it cannot **react in real time to a moving,
unpredictable target** — that is what this collector is built to measure.

---

## What it collects

Downloading a session gives one JSON object: `{ source, frames, meta }`.

### `frames[]` — 60Hz simulation, one row per tick

Cursor + target kinematics sampled on a fixed 60Hz sim clock. This is the
tracking channel.

| field | meaning |
|---|---|
| `episode`, `step`, `t` | episode index, step within episode, sim time (s) |
| `wall_t` | **real** wall-clock time, `performance.now()` ms |
| `cursor_x/y`, `cursor_vx/vy` | cursor position + velocity (world coords, [-1,1]) |
| `target_x/y`, `target_vx/vy` | moving-target position + velocity |
| `lead_x/y`, `lead_distance` | 0.18s lead point and cursor-to-lead error |
| `distance` | **instantaneous tracking error** (cursor→target) |
| `forward_offset`, `desired_forward_offset` | lead quality |
| `action_x/y`, `reward` | implied per-tick action, shaped reward |
| `client_x/y` | raw viewport pixel cursor (for visual-angle reconstruction) |
| `perturbed` | `1` on the tick the target discretely jumped, else `0` |

### `meta.mouse_trace[]` — native-rate mouse (240Hz+)

Every raw mouse sample the browser batched (`getCoalescedEvents`), each with its
own `event.timeStamp`. This preserves the high-frequency micro-structure
(jerk/tremor) that the 60Hz sim would discard.

| field | meaning |
|---|---|
| `wall_t` | `event.timeStamp` (performance.now clock), ms |
| `x`, `y` | world coords | 
| `client_x`, `client_y` | raw pixels |

### `meta.events[]` — discrete, wall-clock-timed events

| `type` | when | key fields |
|---|---|---|
| `target_jump` | target teleports + re-aims (stimulus onset) | `wall_t`, `x`, `y`, `step` |
| `pointerdown` / `pointerup` | mouse button | `wall_t`, `x/y`, `client_x/y`, `button` |
| `keydown` / `keyup` | keyboard (cross-modal) | `wall_t`, `key` |

### `meta` — session summary

`dpr`, `viewport_w/h`, `pointer_type`, `mouse_sample_count`,
`mouse_hz_estimate` (measured native rate), `perturbation_count`, `event_count`,
plus score/`hit_frames`/`track_frames` and `player_name`.

---

## How to play / collect

1. Open the link. Enter a **Player Name** (to tell contributors apart).
2. **Start** (or `Space`) and chase the target with the mouse:
   orange = track zone, violet = hit zone (aim here), green = lead point.
3. The target **jumps** at random intervals — chase it back. A **round is 6
   episodes**, then it auto-stops and shows your **score** (best score is kept).
4. **Download JSONL** (or `D`) → one JSON file → send it back.

Controls: `Space` start/pause · `R` reset · `D` download.

---

## How to analyze

The point is the layers a static-trajectory model can't reach. Each maps to
fields above.

- **Reaction time (L2).** For each `target_jump` (onset `wall_t`), find the first
  cursor response after it — a velocity onset in `frames` (`cursor_vx/vy` crossing
  a threshold) or a `pointerdown`. The onset→response gap is reaction time; a
  human's is ~150–250ms and variable, a replay/bot's is 0 or constant.
- **Challenge-response / evoked tracking (L6).** Align `distance(t)` on each
  `target_jump`: real players show a latency then a recovery curve (re-acquire the
  target); a pre-recorded stroke can't react, so its post-jump tracking error
  diverges. Also useful: RMS tracking error, phase lag between `target` and
  `cursor` velocity, and lead-quality (`forward_offset` vs `desired_forward_offset`).
- **Micro-structure (L1 check).** Recompute jerk/tremor from `mouse_trace` (native
  rate) rather than the 60Hz `frames` — the high-frequency detail lives here.
- **Session-level variation (L4).** Across rounds/time within one player: does
  accuracy, reaction time, or tracking error drift (warm-up, fatigue)? A bot is
  flat; a human is not.
- **Cross-modal (L5).** Relative timing of `keydown/up` vs mouse motion — humans
  couple key and mouse actions in ways an isolated mouse generator does not.

Recommended volume: a pilot of **10–20 rounds from one player** (~20 min) is
enough to validate the pipeline and get first reaction-time / tracking-error
signals; **5–10 players × ~10 rounds** for session and style variation.

---

## Deploy (GitHub Pages)

Static site, no backend. Push to `main` → GitHub Actions
(`.github/workflows/deploy.yml`) builds `web/` and publishes to Pages. Set
**Settings → Pages → Source: GitHub Actions** once (public repo required on the
free plan). Change `base` in `web/vite.config.ts` for a user page / custom domain.

## Develop

```bash
cd web
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # -> web/dist (what Pages serves)
```

The whole app is `web/src/main.ts` (canvas game + capture + JSON download).
