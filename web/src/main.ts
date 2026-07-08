import "./styles.css";

type Frame = {
  episode: number;
  step: number;
  t: number;
  wall_t: number;        // performance.now() ms - real wall-clock timing (L2 reaction, L6 challenge)
  cursor_x: number;
  cursor_y: number;
  cursor_vx: number;
  cursor_vy: number;
  target_x: number;
  target_y: number;
  target_vx: number;
  target_vy: number;
  lead_x: number;
  lead_y: number;
  action_x: number;
  action_y: number;
  distance: number;
  lead_distance: number;
  forward_offset: number;
  desired_forward_offset: number;
  reward: number;
  client_x: number;      // raw viewport pixel cursor (true kinematics / visual-angle reconstruction)
  client_y: number;
  perturbed: number;     // 1 on the frame the target discretely jumped (stimulus onset), else 0
  source: string;
};

// Discrete behavioral events, timestamped on the same wall clock as frames.
// Enables L2 (reaction time = target_jump -> pointer/velocity response), L5
// (cross-modal keyboard+mouse), and clean L6 challenge markers.
type GameEvent = {
  type: "pointerdown" | "pointerup" | "keydown" | "keyup" | "target_jump";
  wall_t: number;
  episode: number;
  step: number;
  x?: number;            // world coords: pointer position, or target position for a jump
  y?: number;
  client_x?: number;     // raw pixel (pointer events)
  client_y?: number;
  key?: string;          // keyboard events
  button?: number;       // pointer button
};

// High-resolution mouse sample captured at the pointer's NATIVE rate (240Hz+ on
// gaming mice) via getCoalescedEvents, independent of the 60Hz sim - so the L1
// micro-structure (jerk/tremor) that the sim down-sampling would destroy is kept.
type MouseSample = {
  wall_t: number;        // event.timeStamp (performance.now() clock), ms
  x: number;             // world coords
  y: number;
  client_x: number;      // raw pixel
  client_y: number;
};

type SessionSummary = {
  session_id: string;
  source: string;
  player_name?: string;
  frame_count: number;
  episode_count: number;
  created_at: string;
  score?: number;
  meta?: Record<string, unknown>;
};

type LeaderboardEntry = {
  session_id: string;
  source: string;
  player_name?: string;
  score: number;
  frame_count: number;
  episode_count: number;
  created_at: string;
};

type AdminStats = {
  session_count: number;
  stored_frame_count: number;
  average_score: number;
  top_score: number;
  leaderboard: LeaderboardEntry[];
  sources: Array<{ source: string; session_count: number; frame_count: number; average_score: number }>;
  upload_limits: {
    hourly_limit: number;
    minute_limit: number;
    recent_uploads_from_ip: number;
    recent_hour_uploads_from_ip: number;
  };
};

type WorldState = {
  stepCount: number;
  cursorX: number;
  cursorY: number;
  cursorVx: number;
  cursorVy: number;
  targetX: number;
  targetY: number;
  targetVx: number;
  targetVy: number;
  prevActionX: number;
  prevActionY: number;
  consecutiveHits: number;
  nextPerturbStep: number;   // step at which the target will discretely jump (L2/L6 stimulus)
};

type SessionStats = {
  rewardSum: number;
  hitFrames: number;
  trackFrames: number;
  minDistance: number;
  leadQualitySum: number;
  frameCount: number;
};

const DT = 1 / 60;
const WORLD_X = 1.0;
const WORLD_Y = 1.0;
const TARGET_RADIUS = 0.07;
const HIT_RADIUS = 0.03;
const MAX_CURSOR_SPEED = 1.4;
const MAX_ACTION = 0.09;
const TARGET_MAX_SPEED = 0.55;
const TARGET_ACCEL_NOISE = 0.14;
const REWARD_LEAD_TIME = 0.18;
const REWARD_LEAD_WEIGHT = 0.85;
const REWARD_FORWARD_WEIGHT = 0.45;
const REWARD_FORWARD_SCALE = 0.7;
const ACTION_SMOOTH_PENALTY = 0.12;
const TIME_PENALTY = 0.01;
const EPISODE_STEPS = 300;
// Discrete target perturbation: the target teleports + re-aims at a random step,
// giving a clean stimulus onset to measure reaction time (L2) and evoked
// tracking recovery (L6) - the continuous random walk alone has no such event.
const PERTURB_MIN_GAP = 45;   // steps (~0.75 s) minimum before a jump can fire
const PERTURB_MAX_GAP = 150;  // steps (~2.5 s) maximum
const ROUND_EPISODES = 6;     // one round = 6 episodes, then auto-stop with a final score

