const INDEX_HTML = "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Aim RL Collector</title>\n    <script type=\"module\" crossorigin src=\"/assets/index-B7IbrO7U.js\"></script>\n    <link rel=\"stylesheet\" crossorigin href=\"/assets/index-Dywt8KP2.css\">\n  </head>\n  <body>\n    <div id=\"app\"></div>\n  </body>\n  </html>\n\n";
const APP_JS = "(function(){const t=document.createElement(\"link\").relList;if(t&&t.supports&&t.supports(\"modulepreload\"))return;for(const a of document.querySelectorAll('link[rel=\"modulepreload\"]'))o(a);new MutationObserver(a=>{for(const r of a)if(r.type===\"childList\")for(const d of r.addedNodes)d.tagName===\"LINK\"&&d.rel===\"modulepreload\"&&o(d)}).observe(document,{childList:!0,subtree:!0});function n(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin===\"use-credentials\"?r.credentials=\"include\":a.crossOrigin===\"anonymous\"?r.credentials=\"omit\":r.credentials=\"same-origin\",r}function o(a){if(a.ep)return;a.ep=!0;const r=n(a);fetch(a.href,r)}})();const h=1/60,c=1,_=1,ce=.07,de=.03,J=1.4,x=.09,k=.55,q=.14,se=.18,Ve=.85,Ye=.45,De=.7,Pe=.12,ke=.01,Fe=300,Ie=window.location.origin;let T=!1,Q=0,m=[],H=[],E=null,u=[],w=0,C=!1,Z=0,z=0,P=0,F=0,p=\"Ready\",ne=17,v=null,s=Ee(),N=window.localStorage.getItem(\"aim-rl-player-name\")||\"anonymous\",b=_t(),G=\"\",ve=\"\";const he=document.querySelector(\"#app\");if(!he)throw new Error(\"App root not found.\");he.innerHTML=`\n  <section class=\"panel sidebar\">\n    <div>\n      <p class=\"eyebrow\">Browser Collector</p>\n      <h1>Aim RL Web Arena</h1>\n      <p class=\"lede\">\n        Collect human aim traces, compete on score, upload sessions, and replay top runs\n        without leaving the browser.\n      </p>\n    </div>\n\n    <div class=\"controls\">\n      <div class=\"button-row\">\n        <button id=\"toggle-run\">Start</button>\n        <button id=\"reset-episode\" class=\"secondary\">Reset Episode</button>\n        <button id=\"save-local\" class=\"ghost\">Download JSONL</button>\n        <button id=\"upload-session\" class=\"secondary\">Upload Session</button>\n      </div>\n    </div>\n\n    <div class=\"api-box\">\n      <label>\n        Player Name\n        <input id=\"player-name\" value=\"${N}\" maxlength=\"24\" />\n      </label>\n      <label>\n        API Base URL\n        <input id=\"api-base\" value=\"${Ie}\" />\n      </label>\n      <div class=\"button-row\">\n        <button id=\"refresh-admin\" class=\"ghost\">Refresh Admin</button>\n        <button id=\"clear-replay\" class=\"ghost\">Clear Replay</button>\n      </div>\n    </div>\n\n    <div class=\"metrics\">\n      <div class=\"metric-grid\">\n        <div class=\"metric\"><span>Mode</span><strong id=\"metric-mode\">Paused</strong></div>\n        <div class=\"metric\"><span>Episode</span><strong id=\"metric-episode\">1</strong></div>\n        <div class=\"metric\"><span>Frames</span><strong id=\"metric-frames\">0</strong></div>\n        <div class=\"metric\"><span>Distance</span><strong id=\"metric-distance\">0.000</strong></div>\n        <div class=\"metric\"><span>Lead Offset</span><strong id=\"metric-forward\">0.000</strong></div>\n        <div class=\"metric\"><span>Score</span><strong id=\"metric-score\">0</strong></div>\n      </div>\n    </div>\n\n    <div class=\"admin-block\">\n      <strong>Admin Snapshot</strong>\n      <div id=\"admin-stats\" class=\"admin-stats\"></div>\n    </div>\n\n    <div class=\"leaderboard-block\">\n      <strong>Leaderboard</strong>\n      <ol id=\"leaderboard-list\" class=\"leaderboard-list\"></ol>\n    </div>\n\n    <div class=\"sessions\">\n      <strong>Stored Sessions</strong>\n      <ul id=\"session-list\" class=\"session-list\"></ul>\n    </div>\n\n    <p id=\"status-line\" class=\"footer-note\">Ready</p>\n  </section>\n\n  <section class=\"panel canvas-panel\">\n    <div class=\"canvas-shell\">\n      <canvas id=\"arena\" width=\"960\" height=\"960\"></canvas>\n      <div class=\"canvas-overlay\">\n        <div class=\"badge\">Orange = track zone, violet = hit zone, green = lead point</div>\n        <div class=\"hint\">Space start/pause, R reset, U upload, P replay</div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"panel replay-panel\">\n    <div class=\"replay-header\">\n      <div>\n        <p class=\"eyebrow\">Replay Viewer</p>\n        <h2 id=\"replay-title\">No Session Loaded</h2>\n      </div>\n      <div class=\"button-row\">\n        <button id=\"replay-toggle\" class=\"secondary\" disabled>Play</button>\n        <button id=\"replay-download\" class=\"ghost\" disabled>Download Trace</button>\n      </div>\n    </div>\n\n    <div class=\"replay-shell\">\n      <canvas id=\"replay-canvas\" width=\"720\" height=\"720\"></canvas>\n    </div>\n\n    <div class=\"replay-controls\">\n      <input id=\"replay-slider\" type=\"range\" min=\"0\" max=\"0\" value=\"0\" disabled />\n      <div class=\"replay-meta\">\n        <span id=\"replay-step\">step 0 / 0</span>\n        <span id=\"replay-distance\">distance 0.000</span>\n      </div>\n    </div>\n  </section>\n`;const W=i(\"#arena\"),Ne=Oe(W),re=i(\"#replay-canvas\"),je=Oe(re),oe=i(\"#player-name\"),He=i(\"#api-base\"),ue=i(\"#toggle-run\"),We=i(\"#reset-episode\"),Be=i(\"#save-local\"),Ue=i(\"#upload-session\"),Je=i(\"#refresh-admin\"),qe=i(\"#clear-replay\"),ie=i(\"#replay-toggle\"),_e=i(\"#replay-download\"),j=i(\"#replay-slider\"),Ge=i(\"#metric-mode\"),Ke=i(\"#metric-episode\"),Qe=i(\"#metric-frames\"),Ze=i(\"#metric-distance\"),ze=i(\"#metric-forward\"),et=i(\"#metric-score\"),tt=i(\"#status-line\"),ye=i(\"#admin-stats\"),le=i(\"#leaderboard-list\"),be=i(\"#session-list\"),st=i(\"#replay-title\"),nt=i(\"#replay-step\"),ot=i(\"#replay-distance\");W.addEventListener(\"mousemove\",e=>{const t=W.getBoundingClientRect();Z=g(((e.clientX-t.left)/t.width*2-1)*c,-c,c),z=g((1-(e.clientY-t.top)/t.height*2)*_,-_,_)});window.addEventListener(\"keydown\",e=>{const t=e.key.toLowerCase();e.code===\"Space\"?(e.preventDefault(),we()):t===\"r\"?pe():t===\"u\"?Te():t===\"p\"&&u.length>0&&Me()});ue.addEventListener(\"click\",()=>we());We.addEventListener(\"click\",()=>pe());Be.addEventListener(\"click\",()=>dt());Ue.addEventListener(\"click\",()=>{Te()});Je.addEventListener(\"click\",()=>{fe()});qe.addEventListener(\"click\",()=>xe());ie.addEventListener(\"click\",()=>Me());_e.addEventListener(\"click\",()=>{mt()});j.addEventListener(\"input\",()=>{w=Number(j.value),C=!1,B()});le.addEventListener(\"click\",e=>{const n=e.target?.closest(\".leaderboard-button\");n?.dataset.sessionId&&$e(n.dataset.sessionId)});be.addEventListener(\"click\",e=>{const n=e.target?.closest(\".session-button\");n?.dataset.sessionId&&$e(n.dataset.sessionId)});oe.addEventListener(\"input\",()=>{N=ht(oe.value),oe.value=N,window.localStorage.setItem(\"aim-rl-player-name\",N)});Z=s.cursorX;z=s.cursorY;Le();Re();fe();requestAnimationFrame(Se);function Se(e){if(P===0&&(P=e),F===0&&(F=e),T&&e-P>=h*1e3){const t=Math.max(1,Math.floor((e-P)/(h*1e3)));for(let n=0;n<t;n+=1)at();P=e}C&&u.length>0&&e-F>=h*1e3&&(w=Math.min(w+1,u.length-1),w>=u.length-1&&(C=!1),F=e,B()),Le(),Re(),requestAnimationFrame(Se)}function we(){T=!T,p=T?\"Collecting frames\":\"Paused\",ue.textContent=T?\"Pause\":\"Start\",f(me())}function pe(){Q+=1,s=Ee(),Z=s.cursorX,z=s.cursorY,p=`Episode ${Q+1} ready`,f(me())}function at(){const e=s.cursorX,t=s.cursorY,n=s.cursorVx,o=s.cursorVy;s.cursorX=g(Z,-c,c),s.cursorY=g(z,-_,_),s.cursorVx=g((s.cursorX-e)/h,-J,J),s.cursorVy=g((s.cursorY-t)/h,-J,J);const a=g(s.cursorVx-n,-x,x),r=g(s.cursorVy-o,-x,x);s.targetVx=g(s.targetVx+M(-q,q)*h,-k,k),s.targetVy=g(s.targetVy+M(-q,q)*h,-k,k);const d=s.targetX+s.targetVx*h,$=s.targetY+s.targetVy*h;(d>c||d<-c)&&(s.targetVx*=-1),($>_||$<-_)&&(s.targetVy*=-1),s.targetX=g(s.targetX+s.targetVx*h,-c,c),s.targetY=g(s.targetY+s.targetVy*h,-_,_);const L=g(s.targetX+s.targetVx*se,-c,c),X=g(s.targetY+s.targetVy*se,-_,_),A=I(s.targetX-s.cursorX,s.targetY-s.cursorY),O=I(L-s.cursorX,X-s.cursorY),V=I(s.targetVx,s.targetVy)*se*De,Y=vt(),R=I(a-s.prevActionX,r-s.prevActionY),U=A<=ce,D=A<=de;s.consecutiveHits=D?s.consecutiveHits+1:0;let S=0;S+=Math.max(0,1-A/c),S+=Ve*Math.max(0,1-O/c),S+=Ye*Math.max(0,1-Math.abs(Y-V)/c),S-=ke,S-=R*Pe,U&&(S+=.5),D&&(S+=1.5),s.consecutiveHits>=8&&(S+=2),s.prevActionX=a,s.prevActionY=r,s.stepCount+=1,m.push({episode:Q+1,step:s.stepCount,t:l(s.stepCount*h,6),cursor_x:l(s.cursorX,6),cursor_y:l(s.cursorY,6),cursor_vx:l(s.cursorVx,6),cursor_vy:l(s.cursorVy,6),target_x:l(s.targetX,6),target_y:l(s.targetY,6),target_vx:l(s.targetVx,6),target_vy:l(s.targetVy,6),lead_x:l(L,6),lead_y:l(X,6),action_x:l(a/x,6),action_y:l(r/x,6),distance:l(A,6),lead_distance:l(O,6),forward_offset:l(Y,6),desired_forward_offset:l(V,6),reward:l(S,6),source:\"human-web\"}),bt(m[m.length-1]),(s.stepCount>=Fe||s.consecutiveHits>=8)&&(pe(),T=!0,ue.textContent=\"Pause\"),f(me())}function Ee(){const e=M(0,Math.PI*2),t=M(.15,k);return{stepCount:0,cursorX:0,cursorY:0,cursorVx:0,cursorVy:0,targetX:M(-.6,.6),targetY:M(-.4,.4),targetVx:Math.cos(e)*t,targetVy:Math.sin(e)*t,prevActionX:0,prevActionY:0,consecutiveHits:0}}function Le(){Ce(Ne,W.width,W.height,y(),s.targetX,s.targetY,s.cursorX,s.cursorY)}function Re(){Ce(je,re.width,re.height,u[w],null,null,null,null)}function y(){return m[m.length-1]}function Ce(e,t,n,o,a,r,d,$){e.clearRect(0,0,t,n);const L=e.createLinearGradient(0,0,t,n);L.addColorStop(0,\"#fefefe\"),L.addColorStop(1,\"#eef3ff\"),e.fillStyle=L,e.fillRect(0,0,t,n),rt(e,t,n);const X=o?o.target_x:a,A=o?o.target_y:r,O=o?o.cursor_x:d,te=o?o.cursor_y:$,V=o?.lead_x??null,Y=o?.lead_y??null;if(X==null||A==null||O==null||te==null)return;const R=ae(X,A,t,n),U=ae(O,te,t,n);if(K(e,R.x,R.y,ce,\"#f39c12\",2,t),K(e,R.x,R.y,de,\"#8e44ad\",2,t),K(e,R.x,R.y,.012,\"#d7263d\",0,t,!0),V!=null&&Y!=null){const D=ae(V,Y,t,n);K(e,D.x,D.y,.009,\"#2faa68\",2,t)}it(e,U.x,U.y,Math.max(12,t/60),\"#1f4fff\")}function rt(e,t,n){e.strokeStyle=\"rgba(31, 36, 48, 0.08)\",e.lineWidth=1;for(let o=1;o<8;o+=1){const a=o/8,r=a*t,d=a*n;e.beginPath(),e.moveTo(r,0),e.lineTo(r,n),e.stroke(),e.beginPath(),e.moveTo(0,d),e.lineTo(t,d),e.stroke()}}function K(e,t,n,o,a,r,d,$=!1){const L=o/c*d*.5;e.beginPath(),e.arc(t,n,L,0,Math.PI*2),$?(e.fillStyle=a,e.fill()):(e.strokeStyle=a,e.lineWidth=r,e.stroke())}function it(e,t,n,o,a){e.strokeStyle=a,e.lineWidth=2.5,e.beginPath(),e.moveTo(t-o,n),e.lineTo(t+o,n),e.moveTo(t,n-o),e.lineTo(t,n+o),e.stroke()}function f(e){Ge.textContent=T?\"Running\":\"Paused\",Ke.textContent=String(Q+1),Qe.textContent=String(m.length),Ze.textContent=e?e.distance.toFixed(3):\"0.000\",ze.textContent=e?e.forward_offset.toFixed(3):\"0.000\",et.textContent=String(Ae()),tt.textContent=p}function lt(){const e=new Set(m.map(t=>t.episode));return{source:\"human-web\",frames:m,meta:{episode_count:e.size,frame_count:m.length,client:\"aim-rl-web\",created_at:new Date().toISOString(),score:Ae(),player_name:N,best_distance:b.frameCount>0?b.minDistance:0,hit_frames:b.hitFrames,track_frames:b.trackFrames}}}function Ae(){return ct(b)}function ct(e){if(e.frameCount===0)return 0;const t=e.leadQualitySum/e.frameCount;return Math.max(0,Math.round(e.rewardSum+e.hitFrames*45+e.trackFrames*8+(1-e.minDistance)*180+t*120))}function dt(){if(m.length===0){p=\"No frames collected yet\",f(y());return}Xe(m,`human-web-${yt()}.jsonl`),p=\"Downloaded JSONL session\",f(y())}async function Te(){if(m.length===0){p=\"No frames to upload\",f(y());return}p=\"Uploading session\",f(y());const e=await fetch(`${ee()}/api/sessions`,{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify(lt())});if(!e.ok){const t=await e.text();p=`Upload failed: ${e.status} ${t}`,f(y());return}p=\"Session uploaded\",f(y()),await fe()}async function fe(){await Promise.all([ut(),pt()])}async function ut(){const e=await fetch(`${ee()}/api/sessions`);if(!e.ok){p=`Session list failed: ${e.status}`,f(y());return}H=(await e.json()).sessions,ge(),E&&!H.some(n=>n.session_id===E)&&xe()}async function pt(){const e=await fetch(`${ee()}/api/admin/stats`);if(!e.ok){p=`Admin stats failed: ${e.status}`,f(y());return}v=await e.json(),ft(),gt(),p=`Loaded ${H.length} sessions`,f(y())}function ft(){if(!v){ye.innerHTML=\"<p>No stats yet.</p>\";return}const e=v.sources.map(t=>`<li>${t.source}: ${t.session_count} sessions / ${t.frame_count} frames / avg ${t.average_score.toFixed(1)}</li>`).join(\"\");ye.innerHTML=`\n    <div class=\"stat-row\"><span>Total sessions</span><strong>${v.session_count}</strong></div>\n    <div class=\"stat-row\"><span>Total frames</span><strong>${v.stored_frame_count}</strong></div>\n    <div class=\"stat-row\"><span>Average score</span><strong>${v.average_score.toFixed(1)}</strong></div>\n    <div class=\"stat-row\"><span>Top score</span><strong>${v.top_score}</strong></div>\n    <div class=\"stat-row\"><span>Minute uploads from you</span><strong>${v.upload_limits.recent_uploads_from_ip}</strong></div>\n    <div class=\"footer-note\">Rate limit: ${v.upload_limits.minute_limit}/min, ${v.upload_limits.hourly_limit}/hour</div>\n    <ul class=\"source-breakdown\">${e}</ul>\n  `}function gt(){if(!v){G!==\"\"&&(le.innerHTML=\"\",G=\"\");return}const e=JSON.stringify(v.leaderboard.slice(0,10).map(t=>[t.session_id,t.player_name,t.score,t.frame_count]));e!==G&&(G=e,le.innerHTML=v.leaderboard.slice(0,10).map((t,n)=>`<li><button class=\"leaderboard-button\" data-session-id=\"${t.session_id}\"><strong>#${n+1} ${t.score} \u00b7 ${t.player_name??\"anonymous\"}</strong><span>${t.source} \u00b7 ${t.frame_count} frames</span></button></li>`).join(\"\"))}function ge(){const e=JSON.stringify(H.slice(0,20).map(t=>[t.session_id,t.player_name,t.score,t.frame_count,t.session_id===E]));e!==ve&&(ve=e,be.innerHTML=H.slice(0,20).map(t=>`\n        <li class=\"session-item${t.session_id===E?\" selected\":\"\"}\">\n          <button class=\"session-button\" data-session-id=\"${t.session_id}\">\n            <strong>${t.session_id}</strong>\n            <span>${t.player_name??\"anonymous\"} \u00b7 ${t.score??0} pts \u00b7 ${t.frame_count} frames</span>\n          </button>\n        </li>\n      `).join(\"\"))}async function $e(e){if(!e)return;const t=await fetch(`${ee()}/api/sessions/${e}/jsonl`);if(!t.ok){p=`Replay load failed: ${t.status}`,f(y());return}u=(await t.json()).content.split(`\n`).filter(o=>o.trim().length>0).map(o=>JSON.parse(o)),E=e,w=0,C=!1,B(),ge(),p=`Loaded replay ${e}`,f(y())}function xe(){E=null,u=[],w=0,C=!1,B(),ge(),p=\"Replay cleared\",f(y())}function B(){const e=u.length>0;ie.disabled=!e,_e.disabled=!e,j.disabled=!e,j.max=String(Math.max(0,u.length-1)),j.value=String(w),st.textContent=e?`Replay ${E}`:\"No Session Loaded\",ie.textContent=C?\"Pause\":\"Play\";const t=u[w];nt.textContent=e?`step ${t.step} / ${u[u.length-1].step}`:\"step 0 / 0\",ot.textContent=e?`distance ${t.distance.toFixed(3)} \u00b7 forward ${t.forward_offset.toFixed(3)}`:\"distance 0.000\"}function Me(){u.length!==0&&(C=!C,F=0,B())}async function mt(){u.length===0||!E||Xe(u,`${E}.jsonl`)}function Xe(e,t){const n=e.map(d=>JSON.stringify(d)).join(`\n`),o=new Blob([n],{type:\"application/jsonl\"}),a=URL.createObjectURL(o),r=document.createElement(\"a\");r.href=a,r.download=t,r.click(),URL.revokeObjectURL(a)}function ee(){return He.value.replace(/\\/$/,\"\")}function ae(e,t,n,o){return{x:(e/c+1)*.5*n,y:(1-(t/_+1)*.5)*o}}function vt(){const e=I(s.targetVx,s.targetVy);if(e<1e-8)return 0;const t=s.targetVx/e,n=s.targetVy/e;return(s.cursorX-s.targetX)*t+(s.cursorY-s.targetY)*n}function M(e,t){ne=(ne*1664525+1013904223)%4294967296;const n=ne/4294967296;return e+(t-e)*n}function g(e,t,n){return Math.max(t,Math.min(n,e))}function I(e,t){return Math.sqrt(e*e+t*t)}function l(e,t){const n=10**t;return Math.round(e*n)/n}function yt(){return new Date().toISOString().replace(/[:.]/g,\"-\")}function ht(e){return(e.split(\"\").filter(n=>/[a-zA-Z0-9 _-]/.test(n)).join(\"\").trim()||\"anonymous\").slice(0,24)}function _t(){return{rewardSum:0,hitFrames:0,trackFrames:0,minDistance:1,leadQualitySum:0,frameCount:0}}function bt(e){b.rewardSum+=e.reward,b.hitFrames+=e.distance<=de?1:0,b.trackFrames+=e.distance<=ce?1:0,b.minDistance=Math.min(b.minDistance,e.distance),b.leadQualitySum+=Math.max(0,1-Math.abs(e.forward_offset-e.desired_forward_offset)),b.frameCount+=1}function me(){return m[m.length-1]}function i(e){const t=document.querySelector(e);if(!t)throw new Error(`Missing DOM node: ${e}`);return t}function Oe(e){const t=e.getContext(\"2d\");if(!t)throw new Error(\"2d context unavailable\");return t}\n";
const APP_CSS = ":root{color-scheme:light;font-family:Space Grotesk,Segoe UI,sans-serif;background:radial-gradient(circle at top left,#f6efe3 0%,transparent 32%),radial-gradient(circle at bottom right,#dce8ff 0%,transparent 28%),#f7f7f2;color:#1f2430}*{box-sizing:border-box}body{margin:0;min-height:100vh}#app{display:grid;grid-template-columns:minmax(320px,400px) minmax(420px,1fr) minmax(360px,460px);gap:22px;min-height:100vh;padding:22px}.panel{border:1px solid rgba(31,36,48,.12);border-radius:24px;background:#ffffffd6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 18px 50px #1f24301a}.sidebar,.replay-panel{display:flex;flex-direction:column;gap:18px;padding:22px}.eyebrow{margin:0 0 8px;color:#7f5af0;font-size:12px;letter-spacing:.18em;text-transform:uppercase}h1,h2{margin:0;line-height:1.02}h1{font-size:34px}h2{font-size:22px}.lede,.footer-note{margin:0;color:#5f6779;line-height:1.55}.controls,.metrics,.sessions,.api-box,.admin-block,.leaderboard-block{display:grid;gap:12px}.button-row{display:flex;flex-wrap:wrap;gap:10px}button{border:0;border-radius:999px;padding:11px 15px;background:#1f2430;color:#fff;font:inherit;cursor:pointer;transition:transform .12s ease,opacity .12s ease}button.secondary{background:#dbe2ef;color:#1f2430}button.ghost{background:transparent;color:#1f2430;border:1px solid rgba(31,36,48,.18)}button:disabled{opacity:.45;cursor:not-allowed;transform:none}button:hover:not(:disabled){transform:translateY(-1px)}label{display:grid;gap:6px;font-size:14px}input{width:100%;border:1px solid rgba(31,36,48,.16);border-radius:12px;padding:10px 12px;font:inherit}.metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric,.admin-stats,.session-item{border-radius:18px;background:#f3f5fb}.metric{padding:14px}.metric span{display:block;color:#626b80;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.metric strong{display:block;margin-top:6px;font-size:20px}.admin-stats{padding:14px;display:grid;gap:10px}.stat-row{display:flex;justify-content:space-between;gap:12px;font-size:14px}.source-breakdown{margin:0;padding-left:18px;color:#4a5161}.canvas-panel{position:relative;overflow:hidden;padding:18px}.canvas-shell,.replay-shell{position:relative;border-radius:20px;overflow:hidden;background:linear-gradient(135deg,rgba(127,90,240,.08),transparent 35%),linear-gradient(315deg,rgba(47,170,104,.08),transparent 35%),#fbfbfd}.canvas-shell{min-height:760px;height:100%}.replay-shell{min-height:420px}canvas{display:block;width:100%;height:100%}.canvas-overlay{position:absolute;left:18px;right:18px;top:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;pointer-events:none}.badge,.hint{border-radius:999px;background:#ffffffd1;border:1px solid rgba(31,36,48,.12);padding:8px 12px;font-size:13px}.session-list,.leaderboard-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.leaderboard-button{width:100%;text-align:left;display:grid;gap:6px;border-radius:18px;background:#f3f5fb;color:#1f2430;padding:12px 14px}.leaderboard-button span{color:#5f6779;font-size:13px}.session-button{width:100%;text-align:left;display:grid;gap:6px;border-radius:18px;background:transparent;color:#1f2430;padding:12px 14px}.session-button span{color:#5f6779;font-size:13px}.session-item.selected{outline:2px solid #7f5af0}.replay-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.replay-controls{display:grid;gap:10px}.replay-meta{display:flex;justify-content:space-between;gap:12px;color:#5f6779;font-size:13px}input[type=range]{padding:0}@media(max-width:1440px){#app{grid-template-columns:minmax(320px,380px) minmax(400px,1fr)}.replay-panel{grid-column:1 / -1}}@media(max-width:1024px){#app{grid-template-columns:1fr}.canvas-shell{min-height:520px}}\n";
const UPLOAD_LIMIT_PER_MINUTE = 6;
const UPLOAD_LIMIT_PER_HOUR = 30;
const WORLD_LIMIT = 1.05;
const CURSOR_SPEED_LIMIT = 2.0;
const TARGET_SPEED_LIMIT = 1.0;
const ACTION_LIMIT = 1.05;
const TARGET_RADIUS = 0.07;
const HIT_RADIUS = 0.03;

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

