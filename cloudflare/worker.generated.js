const INDEX_HTML = "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Aim RL Collector</title>\n    <script type=\"module\" crossorigin src=\"/assets/index-BIN5_0rX.js\"></script>\n    <link rel=\"stylesheet\" crossorigin href=\"/assets/index-DuqdNiZL.css\">\n  </head>\n  <body>\n    <div id=\"app\"></div>\n  </body>\n  </html>\n\n";
const APP_JS = "(function(){const o=document.createElement(\"link\").relList;if(o&&o.supports&&o.supports(\"modulepreload\"))return;for(const n of document.querySelectorAll('link[rel=\"modulepreload\"]'))i(n);new MutationObserver(n=>{for(const d of n)if(d.type===\"childList\")for(const S of d.addedNodes)S.tagName===\"LINK\"&&S.rel===\"modulepreload\"&&i(S)}).observe(document,{childList:!0,subtree:!0});function s(n){const d={};return n.integrity&&(d.integrity=n.integrity),n.referrerPolicy&&(d.referrerPolicy=n.referrerPolicy),n.crossOrigin===\"use-credentials\"?d.credentials=\"include\":n.crossOrigin===\"anonymous\"?d.credentials=\"omit\":d.credentials=\"same-origin\",d}function i(n){if(n.ep)return;n.ep=!0;const d=s(n);fetch(n.href,d)}})();const p=1/60,a=1,g=1,G=.07,J=.03,T=1.4,x=.09,b=.55,C=.14,A=.18,he=.85,ve=.45,ye=.7,Se=.12,we=.01,xe=300,Ee=window.location.origin;let w=!1,X=0,v=[],q=[],Y=0,O=0,_=0,f=\"Ready\",D=17,e=ue();const Z=document.querySelector(\"#app\");if(!Z)throw new Error(\"App root not found.\");Z.innerHTML=`\n  <section class=\"panel sidebar\">\n    <div>\n      <p class=\"eyebrow\">Browser Collector</p>\n      <h1>Aim RL Web Arena</h1>\n      <p class=\"lede\">\n        Move your mouse like a game. The browser records target motion, your cursor\n        response, and lead-aim metrics into uploadable session traces.\n      </p>\n    </div>\n\n    <div class=\"controls\">\n      <div class=\"button-row\">\n        <button id=\"toggle-run\">Start</button>\n        <button id=\"reset-episode\" class=\"secondary\">Reset Episode</button>\n        <button id=\"save-local\" class=\"ghost\">Download JSONL</button>\n        <button id=\"upload-session\" class=\"secondary\">Upload Session</button>\n      </div>\n    </div>\n\n    <div class=\"api-box\">\n      <label>\n        API Base URL\n        <input id=\"api-base\" value=\"${Ee}\" />\n      </label>\n      <button id=\"refresh-sessions\" class=\"ghost\">Refresh Saved Sessions</button>\n    </div>\n\n    <div class=\"metrics\">\n      <div class=\"metric-grid\">\n        <div class=\"metric\"><span>Mode</span><strong id=\"metric-mode\">Paused</strong></div>\n        <div class=\"metric\"><span>Episode</span><strong id=\"metric-episode\">1</strong></div>\n        <div class=\"metric\"><span>Frames</span><strong id=\"metric-frames\">0</strong></div>\n        <div class=\"metric\"><span>Distance</span><strong id=\"metric-distance\">0.000</strong></div>\n        <div class=\"metric\"><span>Lead Offset</span><strong id=\"metric-forward\">0.000</strong></div>\n        <div class=\"metric\"><span>Reward</span><strong id=\"metric-reward\">0.000</strong></div>\n      </div>\n    </div>\n\n    <div class=\"sessions\">\n      <strong>Uploaded Sessions</strong>\n      <ol id=\"session-list\" class=\"session-list\"></ol>\n    </div>\n\n    <p id=\"status-line\" class=\"footer-note\">Ready</p>\n  </section>\n\n  <section class=\"panel canvas-panel\">\n    <div class=\"canvas-shell\">\n      <canvas id=\"arena\" width=\"960\" height=\"960\"></canvas>\n      <div class=\"canvas-overlay\">\n        <div class=\"badge\">Orange = track zone, violet = hit zone, green = lead point</div>\n        <div class=\"hint\">Space start/pause, R reset, U upload</div>\n      </div>\n    </div>\n  </section>\n`;const l=document.querySelector(\"#arena\"),r=l?.getContext(\"2d\"),K=document.querySelector(\"#metric-mode\"),z=document.querySelector(\"#metric-episode\"),Q=document.querySelector(\"#metric-frames\"),ee=document.querySelector(\"#metric-distance\"),te=document.querySelector(\"#metric-forward\"),oe=document.querySelector(\"#metric-reward\"),se=document.querySelector(\"#status-line\"),re=document.querySelector(\"#session-list\"),I=document.querySelector(\"#api-base\"),M=document.querySelector(\"#toggle-run\"),ne=document.querySelector(\"#reset-episode\"),ie=document.querySelector(\"#save-local\"),ce=document.querySelector(\"#upload-session\"),ae=document.querySelector(\"#refresh-sessions\");if(!l||!r||!K||!z||!Q||!ee||!te||!oe||!se||!re||!I||!M||!ne||!ie||!ce||!ae)throw new Error(\"Required DOM nodes are missing.\");l.addEventListener(\"mousemove\",t=>{const o=l.getBoundingClientRect();Y=u(((t.clientX-o.left)/o.width*2-1)*a,-a,a),O=u((1-(t.clientY-o.top)/o.height*2)*g,-g,g)});window.addEventListener(\"keydown\",t=>{t.code===\"Space\"?(t.preventDefault(),le()):t.key.toLowerCase()===\"r\"?k():t.key.toLowerCase()===\"u\"&&pe()});M.addEventListener(\"click\",()=>le());ne.addEventListener(\"click\",()=>k());ie.addEventListener(\"click\",()=>Le());ce.addEventListener(\"click\",()=>{pe()});ae.addEventListener(\"click\",()=>{N()});Y=e.cursorX;O=e.cursorY;ge();N();requestAnimationFrame(de);function de(t){if(_===0&&(_=t),w&&t-_>=p*1e3){const o=Math.max(1,Math.floor((t-_)/(p*1e3)));for(let s=0;s<o;s+=1)_e();_=t}ge(),requestAnimationFrame(de)}function le(){w=!w,f=w?\"Collecting frames\":\"Paused\",M.textContent=w?\"Pause\":\"Start\",m(h())}function k(){X+=1,e=ue(),Y=e.cursorX,O=e.cursorY,f=`Episode ${X+1} ready`,m(h())}function _e(){const t=e.cursorX,o=e.cursorY,s=e.cursorVx,i=e.cursorVy;e.cursorX=u(Y,-a,a),e.cursorY=u(O,-g,g),e.cursorVx=u((e.cursorX-t)/p,-T,T),e.cursorVy=u((e.cursorY-o)/p,-T,T);const n=u(e.cursorVx-s,-x,x),d=u(e.cursorVy-i,-x,x);e.targetVx=u(e.targetVx+E(-C,C)*p,-b,b),e.targetVy=u(e.targetVy+E(-C,C)*p,-b,b);const S=e.targetX+e.targetVx*p,U=e.targetY+e.targetVy*p;(S>a||S<-a)&&(e.targetVx*=-1),(U>g||U<-g)&&(e.targetVy*=-1),e.targetX=u(e.targetX+e.targetVx*p,-a,a),e.targetY=u(e.targetY+e.targetVy*p,-g,g);const W=u(e.targetX+e.targetVx*A,-a,a),$=u(e.targetY+e.targetVy*A,-g,g),L=R(e.targetX-e.cursorX,e.targetY-e.cursorY),F=R(W-e.cursorX,$-e.cursorY),H=R(e.targetVx,e.targetVy)*A*ye,j=Ce(),fe=R(n-e.prevActionX,d-e.prevActionY),me=L<=G,B=L<=J;e.consecutiveHits=B?e.consecutiveHits+1:0;let y=0;y+=Math.max(0,1-L/a),y+=he*Math.max(0,1-F/a),y+=ve*Math.max(0,1-Math.abs(j-H)/a),y-=we,y-=fe*Se,me&&(y+=.5),B&&(y+=1.5),e.consecutiveHits>=8&&(y+=2),e.prevActionX=n,e.prevActionY=d,e.stepCount+=1,v.push({episode:X+1,step:e.stepCount,t:c(e.stepCount*p,6),cursor_x:c(e.cursorX,6),cursor_y:c(e.cursorY,6),cursor_vx:c(e.cursorVx,6),cursor_vy:c(e.cursorVy,6),target_x:c(e.targetX,6),target_y:c(e.targetY,6),target_vx:c(e.targetVx,6),target_vy:c(e.targetVy,6),lead_x:c(W,6),lead_y:c($,6),action_x:c(n/x,6),action_y:c(d/x,6),distance:c(L,6),lead_distance:c(F,6),forward_offset:c(j,6),desired_forward_offset:c(H,6),reward:c(y,6),source:\"human-web\"}),(e.stepCount>=xe||e.consecutiveHits>=8)&&(k(),w=!0,M.textContent=\"Pause\"),m(h())}function ue(){const t=E(0,Math.PI*2),o=E(.15,b);return{stepCount:0,cursorX:0,cursorY:0,cursorVx:0,cursorVy:0,targetX:E(-.6,.6),targetY:E(-.4,.4),targetVx:Math.cos(t)*o,targetVy:Math.sin(t)*o,prevActionX:0,prevActionY:0,consecutiveHits:0}}function ge(){r.clearRect(0,0,l.width,l.height);const t=r.createLinearGradient(0,0,l.width,l.height);t.addColorStop(0,\"#fefefe\"),t.addColorStop(1,\"#eef3ff\"),r.fillStyle=t,r.fillRect(0,0,l.width,l.height);const o=P(e.targetX,e.targetY),s=P(e.cursorX,e.cursorY),i=P(u(e.targetX+e.targetVx*A,-a,a),u(e.targetY+e.targetVy*A,-g,g));be(),V(o.x,o.y,G,\"#f39c12\",2),V(o.x,o.y,J,\"#8e44ad\",2),V(o.x,o.y,.012,\"#d7263d\",0,!0),V(i.x,i.y,.009,\"#2faa68\",2),Re(s.x,s.y,14,\"#1f4fff\")}function be(){r.strokeStyle=\"rgba(31, 36, 48, 0.08)\",r.lineWidth=1;for(let t=1;t<8;t+=1){const o=t/8,s=o*l.width,i=o*l.height;r.beginPath(),r.moveTo(s,0),r.lineTo(s,l.height),r.stroke(),r.beginPath(),r.moveTo(0,i),r.lineTo(l.width,i),r.stroke()}}function V(t,o,s,i,n,d=!1){const S=s/a*l.width*.5;r.beginPath(),r.arc(t,o,S,0,Math.PI*2),d?(r.fillStyle=i,r.fill()):(r.strokeStyle=i,r.lineWidth=n,r.stroke())}function Re(t,o,s,i){r.strokeStyle=i,r.lineWidth=2.5,r.beginPath(),r.moveTo(t-s,o),r.lineTo(t+s,o),r.moveTo(t,o-s),r.lineTo(t,o+s),r.stroke()}function m(t){K.textContent=w?\"Running\":\"Paused\",z.textContent=String(X+1),Q.textContent=String(v.length),ee.textContent=t?t.distance.toFixed(3):\"0.000\",te.textContent=t?t.forward_offset.toFixed(3):\"0.000\",oe.textContent=t?t.reward.toFixed(3):\"0.000\",se.textContent=f}function h(){return v[v.length-1]}function Ae(){const t=new Set(v.map(o=>o.episode));return{source:\"human-web\",frames:v,meta:{episode_count:t.size,frame_count:v.length,client:\"aim-rl-web\",created_at:new Date().toISOString()}}}function Le(){if(v.length===0){f=\"No frames collected yet\",m(h());return}const t=v.map(n=>JSON.stringify(n)).join(`\n`),o=new Blob([t],{type:\"application/jsonl\"}),s=URL.createObjectURL(o),i=document.createElement(\"a\");i.href=s,i.download=`human-web-${new Date().toISOString().replace(/[:.]/g,\"-\")}.jsonl`,i.click(),URL.revokeObjectURL(s),f=\"Downloaded JSONL session\",m(h())}async function pe(){if(v.length===0){f=\"No frames to upload\",m(h());return}f=\"Uploading session\",m(h());const t=await fetch(`${I.value.replace(/\\/$/,\"\")}/api/sessions`,{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify(Ae())});if(!t.ok){f=`Upload failed: ${t.status}`,m(h());return}f=\"Session uploaded\",m(h()),await N()}async function N(){const t=await fetch(`${I.value.replace(/\\/$/,\"\")}/api/sessions`);if(!t.ok){f=`Session list failed: ${t.status}`,m(h());return}q=(await t.json()).sessions,Te(),f=`Loaded ${q.length} saved sessions`,m(h())}function Te(){re.innerHTML=q.slice(0,8).map(t=>`<li><strong>${t.session_id}</strong><br />${t.source} \u00b7 ${t.frame_count} frames \u00b7 ${t.episode_count} episodes</li>`).join(\"\")}function P(t,o){return{x:(t/a+1)*.5*l.width,y:(1-(o/g+1)*.5)*l.height}}function Ce(){const t=R(e.targetVx,e.targetVy);if(t<1e-8)return 0;const o=e.targetVx/t,s=e.targetVy/t;return(e.cursorX-e.targetX)*o+(e.cursorY-e.targetY)*s}function E(t,o){D=(D*1664525+1013904223)%4294967296;const s=D/4294967296;return t+(o-t)*s}function u(t,o,s){return Math.max(o,Math.min(s,t))}function R(t,o){return Math.sqrt(t*t+o*o)}function c(t,o){const s=10**o;return Math.round(t*s)/s}\n";
const APP_CSS = ":root{color-scheme:light;font-family:Space Grotesk,Segoe UI,sans-serif;background:radial-gradient(circle at top left,#f6efe3 0%,transparent 35%),radial-gradient(circle at bottom right,#dbe8ff 0%,transparent 30%),#f7f7f2;color:#1f2430}*{box-sizing:border-box}body{margin:0;min-height:100vh}#app{display:grid;grid-template-columns:minmax(340px,420px) minmax(480px,1fr);gap:24px;min-height:100vh;padding:24px}.panel{border:1px solid rgba(31,36,48,.12);border-radius:24px;background:#ffffffd1;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 18px 50px #1f24301a}.sidebar{display:flex;flex-direction:column;gap:18px;padding:24px}.eyebrow{margin:0 0 8px;color:#7f5af0;font-size:12px;letter-spacing:.18em;text-transform:uppercase}h1{margin:0;font-size:36px;line-height:1}.lede{margin:12px 0 0;color:#4a5161;line-height:1.55}.controls,.metrics,.sessions,.api-box{display:grid;gap:10px}.button-row{display:flex;flex-wrap:wrap;gap:10px}button{border:0;border-radius:999px;padding:12px 16px;background:#1f2430;color:#fff;font:inherit;cursor:pointer;transition:transform .12s ease,opacity .12s ease}button.secondary{background:#dbe2ef;color:#1f2430}button.ghost{background:transparent;color:#1f2430;border:1px solid rgba(31,36,48,.18)}button:hover{transform:translateY(-1px)}button:disabled{opacity:.45;cursor:not-allowed;transform:none}label{display:grid;gap:6px;font-size:14px}input{width:100%;border:1px solid rgba(31,36,48,.16);border-radius:12px;padding:10px 12px;font:inherit}.metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{border-radius:18px;background:#f3f5fb;padding:14px}.metric span{display:block;color:#626b80;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.metric strong{display:block;margin-top:6px;font-size:20px}.canvas-panel{position:relative;overflow:hidden;padding:18px}.canvas-shell{position:relative;border-radius:20px;overflow:hidden;height:100%;min-height:720px;background:linear-gradient(135deg,rgba(127,90,240,.08),transparent 35%),linear-gradient(315deg,rgba(47,170,104,.08),transparent 35%),#fbfbfd}canvas{display:block;width:100%;height:100%}.canvas-overlay{position:absolute;left:18px;right:18px;top:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;pointer-events:none}.badge,.hint{border-radius:999px;background:#ffffffd1;border:1px solid rgba(31,36,48,.12);padding:8px 12px;font-size:13px}.session-list{margin:0;padding-left:18px;color:#4a5161}.session-list li{margin:6px 0}.footer-note{color:#626b80;font-size:13px;line-height:1.5}@media(max-width:1100px){#app{grid-template-columns:1fr}.canvas-shell{min-height:560px}}\n";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function html(body) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function text(body, contentType) {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function sessionJsonl(frames) {
  return frames.map((frame) => JSON.stringify(frame)).join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({ status: "ok" });
    }

    if (url.pathname === "/assets/app.js") {
      return text(APP_JS, "application/javascript; charset=utf-8");
    }

    if (url.pathname === "/assets/app.css") {
      return text(APP_CSS, "text/css; charset=utf-8");
    }

    if (url.pathname === "/api/sessions" && request.method === "POST") {
      const payload = await readJson(request);
      if (!payload || !Array.isArray(payload.frames) || payload.frames.length === 0) {
        return json({ error: "Invalid payload" }, { status: 400 });
      }

      const sessionId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      const createdAt = new Date().toISOString();
      const episodeCount = new Set(payload.frames.map((frame) => frame.episode)).size;
      const metaJson = JSON.stringify(payload.meta || {});
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

      return json({
        session_id: sessionId,
        source: payload.source || "unknown",
        frame_count: payload.frames.length,
        episode_count: episodeCount,
        created_at: createdAt,
        meta: payload.meta || {},
      }, {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    if (url.pathname === "/api/sessions" && request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT session_id, source, frame_count, episode_count, created_at, meta_json
         FROM sessions ORDER BY created_at DESC LIMIT 50`
      ).all();

      const sessions = (result.results || []).map((row) => ({
        session_id: row.session_id,
        source: row.source,
        frame_count: row.frame_count,
        episode_count: row.episode_count,
        created_at: row.created_at,
        meta: JSON.parse(row.meta_json || "{}"),
      }));
      return json({ sessions }, {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    if (url.pathname.startsWith("/api/sessions/") && request.method === "GET") {
      const parts = url.pathname.split("/").filter(Boolean);
      const sessionId = parts[2];
      if (!sessionId) {
        return json({ error: "Session not found" }, { status: 404 });
      }

      if (parts[3] === "jsonl") {
        const trace = await env.DB.prepare(
          `SELECT jsonl FROM session_traces WHERE session_id = ?1`
        ).bind(sessionId).first();
        if (!trace) {
          return json({ error: "Session trace not found" }, { status: 404 });
        }
        return json({ content: trace.jsonl }, {
          headers: { "access-control-allow-origin": "*" },
        });
      }

      const row = await env.DB.prepare(
        `SELECT session_id, source, frame_count, episode_count, created_at, meta_json
         FROM sessions WHERE session_id = ?1`
      ).bind(sessionId).first();
      if (!row) {
        return json({ error: "Session not found" }, { status: 404 });
      }

      return json({
        session_id: row.session_id,
        source: row.source,
        frame_count: row.frame_count,
        episode_count: row.episode_count,
        created_at: row.created_at,
        meta: JSON.parse(row.meta_json || "{}"),
      }, {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    return html(
      INDEX_HTML
        .replace("/assets/index-CbzGeoJP.js", "/assets/app.js")
        .replace("/assets/index-DuqdNiZL.css", "/assets/app.css")
    );
  },
};