let running = false;
let episode = 0;
let roundStartEpisode = 0;
let bestScore = Number(window.localStorage.getItem("aim-rl-best-score") || "0");
let frames: Frame[] = [];
let pointerX = 0;
let pointerY = 0;
let rawClientX = 0;
let rawClientY = 0;
let sessionEvents: GameEvent[] = [];
let mouseTrace: MouseSample[] = [];
let lastTimestamp = 0;
let statusMessage = "Ready";
let rngSeed = 17;
let state = resetState();
let playerName = window.localStorage.getItem("aim-rl-player-name") || "anonymous";
let sessionStats = createEmptySessionStats();

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found.");

app.innerHTML = `
  <section class="panel sidebar">
    <div>
      <p class="eyebrow">Browser Collector</p>
      <h1>Aim RL Web Arena</h1>
      <p class="lede">
        Track the moving target — it jumps at random intervals, chase it back.
        A <strong>round is ${ROUND_EPISODES} episodes</strong>; then it stops and shows your
        score. When you're done, <strong>Download JSONL</strong> and send the file.
        Mouse is captured at your device's native rate (240Hz+ on gaming mice).
      </p>
    </div>

    <div class="controls">
      <div class="button-row">
        <button id="toggle-run">Start</button>
        <button id="reset-episode" class="secondary">Reset Episode</button>
        <button id="save-local" class="secondary">Download JSONL</button>
      </div>
    </div>

    <div class="api-box">
      <label>
        Player Name
        <input id="player-name" value="${playerName}" maxlength="24" />
      </label>
    </div>

    <div class="metrics">
      <div class="metric-grid">
        <div class="metric"><span>Mode</span><strong id="metric-mode">Paused</strong></div>
        <div class="metric"><span>Episode</span><strong id="metric-episode">1</strong></div>
        <div class="metric"><span>Frames</span><strong id="metric-frames">0</strong></div>
        <div class="metric"><span>Distance</span><strong id="metric-distance">0.000</strong></div>
        <div class="metric"><span>Lead Offset</span><strong id="metric-forward">0.000</strong></div>
        <div class="metric"><span>Score</span><strong id="metric-score">0</strong></div>
        <div class="metric"><span>Best</span><strong id="metric-best">0</strong></div>
      </div>
    </div>

    <p id="status-line" class="footer-note">Ready</p>
  </section>

  <section class="panel canvas-panel">
    <div class="canvas-shell">
      <canvas id="arena" width="960" height="960"></canvas>
      <div class="canvas-overlay">
        <div class="badge">Orange = track zone, violet = hit zone, green = lead point</div>
        <div class="hint">Space start/pause, R reset, D download</div>
      </div>
    </div>
  </section>
`;

