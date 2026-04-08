from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from typing import Any
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "server" / "data" / "sessions"
WEB_DIST = ROOT / "web" / "dist"
UPLOAD_LIMIT_PER_MINUTE = 6
UPLOAD_LIMIT_PER_HOUR = 30
WORLD_LIMIT = 1.05
CURSOR_SPEED_LIMIT = 2.0
TARGET_SPEED_LIMIT = 1.0
ACTION_LIMIT = 1.05
TARGET_RADIUS = 0.07
HIT_RADIUS = 0.03


class FramePayload(BaseModel):
    episode: int
    step: int
    t: float
    cursor_x: float
    cursor_y: float
    cursor_vx: float
    cursor_vy: float
    target_x: float
    target_y: float
    target_vx: float
    target_vy: float
    lead_x: float
    lead_y: float
    action_x: float
    action_y: float
    distance: float
    lead_distance: float
    forward_offset: float
    desired_forward_offset: float
    reward: float
    source: str


class SessionUpload(BaseModel):
    source: str = Field(min_length=1, max_length=64)
    frames: list[FramePayload] = Field(min_length=1, max_length=100_000)
    meta: dict[str, Any] = Field(default_factory=dict)


class SessionMetadata(BaseModel):
    session_id: str
    source: str
    player_name: str
    frame_count: int
    episode_count: int
    created_at: str
    score: int
    meta: dict[str, Any]


@dataclass
class UploadWindow:
    timestamps: deque[datetime]


UPLOAD_HISTORY: dict[str, UploadWindow] = defaultdict(lambda: UploadWindow(timestamps=deque()))

app = FastAPI(title="Aim RL Collector API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def sanitize_player_name(meta: dict[str, Any]) -> str:
    raw = str(meta.get("player_name", "anonymous")).strip()
    filtered = "".join(ch for ch in raw if ch.isalnum() or ch in {" ", "_", "-"}).strip()
    if not filtered:
        filtered = "anonymous"
    return filtered[:24]


def enforce_rate_limit(ip_address: str) -> None:
    now = datetime.now(timezone.utc)
    minute_cutoff = now - timedelta(minutes=1)
    hour_cutoff = now - timedelta(hours=1)
    window = UPLOAD_HISTORY[ip_address].timestamps
    while window and window[0] < hour_cutoff:
        window.popleft()

    minute_count = sum(1 for stamp in window if stamp >= minute_cutoff)
    hour_count = len(window)
    if minute_count >= UPLOAD_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {UPLOAD_LIMIT_PER_MINUTE} uploads per minute")
    if hour_count >= UPLOAD_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {UPLOAD_LIMIT_PER_HOUR} uploads per hour")


def record_upload(ip_address: str) -> None:
    UPLOAD_HISTORY[ip_address].timestamps.append(datetime.now(timezone.utc))


def validate_frames(payload: SessionUpload) -> None:
    last_step_by_episode: dict[int, int] = {}
    last_time_by_episode: dict[int, float] = {}
    for frame in payload.frames:
        if frame.source != payload.source:
            raise HTTPException(status_code=400, detail="Frame source does not match payload source")
        if frame.episode < 1 or frame.step < 1:
            raise HTTPException(status_code=400, detail="Episode and step must be positive")
        if abs(frame.cursor_x) > WORLD_LIMIT or abs(frame.cursor_y) > WORLD_LIMIT:
            raise HTTPException(status_code=400, detail="Cursor coordinates are out of bounds")
        if abs(frame.target_x) > WORLD_LIMIT or abs(frame.target_y) > WORLD_LIMIT:
            raise HTTPException(status_code=400, detail="Target coordinates are out of bounds")
        if abs(frame.lead_x) > WORLD_LIMIT or abs(frame.lead_y) > WORLD_LIMIT:
            raise HTTPException(status_code=400, detail="Lead coordinates are out of bounds")
        if abs(frame.cursor_vx) > CURSOR_SPEED_LIMIT or abs(frame.cursor_vy) > CURSOR_SPEED_LIMIT:
            raise HTTPException(status_code=400, detail="Cursor velocity is out of bounds")
        if abs(frame.target_vx) > TARGET_SPEED_LIMIT or abs(frame.target_vy) > TARGET_SPEED_LIMIT:
            raise HTTPException(status_code=400, detail="Target velocity is out of bounds")
        if abs(frame.action_x) > ACTION_LIMIT or abs(frame.action_y) > ACTION_LIMIT:
            raise HTTPException(status_code=400, detail="Action is out of bounds")
        if frame.distance < 0 or frame.lead_distance < 0:
            raise HTTPException(status_code=400, detail="Distances must be non-negative")

        previous_step = last_step_by_episode.get(frame.episode, 0)
        if frame.step <= previous_step:
            raise HTTPException(status_code=400, detail="Steps must increase within each episode")
        previous_time = last_time_by_episode.get(frame.episode, -1.0)
        if frame.t < previous_time:
            raise HTTPException(status_code=400, detail="Time must be non-decreasing within each episode")
        last_step_by_episode[frame.episode] = frame.step
        last_time_by_episode[frame.episode] = frame.t


def compute_score_from_frames(frames: list[FramePayload]) -> int:
    reward_sum = sum(frame.reward for frame in frames)
    hit_frames = sum(1 for frame in frames if frame.distance <= HIT_RADIUS)
    track_frames = sum(1 for frame in frames if frame.distance <= TARGET_RADIUS)
    min_distance = min(frame.distance for frame in frames)
    lead_quality = sum(max(0.0, 1.0 - abs(frame.forward_offset - frame.desired_forward_offset)) for frame in frames) / len(frames)
    return max(
        0,
        round(reward_sum + hit_frames * 45 + track_frames * 8 + (1 - min_distance) * 180 + lead_quality * 120),
    )


def load_metadata_rows() -> list[dict[str, Any]]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for path in sorted(DATA_DIR.glob("*.json"), key=lambda file: file.stat().st_mtime, reverse=True):
        rows.append(json.loads(path.read_text(encoding="utf-8")))
    return rows


@app.post("/api/sessions", response_model=SessionMetadata)
def create_session(payload: SessionUpload, request: Request) -> SessionMetadata:
    ip_address = client_ip(request)
    enforce_rate_limit(ip_address)
    validate_frames(payload)

    session_id = uuid.uuid4().hex[:12]
    created_at = datetime.now(timezone.utc).isoformat()
    episode_count = len({frame.episode for frame in payload.frames})
    player_name = sanitize_player_name(payload.meta)
    score = compute_score_from_frames(payload.frames)
    metadata = SessionMetadata(
        session_id=session_id,
        source=payload.source,
        player_name=player_name,
        frame_count=len(payload.frames),
        episode_count=episode_count,
        created_at=created_at,
        score=score,
        meta={**payload.meta, "player_name": player_name, "ip_hash_hint": ip_address[-6:]},
    )

    jsonl_path = DATA_DIR / f"{session_id}.jsonl"
    metadata_path = DATA_DIR / f"{session_id}.json"
    with jsonl_path.open("w", encoding="utf-8") as handle:
        for frame in payload.frames:
            handle.write(frame.model_dump_json() + "\n")
    metadata_path.write_text(metadata.model_dump_json(indent=2), encoding="utf-8")
    record_upload(ip_address)
    return metadata


@app.get("/api/sessions")
def list_sessions() -> dict[str, list[dict[str, Any]]]:
    return {"sessions": load_metadata_rows()}


@app.get("/api/sessions/{session_id}", response_model=SessionMetadata)
def get_session(session_id: str) -> SessionMetadata:
    path = DATA_DIR / f"{session_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionMetadata.model_validate_json(path.read_text(encoding="utf-8"))


@app.get("/api/sessions/{session_id}/jsonl")
def get_session_jsonl(session_id: str) -> dict[str, str]:
    path = DATA_DIR / f"{session_id}.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session trace not found")
    return {"content": path.read_text(encoding="utf-8")}


