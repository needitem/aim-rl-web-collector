const INDEX_HTML = "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Aim RL Collector</title>\n    <script type=\"module\" crossorigin src=\"/assets/index-dhJI1ivM.js\"></script>\n    <link rel=\"stylesheet\" crossorigin href=\"/assets/index-H5tmK3tN.css\">\n  </head>\n  <body>\n    <div id=\"app\"></div>\n  </body>\n  </html>\n\n";
const APP_JS = "(function(){const t=document.createElement(\"link\").relList;if(t&&t.supports&&t.supports(\"modulepreload\"))return;for(const r of document.querySelectorAll('link[rel=\"modulepreload\"]'))o(r);new MutationObserver(r=>{for(const a of r)if(a.type===\"childList\")for(const d of a.addedNodes)d.tagName===\"LINK\"&&d.rel===\"modulepreload\"&&o(d)}).observe(document,{childList:!0,subtree:!0});function n(r){const a={};return r.integrity&&(a.integrity=r.integrity),r.referrerPolicy&&(a.referrerPolicy=r.referrerPolicy),r.crossOrigin===\"use-credentials\"?a.credentials=\"include\":r.crossOrigin===\"anonymous\"?a.credentials=\"omit\":a.credentials=\"same-origin\",a}function o(r){if(r.ep)return;r.ep=!0;const a=n(r);fetch(r.href,a)}})();const y=1/60,c=1,m=1,ce=.07,de=.03,W=1.4,x=.09,D=.55,B=.14,Q=.18,Re=.85,Le=.45,Ae=.7,Te=.12,Ce=.01,xe=300,$e=window.location.origin;let T=!1,q=0,h=[],G=[],R=null,u=[],S=0,L=!1,J=0,Z=0,P=0,k=0,p=\"Ready\",ee=17,w=null,s=ve();const ue=document.querySelector(\"#app\");if(!ue)throw new Error(\"App root not found.\");ue.innerHTML=`\n  <section class=\"panel sidebar\">\n    <div>\n      <p class=\"eyebrow\">Browser Collector</p>\n      <h1>Aim RL Web Arena</h1>\n      <p class=\"lede\">\n        Collect human aim traces, upload them to the backend, inspect stored sessions,\n        and replay captured motion without leaving the browser.\n      </p>\n    </div>\n\n    <div class=\"controls\">\n      <div class=\"button-row\">\n        <button id=\"toggle-run\">Start</button>\n        <button id=\"reset-episode\" class=\"secondary\">Reset Episode</button>\n        <button id=\"save-local\" class=\"ghost\">Download JSONL</button>\n        <button id=\"upload-session\" class=\"secondary\">Upload Session</button>\n      </div>\n    </div>\n\n    <div class=\"api-box\">\n      <label>\n        API Base URL\n        <input id=\"api-base\" value=\"${$e}\" />\n      </label>\n      <div class=\"button-row\">\n        <button id=\"refresh-admin\" class=\"ghost\">Refresh Admin</button>\n        <button id=\"clear-replay\" class=\"ghost\">Clear Replay</button>\n      </div>\n    </div>\n\n    <div class=\"metrics\">\n      <div class=\"metric-grid\">\n        <div class=\"metric\"><span>Mode</span><strong id=\"metric-mode\">Paused</strong></div>\n        <div class=\"metric\"><span>Episode</span><strong id=\"metric-episode\">1</strong></div>\n        <div class=\"metric\"><span>Frames</span><strong id=\"metric-frames\">0</strong></div>\n        <div class=\"metric\"><span>Distance</span><strong id=\"metric-distance\">0.000</strong></div>\n        <div class=\"metric\"><span>Lead Offset</span><strong id=\"metric-forward\">0.000</strong></div>\n        <div class=\"metric\"><span>Reward</span><strong id=\"metric-reward\">0.000</strong></div>\n      </div>\n    </div>\n\n    <div class=\"admin-block\">\n      <strong>Admin Snapshot</strong>\n      <div id=\"admin-stats\" class=\"admin-stats\"></div>\n    </div>\n\n    <div class=\"sessions\">\n      <strong>Stored Sessions</strong>\n      <ul id=\"session-list\" class=\"session-list\"></ul>\n    </div>\n\n    <p id=\"status-line\" class=\"footer-note\">Ready</p>\n  </section>\n\n  <section class=\"panel canvas-panel\">\n    <div class=\"canvas-shell\">\n      <canvas id=\"arena\" width=\"960\" height=\"960\"></canvas>\n      <div class=\"canvas-overlay\">\n        <div class=\"badge\">Orange = track zone, violet = hit zone, green = lead point</div>\n        <div class=\"hint\">Space start/pause, R reset, U upload</div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"panel replay-panel\">\n    <div class=\"replay-header\">\n      <div>\n        <p class=\"eyebrow\">Replay Viewer</p>\n        <h2 id=\"replay-title\">No Session Loaded</h2>\n      </div>\n      <div class=\"button-row\">\n        <button id=\"replay-toggle\" class=\"secondary\" disabled>Play</button>\n        <button id=\"replay-download\" class=\"ghost\" disabled>Download Trace</button>\n      </div>\n    </div>\n\n    <div class=\"replay-shell\">\n      <canvas id=\"replay-canvas\" width=\"720\" height=\"720\"></canvas>\n    </div>\n\n    <div class=\"replay-controls\">\n      <input id=\"replay-slider\" type=\"range\" min=\"0\" max=\"0\" value=\"0\" disabled />\n      <div class=\"replay-meta\">\n        <span id=\"replay-step\">step 0 / 0</span>\n        <span id=\"replay-distance\">distance 0.000</span>\n      </div>\n    </div>\n  </section>\n`;const N=i(\"#arena\"),Xe=Ee(N),se=i(\"#replay-canvas\"),Ve=Ee(se),Ye=i(\"#api-base\"),oe=i(\"#toggle-run\"),Me=i(\"#reset-episode\"),Oe=i(\"#save-local\"),Pe=i(\"#upload-session\"),De=i(\"#refresh-admin\"),ke=i(\"#clear-replay\"),ne=i(\"#replay-toggle\"),pe=i(\"#replay-download\"),I=i(\"#replay-slider\"),Fe=i(\"#metric-mode\"),Ie=i(\"#metric-episode\"),Ne=i(\"#metric-frames\"),je=i(\"#metric-distance\"),He=i(\"#metric-forward\"),We=i(\"#metric-reward\"),Be=i(\"#status-line\"),le=i(\"#admin-stats\"),Ue=i(\"#session-list\"),qe=i(\"#replay-title\"),Ge=i(\"#replay-step\"),Je=i(\"#replay-distance\");N.addEventListener(\"mousemove\",e=>{const t=N.getBoundingClientRect();J=g(((e.clientX-t.left)/t.width*2-1)*c,-c,c),Z=g((1-(e.clientY-t.top)/t.height*2)*m,-m,m)});window.addEventListener(\"keydown\",e=>{const t=e.key.toLowerCase();e.code===\"Space\"?(e.preventDefault(),ge()):t===\"r\"?re():t===\"u\"?_e():t===\"p\"&&u.length>0&&Se()});oe.addEventListener(\"click\",()=>ge());Me.addEventListener(\"click\",()=>re());Oe.addEventListener(\"click\",()=>et());Pe.addEventListener(\"click\",()=>{_e()});De.addEventListener(\"click\",()=>{ae()});ke.addEventListener(\"click\",()=>we());ne.addEventListener(\"click\",()=>Se());pe.addEventListener(\"click\",()=>{rt()});I.addEventListener(\"input\",()=>{S=Number(I.value),L=!1,j()});J=s.cursorX;Z=s.cursorY;ye();me();ae();requestAnimationFrame(fe);function fe(e){if(P===0&&(P=e),k===0&&(k=e),T&&e-P>=y*1e3){const t=Math.max(1,Math.floor((e-P)/(y*1e3)));for(let n=0;n<t;n+=1)Ze();P=e}L&&u.length>0&&e-k>=y*1e3&&(S=Math.min(S+1,u.length-1),S>=u.length-1&&(L=!1),k=e,j()),ye(),me(),requestAnimationFrame(fe)}function ge(){T=!T,p=T?\"Collecting frames\":\"Paused\",oe.textContent=T?\"Pause\":\"Start\",f(lastFrame())}function re(){q+=1,s=ve(),J=s.cursorX,Z=s.cursorY,p=`Episode ${q+1} ready`,f(lastFrame())}function Ze(){const e=s.cursorX,t=s.cursorY,n=s.cursorVx,o=s.cursorVy;s.cursorX=g(J,-c,c),s.cursorY=g(Z,-m,m),s.cursorVx=g((s.cursorX-e)/y,-W,W),s.cursorVy=g((s.cursorY-t)/y,-W,W);const r=g(s.cursorVx-n,-x,x),a=g(s.cursorVy-o,-x,x);s.targetVx=g(s.targetVx+$(-B,B)*y,-D,D),s.targetVy=g(s.targetVy+$(-B,B)*y,-D,D);const d=s.targetX+s.targetVx*y,C=s.targetY+s.targetVy*y;(d>c||d<-c)&&(s.targetVx*=-1),(C>m||C<-m)&&(s.targetVy*=-1),s.targetX=g(s.targetX+s.targetVx*y,-c,c),s.targetY=g(s.targetY+s.targetVy*y,-m,m);const b=g(s.targetX+s.targetVx*Q,-c,c),X=g(s.targetY+s.targetVy*Q,-m,m),A=F(s.targetX-s.cursorX,s.targetY-s.cursorY),V=F(b-s.cursorX,X-s.cursorY),Y=F(s.targetVx,s.targetVy)*Q*Ae,M=at(),E=F(r-s.prevActionX,a-s.prevActionY),H=A<=ce,O=A<=de;s.consecutiveHits=O?s.consecutiveHits+1:0;let _=0;_+=Math.max(0,1-A/c),_+=Re*Math.max(0,1-V/c),_+=Le*Math.max(0,1-Math.abs(M-Y)/c),_-=Ce,_-=E*Te,H&&(_+=.5),O&&(_+=1.5),s.consecutiveHits>=8&&(_+=2),s.prevActionX=r,s.prevActionY=a,s.stepCount+=1,h.push({episode:q+1,step:s.stepCount,t:l(s.stepCount*y,6),cursor_x:l(s.cursorX,6),cursor_y:l(s.cursorY,6),cursor_vx:l(s.cursorVx,6),cursor_vy:l(s.cursorVy,6),target_x:l(s.targetX,6),target_y:l(s.targetY,6),target_vx:l(s.targetVx,6),target_vy:l(s.targetVy,6),lead_x:l(b,6),lead_y:l(X,6),action_x:l(r/x,6),action_y:l(a/x,6),distance:l(A,6),lead_distance:l(V,6),forward_offset:l(M,6),desired_forward_offset:l(Y,6),reward:l(_,6),source:\"human-web\"}),(s.stepCount>=xe||s.consecutiveHits>=8)&&(re(),T=!0,oe.textContent=\"Pause\"),f(lastFrame())}function ve(){const e=$(0,Math.PI*2),t=$(.15,D);return{stepCount:0,cursorX:0,cursorY:0,cursorVx:0,cursorVy:0,targetX:$(-.6,.6),targetY:$(-.4,.4),targetVx:Math.cos(e)*t,targetVy:Math.sin(e)*t,prevActionX:0,prevActionY:0,consecutiveHits:0}}function ye(){he(Xe,N.width,N.height,v(),s.targetX,s.targetY,s.cursorX,s.cursorY)}function me(){he(Ve,se.width,se.height,u[S],null,null,null,null)}function v(){return h[h.length-1]}function he(e,t,n,o,r,a,d,C){e.clearRect(0,0,t,n);const b=e.createLinearGradient(0,0,t,n);b.addColorStop(0,\"#fefefe\"),b.addColorStop(1,\"#eef3ff\"),e.fillStyle=b,e.fillRect(0,0,t,n),Ke(e,t,n);const X=o?o.target_x:r,A=o?o.target_y:a,V=o?o.cursor_x:d,z=o?o.cursor_y:C,Y=o?.lead_x??null,M=o?.lead_y??null;if(X==null||A==null||V==null||z==null)return;const E=te(X,A,t,n),H=te(V,z,t,n);if(U(e,E.x,E.y,ce,\"#f39c12\",2,t),U(e,E.x,E.y,de,\"#8e44ad\",2,t),U(e,E.x,E.y,.012,\"#d7263d\",0,t,!0),Y!=null&&M!=null){const O=te(Y,M,t,n);U(e,O.x,O.y,.009,\"#2faa68\",2,t)}ze(e,H.x,H.y,Math.max(12,t/60),\"#1f4fff\")}function Ke(e,t,n){e.strokeStyle=\"rgba(31, 36, 48, 0.08)\",e.lineWidth=1;for(let o=1;o<8;o+=1){const r=o/8,a=r*t,d=r*n;e.beginPath(),e.moveTo(a,0),e.lineTo(a,n),e.stroke(),e.beginPath(),e.moveTo(0,d),e.lineTo(t,d),e.stroke()}}function U(e,t,n,o,r,a,d,C=!1){const b=o/c*d*.5;e.beginPath(),e.arc(t,n,b,0,Math.PI*2),C?(e.fillStyle=r,e.fill()):(e.strokeStyle=r,e.lineWidth=a,e.stroke())}function ze(e,t,n,o,r){e.strokeStyle=r,e.lineWidth=2.5,e.beginPath(),e.moveTo(t-o,n),e.lineTo(t+o,n),e.moveTo(t,n-o),e.lineTo(t,n+o),e.stroke()}function f(e){Fe.textContent=T?\"Running\":\"Paused\",Ie.textContent=String(q+1),Ne.textContent=String(h.length),je.textContent=e?e.distance.toFixed(3):\"0.000\",He.textContent=e?e.forward_offset.toFixed(3):\"0.000\",We.textContent=e?e.reward.toFixed(3):\"0.000\",Be.textContent=p}function Qe(){const e=new Set(h.map(t=>t.episode));return{source:\"human-web\",frames:h,meta:{episode_count:e.size,frame_count:h.length,client:\"aim-rl-web\",created_at:new Date().toISOString()}}}function et(){if(h.length===0){p=\"No frames collected yet\",f(v());return}be(h,`human-web-${it()}.jsonl`),p=\"Downloaded JSONL session\",f(v())}async function _e(){if(h.length===0){p=\"No frames to upload\",f(v());return}p=\"Uploading session\",f(v());const e=await fetch(`${K()}/api/sessions`,{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify(Qe())});if(!e.ok){const t=await e.text();p=`Upload failed: ${e.status} ${t}`,f(v());return}p=\"Session uploaded\",f(v()),await ae()}async function ae(){await Promise.all([tt(),st()])}async function tt(){const e=await fetch(`${K()}/api/sessions`);if(!e.ok){p=`Session list failed: ${e.status}`,f(v());return}G=(await e.json()).sessions,ie(),R&&!G.some(n=>n.session_id===R)&&we()}async function st(){const e=await fetch(`${K()}/api/admin/stats`);if(!e.ok){p=`Admin stats failed: ${e.status}`,f(v());return}w=await e.json(),nt(),p=`Loaded ${G.length} sessions`,f(v())}function nt(){if(!w){le.innerHTML=\"<p>No stats yet.</p>\";return}const e=w.sources.map(t=>`<li>${t.source}: ${t.session_count} sessions / ${t.frame_count} frames</li>`).join(\"\");le.innerHTML=`\n    <div class=\"stat-row\"><span>Total sessions</span><strong>${w.session_count}</strong></div>\n    <div class=\"stat-row\"><span>Total frames</span><strong>${w.stored_frame_count}</strong></div>\n    <div class=\"stat-row\"><span>Minute uploads from you</span><strong>${w.upload_limits.recent_uploads_from_ip}</strong></div>\n    <div class=\"stat-row\"><span>Hour uploads from you</span><strong>${w.upload_limits.recent_hour_uploads_from_ip}</strong></div>\n    <div class=\"footer-note\">\n      Rate limit: ${w.upload_limits.minute_limit}/min, ${w.upload_limits.hourly_limit}/hour\n    </div>\n    <ul class=\"source-breakdown\">${e}</ul>\n  `}function ie(){Ue.innerHTML=G.slice(0,20).map(e=>`\n        <li class=\"session-item${e.session_id===R?\" selected\":\"\"}\">\n          <button class=\"session-button\" data-session-id=\"${e.session_id}\">\n            <strong>${e.session_id}</strong>\n            <span>${e.source} \u00b7 ${e.frame_count} frames \u00b7 ${e.episode_count} episodes</span>\n          </button>\n        </li>\n      `).join(\"\"),document.querySelectorAll(\".session-button\").forEach(e=>{e.addEventListener(\"click\",()=>{ot(e.dataset.sessionId||\"\")})})}async function ot(e){if(!e)return;const t=await fetch(`${K()}/api/sessions/${e}/jsonl`);if(!t.ok){p=`Replay load failed: ${t.status}`,f(v());return}u=(await t.json()).content.split(`\n`).filter(o=>o.trim().length>0).map(o=>JSON.parse(o)),R=e,S=0,L=!1,j(),ie(),p=`Loaded replay ${e}`,f(v())}function we(){R=null,u=[],S=0,L=!1,j(),ie(),p=\"Replay cleared\",f(v())}function j(){const e=u.length>0;ne.disabled=!e,pe.disabled=!e,I.disabled=!e,I.max=String(Math.max(0,u.length-1)),I.value=String(S),qe.textContent=e?`Replay ${R}`:\"No Session Loaded\",ne.textContent=L?\"Pause\":\"Play\";const t=u[S];Ge.textContent=e?`step ${t.step} / ${u[u.length-1].step}`:\"step 0 / 0\",Je.textContent=e?`distance ${t.distance.toFixed(3)} \u00b7 forward ${t.forward_offset.toFixed(3)}`:\"distance 0.000\"}function Se(){u.length!==0&&(L=!L,k=0,j())}async function rt(){u.length===0||!R||be(u,`${R}.jsonl`)}function be(e,t){const n=e.map(d=>JSON.stringify(d)).join(`\n`),o=new Blob([n],{type:\"application/jsonl\"}),r=URL.createObjectURL(o),a=document.createElement(\"a\");a.href=r,a.download=t,a.click(),URL.revokeObjectURL(r)}function K(){return Ye.value.replace(/\\/$/,\"\")}function te(e,t,n,o){return{x:(e/c+1)*.5*n,y:(1-(t/m+1)*.5)*o}}function at(){const e=F(s.targetVx,s.targetVy);if(e<1e-8)return 0;const t=s.targetVx/e,n=s.targetVy/e;return(s.cursorX-s.targetX)*t+(s.cursorY-s.targetY)*n}function $(e,t){ee=(ee*1664525+1013904223)%4294967296;const n=ee/4294967296;return e+(t-e)*n}function g(e,t,n){return Math.max(t,Math.min(n,e))}function F(e,t){return Math.sqrt(e*e+t*t)}function l(e,t){const n=10**t;return Math.round(e*n)/n}function it(){return new Date().toISOString().replace(/[:.]/g,\"-\")}function i(e){const t=document.querySelector(e);if(!t)throw new Error(`Missing DOM node: ${e}`);return t}function Ee(e){const t=e.getContext(\"2d\");if(!t)throw new Error(\"2d context unavailable\");return t}\n";
const APP_CSS = ":root{color-scheme:light;font-family:Space Grotesk,Segoe UI,sans-serif;background:radial-gradient(circle at top left,#f6efe3 0%,transparent 32%),radial-gradient(circle at bottom right,#dce8ff 0%,transparent 28%),#f7f7f2;color:#1f2430}*{box-sizing:border-box}body{margin:0;min-height:100vh}#app{display:grid;grid-template-columns:minmax(320px,400px) minmax(420px,1fr) minmax(360px,460px);gap:22px;min-height:100vh;padding:22px}.panel{border:1px solid rgba(31,36,48,.12);border-radius:24px;background:#ffffffd6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 18px 50px #1f24301a}.sidebar,.replay-panel{display:flex;flex-direction:column;gap:18px;padding:22px}.eyebrow{margin:0 0 8px;color:#7f5af0;font-size:12px;letter-spacing:.18em;text-transform:uppercase}h1,h2{margin:0;line-height:1.02}h1{font-size:34px}h2{font-size:22px}.lede,.footer-note{margin:0;color:#5f6779;line-height:1.55}.controls,.metrics,.sessions,.api-box,.admin-block{display:grid;gap:12px}.button-row{display:flex;flex-wrap:wrap;gap:10px}button{border:0;border-radius:999px;padding:11px 15px;background:#1f2430;color:#fff;font:inherit;cursor:pointer;transition:transform .12s ease,opacity .12s ease}button.secondary{background:#dbe2ef;color:#1f2430}button.ghost{background:transparent;color:#1f2430;border:1px solid rgba(31,36,48,.18)}button:disabled{opacity:.45;cursor:not-allowed;transform:none}button:hover:not(:disabled){transform:translateY(-1px)}label{display:grid;gap:6px;font-size:14px}input{width:100%;border:1px solid rgba(31,36,48,.16);border-radius:12px;padding:10px 12px;font:inherit}.metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric,.admin-stats,.session-item{border-radius:18px;background:#f3f5fb}.metric{padding:14px}.metric span{display:block;color:#626b80;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.metric strong{display:block;margin-top:6px;font-size:20px}.admin-stats{padding:14px;display:grid;gap:10px}.stat-row{display:flex;justify-content:space-between;gap:12px;font-size:14px}.source-breakdown{margin:0;padding-left:18px;color:#4a5161}.canvas-panel{position:relative;overflow:hidden;padding:18px}.canvas-shell,.replay-shell{position:relative;border-radius:20px;overflow:hidden;background:linear-gradient(135deg,rgba(127,90,240,.08),transparent 35%),linear-gradient(315deg,rgba(47,170,104,.08),transparent 35%),#fbfbfd}.canvas-shell{min-height:760px;height:100%}.replay-shell{min-height:420px}canvas{display:block;width:100%;height:100%}.canvas-overlay{position:absolute;left:18px;right:18px;top:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;pointer-events:none}.badge,.hint{border-radius:999px;background:#ffffffd1;border:1px solid rgba(31,36,48,.12);padding:8px 12px;font-size:13px}.session-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.session-button{width:100%;text-align:left;display:grid;gap:6px;border-radius:18px;background:transparent;color:#1f2430;padding:12px 14px}.session-button span{color:#5f6779;font-size:13px}.session-item.selected{outline:2px solid #7f5af0}.replay-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.replay-controls{display:grid;gap:10px}.replay-meta{display:flex;justify-content:space-between;gap:12px;color:#5f6779;font-size:13px}input[type=range]{padding:0}@media(max-width:1440px){#app{grid-template-columns:minmax(320px,380px) minmax(400px,1fr)}.replay-panel{grid-column:1 / -1}}@media(max-width:1024px){#app{grid-template-columns:1fr}.canvas-shell{min-height:520px}}\n";
const UPLOAD_LIMIT_PER_MINUTE = 6;
const UPLOAD_LIMIT_PER_HOUR = 30;

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

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

