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

    worker = f"""const INDEX_HTML = {js_string(html)};
const APP_JS = {js_string(js)};
const APP_CSS = {js_string(css)};
const UPLOAD_LIMIT_PER_MINUTE = 6;
const UPLOAD_LIMIT_PER_HOUR = 30;

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

    if (url.pathname === "/assets/app.js") {{
      return text(APP_JS, "application/javascript; charset=utf-8");
    }}

    if (url.pathname === "/assets/app.css") {{
      return text(APP_CSS, "text/css; charset=utf-8");
    }}

    if (url.pathname === "/api/sessions" && request.method === "POST") {{
      const payload = await readJson(request);
      if (!payload || !Array.isArray(payload.frames) || payload.frames.length === 0) {{
        return json({{ error: "Invalid payload" }}, {{ status: 400 }});
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
      const metaJson = JSON.stringify({{ ...(payload.meta || {{}}), ip_hash_hint: ipAddress.slice(-6) }});
      const jsonl = sessionJsonl(payload.frames);

      await env.DB.prepare(
        `INSERT INTO sessions (session_id, source, frame_count, episode_count, created_at, meta_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      ).bind(
        sessionId,
        payload.source || "unknown",
        payload.frames.length,
        episodeCount,
        createdAt,
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
        frame_count: payload.frames.length,
        episode_count: episodeCount,
        created_at: createdAt,
        meta: payload.meta || {{}},
      }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    if (url.pathname === "/api/admin/stats" && request.method === "GET") {{
      const sourceResult = await env.DB.prepare(
        `SELECT source, COUNT(*) AS session_count, SUM(frame_count) AS frame_count
         FROM sessions GROUP BY source ORDER BY session_count DESC`
      ).all();
      const summaryResult = await env.DB.prepare(
        `SELECT COUNT(*) AS session_count, COALESCE(SUM(frame_count), 0) AS stored_frame_count FROM sessions`
      ).first();
      const now = new Date();
      const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const minuteCount = await countUploads(env, ipAddress, minuteAgo);
      const hourCount = await countUploads(env, ipAddress, hourAgo);
      return json({{
        session_count: Number(summaryResult?.session_count || 0),
        stored_frame_count: Number(summaryResult?.stored_frame_count || 0),
        sources: (sourceResult.results || []).map((row) => ({{
          source: row.source,
          session_count: Number(row.session_count || 0),
          frame_count: Number(row.frame_count || 0),
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
        `SELECT session_id, source, frame_count, episode_count, created_at, meta_json
         FROM sessions ORDER BY created_at DESC LIMIT 50`
      ).all();

      const sessions = (result.results || []).map((row) => ({{
        session_id: row.session_id,
        source: row.source,
        frame_count: row.frame_count,
        episode_count: row.episode_count,
        created_at: row.created_at,
        meta: JSON.parse(row.meta_json || "{{}}"),
      }}));
      return json({{ sessions }}, {{
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
        `SELECT session_id, source, frame_count, episode_count, created_at, meta_json
         FROM sessions WHERE session_id = ?1`
      ).bind(sessionId).first();
      if (!row) {{
        return json({{ error: "Session not found" }}, {{ status: 404 }});
      }}

      return json({{
        session_id: row.session_id,
        source: row.source,
        frame_count: row.frame_count,
        episode_count: row.episode_count,
        created_at: row.created_at,
        meta: JSON.parse(row.meta_json || "{{}}"),
      }}, {{
        headers: {{ "access-control-allow-origin": "*" }},
      }});
    }}

    return html(
      INDEX_HTML
        .replace("/assets/index-CbzGeoJP.js", "/assets/app.js")
        .replace("/assets/index-DuqdNiZL.css", "/assets/app.css")
    );
  }},
}};
"""
    OUTPUT_PATH.write_text(worker, encoding="utf-8")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