function sanitizePlayerName(meta) {
  const raw = String(meta?.player_name || "anonymous").trim();
  const filtered = raw.split("").filter((char) => /[a-zA-Z0-9 _-]/.test(char)).join("").trim();
  return (filtered || "anonymous").slice(0, 24);
}

function validateFrames(payload) {
  const lastStepByEpisode = new Map();
  const lastTimeByEpisode = new Map();
  for (const frame of payload.frames) {
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
  }
  return null;
}

function computeScore(frames) {
  const rewardSum = frames.reduce((sum, frame) => sum + Number(frame.reward || 0), 0);
  const hitFrames = frames.filter((frame) => Number(frame.distance) <= HIT_RADIUS).length;
  const trackFrames = frames.filter((frame) => Number(frame.distance) <= TARGET_RADIUS).length;
  const minDistance = Math.min(...frames.map((frame) => Number(frame.distance)));
  const leadQuality = frames.reduce((sum, frame) => {
    return sum + Math.max(0, 1 - Math.abs(Number(frame.forward_offset) - Number(frame.desired_forward_offset)));
  }, 0) / frames.length;
  return Math.max(0, Math.round(rewardSum + hitFrames * 45 + trackFrames * 8 + (1 - minDistance) * 180 + leadQuality * 120));
}