const canvas = getRequired<HTMLCanvasElement>("#arena");
const ctx = get2d(canvas);
const playerNameInput = getRequired<HTMLInputElement>("#player-name");
const toggleRunButton = getRequired<HTMLButtonElement>("#toggle-run");
const resetButton = getRequired<HTMLButtonElement>("#reset-episode");
const saveButton = getRequired<HTMLButtonElement>("#save-local");
const modeEl = getRequired<HTMLElement>("#metric-mode");
const episodeEl = getRequired<HTMLElement>("#metric-episode");
const framesEl = getRequired<HTMLElement>("#metric-frames");
const distanceEl = getRequired<HTMLElement>("#metric-distance");
const forwardEl = getRequired<HTMLElement>("#metric-forward");
const scoreEl = getRequired<HTMLElement>("#metric-score");
const bestEl = getRequired<HTMLElement>("#metric-best");
const statusEl = getRequired<HTMLElement>("#status-line");

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  rawClientX = event.clientX;
  rawClientY = event.clientY;
  pointerX = clip((((event.clientX - rect.left) / rect.width) * 2 - 1) * WORLD_X, -WORLD_X, WORLD_X);
  pointerY = clip((1 - ((event.clientY - rect.top) / rect.height) * 2) * WORLD_Y, -WORLD_Y, WORLD_Y);
  if (!running) return;
  // High-resolution capture at the mouse's NATIVE rate (240Hz+ on gaming mice):
  // getCoalescedEvents returns every raw sample the browser batched into this
  // event, each with its own event.timeStamp - the 60Hz sim would discard them.
  const batch = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
  for (const e of batch) {
    const wx = clip((((e.clientX - rect.left) / rect.width) * 2 - 1) * WORLD_X, -WORLD_X, WORLD_X);
    const wy = clip((1 - ((e.clientY - rect.top) / rect.height) * 2) * WORLD_Y, -WORLD_Y, WORLD_Y);
    mouseTrace.push({
      wall_t: round(e.timeStamp, 3), x: round(wx, 6), y: round(wy, 6),
      client_x: e.clientX, client_y: e.clientY,
    });
  }
});

// Pointer-button events: reaction-response markers (L2) and cross-modal (L5).
canvas.addEventListener("pointerdown", (event) => logPointerEvent("pointerdown", event));
canvas.addEventListener("pointerup", (event) => logPointerEvent("pointerup", event));

window.addEventListener("keydown", (event) => {
  if (running && !event.repeat) logKeyEvent("keydown", event);
  const key = event.key.toLowerCase();
  if (event.code === "Space") {
    event.preventDefault();
    toggleRun();
  } else if (key === "r") {
    resetEpisode();
  } else if (key === "d") {
    downloadSession();
  }
});
window.addEventListener("keyup", (event) => {
  if (running) logKeyEvent("keyup", event);
});

function logPointerEvent(type: "pointerdown" | "pointerup", event: PointerEvent): void {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const wx = clip((((event.clientX - rect.left) / rect.width) * 2 - 1) * WORLD_X, -WORLD_X, WORLD_X);
  const wy = clip((1 - ((event.clientY - rect.top) / rect.height) * 2) * WORLD_Y, -WORLD_Y, WORLD_Y);
  sessionEvents.push({
    type, wall_t: round(performance.now(), 3), episode: episode + 1, step: state.stepCount,
    x: round(wx, 6), y: round(wy, 6), client_x: event.clientX, client_y: event.clientY, button: event.button,
  });
}

function logKeyEvent(type: "keydown" | "keyup", event: KeyboardEvent): void {
  sessionEvents.push({
    type, wall_t: round(performance.now(), 3), episode: episode + 1, step: state.stepCount, key: event.key,
  });
}

toggleRunButton.addEventListener("click", () => toggleRun());
resetButton.addEventListener("click", () => resetEpisode());
saveButton.addEventListener("click", () => downloadSession());
playerNameInput.addEventListener("input", () => {
  playerName = sanitizePlayerName(playerNameInput.value);
  playerNameInput.value = playerName;
  window.localStorage.setItem("aim-rl-player-name", playerName);
});

pointerX = state.cursorX;
pointerY = state.cursorY;
renderLive();
requestAnimationFrame(loop);

function loop(timestamp: number): void {
  if (lastTimestamp === 0) lastTimestamp = timestamp;

  if (running && timestamp - lastTimestamp >= DT * 1000) {
    const steps = Math.max(1, Math.floor((timestamp - lastTimestamp) / (DT * 1000)));
    for (let index = 0; index < steps; index += 1) tick();
    lastTimestamp = timestamp;
  }

  renderLive();
  requestAnimationFrame(loop);
}

function toggleRun(): void {
  running = !running;
  toggleRunButton.textContent = running ? "Pause" : "Start";
  if (running) {
    const epInRound = Math.min(episode - roundStartEpisode + 1, ROUND_EPISODES);
    statusMessage = `Round in progress — episode ${epInRound}/${ROUND_EPISODES}`;
  } else {
    statusMessage = "Paused";
  }
  updateMetrics(lastFrame());
}

