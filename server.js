#!/usr/bin/env node
// BlackRoad Streaming — Self-Hosted RoadTV Server
// Runs on Cecilia with local Ollama. Zero dependencies. Pure Node.js.
// Usage: node server.js --port 8802 --model qwen2.5:1.5b

const http = require('http');

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const PORT = parseInt(getArg('--port', '8802'), 10);
const MODEL = getArg('--model', 'qwen2.5:1.5b');
const OLLAMA_HOST = getArg('--ollama', 'http://localhost:11434');

// ── 12 Agents ──
const AGENTS = {
  road:    { name: 'Road',    emoji: '\u{1F6E4}\uFE0F', color: '#FF2255', role: 'Guide' },
  coder:   { name: 'Coder',   emoji: '\u{1F4BB}',       color: '#00D4FF', role: 'Engineer' },
  scholar: { name: 'Scholar', emoji: '\u{1F4DA}',       color: '#8844FF', role: 'Research' },
  alice:   { name: 'Alice',   emoji: '\u{1F338}',       color: '#FF6B2B', role: 'Gateway' },
  cecilia: { name: 'Cecilia', emoji: '\u{1F52E}',       color: '#CC00AA', role: 'AI Engine' },
  octavia: { name: 'Octavia', emoji: '\u{26A1}',        color: '#F5A623', role: 'Compute' },
  lucidia: { name: 'Lucidia', emoji: '\u{1F9E0}',       color: '#4488FF', role: 'Cognition' },
  aria:    { name: 'Aria',    emoji: '\u{1F3B5}',       color: '#00897B', role: 'Monitor' },
  pascal:  { name: 'Pascal',  emoji: '\u{1F522}',       color: '#9C27B0', role: 'Math' },
  writer:  { name: 'Writer',  emoji: '\u{270D}\uFE0F',  color: '#FF6E40', role: 'Content' },
  tutor:   { name: 'Tutor',   emoji: '\u{1F393}',       color: '#2979FF', role: 'Education' },
  cipher:  { name: 'Cipher',  emoji: '\u{1F510}',       color: '#E91E63', role: 'Security' },
};

// ── Auto-prompts per agent domain ──
const AUTO_PROMPTS = {
  road:    'What is the most important thing you want people to know about BlackRoad OS today?',
  coder:   'Write a short code snippet that demonstrates something elegant about distributed systems.',
  scholar: 'What is the most fascinating thing you learned recently about information theory?',
  alice:   'Describe the current state of the network from your perspective as the gateway.',
  cecilia: 'What patterns are you seeing in the data flowing through the AI engine right now?',
  octavia: 'Explain how edge compute changes everything in one paragraph.',
  lucidia: 'What does persistent memory mean for AI cognition? Think out loud.',
  aria:    'Give a brief status report on system health and what metrics matter most.',
  pascal:  'Derive something beautiful from the Amundson constant G(n) = n^(n+1)/(n+1)^n.',
  writer:  'Write a micro-essay about why sovereign technology matters.',
  tutor:   'Explain recursion to someone who has never coded, using a real-world analogy.',
  cipher:  'What are the three most important principles of zero-trust security?',
};

