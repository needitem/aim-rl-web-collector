import "./styles.css";

type Frame = {
  episode: number;
  step: number;
  t: number;
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
  source: string;
};

type SessionSummary = {
  session_id: string;
  source: string;
  frame_count: number;
  episode_count: number;
  created_at: string;
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
const DEFAULT_API = window.location.origin;

let running = false;
let episode = 0;
let frames: Frame[] = [];
let summaries: SessionSummary[] = [];
let pointerX = 0;
let pointerY = 0;
let lastTimestamp = 0;
let statusMessage = "Ready";
let rngSeed = 17;
let state = resetState();

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root not found.");
}

app.innerHTML = `
  <section class="panel sidebar">
    <div>
      <p class="eyebrow">Browser Collector</p>
      <h1>Aim RL Web Arena</h1>
      <p class="lede">
        Move your mouse like a game. The browser records target motion, your cursor
        response, and lead-aim metrics into uploadable session traces.
      </p>
    </div>

    <div class="controls">
      <div class="button-row">
        <button id="toggle-run">Start</button>
        <button id="reset-episode" class="secondary">Reset Episode</button>
        <button id="save-local" class="ghost">Download JSONL</button>
        <button id="upload-session" class="secondary">Upload Session</button>
      </div>
    </div>

    <div class="api-box">
      <label>
        API Base URL
        <input id="api-base" value="${DEFAULT_API}" />
      </label>
      <button id="refresh-sessions" class="ghost">Refresh Saved Sessions</button>
    </div>

    <div class="metrics">
      <div class="metric-grid">
        <div class="metric"><span>Mode</span><strong id="metric-mode">Paused</strong></div>
        <div class="metric"><span>Episode</span><strong id="metric-episode">1</strong></div>
        <div class="metric"><span>Frames</span><strong id="metric-frames">0</strong></div>
        <div class="metric"><span>Distance</span><strong id="metric-distance">0.000</strong></div>
        <div class="metric"><span>Lead Offset</span><strong id="metric-forward">0.000</strong></div>
        <div class="metric"><span>Reward</span><strong id="metric-reward">0.000</strong></div>
      </div>
    </div>

    <div class="sessions">
      <strong>Uploaded Sessions</strong>
      <ol id="session-list" class="session-list"></ol>
    </div>

    <p id="status-line" class="footer-note">Ready</p>
  </section>

  <section class="panel canvas-panel">
    <div class="canvas-shell">
      <canvas id="arena" width="960" height="960"></canvas>
      <div class="canvas-overlay">
        <div class="badge">Orange = track zone, violet = hit zone, green = lead point</div>
        <div class="hint">Space start/pause, R reset, U upload</div>
      </div>
    </div>
  </section>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#arena");
const ctx = canvas?.getContext("2d");
const modeEl = document.querySelector<HTMLElement>("#metric-mode");
const episodeEl = document.querySelector<HTMLElement>("#metric-episode");
const framesEl = document.querySelector<HTMLElement>("#metric-frames");
const distanceEl = document.querySelector<HTMLElement>("#metric-distance");
const forwardEl = document.querySelector<HTMLElement>("#metric-forward");
const rewardEl = document.querySelector<HTMLElement>("#metric-reward");
const statusEl = document.querySelector<HTMLElement>("#status-line");
const sessionListEl = document.querySelector<HTMLOListElement>("#session-list");
const apiInput = document.querySelector<HTMLInputElement>("#api-base");
const toggleRunButton = document.querySelector<HTMLButtonElement>("#toggle-run");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-episode");
const saveButton = document.querySelector<HTMLButtonElement>("#save-local");
const uploadButton = document.querySelector<HTMLButtonElement>("#upload-session");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-sessions");

if (
  !canvas ||
  !ctx ||
  !modeEl ||
  !episodeEl ||
  !framesEl ||
  !distanceEl ||
  !forwardEl ||
  !rewardEl ||
  !statusEl ||
  !sessionListEl ||
  !apiInput ||
  !toggleRunButton ||
  !resetButton ||
  !saveButton ||
  !uploadButton ||
  !refreshButton
) {
  throw new Error("Required DOM nodes are missing.");
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointerX = clip((((event.clientX - rect.left) / rect.width) * 2 - 1) * WORLD_X, -WORLD_X, WORLD_X);
  pointerY = clip((1 - ((event.clientY - rect.top) / rect.height) * 2) * WORLD_Y, -WORLD_Y, WORLD_Y);
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    toggleRun();
  } else if (event.key.toLowerCase() === "r") {
    resetEpisode();
  } else if (event.key.toLowerCase() === "u") {
    void uploadSession();
  }
});

toggleRunButton.addEventListener("click", () => toggleRun());
resetButton.addEventListener("click", () => resetEpisode());
saveButton.addEventListener("click", () => downloadSession());
uploadButton.addEventListener("click", () => void uploadSession());
refreshButton.addEventListener("click", () => void fetchSessions());

pointerX = state.cursorX;
pointerY = state.cursorY;
render();
void fetchSessions();
requestAnimationFrame(loop);

function loop(timestamp: number): void {
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
  }

  if (running && timestamp - lastTimestamp >= DT * 1000) {
    const steps = Math.max(1, Math.floor((timestamp - lastTimestamp) / (DT * 1000)));
    for (let index = 0; index < steps; index += 1) {
      tick();
    }
    lastTimestamp = timestamp;
  }

  render();
  requestAnimationFrame(loop);
}

function toggleRun(): void {
  running = !running;
  statusMessage = running ? "Collecting frames" : "Paused";
  toggleRunButton.textContent = running ? "Pause" : "Start";
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

  state.targetVx = clip(
    state.targetVx + randomRange(-TARGET_ACCEL_NOISE, TARGET_ACCEL_NOISE) * DT,
    -TARGET_MAX_SPEED,
    TARGET_MAX_SPEED,
  );
  state.targetVy = clip(
    state.targetVy + randomRange(-TARGET_ACCEL_NOISE, TARGET_ACCEL_NOISE) * DT,
    -TARGET_MAX_SPEED,
    TARGET_MAX_SPEED,
  );

  const nextTargetX = state.targetX + state.targetVx * DT;
  const nextTargetY = state.targetY + state.targetVy * DT;
  if (nextTargetX > WORLD_X || nextTargetX < -WORLD_X) {
    state.targetVx *= -1;
  }
  if (nextTargetY > WORLD_Y || nextTargetY < -WORLD_Y) {
    state.targetVy *= -1;
  }
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
    source: "human-web",
  });

  if (state.stepCount >= EPISODE_STEPS || state.consecutiveHits >= 8) {
    resetEpisode();
    running = true;
    toggleRunButton.textContent = "Pause";
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
  };
}

function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#fefefe");
  gradient.addColorStop(1, "#eef3ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const target = worldToCanvas(state.targetX, state.targetY);
  const cursor = worldToCanvas(state.cursorX, state.cursorY);
  const lead = worldToCanvas(
    clip(state.targetX + state.targetVx * REWARD_LEAD_TIME, -WORLD_X, WORLD_X),
    clip(state.targetY + state.targetVy * REWARD_LEAD_TIME, -WORLD_Y, WORLD_Y),
  );

  drawGrid();
  drawCircle(target.x, target.y, TARGET_RADIUS, "#f39c12", 2);
  drawCircle(target.x, target.y, HIT_RADIUS, "#8e44ad", 2);
  drawCircle(target.x, target.y, 0.012, "#d7263d", 0, true);
  drawCircle(lead.x, lead.y, 0.009, "#2faa68", 2);
  drawCross(cursor.x, cursor.y, 14, "#1f4fff");
}

function drawGrid(): void {
  ctx.strokeStyle = "rgba(31, 36, 48, 0.08)";
  ctx.lineWidth = 1;
  for (let index = 1; index < 8; index += 1) {
    const ratio = index / 8;
    const x = ratio * canvas.width;
    const y = ratio * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawCircle(x: number, y: number, radiusWorld: number, color: string, width: number, fill = false): void {
  const radius = (radiusWorld / WORLD_X) * canvas.width * 0.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function drawCross(x: number, y: number, size: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
}

function updateMetrics(frame?: Frame): void {
  modeEl.textContent = running ? "Running" : "Paused";
  episodeEl.textContent = String(episode + 1);
  framesEl.textContent = String(frames.length);
  distanceEl.textContent = frame ? frame.distance.toFixed(3) : "0.000";
  forwardEl.textContent = frame ? frame.forward_offset.toFixed(3) : "0.000";
  rewardEl.textContent = frame ? frame.reward.toFixed(3) : "0.000";
  statusEl.textContent = statusMessage;
}

function lastFrame(): Frame | undefined {
  return frames[frames.length - 1];
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
    },
  };
}

function downloadSession(): void {
  if (frames.length === 0) {
    statusMessage = "No frames collected yet";
    updateMetrics(lastFrame());
    return;
  }

  const jsonl = frames.map((frame) => JSON.stringify(frame)).join("\n");
  const blob = new Blob([jsonl], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `human-web-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
  anchor.click();
  URL.revokeObjectURL(url);
  statusMessage = "Downloaded JSONL session";
  updateMetrics(lastFrame());
}