function resetEpisode(): void {
  episode += 1;
  state = resetState();
  pointerX = state.cursorX;
  pointerY = state.cursorY;
  statusMessage = `Episode ${episode + 1} ready`;
  updateMetrics(lastFrame());
}

function tick(): void {
  const previousCursorX = state.cursorX;
  const previousCursorY = state.cursorY;
  const previousCursorVx = state.cursorVx;
  const previousCursorVy = state.cursorVy;

  state.cursorX = clip(pointerX, -WORLD_X, WORLD_X);
  state.cursorY = clip(pointerY, -WORLD_Y, WORLD_Y);
  state.cursorVx = clip((state.cursorX - previousCursorX) / DT, -MAX_CURSOR_SPEED, MAX_CURSOR_SPEED);
  state.cursorVy = clip((state.cursorY - previousCursorY) / DT, -MAX_CURSOR_SPEED, MAX_CURSOR_SPEED);

  const impliedAx = clip(state.cursorVx - previousCursorVx, -MAX_ACTION, MAX_ACTION);
  const impliedAy = clip(state.cursorVy - previousCursorVy, -MAX_ACTION, MAX_ACTION);

  // Discrete perturbation (stimulus onset): teleport + re-aim the target on the
  // scheduled step, then reschedule. Logged as a target_jump event + perturbed=1
  // so reaction time (L2) and evoked tracking recovery (L6) can be measured.
  let perturbed = 0;
  if (state.stepCount + 1 >= state.nextPerturbStep) {
    state.targetX = randomRange(-0.7, 0.7);
    state.targetY = randomRange(-0.5, 0.5);
    const jumpAngle = randomRange(0, Math.PI * 2);
    const jumpSpeed = randomRange(0.15, TARGET_MAX_SPEED);
    state.targetVx = Math.cos(jumpAngle) * jumpSpeed;
    state.targetVy = Math.sin(jumpAngle) * jumpSpeed;
    perturbed = 1;
    state.nextPerturbStep = state.stepCount + 1 + Math.floor(randomRange(PERTURB_MIN_GAP, PERTURB_MAX_GAP));
    sessionEvents.push({
      type: "target_jump", wall_t: round(performance.now(), 3), episode: episode + 1,
      step: state.stepCount + 1, x: round(state.targetX, 6), y: round(state.targetY, 6),
    });
  }

  state.targetVx = clip(state.targetVx + randomRange(-TARGET_ACCEL_NOISE, TARGET_ACCEL_NOISE) * DT, -TARGET_MAX_SPEED, TARGET_MAX_SPEED);
  state.targetVy = clip(state.targetVy + randomRange(-TARGET_ACCEL_NOISE, TARGET_ACCEL_NOISE) * DT, -TARGET_MAX_SPEED, TARGET_MAX_SPEED);

  const nextTargetX = state.targetX + state.targetVx * DT;
  const nextTargetY = state.targetY + state.targetVy * DT;
  if (nextTargetX > WORLD_X || nextTargetX < -WORLD_X) state.targetVx *= -1;
  if (nextTargetY > WORLD_Y || nextTargetY < -WORLD_Y) state.targetVy *= -1;
  state.targetX = clip(state.targetX + state.targetVx * DT, -WORLD_X, WORLD_X);
  state.targetY = clip(state.targetY + state.targetVy * DT, -WORLD_Y, WORLD_Y);

  const leadX = clip(state.targetX + state.targetVx * REWARD_LEAD_TIME, -WORLD_X, WORLD_X);
  const leadY = clip(state.targetY + state.targetVy * REWARD_LEAD_TIME, -WORLD_Y, WORLD_Y);
  const distance = hypot(state.targetX - state.cursorX, state.targetY - state.cursorY);
  const leadDistance = hypot(leadX - state.cursorX, leadY - state.cursorY);
  const targetSpeed = hypot(state.targetVx, state.targetVy);
  const desiredForwardOffset = targetSpeed * REWARD_LEAD_TIME * REWARD_FORWARD_SCALE;
  const forwardOffset = computeForwardOffset();
  const smoothDelta = hypot(impliedAx - state.prevActionX, impliedAy - state.prevActionY);

  const inTrackZone = distance <= TARGET_RADIUS;
  const hitZone = distance <= HIT_RADIUS;
  state.consecutiveHits = hitZone ? state.consecutiveHits + 1 : 0;

  let reward = 0;
  reward += Math.max(0, 1 - distance / WORLD_X);
  reward += REWARD_LEAD_WEIGHT * Math.max(0, 1 - leadDistance / WORLD_X);
  reward += REWARD_FORWARD_WEIGHT * Math.max(0, 1 - Math.abs(forwardOffset - desiredForwardOffset) / WORLD_X);
  reward -= TIME_PENALTY;
  reward -= smoothDelta * ACTION_SMOOTH_PENALTY;
  if (inTrackZone) reward += 0.5;
  if (hitZone) reward += 1.5;
  if (state.consecutiveHits >= 8) reward += 2.0;

  state.prevActionX = impliedAx;
  state.prevActionY = impliedAy;
  state.stepCount += 1;

  frames.push({
    episode: episode + 1,
    step: state.stepCount,
    t: round(state.stepCount * DT, 6),
    wall_t: round(performance.now(), 3),
    cursor_x: round(state.cursorX, 6),
    cursor_y: round(state.cursorY, 6),
    cursor_vx: round(state.cursorVx, 6),
    cursor_vy: round(state.cursorVy, 6),
    target_x: round(state.targetX, 6),
    target_y: round(state.targetY, 6),
    target_vx: round(state.targetVx, 6),
    target_vy: round(state.targetVy, 6),
    lead_x: round(leadX, 6),
    lead_y: round(leadY, 6),
    action_x: round(impliedAx / MAX_ACTION, 6),
    action_y: round(impliedAy / MAX_ACTION, 6),
    distance: round(distance, 6),
    lead_distance: round(leadDistance, 6),
    forward_offset: round(forwardOffset, 6),
    desired_forward_offset: round(desiredForwardOffset, 6),
    reward: round(reward, 6),
    client_x: Math.round(rawClientX),
    client_y: Math.round(rawClientY),
    perturbed,
    source: "human-web",
  });
  updateSessionStats(frames[frames.length - 1]);

  if (state.stepCount >= EPISODE_STEPS || state.consecutiveHits >= 8) {
    episode += 1;
    state = resetState();
    pointerX = state.cursorX;
    pointerY = state.cursorY;
    if (episode - roundStartEpisode >= ROUND_EPISODES) {
      // Round over: stop, show the final score, update best.
      running = false;
      const finalScore = currentScore();
      if (finalScore > bestScore) {
        bestScore = finalScore;
        window.localStorage.setItem("aim-rl-best-score", String(bestScore));
      }
      roundStartEpisode = episode;
      toggleRunButton.textContent = "Start";
      statusMessage = `Round complete — Score ${finalScore} (best ${bestScore}) · Download JSONL, or Start again`;
    }
  }

  updateMetrics(lastFrame());
}

