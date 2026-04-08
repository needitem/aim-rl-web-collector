CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT 'anonymous',
  frame_count INTEGER NOT NULL,
  episode_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_traces (
  session_id TEXT PRIMARY KEY,
  jsonl TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS upload_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_events_ip_created_at ON upload_events(ip_address, created_at DESC);
