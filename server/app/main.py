from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "server" / "data" / "sessions"
WEB_DIST = ROOT / "web" / "dist"


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
    meta: dict[str, object] = Field(default_factory=dict)


class SessionMetadata(BaseModel):
    session_id: str
    source: str
    frame_count: int
    episode_count: int
    created_at: str
    meta: dict[str, object]


app = FastAPI(title="Aim RL Collector API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sessions", response_model=SessionMetadata)
def create_session(payload: SessionUpload) -> SessionMetadata:
    session_id = uuid.uuid4().hex[:12]
    created_at = datetime.now(timezone.utc).isoformat()
    episode_count = len({frame.episode for frame in payload.frames})
    metadata = SessionMetadata(
        session_id=session_id,
        source=payload.source,
        frame_count=len(payload.frames),
        episode_count=episode_count,
        created_at=created_at,
        meta=payload.meta,
    )

    jsonl_path = DATA_DIR / f"{session_id}.jsonl"
    metadata_path = DATA_DIR / f"{session_id}.json"
    with jsonl_path.open("w", encoding="utf-8") as handle:
        for frame in payload.frames:
            handle.write(frame.model_dump_json() + "\n")
    metadata_path.write_text(metadata.model_dump_json(indent=2), encoding="utf-8")
    return metadata


@app.get("/api/sessions")
def list_sessions() -> dict[str, list[dict[str, object]]]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sessions: list[dict[str, object]] = []
    for path in sorted(DATA_DIR.glob("*.json"), key=lambda file: file.stat().st_mtime, reverse=True):
        sessions.append(json.loads(path.read_text(encoding="utf-8")))
    return {"sessions": sessions}


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


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
