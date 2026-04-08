CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  frame_count INTEGER NOT NULL,
  episode_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  meta_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_traces (
  session_id TEXT PRIMARY KEY,
  jsonl TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

