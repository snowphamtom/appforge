/**
 * Offline StoryForge fallback — interactive scene from story beats when LLM is unavailable.
 */
import type { GenerateResult } from './generator';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateStoryScene(story: string): GenerateResult {
  const trimmed = story.trim() || 'An empty stage waits for the first beat.';
  const beats = trimmed
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const rawTitle =
    beats[0] && beats[0].length <= 56
      ? beats[0].replace(/[.!?].*$/, '').trim()
      : '';
  const title = rawTitle || 'StoryForge Scene';
  const safeTitle = escapeHtml(title);
  const beatButtons = beats
    .map((b, i) => {
      const label = escapeHtml(b.length > 72 ? `${b.slice(0, 69)}…` : b);
      const full = escapeHtml(b);
      return `<button type="button" class="prop" data-beat="${i}" data-full="${full}" aria-pressed="false"><span class="prop-n">${i + 1}</span><span class="prop-t">${label}</span></button>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle} · StoryForge</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
:root {
  --bg:#070a0e; --panel:#12181f; --border:#243040; --text:#e8eef6; --muted:#8b9bb0;
  --accent:#2dd4bf; --mono:"IBM Plex Mono",ui-monospace,monospace;
  font-family:"IBM Plex Sans",system-ui,sans-serif;
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); min-height:100vh; }
.wrap { max-width:720px; margin:0 auto; padding:1.5rem 1.15rem 3rem; }
.badge { display:inline-flex; gap:.4rem; font-size:.7rem; letter-spacing:.06em; text-transform:uppercase;
  color:var(--muted); border:1px solid var(--border); border-radius:999px; padding:.2rem .55rem; margin-bottom:1rem; }
.badge em { font-style:normal; color:var(--accent); font-weight:600; }
h1 { font-size:clamp(1.4rem,4vw,2rem); letter-spacing:-.03em; margin:0 0 .4rem; }
.lead { color:var(--muted); margin:0 0 1.25rem; line-height:1.5; }
.stage { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:1rem 1.1rem; margin-bottom:1rem; }
.focus { min-height:3.2rem; font-size:1.05rem; line-height:1.45; }
.meter { height:6px; background:#0a0e14; border-radius:99px; overflow:hidden; margin:.85rem 0 .45rem; }
.fill { height:100%; width:0; background:linear-gradient(90deg,#2dd4bf,#5eead4); transition:width .25s ease; }
.meta { margin:0; font-size:.78rem; color:var(--muted); font-family:var(--mono); }
.props { display:flex; flex-direction:column; gap:.45rem; margin-bottom:1rem; }
.prop { display:flex; gap:.65rem; align-items:flex-start; text-align:left; width:100%;
  background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:.7rem .85rem;
  color:var(--text); cursor:pointer; font:inherit; transition:border-color .15s, background .15s; }
.prop:hover { border-color:var(--accent); }
.prop[aria-pressed="true"] { border-color:var(--accent); background:rgba(45,212,191,.08); }
.prop-n { font-family:var(--mono); color:var(--accent); font-weight:600; min-width:1.2rem; }
.prop-t { flex:1; line-height:1.4; }
.actions { display:flex; gap:.5rem; flex-wrap:wrap; }
.btn { background:var(--panel); border:1px solid var(--border); color:var(--text); border-radius:10px;
  padding:.5rem .85rem; font-weight:600; cursor:pointer; font:inherit; }
.btn-accent { background:var(--accent); color:#042f2e; border-color:transparent; }
.empty { color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <div class="badge"><em>StoryForge</em> Offline scene · click → state</div>
  <h1>${safeTitle}</h1>
  <p class="lead">Click beats to light the stage. Keep typing your story — the scene regenerates as it grows.</p>
  <section class="stage" aria-label="Live stage">
    <div id="stage-focus" class="focus" role="status">Click a beat to bring it into focus.</div>
    <div class="meter" aria-hidden="true"><div id="stage-fill" class="fill"></div></div>
    <p class="meta"><span id="stage-count">0</span> / ${beats.length || 1} beats lit · <span id="stage-mood">quiet</span></p>
  </section>
  <section class="props" aria-label="Story beats">
    ${beatButtons || '<p class="empty">Start typing your story…</p>'}
  </section>
  <div class="actions">
    <button type="button" id="btn-reset" class="btn">Reset stage</button>
    <button type="button" id="btn-all" class="btn btn-accent">Light all</button>
  </div>
</div>
<script>
(function(){
  var lit = {};
  var focus = document.getElementById('stage-focus');
  var fill = document.getElementById('stage-fill');
  var countEl = document.getElementById('stage-count');
  var mood = document.getElementById('stage-mood');
  var total = ${beats.length || 1};
  var moods = ['quiet','curious','tense','bright','alive'];
  function sync(){
    var n = Object.keys(lit).length;
    countEl.textContent = String(n);
    fill.style.width = Math.round((n / Math.max(total,1)) * 100) + '%';
    mood.textContent = moods[Math.min(moods.length - 1, n)];
    try { localStorage.setItem('storyforge-lit', JSON.stringify(lit)); } catch(e) {}
  }
  document.querySelectorAll('.prop').forEach(function(btn){
    btn.addEventListener('click', function(){
      var id = btn.getAttribute('data-beat');
      var on = btn.getAttribute('aria-pressed') === 'true';
      if (on) { btn.setAttribute('aria-pressed','false'); delete lit[id]; }
      else { btn.setAttribute('aria-pressed','true'); lit[id] = true; }
      focus.textContent = btn.getAttribute('data-full') || '';
      sync();
    });
  });
  var reset = document.getElementById('btn-reset');
  var all = document.getElementById('btn-all');
  if (reset) reset.addEventListener('click', function(){
    lit = {};
    document.querySelectorAll('.prop').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
    focus.textContent = 'Stage cleared. Click a beat.';
    sync();
  });
  if (all) all.addEventListener('click', function(){
    document.querySelectorAll('.prop').forEach(function(b){
      b.setAttribute('aria-pressed','true');
      lit[b.getAttribute('data-beat')] = true;
    });
    focus.textContent = 'Every beat is lit.';
    sync();
  });
  try {
    var saved = JSON.parse(localStorage.getItem('storyforge-lit') || '{}');
    if (saved && typeof saved === 'object') {
      lit = saved;
      document.querySelectorAll('.prop').forEach(function(b){
        var id = b.getAttribute('data-beat');
        if (lit[id]) b.setAttribute('aria-pressed','true');
      });
    }
  } catch(e) {}
  sync();
})();
</script>
</body>
</html>`;

  return { html, kind: 'story', title };
}
