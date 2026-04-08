from __future__ import annotations

from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "web" / "dist"
HTML_PATH = DIST / "index.html"
JS_PATH = next((DIST / "assets").glob("index-*.js"))
CSS_PATH = next((DIST / "assets").glob("index-*.css"))
OUTPUT_PATH = ROOT / "cloudflare" / "worker.generated.js"


def js_string(value: str) -> str:
    return json.dumps(value)


def main() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")
    js = JS_PATH.read_text(encoding="utf-8")
    css = CSS_PATH.read_text(encoding="utf-8")
    js_asset_path = f"/assets/{JS_PATH.name}"
    css_asset_path = f"/assets/{CSS_PATH.name}"

    worker = f"""const INDEX_HTML = {js_string(html)};
const APP_JS = {js_string(js)};
const APP_CSS = {js_string(css)};
const JS_ASSET_PATH = {js_string(js_asset_path)};
const CSS_ASSET_PATH = {js_string(css_asset_path)};
const UPLOAD_LIMIT_PER_MINUTE = 6;
const UPLOAD_LIMIT_PER_HOUR = 30;
const WORLD_LIMIT = 1.05;
const CURSOR_SPEED_LIMIT = 2.0;
const TARGET_SPEED_LIMIT = 1.0;
const ACTION_LIMIT = 1.05;
const TARGET_RADIUS = 0.07;
const HIT_RADIUS = 0.03;

function json(data, init = {{}}) {{
  return new Response(JSON.stringify(data), {{
    ...init,
    headers: {{
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {{}}),
    }},
  }});
}}

function html(body) {{
  return new Response(body, {{
    headers: {{
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    }},
  }});
}}

function text(body, contentType) {{
  return new Response(body, {{
    headers: {{
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    }},
  }});
}}

async function readJson(request) {{
  try {{
    return await request.json();
  }} catch {{
    return null;
  }}
}}

function sessionJsonl(frames) {{
  return frames.map((frame) => JSON.stringify(frame)).join("\\n");
}}

function clientIp(request) {{
  return request.headers.get("CF-Connecting-IP") || "unknown";
}}

function sanitizePlayerName(meta) {{
  const raw = String(meta?.player_name || "anonymous").trim();
  const filtered = raw.split("").filter((char) => /[a-zA-Z0-9 _-]/.test(char)).join("").trim();
  return (filtered || "anonymous").slice(0, 24);
}}

function validateFrames(payload) {{
  const lastStepByEpisode = new Map();
  const lastTimeByEpisode = new Map();
  for (const frame of payload.frames) {{
    if (frame.source !== payload.source) return "Frame source does not match payload source";
    if (frame.episode < 1 || frame.step < 1) return "Episode and step must be positive";
    if (Math.abs(frame.cursor_x) > WORLD_LIMIT || Math.abs(frame.cursor_y) > WORLD_LIMIT) return "Cursor coordinates are out of bounds";
    if (Math.abs(frame.target_x) > WORLD_LIMIT || Math.abs(frame.target_y) > WORLD_LIMIT) return "Target coordinates are out of bounds";
    if (Math.abs(frame.lead_x) > WORLD_LIMIT || Math.abs(frame.lead_y) > WORLD_LIMIT) return "Lead coordinates are out of bounds";
    if (Math.abs(frame.cursor_vx) > CURSOR_SPEED_LIMIT || Math.abs(frame.cursor_vy) > CURSOR_SPEED_LIMIT) return "Cursor velocity is out of bounds";
    if (Math.abs(frame.target_vx) > TARGET_SPEED_LIMIT || Math.abs(frame.target_vy) > TARGET_SPEED_LIMIT) return "Target velocity is out of bounds";
    if (Math.abs(frame.action_x) > ACTION_LIMIT || Math.abs(frame.action_y) > ACTION_LIMIT) return "Action is out of bounds";
    if (frame.distance < 0 || frame.lead_distance < 0) return "Distances must be non-negative";

    const previousStep = lastStepByEpisode.get(frame.episode) || 0;
    const previousTime = lastTimeByEpisode.get(frame.episode) || -1;
    if (frame.step <= previousStep) return "Steps must increase within each episode";
    if (frame.t < previousTime) return "Time must be non-decreasing within each episode";
    lastStepByEpisode.set(frame.episode, frame.step);
    lastTimeByEpisode.set(frame.episode, frame.t);
  }}
  return null;
}}

function computeScore(frames) {{
  const rewardSum = frames.reduce((sum, frame) => sum + Number(frame.reward || 0), 0);
  const hitFrames = frames.filter((frame) => Number(frame.distance) <= HIT_RADIUS).length;
  const trackFrames = frames.filter((frame) => Number(frame.distance) <= TARGET_RADIUS).length;
  const minDistance = Math.min(...frames.map((frame) => Number(frame.distance)));
  const leadQuality = frames.reduce((sum, frame) => {{
    return sum + Math.max(0, 1 - Math.abs(Number(frame.forward_offset) - Number(frame.desired_forward_offset)));
  }}, 0) / frames.length;
  return Math.max(0, Math.round(rewardSum + hitFrames * 45 + trackFrames * 8 + (1 - minDistance) * 180 + leadQuality * 120));
}}

async function countUploads(env, ipAddress, sinceIso) {{
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM upload_events WHERE ip_address = ?1 AND created_at >= ?2`
  ).bind(ipAddress, sinceIso).first();
  return Number(result?.count || 0);
}}

export default {{
  async fetch(request, env) {{
    const url = new URL(request.url);
    const ipAddress = clientIp(request);

    if (request.method === "OPTIONS") {{
      return new Response(null, {{
        headers: {{
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
        }},
      }});
    }}

    if (url.pathname === "/health") {{
      return json({{ status: "ok" }});
    }}

    if (url.pathname === "/assets/app.js" || url.pathname === JS_ASSET_PATH) {{
      return text(APP_JS, "application/javascript; charset=utf-8");
    }}

    if (url.pathname === "/assets/app.css" || url.pathname === CSS_ASSET_PATH) {{
      return text(APP_CSS, "text/css; charset=utf-8");
    }}

    if (url.pathname === "/api/sessions" && request.method === "POST") {{
      const payload = await readJson(request);
      if (!payload || !Array.isArray(payload.frames) || payload.frames.length === 0) {{
        return json({{ error: "Invalid payload" }}, {{ status: 400 }});
      }}

      const validationError = validateFrames(payload);
      if (validationError) {{
        return json({{ error: validationError }}, {{ status: 400 }});
      }}

      const now = new Date();
      const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const minuteCount = await countUploads(env, ipAddress, minuteAgo);
      const hourCount = await countUploads(env, ipAddress, hourAgo);
      if (minuteCount >= UPLOAD_LIMIT_PER_MINUTE) {{
        return json({{ error: `Rate limit exceeded: ${{UPLOAD_LIMIT_PER_MINUTE}} uploads per minute` }}, {{ status: 429 }});
      }}
      if (hourCount >= UPLOAD_LIMIT_PER_HOUR) {{
        return json({{ error: `Rate limit exceeded: ${{UPLOAD_LIMIT_PER_HOUR}} uploads per hour` }}, {{ status: 429 }});
      }}

      const sessionId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      const createdAt = now.toISOString();
      const episodeCount = new Set(payload.frames.map((frame) => frame.episode)).size;
      const score = computeScore(payload.frames);
      const playerName = sanitizePlayerName(payload.meta);
      const metaJson = JSON.stringify({{ ...(payload.meta || {{}}), player_name: playerName, ip_hash_hint: ipAddress.slice(-6) }});
      const jsonl = sessionJsonl(payload.frames);

      await env.DB.prepare(
        `INSERT INTO sessions (session_id, source, player_name, frame_count, episode_count, created_at, score, meta_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      ).bind(
        sessionId,
        payload.source || "unknown",
        playerName,
        payload.frames.length,
        episodeCount,
        createdAt,
        score,
        metaJson
      ).run();

      await env.DB.prepare(
        `INSERT INTO session_traces (session_id, jsonl) VALUES (?1, ?2)`
      ).bind(sessionId, jsonl).run();

      await env.DB.prepare(
        `INSERT INTO upload_events (ip_address, created_at) VALUES (?1, ?2)`
      ).bind(ipAddress, createdAt).run();

      return json({{
        session_id: sessionId,
        source: payload.source || "unknown",
        player_name: playerName,
        frame_count: payload.frames.length,
        episode_count: episodeCount,
        created_at: createdAt,
        score,
        meta: {{ ...(payload.meta || {{}}), player_name: playerName }},
      }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    if (url.pathname === "/api/admin/stats" && request.method === "GET") {{
      const sourceResult = await env.DB.prepare(
        `SELECT source, COUNT(*) AS session_count, SUM(frame_count) AS frame_count, AVG(score) AS average_score
         FROM sessions GROUP BY source ORDER BY session_count DESC`
      ).all();
      const summaryResult = await env.DB.prepare(
        `SELECT COUNT(*) AS session_count, COALESCE(SUM(frame_count), 0) AS stored_frame_count,
                COALESCE(AVG(score), 0) AS average_score, COALESCE(MAX(score), 0) AS top_score
         FROM sessions`
      ).first();
      const leaderboardResult = await env.DB.prepare(
        `SELECT session_id, source, player_name, score, frame_count, episode_count, created_at
         FROM sessions ORDER BY score DESC, created_at DESC LIMIT 10`
      ).all();
      const now = new Date();
      const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const minuteCount = await countUploads(env, ipAddress, minuteAgo);
      const hourCount = await countUploads(env, ipAddress, hourAgo);
      return json({{
        session_count: Number(summaryResult?.session_count || 0),
        stored_frame_count: Number(summaryResult?.stored_frame_count || 0),
        average_score: Number(summaryResult?.average_score || 0),
        top_score: Number(summaryResult?.top_score || 0),
        leaderboard: (leaderboardResult.results || []).map((row) => ({{
          session_id: row.session_id,
          source: row.source,
          player_name: row.player_name || "anonymous",
          score: Number(row.score || 0),
          frame_count: Number(row.frame_count || 0),
          episode_count: Number(row.episode_count || 0),
          created_at: row.created_at,
        }})),
        sources: (sourceResult.results || []).map((row) => ({{
          source: row.source,
          session_count: Number(row.session_count || 0),
          frame_count: Number(row.frame_count || 0),
          average_score: Number(row.average_score || 0),
        }})),
        upload_limits: {{
          minute_limit: UPLOAD_LIMIT_PER_MINUTE,
          hourly_limit: UPLOAD_LIMIT_PER_HOUR,
          recent_uploads_from_ip: minuteCount,
          recent_hour_uploads_from_ip: hourCount,
        }},
      }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    if (url.pathname === "/api/sessions" && request.method === "GET") {{
      const result = await env.DB.prepare(
        `SELECT session_id, source, player_name, frame_count, episode_count, created_at, score, meta_json
         FROM sessions ORDER BY created_at DESC LIMIT 50`
      ).all();
      const sessions = (result.results || []).map((row) => ({{
        session_id: row.session_id,
        source: row.source,
        player_name: row.player_name || "anonymous",
        frame_count: Number(row.frame_count || 0),
        episode_count: Number(row.episode_count || 0),
        created_at: row.created_at,
        score: Number(row.score || 0),
        meta: JSON.parse(row.meta_json || "{{}}"),
      }}));
      return json({{ sessions }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    if (url.pathname === "/api/leaderboard" && request.method === "GET") {{
      const result = await env.DB.prepare(
        `SELECT session_id, source, player_name, score, frame_count, episode_count, created_at
         FROM sessions ORDER BY score DESC, created_at DESC LIMIT 25`
      ).all();
      return json({{
        leaderboard: (result.results || []).map((row) => ({{
          session_id: row.session_id,
          source: row.source,
          player_name: row.player_name || "anonymous",
          score: Number(row.score || 0),
          frame_count: Number(row.frame_count || 0),
          episode_count: Number(row.episode_count || 0),
          created_at: row.created_at,
        }})),
      }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    if (url.pathname.startsWith("/api/sessions/") && request.method === "GET") {{
      const parts = url.pathname.split("/").filter(Boolean);
      const sessionId = parts[2];
      if (!sessionId) {{
        return json({{ error: "Session not found" }}, {{ status: 404 }});
      }}

      if (parts[3] === "jsonl") {{
        const trace = await env.DB.prepare(
          `SELECT jsonl FROM session_traces WHERE session_id = ?1`
        ).bind(sessionId).first();
        if (!trace) {{
          return json({{ error: "Session trace not found" }}, {{ status: 404 }});
        }}
        return json({{ content: trace.jsonl }}, {{
          headers: {{ "access-control-allow-origin": "*" }},
        }});
      }}

      const row = await env.DB.prepare(
        `SELECT session_id, source, player_name, frame_count, episode_count, created_at, score, meta_json
         FROM sessions WHERE session_id = ?1`
      ).bind(sessionId).first();
      if (!row) {{
        return json({{ error: "Session not found" }}, {{ status: 404 }});
      }}

      return json({{
        session_id: row.session_id,
        source: row.source,
        player_name: row.player_name || "anonymous",
        frame_count: Number(row.frame_count || 0),
        episode_count: Number(row.episode_count || 0),
        created_at: row.created_at,
        score: Number(row.score || 0),
        meta: JSON.parse(row.meta_json || "{{}}"),
      }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    return html(
      INDEX_HTML
        .replace(JS_ASSET_PATH, "/assets/app.js")
        .replace(CSS_ASSET_PATH, "/assets/app.css")
    );
  }},
}};
"""
    OUTPUT_PATH.write_text(worker, encoding="utf-8")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