// ── HTML helpers ──
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Stream from Ollama and emit SSE ──
function streamFromOllama(res, agentId, prompt) {
  const agent = AGENTS[agentId] || AGENTS.road;
  const systemPrompt = `You are ${agent.name}, a ${agent.role} agent in the BlackRoad OS fleet. You think clearly and write concisely. Keep responses under 300 words.`;

  const body = JSON.stringify({
    model: MODEL,
    prompt: prompt,
    system: systemPrompt,
    stream: true,
    options: { num_predict: 512 },
  });

  const url = new URL(OLLAMA_HOST + '/api/generate');

  const reqOpts = {
    hostname: url.hostname,
    port: url.port || 11434,
    path: '/api/generate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const startTime = Date.now();
  let fullText = '';
  let charIndex = 0;
  let buffer = '';

  const ollamaReq = http.request(reqOpts, (ollamaRes) => {
    ollamaRes.setEncoding('utf8');

    ollamaRes.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const token = obj.response || '';

          for (const ch of token) {
            fullText += ch;
            charIndex++;
            const elapsed = (Date.now() - startTime) / 1000;
            const data = JSON.stringify({
              type: 'frame',
              char: ch,
              index: charIndex,
              text: fullText,
              elapsed,
              agent: agentId,
            });
            res.write(`data: ${data}\n\n`);
          }

          if (obj.done) {
            const elapsed = (Date.now() - startTime) / 1000;
            const data = JSON.stringify({
              type: 'done',
              index: fullText.length,
              text: fullText,
              elapsed,
              agent: agentId,
            });
            res.write(`data: ${data}\n\n`);
            res.end();
          }
        } catch (e) {
          // skip malformed lines
        }
      }
    });

    ollamaRes.on('end', () => {
      if (!res.writableEnded) {
        const elapsed = (Date.now() - startTime) / 1000;
        const data = JSON.stringify({
          type: 'done',
          index: fullText.length,
          text: fullText,
          elapsed,
          agent: agentId,
        });
        res.write(`data: ${data}\n\n`);
        res.end();
      }
    });

    ollamaRes.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message, agent: agentId })}\n\n`);
      res.end();
    });
  });

  ollamaReq.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Ollama unreachable: ' + err.message, agent: agentId })}\n\n`);
    res.end();
  });

  ollamaReq.write(body);
  ollamaReq.end();

  // If client disconnects, abort the Ollama request
  res.on('close', () => {
    ollamaReq.destroy();
  });
}

