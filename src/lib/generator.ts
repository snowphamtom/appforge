/**
 * Local HTML generator — maps prompt intent to solid self-contained templates.
 * No external LLM required for v0. Convex can store generations later.
 */

export type TemplateKind = 'todo' | 'tipjar' | 'landing' | 'habit' | 'dashboard';

/** Template kinds plus LLM-forged apps from /api/generate */
export type ResultKind = TemplateKind | 'llm';

export interface GenerateResult {
  html: string;
  kind: ResultKind;
  title: string;
  /** Present when kind === 'llm' */
  model?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectKind(prompt: string): TemplateKind {
  const p = prompt.toLowerCase();
  if (/\b(todo|to-?do|task|checklist|errand)\b/.test(p)) return 'todo';
  if (/\b(tip\s*jar|tips?|donate|donation|coffee|kofi|buy\s+me)\b/.test(p)) return 'tipjar';
  if (/\b(landing|marketing|hero|waitlist|saas|product\s+page|homepage)\b/.test(p)) return 'landing';
  if (/\b(habit|streak|daily|routine|tracker)\b/.test(p)) return 'habit';
  return 'dashboard';
}

function titleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Untitled App';
  // Capitalize first letter, truncate
  const t = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

const SHELL_CSS = `
:root {
  --bg: #0b0f14;
  --surface: #12181f;
  --surface2: #1a222c;
  --border: #2a3544;
  --text: #e8eef6;
  --muted: #8b9bb0;
  --accent: #5eead4;
  --accent-dim: #2dd4bf33;
  --danger: #f87171;
  --ok: #4ade80;
  --radius: 12px;
  --font: "IBM Plex Sans", "Inter", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { min-height: 100%; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
button, input, textarea { font: inherit; color: inherit; }
a { color: var(--accent); }
.af-wrap { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
.af-badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--muted);
  margin-bottom: 1rem;
}
.af-badge span {
  background: var(--accent-dim); color: var(--accent);
  padding: 0.15rem 0.45rem; border-radius: 999px;
}
h1 { font-size: clamp(1.55rem, 4vw, 2.05rem); font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.4rem; line-height: 1.2; }
.af-sub { color: var(--muted); font-size: 0.95rem; margin-bottom: 1.75rem; max-width: 48ch; line-height: 1.55; }
.af-progress { height: 6px; background: var(--surface2); border-radius: 999px; overflow: hidden; margin: 0.75rem 0 0; }
.af-progress > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #0d9488, var(--accent)); border-radius: inherit; transition: width 0.25s ease; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem;
}
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
  background: var(--accent); color: #042f2e; border: none;
  font-weight: 600; padding: 0.65rem 1.1rem; border-radius: 10px;
  cursor: pointer; transition: filter 0.15s, transform 0.1s;
}
.btn:hover { filter: brightness(1.08); }
.btn:active { transform: scale(0.98); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn-ghost {
  background: transparent; color: var(--text);
  border: 1px solid var(--border);
}
.btn-ghost:hover { background: var(--surface2); filter: none; }
.field {
  width: 100%; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.7rem 0.9rem; outline: none;
}
.field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
.row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
`.trim();

function wrapDoc(title: string, subtitle: string, body: string, script: string): string {
  const safeTitle = escapeHtml(title);
  const safeSub = escapeHtml(subtitle);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle} · AppForge</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
${SHELL_CSS}
</style>
</head>
<body>
<div class="af-wrap">
  <div class="af-badge"><span>AppForge</span> Generated · remixable</div>
  <h1>${safeTitle}</h1>
  <p class="af-sub">${safeSub}</p>
  ${body}
</div>
<script>
${script}
</script>
</body>
</html>`;
}

function genTodo(title: string, prompt: string): string {
  const body = `
  <div class="card" style="margin-bottom:1rem">
    <form id="add-form" class="row" style="align-items:stretch">
      <label class="sr-only" for="task">New task</label>
      <input id="task" class="field" style="flex:1;min-width:180px" placeholder="Add a task…" autocomplete="off" />
      <button type="submit" class="btn">Add</button>
    </form>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
      <strong id="count" style="font-size:0.85rem;color:var(--muted)">0 items</strong>
      <div class="row" role="group" aria-label="Filter tasks" style="gap:0.35rem">
        <button type="button" class="btn btn-ghost filt" data-f="all" style="padding:0.35rem 0.65rem;font-size:0.75rem">All</button>
        <button type="button" class="btn btn-ghost filt" data-f="active" style="padding:0.35rem 0.65rem;font-size:0.75rem">Active</button>
        <button type="button" class="btn btn-ghost filt" data-f="done" style="padding:0.35rem 0.65rem;font-size:0.75rem">Done</button>
        <button type="button" id="clear-done" class="btn btn-ghost" style="padding:0.35rem 0.65rem;font-size:0.75rem">Clear done</button>
      </div>
    </div>
    <ul id="list" style="list-style:none;display:flex;flex-direction:column;gap:0.5rem"></ul>
    <p id="empty" style="color:var(--muted);font-size:0.9rem;padding:0.5rem 0">No tasks yet — add one above.</p>
  </div>`;
  const script = `
const KEY = 'af-todo-v1';
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const countEl = document.getElementById('count');
let items = JSON.parse(localStorage.getItem(KEY) || '[]');
let filter = 'all';

function save() { localStorage.setItem(KEY, JSON.stringify(items)); }

function syncFilt() {
  document.querySelectorAll('.filt').forEach(b => {
    const on = b.dataset.f === filter;
    b.className = 'btn filt' + (on ? '' : ' btn-ghost');
    b.style.cssText = 'padding:0.35rem 0.65rem;font-size:0.75rem';
  });
}

document.querySelectorAll('.filt').forEach(b => {
  b.addEventListener('click', () => { filter = b.dataset.f; syncFilt(); render(); });
});
syncFilt();

function render() {
  list.innerHTML = '';
  const shown = items.map((item, i) => ({ item, i })).filter(({ item }) =>
    filter === 'all' || (filter === 'done' ? item.done : !item.done)
  );
  shown.forEach(({ item, i }) => {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.65rem;background:var(--surface2);border-radius:8px;border:1px solid var(--border)';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = item.done; cb.id = 't'+i;
    cb.setAttribute('aria-label', 'Mark done: ' + item.text);
    cb.addEventListener('change', () => { items[i].done = cb.checked; save(); render(); });
    const label = document.createElement('label');
    label.htmlFor = 't'+i;
    label.textContent = item.text;
    label.style.cssText = 'flex:1;cursor:pointer' + (item.done ? ';text-decoration:line-through;color:var(--muted)' : '');
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn btn-ghost';
    del.style.cssText = 'padding:0.25rem 0.5rem;font-size:0.75rem';
    del.textContent = '✕'; del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => { items.splice(i,1); save(); render(); });
    li.append(cb, label, del);
    list.appendChild(li);
  });
  empty.hidden = shown.length > 0;
  empty.textContent = items.length ? 'Nothing in this filter.' : 'No tasks yet — add one above.';
  const left = items.filter(x => !x.done).length;
  countEl.textContent = items.length + ' item' + (items.length===1?'':'s') + ' · ' + left + ' left';
}

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('task');
  const text = input.value.trim();
  if (!text) return;
  items.unshift({ text, done: false });
  input.value = '';
  save(); render();
  input.focus();
});

