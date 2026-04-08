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

export default {{
  async fetch(request, env) {{
    const url = new URL(request.url);

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

      const sessionId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      const createdAt = new Date().toISOString();
      const episodeCount = new Set(payload.frames.map((frame) => frame.episode)).size;
      const metaJson = JSON.stringify(payload.meta || {{}});
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
