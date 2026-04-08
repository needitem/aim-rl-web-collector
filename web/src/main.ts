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
let selectedSessionId: string | null = null;
let replayFrames: Frame[] = [];
let replayIndex = 0;
let replayPlaying = false;
let pointerX = 0;
let pointerY = 0;
let lastTimestamp = 0;
let replayTimestamp = 0;
let statusMessage = "Ready";
let rngSeed = 17;
let adminStats: AdminStats | null = null;
let state = resetState();
let playerName = window.localStorage.getItem("aim-rl-player-name") || "anonymous";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found.");

app.innerHTML = `
  <section class="panel sidebar">
    <div>
      <p class="eyebrow">Browser Collector</p>
      <h1>Aim RL Web Arena</h1>
      <p class="lede">
        Collect human aim traces, compete on score, upload sessions, and replay top runs
        without leaving the browser.
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
        Player Name
        <input id="player-name" value="${playerName}" maxlength="24" />
      </label>
      <label>
        API Base URL
        <input id="api-base" value="${DEFAULT_API}" />
      </label>
      <div class="button-row">
        <button id="refresh-admin" class="ghost">Refresh Admin</button>
        <button id="clear-replay" class="ghost">Clear Replay</button>
      </div>
    </div>

    <div class="metrics">
      <div class="metric-grid">
        <div class="metric"><span>Mode</span><strong id="metric-mode">Paused</strong></div>
        <div class="metric"><span>Episode</span><strong id="metric-episode">1</strong></div>
        <div class="metric"><span>Frames</span><strong id="metric-frames">0</strong></div>
        <div class="metric"><span>Distance</span><strong id="metric-distance">0.000</strong></div>
        <div class="metric"><span>Lead Offset</span><strong id="metric-forward">0.000</strong></div>
        <div class="metric"><span>Score</span><strong id="metric-score">0</strong></div>
      </div>
    </div>

    <div class="admin-block">
      <strong>Admin Snapshot</strong>
      <div id="admin-stats" class="admin-stats"></div>
    </div>

    <div class="leaderboard-block">
      <strong>Leaderboard</strong>
      <ol id="leaderboard-list" class="leaderboard-list"></ol>
    </div>

    <div class="sessions">
      <strong>Stored Sessions</strong>
      <ul id="session-list" class="session-list"></ul>
    </div>

    <p id="status-line" class="footer-note">Ready</p>
  </section>

  <section class="panel canvas-panel">
    <div class="canvas-shell">
      <canvas id="arena" width="960" height="960"></canvas>
      <div class="canvas-overlay">
        <div class="badge">Orange = track zone, violet = hit zone, green = lead point</div>
        <div class="hint">Space start/pause, R reset, U upload, P replay</div>
      </div>
    </div>
  </section>

  <section class="panel replay-panel">
    <div class="replay-header">
      <div>
        <p class="eyebrow">Replay Viewer</p>
        <h2 id="replay-title">No Session Loaded</h2>
      </div>
      <div class="button-row">
        <button id="replay-toggle" class="secondary" disabled>Play</button>
        <button id="replay-download" class="ghost" disabled>Download Trace</button>
      </div>
    </div>

    <div class="replay-shell">
      <canvas id="replay-canvas" width="720" height="720"></canvas>
    </div>

    <div class="replay-controls">
      <input id="replay-slider" type="range" min="0" max="0" value="0" disabled />
      <div class="replay-meta">
        <span id="replay-step">step 0 / 0</span>
        <span id="replay-distance">distance 0.000</span>
      </div>
    </div>
  </section>
`;