@app.get("/api/admin/stats")
def admin_stats(request: Request) -> dict[str, Any]:
    rows = load_metadata_rows()
    total_frames = sum(int(row.get("frame_count", 0)) for row in rows)
    scores = [int(row.get("score", 0)) for row in rows]

    source_groups: dict[str, dict[str, int]] = defaultdict(lambda: {"session_count": 0, "frame_count": 0, "score_sum": 0})
    for row in rows:
        source = str(row.get("source", "unknown"))
        group = source_groups[source]
        group["session_count"] += 1
        group["frame_count"] += int(row.get("frame_count", 0))
        group["score_sum"] += int(row.get("score", 0))

    ip_address = client_ip(request)
    now = datetime.now(timezone.utc)
    minute_cutoff = now - timedelta(minutes=1)
    hour_cutoff = now - timedelta(hours=1)
    window = UPLOAD_HISTORY[ip_address].timestamps
    minute_count = sum(1 for stamp in window if stamp >= minute_cutoff)
    hour_count = sum(1 for stamp in window if stamp >= hour_cutoff)

    leaderboard_rows = sorted(rows, key=lambda row: (int(row.get("score", 0)), row.get("created_at", "")), reverse=True)[:10]
    return {
        "session_count": len(rows),
        "stored_frame_count": total_frames,
        "average_score": round(sum(scores) / len(scores), 2) if scores else 0.0,
        "top_score": max(scores) if scores else 0,
        "leaderboard": [
            {
                "session_id": row["session_id"],
                "source": row["source"],
                "player_name": row.get("player_name", row.get("meta", {}).get("player_name", "anonymous")),
                "score": int(row.get("score", 0)),
                "frame_count": int(row.get("frame_count", 0)),
                "episode_count": int(row.get("episode_count", 0)),
                "created_at": row["created_at"],
            }
            for row in leaderboard_rows
        ],
        "sources": [
            {
                "source": source,
                "session_count": values["session_count"],
                "frame_count": values["frame_count"],
                "average_score": round(values["score_sum"] / values["session_count"], 2) if values["session_count"] else 0.0,
            }
            for source, values in sorted(source_groups.items(), key=lambda item: item[1]["score_sum"], reverse=True)
        ],
        "upload_limits": {
            "minute_limit": UPLOAD_LIMIT_PER_MINUTE,
            "hourly_limit": UPLOAD_LIMIT_PER_HOUR,
            "recent_uploads_from_ip": minute_count,
            "recent_hour_uploads_from_ip": hour_count,
        },
    }


@app.get("/api/leaderboard")
def leaderboard() -> dict[str, list[dict[str, Any]]]:
    rows = load_metadata_rows()
    top_rows = sorted(rows, key=lambda row: (int(row.get("score", 0)), row.get("created_at", "")), reverse=True)[:25]
    return {
        "leaderboard": [
            {
                "session_id": row["session_id"],
                "source": row["source"],
                "player_name": row.get("player_name", row.get("meta", {}).get("player_name", "anonymous")),
                "score": int(row.get("score", 0)),
                "frame_count": int(row.get("frame_count", 0)),
                "episode_count": int(row.get("episode_count", 0)),
                "created_at": row["created_at"],
            }
            for row in top_rows
        ]
    }


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