function resetState(): WorldState {
  const angle = randomRange(0, Math.PI * 2);
  const speed = randomRange(0.15, TARGET_MAX_SPEED);
  return {
    stepCount: 0,
    cursorX: 0,
    cursorY: 0,
    cursorVx: 0,
    cursorVy: 0,
    targetX: randomRange(-0.6, 0.6),
    targetY: randomRange(-0.4, 0.4),
    targetVx: Math.cos(angle) * speed,
    targetVy: Math.sin(angle) * speed,
    prevActionX: 0,
    prevActionY: 0,
    consecutiveHits: 0,
    nextPerturbStep: Math.floor(randomRange(PERTURB_MIN_GAP, PERTURB_MAX_GAP)),
  };
}

function renderLive(): void {
  drawArena(ctx, canvas.width, canvas.height, currentLiveFrame(), state.targetX, state.targetY, state.cursorX, state.cursorY);
}

function currentLiveFrame(): Frame | undefined {
  return frames[frames.length - 1];
}

function drawArena(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame | undefined,
  liveTargetX: number | null,
  liveTargetY: number | null,
  liveCursorX: number | null,
  liveCursorY: number | null,
): void {
  context.clearRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fefefe");
  gradient.addColorStop(1, "#eef3ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height);

  const targetX = frame ? frame.target_x : liveTargetX;
  const targetY = frame ? frame.target_y : liveTargetY;
  const cursorX = frame ? frame.cursor_x : liveCursorX;
  const cursorY = frame ? frame.cursor_y : liveCursorY;
  const leadX = frame?.lead_x ?? null;
  const leadY = frame?.lead_y ?? null;

  if (targetX == null || targetY == null || cursorX == null || cursorY == null) return;

  const target = worldToCanvas(targetX, targetY, width, height);
  const cursor = worldToCanvas(cursorX, cursorY, width, height);
  drawCircle(context, target.x, target.y, TARGET_RADIUS, "#f39c12", 2, width);
  drawCircle(context, target.x, target.y, HIT_RADIUS, "#8e44ad", 2, width);
  drawCircle(context, target.x, target.y, 0.012, "#d7263d", 0, width, true);
  if (leadX != null && leadY != null) {
    const lead = worldToCanvas(leadX, leadY, width, height);
    drawCircle(context, lead.x, lead.y, 0.009, "#2faa68", 2, width);
  }
  drawCross(context, cursor.x, cursor.y, Math.max(12, width / 60), "#1f4fff");
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.strokeStyle = "rgba(31, 36, 48, 0.08)";
  context.lineWidth = 1;
  for (let index = 1; index < 8; index += 1) {
    const ratio = index / 8;
    const x = ratio * width;
    const y = ratio * height;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusWorld: number,
  color: string,
  width: number,
  canvasWidth: number,
  fill = false,
): void {
  const radius = (radiusWorld / WORLD_X) * canvasWidth * 0.5;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    context.fillStyle = color;
    context.fill();
  } else {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
  }
}

function drawCross(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  context.strokeStyle = color;
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(x - size, y);
  context.lineTo(x + size, y);
  context.moveTo(x, y - size);
  context.lineTo(x, y + size);
  context.stroke();
}

function updateMetrics(frame?: Frame): void {
  modeEl.textContent = running ? "Running" : "Paused";
  episodeEl.textContent = String(episode + 1);
  framesEl.textContent = String(frames.length);
  distanceEl.textContent = frame ? frame.distance.toFixed(3) : "0.000";
  forwardEl.textContent = frame ? frame.forward_offset.toFixed(3) : "0.000";
  scoreEl.textContent = String(currentScore());
  bestEl.textContent = String(bestScore);
  statusEl.textContent = statusMessage;
}

function sessionPayload(): { source: string; frames: Frame[]; meta: Record<string, unknown> } {
  const episodes = new Set(frames.map((frame) => frame.episode));
  return {
    source: "human-web",
    frames,
    meta: {
      episode_count: episodes.size,
      frame_count: frames.length,
      client: "aim-rl-web",
      created_at: new Date().toISOString(),
      score: currentScore(),
      player_name: playerName,
      best_distance: sessionStats.frameCount > 0 ? sessionStats.minDistance : 0,
      hit_frames: sessionStats.hitFrames,
      track_frames: sessionStats.trackFrames,
      dpr: window.devicePixelRatio || 1,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      pointer_type: "mouse",
      perturbation_count: sessionEvents.filter((e) => e.type === "target_jump").length,
      event_count: sessionEvents.length,
      events: sessionEvents,
      mouse_sample_count: mouseTrace.length,
      mouse_hz_estimate: estimateMouseHz(),
      mouse_trace: mouseTrace,
    },
  };
}

// Rough native mouse rate from the high-res trace timestamps (sanity check that
// a 240Hz+ device is actually delivering 240Hz+ samples).
function estimateMouseHz(): number {
  if (mouseTrace.length < 20) return 0;
  const span = mouseTrace[mouseTrace.length - 1].wall_t - mouseTrace[0].wall_t;
  return span > 0 ? Math.round(((mouseTrace.length - 1) / span) * 1000) : 0;
}

function computeScore(rows: Frame[]): number {
  if (rows.length === 0) return 0;
  const stats = rows.reduce((acc, frame) => {
    acc.rewardSum += frame.reward;
    acc.hitFrames += frame.distance <= HIT_RADIUS ? 1 : 0;
    acc.trackFrames += frame.distance <= TARGET_RADIUS ? 1 : 0;
    acc.minDistance = Math.min(acc.minDistance, frame.distance);
    acc.leadQualitySum += Math.max(0, 1 - Math.abs(frame.forward_offset - frame.desired_forward_offset));
    acc.frameCount += 1;
    return acc;
  }, createEmptySessionStats());
  return scoreFromStats(stats);
}

function currentScore(): number {
  return scoreFromStats(sessionStats);
}

function scoreFromStats(stats: SessionStats): number {
  if (stats.frameCount === 0) return 0;
  const leadQuality = stats.leadQualitySum / stats.frameCount;
  return Math.max(
    0,
    Math.round(
      stats.rewardSum +
        stats.hitFrames * 45 +
        stats.trackFrames * 8 +
        (1 - stats.minDistance) * 180 +
        leadQuality * 120,
    ),
  );
}

function downloadSession(): void {
  if (frames.length === 0) {
    statusMessage = "No frames collected yet";
    updateMetrics(currentLiveFrame());
    return;
  }
  // Full session as one JSON file: frames + high-res mouse_trace + event log +
  // meta. (No server; the player sends this file back.)
  const blob = new Blob([JSON.stringify(sessionPayload())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aim-session-${playerName}-${stamp()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  statusMessage = `Downloaded: ${frames.length} frames, ${mouseTrace.length} mouse samples, ${sessionEvents.length} events`;
  updateMetrics(currentLiveFrame());
}


function worldToCanvas(worldX: number, worldY: number, width: number, height: number): { x: number; y: number } {
  return {
    x: ((worldX / WORLD_X) + 1) * 0.5 * width,
    y: (1 - ((worldY / WORLD_Y) + 1) * 0.5) * height,
  };
}

function computeForwardOffset(): number {
  const speed = hypot(state.targetVx, state.targetVy);
  if (speed < 1e-8) return 0;
  const directionX = state.targetVx / speed;
  const directionY = state.targetVy / speed;
  return (state.cursorX - state.targetX) * directionX + (state.cursorY - state.targetY) * directionY;
}

function randomRange(min: number, max: number): number {
  rngSeed = (rngSeed * 1664525 + 1013904223) % 4294967296;
  const unit = rngSeed / 4294967296;
  return min + (max - min) * unit;
}

function clip(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizePlayerName(value: string): string {
  const cleaned = value
    .split("")
    .filter((char) => /[a-zA-Z0-9 _-]/.test(char))
    .join("")
    .trim();
  return (cleaned || "anonymous").slice(0, 24);
}

function createEmptySessionStats(): SessionStats {
  return {
    rewardSum: 0,
    hitFrames: 0,
    trackFrames: 0,
    minDistance: 1,
    leadQualitySum: 0,
    frameCount: 0,
  };
}

function updateSessionStats(frame: Frame): void {
  sessionStats.rewardSum += frame.reward;
  sessionStats.hitFrames += frame.distance <= HIT_RADIUS ? 1 : 0;
  sessionStats.trackFrames += frame.distance <= TARGET_RADIUS ? 1 : 0;
  sessionStats.minDistance = Math.min(sessionStats.minDistance, frame.distance);
  sessionStats.leadQualitySum += Math.max(0, 1 - Math.abs(frame.forward_offset - frame.desired_forward_offset));
  sessionStats.frameCount += 1;
}

function lastFrame(): Frame | undefined {
  return frames[frames.length - 1];
}

function getRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing DOM node: ${selector}`);
  return element;
}

function get2d(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d");
  if (!context) throw new Error("2d context unavailable");
  return context;
}