const canvas = getRequired<HTMLCanvasElement>("#arena");
const ctx = get2d(canvas);
const replayCanvas = getRequired<HTMLCanvasElement>("#replay-canvas");
const replayCtx = get2d(replayCanvas);
const playerNameInput = getRequired<HTMLInputElement>("#player-name");
const apiInput = getRequired<HTMLInputElement>("#api-base");
const toggleRunButton = getRequired<HTMLButtonElement>("#toggle-run");
const resetButton = getRequired<HTMLButtonElement>("#reset-episode");
const saveButton = getRequired<HTMLButtonElement>("#save-local");
const uploadButton = getRequired<HTMLButtonElement>("#upload-session");
const refreshButton = getRequired<HTMLButtonElement>("#refresh-admin");
const clearReplayButton = getRequired<HTMLButtonElement>("#clear-replay");
const replayToggleButton = getRequired<HTMLButtonElement>("#replay-toggle");
const replayDownloadButton = getRequired<HTMLButtonElement>("#replay-download");
const replaySlider = getRequired<HTMLInputElement>("#replay-slider");
const modeEl = getRequired<HTMLElement>("#metric-mode");
const episodeEl = getRequired<HTMLElement>("#metric-episode");
const framesEl = getRequired<HTMLElement>("#metric-frames");
const distanceEl = getRequired<HTMLElement>("#metric-distance");
const forwardEl = getRequired<HTMLElement>("#metric-forward");
const scoreEl = getRequired<HTMLElement>("#metric-score");
const statusEl = getRequired<HTMLElement>("#status-line");
const adminStatsEl = getRequired<HTMLElement>("#admin-stats");
const leaderboardEl = getRequired<HTMLElement>("#leaderboard-list");
const sessionListEl = getRequired<HTMLElement>("#session-list");
const replayTitleEl = getRequired<HTMLElement>("#replay-title");
const replayStepEl = getRequired<HTMLElement>("#replay-step");
const replayDistanceEl = getRequired<HTMLElement>("#replay-distance");

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointerX = clip((((event.clientX - rect.left) / rect.width) * 2 - 1) * WORLD_X, -WORLD_X, WORLD_X);
  pointerY = clip((1 - ((event.clientY - rect.top) / rect.height) * 2) * WORLD_Y, -WORLD_Y, WORLD_Y);
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.code === "Space") {
    event.preventDefault();
    toggleRun();
  } else if (key === "r") {
    resetEpisode();
  } else if (key === "u") {
    void uploadSession();
  } else if (key === "p" && replayFrames.length > 0) {
    toggleReplay();
  }
});

toggleRunButton.addEventListener("click", () => toggleRun());
resetButton.addEventListener("click", () => resetEpisode());
saveButton.addEventListener("click", () => downloadSession());
uploadButton.addEventListener("click", () => void uploadSession());
refreshButton.addEventListener("click", () => void refreshAdmin());
clearReplayButton.addEventListener("click", () => clearReplay());
replayToggleButton.addEventListener("click", () => toggleReplay());
replayDownloadButton.addEventListener("click", () => void downloadReplayTrace());
replaySlider.addEventListener("input", () => {
  replayIndex = Number(replaySlider.value);
  replayPlaying = false;
  syncReplayControls();
});
playerNameInput.addEventListener("input", () => {
  playerName = sanitizePlayerName(playerNameInput.value);
  playerNameInput.value = playerName;
  window.localStorage.setItem("aim-rl-player-name", playerName);
});

pointerX = state.cursorX;
pointerY = state.cursorY;
renderLive();
renderReplay();
void refreshAdmin();
requestAnimationFrame(loop);

function loop(timestamp: number): void {
  if (lastTimestamp === 0) lastTimestamp = timestamp;
  if (replayTimestamp === 0) replayTimestamp = timestamp;

  if (running && timestamp - lastTimestamp >= DT * 1000) {
    const steps = Math.max(1, Math.floor((timestamp - lastTimestamp) / (DT * 1000)));
    for (let index = 0; index < steps; index += 1) tick();
    lastTimestamp = timestamp;
  }

  if (replayPlaying && replayFrames.length > 0 && timestamp - replayTimestamp >= DT * 1000) {
    replayIndex = Math.min(replayIndex + 1, replayFrames.length - 1);
    if (replayIndex >= replayFrames.length - 1) replayPlaying = false;
    replayTimestamp = timestamp;
    syncReplayControls();
  }

  renderLive();
  renderReplay();
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

function renderLive(): void {
  drawArena(ctx, canvas.width, canvas.height, currentLiveFrame(), state.targetX, state.targetY, state.cursorX, state.cursorY);
}

function renderReplay(): void {
  drawArena(replayCtx, replayCanvas.width, replayCanvas.height, replayFrames[replayIndex], null, null, null, null);
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
  scoreEl.textContent = String(computeScore(frames));
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
      score: computeScore(frames),
      player_name: playerName,
      best_distance: frames.length ? Math.min(...frames.map((frame) => frame.distance)) : 0,
      hit_frames: frames.filter((frame) => frame.distance <= HIT_RADIUS).length,
      track_frames: frames.filter((frame) => frame.distance <= TARGET_RADIUS).length,
    },
  };
}