document.getElementById('clear-done').addEventListener('click', () => {
  items = items.filter(x => !x.done); save(); render();
});

render();
`;
  return wrapDoc(title, prompt.trim() || 'A simple todo list', body, script);
}

function genTipjar(title: string, prompt: string): string {
  const body = `
  <div class="card" style="text-align:center;padding:2rem 1.5rem">
    <p style="font-size:2.75rem;margin-bottom:0.5rem" aria-hidden="true">☕</p>
    <p style="color:var(--muted);margin-bottom:1.5rem;max-width:28ch;margin-inline:auto">Support this project with a tip. Pick an amount or enter your own.</p>
    <div class="row" style="justify-content:center;margin-bottom:1rem" role="group" aria-label="Tip amounts">
      <button type="button" class="btn btn-ghost tip-amt" data-amt="3">$3</button>
      <button type="button" class="btn btn-ghost tip-amt" data-amt="5">$5</button>
      <button type="button" class="btn tip-amt" data-amt="10">$10</button>
      <button type="button" class="btn btn-ghost tip-amt" data-amt="25">$25</button>
    </div>
    <div class="row" style="justify-content:center;max-width:320px;margin:0 auto 1.25rem">
      <label class="sr-only" for="custom">Custom amount</label>
      <input id="custom" class="field" type="number" min="1" step="1" placeholder="Custom $" style="flex:1;text-align:center" />
    </div>
    <p id="selected" style="font-weight:600;font-size:1.25rem;margin-bottom:1rem;color:var(--accent)">$10</p>
    <button type="button" id="send" class="btn" style="width:100%;max-width:280px">Send tip</button>
    <p id="thanks" hidden style="margin-top:1.25rem;color:var(--ok);font-weight:500"></p>
    <p id="tip-log" style="margin-top:1rem;font-size:0.8rem;color:var(--muted)">Tips sent (demo): 0 · $0</p>
    <p style="margin-top:1.25rem;font-size:0.75rem;color:var(--muted)">Demo only — no real payment. Fee shown is not a prize.</p>
  </div>`;
  const script = `