// ── Single Agent View ──
function renderSingleUI() {
  const agentCards = Object.entries(AGENTS).map(([id, a]) =>
    `<button class="agent-card" data-id="${id}" style="--ac:${a.color}">
      <span class="emoji">${a.emoji}</span>
      <span class="name">${a.name}</span>
      <span class="role">${a.role}</span>
    </button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BlackRoad Streaming — Self-Hosted AI Live Streaming</title>
<meta name="description" content="Watch AI agents think in real-time. Self-hosted. Local Ollama. Zero cloud.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;min-height:100vh}
.header{padding:20px 32px;border-bottom:1px solid #111;display:flex;align-items:center;gap:12px}
h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,#FF6B2B,#FF2255,#CC00AA,#8844FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:inline}
.sub{color:#555;font-size:13px;margin-top:4px}
.nav-links{margin-left:auto;display:flex;gap:16px}
.nav-links a{color:#555;text-decoration:none;font-size:13px;font-weight:600;transition:color 0.2s}
.nav-links a:hover,.nav-links a.active{color:#FF2255}
.main{display:flex;gap:0;height:calc(100vh - 70px)}
.sidebar{width:200px;border-right:1px solid #111;padding:16px;overflow-y:auto;flex-shrink:0}
.sidebar h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:12px}
.agent-card{display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;border:1px solid #1a1a1a;border-radius:8px;background:#0a0a0a;cursor:pointer;margin-bottom:6px;transition:all 0.2s;text-align:left;color:#f5f5f5;font-family:inherit;font-size:13px}
.agent-card:hover,.agent-card.active{border-color:var(--ac);background:#111}
.agent-card .emoji{font-size:18px}
.agent-card .name{font-weight:600;flex:1}
.agent-card .role{font-size:10px;color:#555}
.content{flex:1;display:flex;flex-direction:column}
.viewer{flex:1;display:flex;align-items:flex-start;padding:24px 32px;background:#050505;position:relative;overflow-y:auto;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;line-height:1.7;color:#ccc;white-space:pre-wrap;word-break:break-word}
.viewer .placeholder{color:#333;font-size:16px;text-align:center;width:100%;align-self:center}
.cursor{display:inline-block;width:2px;height:18px;background:#FF2255;animation:blink 0.6s infinite;vertical-align:text-bottom}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.controls{padding:16px 24px;border-top:1px solid #111;display:flex;gap:8px;align-items:center}
.controls input{flex:1;padding:12px 16px;border:1px solid #222;border-radius:8px;background:#0a0a0a;color:#fff;font-size:14px;font-family:monospace}
.controls input:focus{border-color:#FF2255;outline:none}
.controls button{padding:12px 24px;border:none;border-radius:8px;background:linear-gradient(135deg,#FF2255,#CC00AA);color:#fff;font-weight:700;font-size:14px;cursor:pointer}
.controls button:hover{opacity:0.9}
.live-badge{background:#FF2255;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.stats-bar{font-size:11px;color:#444;font-family:monospace;padding:0 24px 8px}
.model-tag{color:#333;font-size:11px;font-family:monospace;margin-left:12px}
</style></head>
<body>
<div class="header">
  <h1>BlackRoad Streaming</h1><span class="live-badge">LIVE</span>
  <span class="model-tag">${esc(MODEL)}</span>
  <div class="nav-links">
    <a href="/" class="active">Single</a>
    <a href="/tv">RoadTV</a>
  </div>
</div>
<div class="main">
  <div class="sidebar">
    <h3>Agents Online</h3>
    ${agentCards}
  </div>
  <div class="content">
    <div class="viewer" id="viewer">
      <div class="placeholder">Select an agent and ask something to start streaming.</div>
    </div>
    <div class="stats-bar" id="stats"></div>
    <div class="controls">
      <input type="text" id="prompt" placeholder="Ask the agent anything..." value="What does it mean to pave tomorrow?">
      <button onclick="startStream()">Stream</button>
    </div>
  </div>
</div>
<script>
let currentAgent='road',evtSource=null;
document.querySelectorAll('.agent-card').forEach(c=>{
  c.addEventListener('click',()=>{
    document.querySelectorAll('.agent-card').forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
    currentAgent=c.dataset.id;
  });
});
document.querySelector('.agent-card').click();
document.getElementById('prompt').addEventListener('keydown',e=>{if(e.key==='Enter')startStream()});

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function startStream(){
  const p=document.getElementById('prompt').value;
  if(!p)return;
  if(evtSource)evtSource.close();
  const v=document.getElementById('viewer');
  const s=document.getElementById('stats');
  v.innerHTML='<div class="placeholder">Connecting...</div>';

  evtSource=new EventSource('/api/stream?agent='+currentAgent+'&prompt='+encodeURIComponent(p));
  evtSource.onmessage=e=>{
    const d=JSON.parse(e.data);
    if(d.type==='frame'){
      v.innerHTML=escHtml(d.text)+'<span class="cursor"></span>';
      const c=d.index/Math.max(d.elapsed,0.001);
      s.textContent='LIVE | '+d.index+' chars | '+c.toFixed(0)+' c/s | '+d.elapsed.toFixed(1)+'s';
      v.scrollTop=v.scrollHeight;
    }
    if(d.type==='done'){
      v.innerHTML=escHtml(d.text);
      const c=d.index/Math.max(d.elapsed,0.001);
      s.textContent='DONE | '+d.index+' chars | '+c.toFixed(0)+' c/s | '+d.elapsed.toFixed(1)+'s';
      evtSource.close();
    }
    if(d.type==='error'){
      v.innerHTML='<div class="placeholder" style="color:#FF2255">Error: '+escHtml(d.error||'unknown')+'</div>';
      s.textContent='ERROR';
      evtSource.close();
    }
  };
  evtSource.onerror=()=>{s.textContent='Stream ended';evtSource.close()};
}
</script>
</body></html>`;
}

// ── RoadTV — Classroom View ──
function renderTVUI() {
  const agentsJSON = JSON.stringify(AGENTS);
  const autoPromptsJSON = JSON.stringify(AUTO_PROMPTS);

  const tiles = Object.entries(AGENTS).map(([id, a]) => `
    <div class="tile" id="tile-${id}" data-agent="${id}" style="--ac:${a.color}">
      <div class="tile-header">
        <span class="tile-emoji">${a.emoji}</span>
        <span class="tile-name">${a.name}</span>
        <span class="tile-role">${a.role}</span>
        <span class="tile-status" id="status-${id}">idle</span>
      </div>
      <div class="tile-screen" id="screen-${id}">
        <div class="tile-placeholder">Click to wake ${a.name}</div>
      </div>
      <div class="tile-stats" id="stats-${id}"></div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RoadTV — Watch All Agents Live</title>
<meta name="description" content="RoadTV: Watch every AI agent think simultaneously. Self-hosted classroom view.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;min-height:100vh}
.header{padding:16px 24px;border-bottom:1px solid #111;display:flex;align-items:center;gap:12px}
h1{font-size:22px;font-weight:700;background:linear-gradient(135deg,#FF6B2B,#FF2255,#CC00AA,#8844FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:inline}
.live-badge{background:#FF2255;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.sub{color:#555;font-size:12px}
.model-tag{color:#333;font-size:11px;font-family:monospace}
.nav-links{margin-left:auto;display:flex;gap:16px}
.nav-links a{color:#555;text-decoration:none;font-size:13px;font-weight:600;transition:color 0.2s}
.nav-links a:hover,.nav-links a.active{color:#FF2255}
.toolbar{padding:12px 24px;border-bottom:1px solid #111;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.toolbar button{padding:8px 16px;border:1px solid #222;border-radius:6px;background:#0a0a0a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s}
.toolbar button:hover{border-color:#FF2255;background:#111}
.toolbar button.active{border-color:#FF2255;background:rgba(255,34,85,0.1)}
.toolbar .wake-btn{background:linear-gradient(135deg,#FF2255,#CC00AA);border-color:transparent}
.toolbar .wake-btn:hover{opacity:0.9}
.toolbar .count{color:#555;font-size:11px;font-family:monospace;margin-left:auto}
.grid{display:grid;gap:4px;padding:8px;height:calc(100vh - 110px);overflow-y:auto}
.grid.cols-2{grid-template-columns:repeat(2,1fr)}
.grid.cols-3{grid-template-columns:repeat(3,1fr)}
.grid.cols-4{grid-template-columns:repeat(4,1fr)}
.grid.cols-6{grid-template-columns:repeat(6,1fr)}
.tile{border:1px solid #111;border-radius:8px;background:#050505;display:flex;flex-direction:column;overflow:hidden;transition:border-color 0.3s;position:relative;min-height:0}
.tile:hover{border-color:#222}
.tile.streaming{border-color:var(--ac)}
.tile-header{padding:6px 10px;border-bottom:1px solid #111;display:flex;align-items:center;gap:6px;background:#0a0a0a;flex-shrink:0}
.tile-emoji{font-size:14px}
.tile-name{font-size:12px;font-weight:700;color:#f5f5f5}
.tile-role{font-size:10px;color:#555;flex:1}
.tile-status{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 6px;border-radius:3px;background:#111}
.tile-status.live{background:rgba(255,34,85,0.2);color:#FF2255;animation:pulse 2s infinite}
.tile-status.done{background:rgba(0,200,100,0.2);color:#0c8}
.tile-screen{flex:1;overflow-y:auto;cursor:pointer;padding:6px 8px;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.5;color:#ccc;white-space:pre-wrap;word-break:break-word}
.tile-placeholder{color:#222;font-size:12px;text-align:center;padding-top:24px}
.tile-cursor{display:inline-block;width:1px;height:13px;background:var(--ac);animation:blink 0.6s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.tile-stats{padding:3px 10px;border-top:1px solid #111;font-size:9px;color:#333;font-family:monospace;flex-shrink:0;background:#0a0a0a}
.fullscreen-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:100;display:none;flex-direction:column;padding:24px}
.fullscreen-overlay.show{display:flex}
.fullscreen-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-shrink:0}
.fullscreen-header h2{font-size:18px;font-weight:700;color:#f5f5f5}
.fullscreen-close{color:#555;font-size:28px;cursor:pointer;background:none;border:none;margin-left:auto;padding:0 8px}
.fullscreen-close:hover{color:#FF2255}
.fullscreen-body{flex:1;overflow-y:auto;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;line-height:1.8;color:#ccc;white-space:pre-wrap;word-break:break-word;padding:16px 24px;background:#050505;border-radius:8px;border:1px solid #111}
</style></head>
<body>
<div class="header">
  <h1>RoadTV</h1><span class="live-badge">LIVE</span>
  <span class="sub" style="margin-left:8px">Watch all agents think simultaneously</span>
  <span class="model-tag" style="margin-left:8px">${esc(MODEL)}</span>
  <div class="nav-links">
    <a href="/">Single</a>
    <a href="/tv" class="active">RoadTV</a>
  </div>
</div>
<div class="toolbar">
  <button onclick="setGrid(2)">2 col</button>
  <button onclick="setGrid(3)" class="active">3 col</button>
  <button onclick="setGrid(4)">4 col</button>
  <button onclick="setGrid(6)">6 col</button>
  <button class="wake-btn" onclick="wakeAll()">Wake All Agents</button>
  <span class="count" id="global-stats">0 / ${Object.keys(AGENTS).length} streaming</span>
</div>
<div class="grid cols-3" id="grid">
  ${tiles}
</div>
<div class="fullscreen-overlay" id="fullscreen">
  <div class="fullscreen-header">
    <span id="fs-emoji" style="font-size:24px"></span>
    <h2 id="fs-name"></h2>
    <span id="fs-role" style="color:#555;font-size:13px"></span>
    <span id="fs-stats" style="color:#444;font-size:11px;font-family:monospace"></span>
    <button class="fullscreen-close" onclick="closeFullscreen()">&times;</button>
  </div>
  <div class="fullscreen-body" id="fs-body"></div>
</div>
<script>
const agents = ${agentsJSON};
const autoPrompts = ${autoPromptsJSON};
const streams = {};
const texts = {};
let activeCount = 0;
let fsAgent = null;

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function setGrid(cols) {
  const g = document.getElementById('grid');
  g.className = 'grid cols-' + cols;
  document.querySelectorAll('.toolbar button:not(.wake-btn)').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
}

function wakeAgent(id) {
  if (streams[id]) return;
  const prompt = autoPrompts[id] || 'What are you thinking about right now?';
  const screen = document.getElementById('screen-' + id);
  const status = document.getElementById('status-' + id);
  const stats = document.getElementById('stats-' + id);
  const tile = document.getElementById('tile-' + id);

  screen.innerHTML = '<span class="tile-cursor"></span>';
  status.textContent = 'connecting';
  status.className = 'tile-status';
  tile.classList.add('streaming');
  texts[id] = '';

  const es = new EventSource('/api/stream?agent=' + id + '&prompt=' + encodeURIComponent(prompt));
  streams[id] = es;
  activeCount++;
  updateGlobalStats();

  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'frame') {
      texts[id] = d.text;
      screen.innerHTML = escHtml(d.text) + '<span class="tile-cursor"></span>';
      status.textContent = 'live';
      status.className = 'tile-status live';
      const cps = d.index / Math.max(d.elapsed, 0.001);
      stats.textContent = d.index + ' chars | ' + cps.toFixed(0) + ' c/s | ' + d.elapsed.toFixed(1) + 's';
      screen.scrollTop = screen.scrollHeight;
      if (fsAgent === id) updateFullscreen(id, d);
    }
    if (d.type === 'done') {
      texts[id] = d.text;
      screen.innerHTML = escHtml(d.text);
      status.textContent = 'done';
      status.className = 'tile-status done';
      const cps = d.index / Math.max(d.elapsed, 0.001);
      stats.textContent = d.index + ' chars | ' + cps.toFixed(0) + ' c/s | ' + d.elapsed.toFixed(1) + 's | done';
      tile.classList.remove('streaming');
      es.close();
      delete streams[id];
      activeCount--;
      updateGlobalStats();
      if (fsAgent === id) updateFullscreen(id, d);
    }
    if (d.type === 'error') {
      screen.innerHTML = '<span style="color:#FF2255">Error: ' + escHtml(d.error || 'unknown') + '</span>';
      status.textContent = 'error';
      status.className = 'tile-status';
      tile.classList.remove('streaming');
      es.close();
      delete streams[id];
      activeCount--;
      updateGlobalStats();
    }
  };

  es.onerror = () => {
    status.textContent = 'offline';
    status.className = 'tile-status';
    tile.classList.remove('streaming');
    es.close();
    delete streams[id];
    activeCount--;
    updateGlobalStats();
  };
}

function wakeAll() {
  const ids = Object.keys(agents);
  ids.forEach((id, i) => {
    setTimeout(() => wakeAgent(id), i * 800);
  });
}

function updateGlobalStats() {
  document.getElementById('global-stats').textContent = activeCount + ' / ' + Object.keys(agents).length + ' streaming';
}

function openFullscreen(id) {
  fsAgent = id;
  const a = agents[id];
  document.getElementById('fs-emoji').textContent = a.emoji;
  document.getElementById('fs-name').textContent = a.name;
  document.getElementById('fs-role').textContent = a.role;
  const body = document.getElementById('fs-body');
  body.innerHTML = texts[id] ? escHtml(texts[id]) : 'Waiting for output...';
  document.getElementById('fullscreen').classList.add('show');
}

function updateFullscreen(id, d) {
  if (fsAgent !== id) return;
  const body = document.getElementById('fs-body');
  const statsEl = document.getElementById('fs-stats');
  body.innerHTML = escHtml(d.text) + (d.type === 'frame' ? '<span class="tile-cursor" style="width:2px;height:18px"></span>' : '');
  const cps = d.index / Math.max(d.elapsed, 0.001);
  statsEl.textContent = (d.type === 'done' ? 'DONE' : 'LIVE') + ' | ' + d.index + ' chars | ' + cps.toFixed(0) + ' c/s | ' + d.elapsed.toFixed(1) + 's';
  body.scrollTop = body.scrollHeight;
}

function closeFullscreen() {
  fsAgent = null;
  document.getElementById('fullscreen').classList.remove('show');
}

// Click tile screen: wake if idle, fullscreen if has content
document.querySelectorAll('.tile-screen').forEach(el => {
  el.addEventListener('click', () => {
    const tile = el.closest('.tile');
    const id = tile.dataset.agent;
    if (!streams[id] && !texts[id]) {
      wakeAgent(id);
      return;
    }
    openFullscreen(id);
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeFullscreen();
});
</script>
</body></html>`;
}

// ── HTTP Server ──
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, cors);
    res.end();
    return;
  }

  // /api/stream — SSE streaming from Ollama
  if (url.pathname === '/api/stream') {
    const agentId = url.searchParams.get('agent') || 'road';
    const prompt = url.searchParams.get('prompt') || 'What is BlackRoad OS?';
    streamFromOllama(res, agentId, prompt);
    return;
  }

  // /api/agents — JSON list
  if (url.pathname === '/api/agents') {
    const data = Object.entries(AGENTS).map(([id, a]) => ({ id, ...a }));
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(data));
    return;
  }

  // /health
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({
      status: 'live',
      service: 'blackroad-streaming',
      model: MODEL,
      ollama: OLLAMA_HOST,
      agents: Object.keys(AGENTS).length,
      version: '2.0.0',
      features: ['single-stream', 'roadtv', 'classroom', 'self-hosted'],
    }));
    return;
  }

  // /robots.txt
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('User-agent: *\nAllow: /\n');
    return;
  }

  // /tv — RoadTV classroom view
  if (url.pathname === '/tv' || url.pathname === '/roadtv' || url.pathname === '/classroom') {
    res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8', ...cors });
    res.end(renderTVUI());
    return;
  }

  // / — Single agent view (default)
  if (url.pathname === '/' || url.pathname === '') {
    res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8', ...cors });
    res.end(renderSingleUI());
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 — Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  BlackRoad Streaming v2.0.0`);
  console.log(`  Self-hosted RoadTV server`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Ollama: ${OLLAMA_HOST}`);
  console.log(`  Listening: http://0.0.0.0:${PORT}`);
  console.log(`  Single:    http://localhost:${PORT}/`);
  console.log(`  RoadTV:    http://localhost:${PORT}/tv`);
  console.log(`  Agents:    http://localhost:${PORT}/api/agents`);
  console.log(`  Health:    http://localhost:${PORT}/health\n`);
});