function computeScore(rows: Frame[]): number {
  if (rows.length === 0) return 0;
  const rewardSum = rows.reduce((sum, frame) => sum + frame.reward, 0);
  const hitFrames = rows.filter((frame) => frame.distance <= HIT_RADIUS).length;
  const trackFrames = rows.filter((frame) => frame.distance <= TARGET_RADIUS).length;
  const minDistance = Math.min(...rows.map((frame) => frame.distance));
  const leadQuality = rows.reduce(
    (sum, frame) => sum + Math.max(0, 1 - Math.abs(frame.forward_offset - frame.desired_forward_offset)),
    0,
  ) / rows.length;
  return Math.max(
    0,
    Math.round(rewardSum + hitFrames * 45 + trackFrames * 8 + (1 - minDistance) * 180 + leadQuality * 120),
  );
}

function downloadSession(): void {
  if (frames.length === 0) {
    statusMessage = "No frames collected yet";
    updateMetrics(currentLiveFrame());
    return;
  }
  downloadJsonl(frames, `human-web-${stamp()}.jsonl`);
  statusMessage = "Downloaded JSONL session";
  updateMetrics(currentLiveFrame());
}

async function uploadSession(): Promise<void> {
  if (frames.length === 0) {
    statusMessage = "No frames to upload";
    updateMetrics(currentLiveFrame());
    return;
  }
  statusMessage = "Uploading session";
  updateMetrics(currentLiveFrame());
  const response = await fetch(`${apiBase()}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionPayload()),
  });
  if (!response.ok) {
    const text = await response.text();
    statusMessage = `Upload failed: ${response.status} ${text}`;
    updateMetrics(currentLiveFrame());
    return;
  }
  statusMessage = "Session uploaded";
  updateMetrics(currentLiveFrame());
  await refreshAdmin();
}

async function refreshAdmin(): Promise<void> {
  await Promise.all([fetchSessions(), fetchAdminStats()]);
}

async function fetchSessions(): Promise<void> {
  const response = await fetch(`${apiBase()}/api/sessions`);
  if (!response.ok) {
    statusMessage = `Session list failed: ${response.status}`;
    updateMetrics(currentLiveFrame());
    return;
  }
  const payload = (await response.json()) as { sessions: SessionSummary[] };
  summaries = payload.sessions;
  renderSessions();
  if (selectedSessionId && !summaries.some((summary) => summary.session_id === selectedSessionId)) clearReplay();
}

async function fetchAdminStats(): Promise<void> {
  const response = await fetch(`${apiBase()}/api/admin/stats`);
  if (!response.ok) {
    statusMessage = `Admin stats failed: ${response.status}`;
    updateMetrics(currentLiveFrame());
    return;
  }
  adminStats = (await response.json()) as AdminStats;
  renderAdminStats();
  renderLeaderboard();
  statusMessage = `Loaded ${summaries.length} sessions`;
  updateMetrics(currentLiveFrame());
}

function renderAdminStats(): void {
  if (!adminStats) {
    adminStatsEl.innerHTML = "<p>No stats yet.</p>";
    return;
  }
  const sourceLines = adminStats.sources
    .map(
      (entry) =>
        `<li>${entry.source}: ${entry.session_count} sessions / ${entry.frame_count} frames / avg ${entry.average_score.toFixed(1)}</li>`,
    )
    .join("");
  adminStatsEl.innerHTML = `
    <div class="stat-row"><span>Total sessions</span><strong>${adminStats.session_count}</strong></div>
    <div class="stat-row"><span>Total frames</span><strong>${adminStats.stored_frame_count}</strong></div>
    <div class="stat-row"><span>Average score</span><strong>${adminStats.average_score.toFixed(1)}</strong></div>
    <div class="stat-row"><span>Top score</span><strong>${adminStats.top_score}</strong></div>
    <div class="stat-row"><span>Minute uploads from you</span><strong>${adminStats.upload_limits.recent_uploads_from_ip}</strong></div>
    <div class="footer-note">Rate limit: ${adminStats.upload_limits.minute_limit}/min, ${adminStats.upload_limits.hourly_limit}/hour</div>
    <ul class="source-breakdown">${sourceLines}</ul>
  `;
}

function renderLeaderboard(): void {
  if (!adminStats) {
    leaderboardEl.innerHTML = "";
    return;
  }
  leaderboardEl.innerHTML = adminStats.leaderboard
    .slice(0, 10)
    .map(
      (entry, index) =>
        `<li><button class="leaderboard-button" data-session-id="${entry.session_id}"><strong>#${index + 1} ${entry.score} · ${entry.player_name ?? "anonymous"}</strong><span>${entry.source} · ${entry.frame_count} frames</span></button></li>`,
    )
    .join("");
  document.querySelectorAll<HTMLButtonElement>(".leaderboard-button").forEach((button) => {
    button.addEventListener("click", () => void loadReplay(button.dataset.sessionId || ""));
  });
}