async function uploadSession(): Promise<void> {
  if (frames.length === 0) {
    statusMessage = "No frames to upload";
    updateMetrics(lastFrame());
    return;
  }

  statusMessage = "Uploading session";
  updateMetrics(lastFrame());
  const response = await fetch(`${apiInput.value.replace(/\/$/, "")}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionPayload()),
  });

  if (!response.ok) {
    statusMessage = `Upload failed: ${response.status}`;
    updateMetrics(lastFrame());
    return;
  }

  statusMessage = "Session uploaded";
  updateMetrics(lastFrame());
  await fetchSessions();
}

async function fetchSessions(): Promise<void> {
  const response = await fetch(`${apiInput.value.replace(/\/$/, "")}/api/sessions`);
  if (!response.ok) {
    statusMessage = `Session list failed: ${response.status}`;
    updateMetrics(lastFrame());
    return;
  }

  const payload = (await response.json()) as { sessions: SessionSummary[] };
  summaries = payload.sessions;
  renderSessions();
  statusMessage = `Loaded ${summaries.length} saved sessions`;
  updateMetrics(lastFrame());
}

function renderSessions(): void {
  sessionListEl.innerHTML = summaries
    .slice(0, 8)
    .map(
      (summary) =>
        `<li><strong>${summary.session_id}</strong><br />${summary.source} · ${summary.frame_count} frames · ${summary.episode_count} episodes</li>`,
    )
    .join("");
}

function worldToCanvas(worldX: number, worldY: number): { x: number; y: number } {
  return {
    x: ((worldX / WORLD_X) + 1) * 0.5 * canvas.width,
    y: (1 - ((worldY / WORLD_Y) + 1) * 0.5) * canvas.height,
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