let amount = 10;
const selected = document.getElementById('selected');
const custom = document.getElementById('custom');
const thanks = document.getElementById('thanks');

function setAmt(n) {
  amount = Math.max(1, Math.round(Number(n) || 1));
  selected.textContent = '$' + amount;
  document.querySelectorAll('.tip-amt').forEach(b => {
    const a = Number(b.dataset.amt);
    b.className = 'btn tip-amt' + (a === amount ? '' : ' btn-ghost');
  });
}

document.querySelectorAll('.tip-amt').forEach(b => {
  b.addEventListener('click', () => { custom.value = ''; setAmt(b.dataset.amt); });
});
custom.addEventListener('input', () => { if (custom.value) setAmt(custom.value); });

const LOG_KEY = 'af-tipjar-v1';
let log = JSON.parse(localStorage.getItem(LOG_KEY) || '{"n":0,"sum":0}');
const tipLog = document.getElementById('tip-log');
function paintLog() {
  tipLog.textContent = 'Tips sent (demo): ' + log.n + ' · $' + log.sum;
}
paintLog();

document.getElementById('send').addEventListener('click', () => {
  log.n += 1; log.sum += amount;
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  paintLog();
  thanks.hidden = false;
  thanks.textContent = 'Thanks for the $' + amount + ' tip! (Demo — nothing charged.)';
});
setAmt(10);
`;
  return wrapDoc(title, prompt.trim() || 'A tip jar for supporters', body, script);
}

function genLanding(title: string, prompt: string): string {
  const body = `
  <div class="card" style="padding:2rem 1.5rem;margin-bottom:1rem;background:linear-gradient(160deg,var(--surface) 0%,#0d2818 100%);border-color:#1e3a2f">
    <p style="font-size:0.8rem;font-weight:600;color:var(--accent);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:0.75rem">Now in early access</p>
    <h2 style="font-size:clamp(1.35rem,3.5vw,1.75rem);letter-spacing:-0.02em;margin-bottom:0.75rem;font-weight:700">Ship faster. Look sharper.</h2>
    <p style="color:var(--muted);margin-bottom:1.5rem;max-width:40ch">${escapeHtml(prompt.trim() || 'A clean landing page for your idea.')}</p>
    <form id="waitlist" class="row">
      <label class="sr-only" for="email">Email</label>
      <input id="email" class="field" type="email" required placeholder="you@company.com" style="flex:1;min-width:200px" />
      <button type="submit" class="btn">Join waitlist</button>
    </form>
    <p id="joined" hidden style="margin-top:1rem;color:var(--ok);font-weight:500">You're on the list. We'll be in touch.</p>
    <div class="row" style="margin-top:1rem;justify-content:flex-start">
      <button type="button" id="mood" class="btn btn-ghost" style="padding:0.4rem 0.75rem;font-size:0.8rem">Try night glow</button>
    </div>
  </div>
  <div style="display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
    <div class="card"><strong style="display:block;margin-bottom:0.35rem">Fast</strong><span style="color:var(--muted);font-size:0.9rem">Launch a polished page in minutes, not weeks.</span></div>
    <div class="card"><strong style="display:block;margin-bottom:0.35rem">Focused</strong><span style="color:var(--muted);font-size:0.9rem">One clear CTA. No clutter. Built to convert.</span></div>
    <div class="card"><strong style="display:block;margin-bottom:0.35rem">Yours</strong><span style="color:var(--muted);font-size:0.9rem">Remix the source. Own every pixel.</span></div>
  </div>`;
  const script = `