function renderSessions(): void {
  sessionListEl.innerHTML = summaries
    .slice(0, 20)
    .map((summary) => {
      const selected = summary.session_id === selectedSessionId ? " selected" : "";
      return `
        <li class="session-item${selected}">
          <button class="session-button" data-session-id="${summary.session_id}">
            <strong>${summary.session_id}</strong>
            <span>${summary.player_name ?? "anonymous"} · ${summary.score ?? 0} pts · ${summary.frame_count} frames</span>
          </button>
        </li>
      `;
    })
    .join("");
  document.querySelectorAll<HTMLButtonElement>(".session-button").forEach((button) => {
    button.addEventListener("click", () => void loadReplay(button.dataset.sessionId || ""));
  });
}

async function loadReplay(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const response = await fetch(`${apiBase()}/api/sessions/${sessionId}/jsonl`);
  if (!response.ok) {
    statusMessage = `Replay load failed: ${response.status}`;
    updateMetrics(currentLiveFrame());
    return;
  }
  const payload = (await response.json()) as { content: string };
  replayFrames = payload.content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Frame);
  selectedSessionId = sessionId;
  replayIndex = 0;
  replayPlaying = false;
  syncReplayControls();
  renderSessions();
  statusMessage = `Loaded replay ${sessionId}`;
  updateMetrics(currentLiveFrame());
}

function clearReplay(): void {
  selectedSessionId = null;
  replayFrames = [];
  replayIndex = 0;
  replayPlaying = false;
  syncReplayControls();
  renderSessions();
  statusMessage = "Replay cleared";
  updateMetrics(currentLiveFrame());
}

function syncReplayControls(): void {
  const hasReplay = replayFrames.length > 0;
  replayToggleButton.disabled = !hasReplay;
  replayDownloadButton.disabled = !hasReplay;
  replaySlider.disabled = !hasReplay;
  replaySlider.max = String(Math.max(0, replayFrames.length - 1));
  replaySlider.value = String(replayIndex);
  replayTitleEl.textContent = hasReplay ? `Replay ${selectedSessionId}` : "No Session Loaded";
  replayToggleButton.textContent = replayPlaying ? "Pause" : "Play";
  const frame = replayFrames[replayIndex];
  replayStepEl.textContent = hasReplay ? `step ${frame.step} / ${replayFrames[replayFrames.length - 1].step}` : "step 0 / 0";
  replayDistanceEl.textContent = hasReplay ? `distance ${frame.distance.toFixed(3)} · forward ${frame.forward_offset.toFixed(3)}` : "distance 0.000";
}

function toggleReplay(): void {
  if (replayFrames.length === 0) return;
  replayPlaying = !replayPlaying;
  replayTimestamp = 0;
  syncReplayControls();
}

async function downloadReplayTrace(): Promise<void> {
  if (replayFrames.length === 0 || !selectedSessionId) return;
  downloadJsonl(replayFrames, `${selectedSessionId}.jsonl`);
}

function downloadJsonl(rows: Frame[], filename: string): void {
  const jsonl = rows.map((row) => JSON.stringify(row)).join("\n");
  const blob = new Blob([jsonl], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function apiBase(): string {
  return apiInput.value.replace(/\/$/, "");
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