async function countUploads(env, ipAddress, sinceIso) {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM upload_events WHERE ip_address = ?1 AND created_at >= ?2`
  ).bind(ipAddress, sinceIso).first();
  return Number(result?.count || 0);
}

function sessionScore(payload) {
  if (payload.meta && payload.meta.score !== undefined) {
    return Number(payload.meta.score || 0);
  }
  return Math.max(0, Math.round((payload.frames || []).reduce((sum, frame) => sum + Number(frame.reward || 0), 0)));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ipAddress = clientIp(request);

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

      const now = new Date();
      const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const minuteCount = await countUploads(env, ipAddress, minuteAgo);
      const hourCount = await countUploads(env, ipAddress, hourAgo);
      if (minuteCount >= UPLOAD_LIMIT_PER_MINUTE) {
        return json({ error: `Rate limit exceeded: ${UPLOAD_LIMIT_PER_MINUTE} uploads per minute` }, { status: 429 });
      }
      if (hourCount >= UPLOAD_LIMIT_PER_HOUR) {
        return json({ error: `Rate limit exceeded: ${UPLOAD_LIMIT_PER_HOUR} uploads per hour` }, { status: 429 });
      }

      const sessionId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      const createdAt = now.toISOString();
      const episodeCount = new Set(payload.frames.map((frame) => frame.episode)).size;
      const score = sessionScore(payload);
      const metaJson = JSON.stringify({ ...(payload.meta || {}), ip_hash_hint: ipAddress.slice(-6) });
      const jsonl = sessionJsonl(payload.frames);

      await env.DB.prepare(
        `INSERT INTO sessions (session_id, source, frame_count, episode_count, created_at, score, meta_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(
        sessionId,
        payload.source || "unknown",
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

      return json({
        session_id: sessionId,
        source: payload.source || "unknown",
        frame_count: payload.frames.length,
        episode_count: episodeCount,
        created_at: createdAt,
        score,
        meta: payload.meta || {},
      }, {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    if (url.pathname === "/api/admin/stats" && request.method === "GET") {
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
        `SELECT session_id, source, score, frame_count, episode_count, created_at
         FROM sessions ORDER BY score DESC, created_at DESC LIMIT 10`
      ).all();
      const now = new Date();
      const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const minuteCount = await countUploads(env, ipAddress, minuteAgo);
      const hourCount = await countUploads(env, ipAddress, hourAgo);
      return json({
        session_count: Number(summaryResult?.session_count || 0),
        stored_frame_count: Number(summaryResult?.stored_frame_count || 0),
        average_score: Number(summaryResult?.average_score || 0),
        top_score: Number(summaryResult?.top_score || 0),
        leaderboard: (leaderboardResult.results || []).map((row) => ({
          session_id: row.session_id,
          source: row.source,
          score: Number(row.score || 0),
          frame_count: Number(row.frame_count || 0),
          episode_count: Number(row.episode_count || 0),
          created_at: row.created_at,
        })),
        sources: (sourceResult.results || []).map((row) => ({
          source: row.source,
          session_count: Number(row.session_count || 0),
          frame_count: Number(row.frame_count || 0),
          average_score: Number(row.average_score || 0),
        })),
        upload_limits: {
          minute_limit: UPLOAD_LIMIT_PER_MINUTE,
          hourly_limit: UPLOAD_LIMIT_PER_HOUR,
          recent_uploads_from_ip: minuteCount,
          recent_hour_uploads_from_ip: hourCount,
        },
      }, {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    if (url.pathname === "/api/sessions" && request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT session_id, source, frame_count, episode_count, created_at, score, meta_json
         FROM sessions ORDER BY created_at DESC LIMIT 50`
      ).all();

      const sessions = (result.results || []).map((row) => ({
        session_id: row.session_id,
        source: row.source,
        frame_count: row.frame_count,
        episode_count: row.episode_count,
        created_at: row.created_at,
        score: Number(row.score || 0),
        meta: JSON.parse(row.meta_json || "{}"),
      }));
      return json({ sessions }, {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT session_id, source, score, frame_count, episode_count, created_at
         FROM sessions ORDER BY score DESC, created_at DESC LIMIT 25`
      ).all();
      return json({
        leaderboard: (result.results || []).map((row) => ({
          session_id: row.session_id,
          source: row.source,
          score: Number(row.score || 0),
          frame_count: Number(row.frame_count || 0),
          episode_count: Number(row.episode_count || 0),
          created_at: row.created_at,
        })),
      }, {
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
        `SELECT session_id, source, frame_count, episode_count, created_at, score, meta_json
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
        score: Number(row.score || 0),
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