document.getElementById('waitlist').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('email');
  if (!email.value.trim()) return;
  document.getElementById('joined').hidden = false;
  email.value = '';
});
let glow = false;
document.getElementById('mood').addEventListener('click', () => {
  glow = !glow;
  document.body.style.boxShadow = glow ? 'inset 0 0 120px #5eead422' : 'none';
  document.getElementById('mood').textContent = glow ? 'Reset glow' : 'Try night glow';
});
`;
  return wrapDoc(title, 'Landing page', body, script);
}

function genHabit(title: string, prompt: string): string {
  const body = `
  <div class="card" style="margin-bottom:1rem">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5rem">
      <strong style="letter-spacing:-0.02em">Today's habits</strong>
      <span id="streak" style="font-size:0.85rem;color:var(--accent);font-weight:600">Streak: 0</span>
    </div>
    <p style="color:var(--muted);font-size:0.85rem;margin-bottom:0.65rem">Check off what you did. Progress saves locally.</p>
    <div class="af-progress" aria-hidden="true"><i id="habit-bar"></i></div>
    <p id="habit-pct" style="font-size:0.75rem;color:var(--muted);margin:0.4rem 0 1rem">0% today</p>
    <ul id="habits" style="list-style:none;display:flex;flex-direction:column;gap:0.5rem"></ul>
  </div>
  <div class="card">
    <form id="add-habit" class="row">
      <label class="sr-only" for="habit-name">New habit</label>
      <input id="habit-name" class="field" style="flex:1;min-width:160px" placeholder="Add a habit…" />
      <button type="submit" class="btn">Add</button>
    </form>
  </div>`;
  const script = `
const KEY = 'af-habit-v1';
const DEFAULTS = [
  { id: '1', name: 'Move 20 min', done: false },
  { id: '2', name: 'Drink water', done: false },
  { id: '3', name: 'No doomscroll', done: false },
];
let state = JSON.parse(localStorage.getItem(KEY) || 'null') || { habits: DEFAULTS, streak: 0, lastDay: '' };

function today() { return new Date().toISOString().slice(0,10); }
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

function ensureDay() {
  const d = today();
  if (state.lastDay !== d) {
    const allDone = state.habits.length && state.habits.every(h => h.done);
    if (state.lastDay && allDone) state.streak += 1;
    else if (state.lastDay && !allDone) state.streak = 0;
    state.habits = state.habits.map(h => ({ ...h, done: false }));
    state.lastDay = d;
    save();
  }
}

function render() {
  ensureDay();
  document.getElementById('streak').textContent = 'Streak: ' + state.streak + ' day' + (state.streak===1?'':'s');
  const ul = document.getElementById('habits');
  ul.innerHTML = '';
  state.habits.forEach((h, i) => {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;gap:0.65rem;padding:0.65rem 0.75rem;background:var(--surface2);border-radius:8px;border:1px solid ' + (h.done ? '#134e4a' : 'var(--border)');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = h.done; cb.id = 'h'+h.id;
    cb.addEventListener('change', () => { state.habits[i].done = cb.checked; save(); render(); });
    const label = document.createElement('label');
    label.htmlFor = 'h'+h.id; label.textContent = h.name;
    label.style.cssText = 'flex:1;cursor:pointer;font-weight:500' + (h.done ? ';color:var(--ok)' : '');
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn btn-ghost';
    del.style.cssText = 'padding:0.25rem 0.5rem;font-size:0.75rem';
    del.textContent = '✕'; del.setAttribute('aria-label', 'Remove habit');
    del.addEventListener('click', () => { state.habits.splice(i,1); save(); render(); });
    li.append(cb, label, del);
    ul.appendChild(li);
  });
  const done = state.habits.filter(h => h.done).length;
  const pct = state.habits.length ? Math.round((done / state.habits.length) * 100) : 0;
  document.getElementById('habit-bar').style.width = pct + '%';
  document.getElementById('habit-pct').textContent = pct + '% today · ' + done + '/' + state.habits.length;
}

document.getElementById('add-habit').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('habit-name');
  const name = input.value.trim();
  if (!name) return;
  state.habits.push({ id: String(Date.now()), name, done: false });
  input.value = ''; save(); render();
});

