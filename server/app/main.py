from __future__ import annotations

from collections import Counter, defaultdict, deque
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
    frame_count: int
    episode_count: int
    created_at: str
    meta: dict[str, Any]


@dataclass
class UploadWindow:
    timestamps: deque[datetime]


UPLOAD_HISTORY: dict[str, UploadWindow] = defaultdict(lambda: UploadWindow(timestamps=deque()))

app = FastAPI(title="Aim RL Collector API", version="0.2.0")
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
    client = request.client.host if request.client else "unknown"
    return client


def enforce_rate_limit(ip_address: str) -> dict[str, int]:
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
    return {"minute": minute_count, "hour": hour_count}


def record_upload(ip_address: str) -> None:
    UPLOAD_HISTORY[ip_address].timestamps.append(datetime.now(timezone.utc))


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

    session_id = uuid.uuid4().hex[:12]
    created_at = datetime.now(timezone.utc).isoformat()
    episode_count = len({frame.episode for frame in payload.frames})
    metadata = SessionMetadata(
        session_id=session_id,
        source=payload.source,
        frame_count=len(payload.frames),
        episode_count=episode_count,
        created_at=created_at,
        meta={**payload.meta, "ip_hash_hint": ip_address[-6:]},
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
    sources = Counter()
    frames = Counter()
    total_frames = 0
    for row in rows:
        source = str(row.get("source", "unknown"))
        frame_count = int(row.get("frame_count", 0))
        sources[source] += 1
        frames[source] += frame_count
        total_frames += frame_count

    ip_address = client_ip(request)
    now = datetime.now(timezone.utc)
    minute_cutoff = now - timedelta(minutes=1)
    hour_cutoff = now - timedelta(hours=1)
    window = UPLOAD_HISTORY[ip_address].timestamps
    minute_count = sum(1 for stamp in window if stamp >= minute_cutoff)
    hour_count = sum(1 for stamp in window if stamp >= hour_cutoff)

    return {
        "session_count": len(rows),
        "stored_frame_count": total_frames,
        "sources": [
            {"source": source, "session_count": count, "frame_count": frames[source]}
            for source, count in sources.most_common()
        ],
        "upload_limits": {
            "minute_limit": UPLOAD_LIMIT_PER_MINUTE,
            "hourly_limit": UPLOAD_LIMIT_PER_HOUR,
            "recent_uploads_from_ip": minute_count,
            "recent_hour_uploads_from_ip": hour_count,
        },
    }


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