async function countUploads(env, ipAddress, sinceIso) {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM upload_events WHERE ip_address = ?1 AND created_at >= ?2`
  ).bind(ipAddress, sinceIso).first();
  return Number(result?.count || 0);
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

      const validationError = validateFrames(payload);
      if (validationError) {
        return json({ error: validationError }, { status: 400 });
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
      const score = computeScore(payload.frames);
      const playerName = sanitizePlayerName(payload.meta);
      const metaJson = JSON.stringify({ ...(payload.meta || {}), player_name: playerName, ip_hash_hint: ipAddress.slice(-6) });
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

      return json({
        session_id: sessionId,
        source: payload.source || "unknown",
        player_name: playerName,
        frame_count: payload.frames.length,
        episode_count: episodeCount,
        created_at: createdAt,
        score,
        meta: { ...(payload.meta || {}), player_name: playerName },
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
        `SELECT session_id, source, player_name, score, frame_count, episode_count, created_at
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
          player_name: row.player_name || "anonymous",
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
        `SELECT session_id, source, player_name, frame_count, episode_count, created_at, score, meta_json
         FROM sessions ORDER BY created_at DESC LIMIT 50`
      ).all();
      const sessions = (result.results || []).map((row) => ({
        session_id: row.session_id,
        source: row.source,
        player_name: row.player_name || "anonymous",
        frame_count: Number(row.frame_count || 0),
        episode_count: Number(row.episode_count || 0),
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
        `SELECT session_id, source, player_name, score, frame_count, episode_count, created_at
         FROM sessions ORDER BY score DESC, created_at DESC LIMIT 25`
      ).all();
      return json({
        leaderboard: (result.results || []).map((row) => ({
          session_id: row.session_id,
          source: row.source,
          player_name: row.player_name || "anonymous",
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
        `SELECT session_id, source, player_name, frame_count, episode_count, created_at, score, meta_json
         FROM sessions WHERE session_id = ?1`
      ).bind(sessionId).first();
      if (!row) {
        return json({ error: "Session not found" }, { status: 404 });
      }

      return json({
        session_id: row.session_id,
        source: row.source,
        player_name: row.player_name || "anonymous",
        frame_count: Number(row.frame_count || 0),
        episode_count: Number(row.episode_count || 0),
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