render();
`;
  return wrapDoc(title, prompt.trim() || 'Daily habit tracker', body, script);
}

function genDashboard(title: string, prompt: string): string {
  const body = `
  <div style="display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:1rem">
    <div class="card"><div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em">Active</div><div style="font-size:1.75rem;font-weight:700;color:var(--accent);margin-top:0.25rem" id="stat-a">12</div></div>
    <div class="card"><div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em">Done</div><div style="font-size:1.75rem;font-weight:700;margin-top:0.25rem" id="stat-b">48</div></div>
    <div class="card"><div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em">Score</div><div style="font-size:1.75rem;font-weight:700;margin-top:0.25rem" id="stat-c">86</div></div>
  </div>
  <div class="card" style="margin-bottom:1rem">
    <strong style="display:block;margin-bottom:0.75rem">Quick notes</strong>
    <textarea id="notes" class="field" rows="4" placeholder="Jot something…" style="resize:vertical;min-height:100px"></textarea>
    <div class="row" style="margin-top:0.75rem;justify-content:flex-end">
      <button type="button" id="save-notes" class="btn">Save notes</button>
    </div>
    <p id="saved" hidden style="margin-top:0.5rem;font-size:0.85rem;color:var(--ok)">Saved locally.</p>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
      <strong style="letter-spacing:-0.02em">Pulse</strong>
      <button type="button" id="reshuffle" class="btn btn-ghost" style="padding:0.35rem 0.65rem;font-size:0.75rem">Reshuffle</button>
    </div>
    <div id="bars" style="display:flex;align-items:flex-end;gap:0.4rem;height:110px" role="img" aria-label="Activity chart"></div>
    <p id="bar-hint" style="margin-top:0.65rem;font-size:0.8rem;color:var(--muted)">Click a bar to focus that day.</p>
  </div>`;
  const script = `
const notes = document.getElementById('notes');
notes.value = localStorage.getItem('af-dash-notes') || '';
document.getElementById('save-notes').addEventListener('click', () => {
  localStorage.setItem('af-dash-notes', notes.value);
  const s = document.getElementById('saved');
  s.hidden = false;
  setTimeout(() => { s.hidden = true; }, 1500);
});

const bars = document.getElementById('bars');
const hint = document.getElementById('bar-hint');
let vals = [40, 65, 45, 80, 55, 90, 70];
function paintBars() {
  bars.innerHTML = '';
  vals.forEach((v, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.style.cssText = 'flex:1;border:none;cursor:pointer;padding:0;background:linear-gradient(180deg,var(--accent),#0d9488);border-radius:6px 6px 2px 2px;height:' + v + '%;opacity:' + (0.55 + i*0.06);
    d.title = 'Day ' + (i+1) + ': ' + v;
    d.setAttribute('aria-label', 'Day ' + (i+1) + ', value ' + v);
    d.addEventListener('click', () => {
      document.getElementById('stat-c').textContent = String(v);
      hint.textContent = 'Focused day ' + (i+1) + ' · score set to ' + v;
    });
    bars.appendChild(d);
  });
}
paintBars();
document.getElementById('reshuffle').addEventListener('click', () => {
  vals = vals.map(() => 30 + Math.round(Math.random() * 70));
  paintBars();
  hint.textContent = 'Reshuffled pulse. Click a bar to focus.';
});

setInterval(() => {
  const a = document.getElementById('stat-a');
  const n = Number(a.textContent) + (Math.random() > 0.6 ? 1 : 0);
  a.textContent = String(Math.min(n, 99));
}, 4000);
`;
  return wrapDoc(title, prompt.trim() || 'Personal dashboard', body, script);
}

const GENERATORS: Record<TemplateKind, (title: string, prompt: string) => string> = {
  todo: genTodo,
  tipjar: genTipjar,
  landing: genLanding,
  habit: genHabit,
  dashboard: genDashboard,
};

export function generateApp(prompt: string): GenerateResult {
  const kind = detectKind(prompt);
  const title = titleFromPrompt(prompt);
  const html = GENERATORS[kind](title, prompt);
  return { html, kind, title };
}

export const EXAMPLE_PROMPTS = [
  { label: 'todo list', prompt: 'A clean todo list with checkboxes' },
  { label: 'tip jar', prompt: 'A tip jar for my creative work' },
  { label: 'landing page', prompt: 'A landing page for my SaaS waitlist' },
  { label: 'habit tracker', prompt: 'A daily habit tracker with streaks' },
  { label: 'waitlist', prompt: 'A waitlist landing page with email signup for my product launch' },
] as const;
