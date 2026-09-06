/**
 * Local HTML generator — maps prompt intent to solid self-contained templates.
 * No external LLM required for v0. Public Pages / no-key: keyword scoring + suites.
 */

export type TemplateKind =
  | 'todo'
  | 'tipjar'
  | 'landing'
  | 'habit'
  | 'dashboard'
  | 'ledger'
  | 'countdown'
  | 'kanban'
  | 'quiz'
  | 'invoice';

/** Template kinds plus LLM-forged apps and multi-section suites */
export type ResultKind = TemplateKind | 'llm' | 'suite';

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

/** Weighted keyword rules — higher weight wins; multiple scores can compose. */
const KIND_RULES: Array<{ kind: TemplateKind; weight: number; re: RegExp }> = [
  { kind: 'todo', weight: 10, re: /\b(todo|to-?do|task\s*list|checklist|errand|shopping\s*list)\b/ },
  { kind: 'todo', weight: 6, re: /\b(tasks?|check\s*off|reminders?)\b/ },
  { kind: 'tipjar', weight: 12, re: /\b(tip\s*jar|tips?|donate|donation|kofi|ko-fi|buy\s+me\s+a\s+coffee|support\s+me|patron)\b/ },
  { kind: 'tipjar', weight: 5, re: /\b(coffee|gratuity|tipping)\b/ },
  { kind: 'landing', weight: 10, re: /\b(landing|marketing|hero|waitlist|saas|product\s+page|homepage|coming\s+soon|sign\s*up\s+page)\b/ },
  { kind: 'landing', weight: 5, re: /\b(launch|newsletter\s+signup|early\s+access)\b/ },
  { kind: 'habit', weight: 11, re: /\b(habit|streak|routine|daily\s+tracker|habit\s*track)\b/ },
  { kind: 'habit', weight: 5, re: /\b(daily|consistency|check-?in)\b/ },
  { kind: 'ledger', weight: 12, re: /\b(ledger|expense|expenses|budget|bookkeep|line\s*item|spend(ing)?|cashflow|cash\s*flow|money\s*track)\b/ },
  { kind: 'ledger', weight: 6, re: /\b(income|outgo|balance\s*sheet|transactions?)\b/ },
  { kind: 'countdown', weight: 12, re: /\b(countdown|count\s*down|timer|deadline|days?\s+until|launch\s+day|wedding\s+countdown)\b/ },
  { kind: 'countdown', weight: 5, re: /\b(pomodoro|stopwatch|alarm)\b/ },
  { kind: 'kanban', weight: 12, re: /\b(kanban|board|trello|backlog|swimlane|wip|pipeline\s*board)\b/ },
  { kind: 'kanban', weight: 6, re: /\b(columns?|cards?\s+board|project\s+board)\b/ },
  { kind: 'quiz', weight: 12, re: /\b(quiz|trivia|flash\s*cards?|flashcards?|multiple\s*choice|test\s+yourself|question(naire)?s?)\b/ },
  { kind: 'quiz', weight: 5, re: /\b(score\s+quiz|practice\s+test|study\s+deck)\b/ },
  { kind: 'invoice', weight: 12, re: /\b(invoice|estimate|quote|billing|bill\s+stub|client\s+bill|receipt)\b/ },
  { kind: 'invoice', weight: 5, re: /\b(line\s*items?\s+bill|freelancer\s+invoice)\b/ },
  { kind: 'dashboard', weight: 8, re: /\b(dashboard|metrics|stats|analytics|overview|pulse|kpi)\b/ },
  { kind: 'dashboard', weight: 3, re: /\b(notes?\s+pad|scratchpad|personal\s+home)\b/ },
];

function scoreKinds(prompt: string): Array<{ kind: TemplateKind; score: number }> {
  const p = prompt.toLowerCase();
  const scores = new Map<TemplateKind, number>();
  for (const rule of KIND_RULES) {
    if (rule.re.test(p)) {
      scores.set(rule.kind, (scores.get(rule.kind) || 0) + rule.weight);
    }
  }
  return [...scores.entries()]
    .map(([kind, score]) => ({ kind, score }))
    .sort((a, b) => b.score - a.score);
}

function pickKinds(prompt: string): TemplateKind[] {
  const scored = scoreKinds(prompt);
  if (scored.length === 0) return ['dashboard'];
  const top = scored[0].score;
  const multi = /\b(and|plus|with|also|,)\b/.test(prompt.toLowerCase());
  const picked: TemplateKind[] = [];
  for (const { kind, score } of scored) {
    if (picked.length === 0) {
      picked.push(kind);
      continue;
    }
    if (picked.length >= 3) break;
    if (multi && score >= 6) picked.push(kind);
    else if (score >= top - 3 && score >= 8) picked.push(kind);
  }
  return picked;
}

function titleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Untitled App';
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
  --warn: #fbbf24;
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
button, input, textarea, select { font: inherit; color: inherit; }
a { color: var(--accent); }
.af-wrap { max-width: 760px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
.af-wrap.wide { max-width: 960px; }
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
h2.af-sec { font-size: 1.05rem; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 0.75rem; }
.af-sub { color: var(--muted); font-size: 0.95rem; margin-bottom: 1.75rem; max-width: 52ch; line-height: 1.55; }
.af-progress { height: 6px; background: var(--surface2); border-radius: 999px; overflow: hidden; margin: 0.75rem 0 0; }
.af-progress > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #0d9488, var(--accent)); border-radius: inherit; transition: width 0.25s ease; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem;
}
.af-section { margin-bottom: 1.25rem; }
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
.btn-danger { background: #7f1d1d; color: #fecaca; }
.field {
  width: 100%; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.7rem 0.9rem; outline: none;
}
.field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
.row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.mono { font-family: var(--mono); }
.pill {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--muted);
  border: 1px solid var(--border); border-radius: 999px; padding: 0.2rem 0.55rem;
}
.kb-col {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.65rem; min-height: 180px;
}
.kb-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 0.55rem 0.65rem; margin-bottom: 0.45rem;
  cursor: grab;
}
`.trim();


function wrapDoc(
  title: string,
  subtitle: string,
  body: string,
  script: string,
  wide = false,
): string {
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
<div class="af-wrap${wide ? ' wide' : ''}">
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


type Section = { body: string; script: string };

function genTodo(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="todo">
    <h2 class="af-sec">Tasks</h2>
    <form id="${p}add-form" class="row" style="align-items:stretch;margin-bottom:1rem">
      <label class="sr-only" for="${p}task">New task</label>
      <input id="${p}task" class="field" style="flex:1;min-width:180px" placeholder="Add a task…" autocomplete="off" />
      <button type="submit" class="btn">Add</button>
    </form>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
      <strong id="${p}count" style="font-size:0.85rem;color:var(--muted)">0 items</strong>
      <div class="row" role="group" aria-label="Filter tasks" style="gap:0.35rem">
        <button type="button" class="btn btn-ghost ${p}filt" data-f="all" style="padding:0.35rem 0.65rem;font-size:0.75rem">All</button>
        <button type="button" class="btn btn-ghost ${p}filt" data-f="active" style="padding:0.35rem 0.65rem;font-size:0.75rem">Active</button>
        <button type="button" class="btn btn-ghost ${p}filt" data-f="done" style="padding:0.35rem 0.65rem;font-size:0.75rem">Done</button>
        <button type="button" id="${p}clear-done" class="btn btn-ghost" style="padding:0.35rem 0.65rem;font-size:0.75rem">Clear done</button>
      </div>
    </div>
    <ul id="${p}list" style="list-style:none;display:flex;flex-direction:column;gap:0.5rem"></ul>
    <p id="${p}empty" style="color:var(--muted);font-size:0.9rem;padding:0.5rem 0">No tasks yet — add one above.</p>
  </div>`;
  const script = `
(function(){
const KEY='af-todo-v2${p || "root"}';
const list=document.getElementById('${p}list');
const empty=document.getElementById('${p}empty');
const countEl=document.getElementById('${p}count');
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
let filter='all';
function save(){localStorage.setItem(KEY,JSON.stringify(items));}
function syncFilt(){document.querySelectorAll('.${p}filt').forEach(b=>{const on=b.dataset.f===filter;b.className='btn ${p}filt'+(on?'':' btn-ghost');b.style.cssText='padding:0.35rem 0.65rem;font-size:0.75rem';});}
document.querySelectorAll('.${p}filt').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.f;syncFilt();render();}));
syncFilt();
function render(){
  list.innerHTML='';
  const shown=items.map((item,i)=>({item,i})).filter(({item})=>filter==='all'||(filter==='done'?item.done:!item.done));
  shown.forEach(({item,i})=>{
    const li=document.createElement('li');
    li.style.cssText='display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.65rem;background:var(--surface2);border-radius:8px;border:1px solid var(--border)';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=item.done;cb.id='${p}t'+i;
    cb.setAttribute('aria-label','Mark done: '+item.text);
    cb.addEventListener('change',()=>{items[i].done=cb.checked;save();render();});
    const label=document.createElement('label');label.htmlFor='${p}t'+i;label.textContent=item.text;
    label.style.cssText='flex:1;cursor:pointer'+(item.done?';text-decoration:line-through;color:var(--muted)':'');
    const del=document.createElement('button');del.type='button';del.className='btn btn-ghost';
    del.style.cssText='padding:0.25rem 0.5rem;font-size:0.75rem';del.textContent='✕';del.setAttribute('aria-label','Delete');
    del.addEventListener('click',()=>{items.splice(i,1);save();render();});
    li.append(cb,label,del);list.appendChild(li);
  });
  empty.hidden=shown.length>0;
  empty.textContent=items.length?'Nothing in this filter.':'No tasks yet — add one above.';
  const left=items.filter(x=>!x.done).length;
  countEl.textContent=items.length+' item'+(items.length===1?'':'s')+' · '+left+' left';
}
document.getElementById('${p}add-form').addEventListener('submit',e=>{e.preventDefault();const input=document.getElementById('${p}task');const text=input.value.trim();if(!text)return;items.unshift({text,done:false});input.value='';save();render();input.focus();});
document.getElementById('${p}clear-done').addEventListener('click',()=>{items=items.filter(x=>!x.done);save();render();});
render();
})();`;
  return { body, script };
}


function genTipjar(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="tipjar" style="text-align:center;padding:2rem 1.5rem">
    <span class="pill" style="margin-bottom:0.75rem">Honest demo · nothing charged</span>
    <p style="font-size:2.75rem;margin-bottom:0.5rem" aria-hidden="true">☕</p>
    <p style="color:var(--muted);margin-bottom:1.5rem;max-width:32ch;margin-inline:auto">Support this project with a tip. Local demo only — no payment processor, no prizes.</p>
    <div class="row" style="justify-content:center;margin-bottom:1rem" role="group" aria-label="Tip amounts">
      <button type="button" class="btn btn-ghost ${p}tip-amt" data-amt="3">$3</button>
      <button type="button" class="btn btn-ghost ${p}tip-amt" data-amt="5">$5</button>
      <button type="button" class="btn ${p}tip-amt" data-amt="10">$10</button>
      <button type="button" class="btn btn-ghost ${p}tip-amt" data-amt="25">$25</button>
    </div>
    <div class="row" style="justify-content:center;max-width:320px;margin:0 auto 1.25rem">
      <label class="sr-only" for="${p}custom">Custom amount</label>
      <input id="${p}custom" class="field" type="number" min="1" step="1" placeholder="Custom $" style="flex:1;text-align:center" />
    </div>
    <p id="${p}selected" style="font-weight:600;font-size:1.25rem;margin-bottom:1rem;color:var(--accent)">$10</p>
    <button type="button" id="${p}send" class="btn" style="width:100%;max-width:280px">Send tip (demo)</button>
    <p id="${p}thanks" hidden style="margin-top:1.25rem;color:var(--ok);font-weight:500"></p>
    <p id="${p}tip-log" style="margin-top:1rem;font-size:0.8rem;color:var(--muted)">Tips sent (demo): 0 · $0</p>
    <p style="margin-top:1.25rem;font-size:0.75rem;color:var(--muted)">Fee shown is not a prize. No real money moves.</p>
  </div>`;
  const script = `
(function(){
let amount=10;
const selected=document.getElementById('${p}selected');
const custom=document.getElementById('${p}custom');
const thanks=document.getElementById('${p}thanks');
function setAmt(n){amount=Math.max(1,Math.round(Number(n)||1));selected.textContent='$'+amount;document.querySelectorAll('.${p}tip-amt').forEach(b=>{const a=Number(b.dataset.amt);b.className='btn ${p}tip-amt'+(a===amount?'':' btn-ghost');});}
document.querySelectorAll('.${p}tip-amt').forEach(b=>b.addEventListener('click',()=>{custom.value='';setAmt(b.dataset.amt);}));
custom.addEventListener('input',()=>{if(custom.value)setAmt(custom.value);});
const LOG_KEY='af-tipjar-v2${p || "root"}';
let log=JSON.parse(localStorage.getItem(LOG_KEY)||'{"n":0,"sum":0}');
const tipLog=document.getElementById('${p}tip-log');
function paintLog(){tipLog.textContent='Tips sent (demo): '+log.n+' · $'+log.sum;}
paintLog();
document.getElementById('${p}send').addEventListener('click',()=>{log.n+=1;log.sum+=amount;localStorage.setItem(LOG_KEY,JSON.stringify(log));paintLog();thanks.hidden=false;thanks.textContent='Thanks for the $'+amount+' tip! (Demo — nothing charged. Not a prize.)';});
setAmt(10);
})();`;
  return { body, script };
}


function genLanding(_title: string, prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="landing" style="padding:2rem 1.5rem;margin-bottom:1rem;background:linear-gradient(160deg,var(--surface) 0%,#0d2818 100%);border-color:#1e3a2f">
    <p style="font-size:0.8rem;font-weight:600;color:var(--accent);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:0.75rem">Now in early access</p>
    <h2 style="font-size:clamp(1.35rem,3.5vw,1.75rem);letter-spacing:-0.02em;margin-bottom:0.75rem;font-weight:700">Ship faster. Look sharper.</h2>
    <p style="color:var(--muted);margin-bottom:1.5rem;max-width:40ch">${escapeHtml(prompt.trim() || 'A clean landing page for your idea.')}</p>
    <form id="${p}waitlist" class="row">
      <label class="sr-only" for="${p}email">Email</label>
      <input id="${p}email" class="field" type="email" required placeholder="you@company.com" style="flex:1;min-width:200px" />
      <button type="submit" class="btn">Join waitlist</button>
    </form>
    <p id="${p}joined" hidden style="margin-top:1rem;color:var(--ok);font-weight:500">You're on the list. We'll be in touch.</p>
    <div class="row" style="margin-top:1rem">
      <button type="button" id="${p}mood" class="btn btn-ghost" style="padding:0.4rem 0.75rem;font-size:0.8rem">Try night glow</button>
      <span id="${p}wl-count" class="pill">0 signed up (local)</span>
    </div>
  </div>
  <div style="display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))" class="af-section">
    <div class="card"><strong style="display:block;margin-bottom:0.35rem">Fast</strong><span style="color:var(--muted);font-size:0.9rem">Launch a polished page in minutes.</span></div>
    <div class="card"><strong style="display:block;margin-bottom:0.35rem">Focused</strong><span style="color:var(--muted);font-size:0.9rem">One clear CTA. Built to convert.</span></div>
    <div class="card"><strong style="display:block;margin-bottom:0.35rem">Yours</strong><span style="color:var(--muted);font-size:0.9rem">Remix the source. Own every pixel.</span></div>
  </div>`;
  const script = `
(function(){
const KEY='af-waitlist-v1${p || "root"}';
let n=Number(localStorage.getItem(KEY)||'0');
const count=document.getElementById('${p}wl-count');
function paint(){count.textContent=n+' signed up (local)';}
paint();
document.getElementById('${p}waitlist').addEventListener('submit',e=>{
  e.preventDefault();
  const email=document.getElementById('${p}email');
  if(!email.value.trim())return;
  n+=1;localStorage.setItem(KEY,String(n));paint();
  document.getElementById('${p}joined').hidden=false;email.value='';
});
let glow=false;
document.getElementById('${p}mood').addEventListener('click',()=>{
  glow=!glow;document.body.style.boxShadow=glow?'inset 0 0 120px #5eead422':'none';
  document.getElementById('${p}mood').textContent=glow?'Reset glow':'Try night glow';
});
})();`;
  return { body, script };
}



function genHabit(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="habit">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5rem">
      <h2 class="af-sec" style="margin:0">Today's habits</h2>
      <span id="${p}streak" style="font-size:0.85rem;color:var(--accent);font-weight:600">Streak: 0</span>
    </div>
    <p style="color:var(--muted);font-size:0.85rem;margin-bottom:0.65rem">Check off what you did. Progress saves locally.</p>
    <div class="af-progress" aria-hidden="true"><i id="${p}habit-bar"></i></div>
    <p id="${p}habit-pct" style="font-size:0.75rem;color:var(--muted);margin:0.4rem 0 1rem">0% today</p>
    <ul id="${p}habits" style="list-style:none;display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem"></ul>
    <form id="${p}add-habit" class="row">
      <label class="sr-only" for="${p}habit-name">New habit</label>
      <input id="${p}habit-name" class="field" style="flex:1;min-width:160px" placeholder="Add a habit…" />
      <button type="submit" class="btn">Add</button>
    </form>
  </div>`;
  const script = `
(function(){
const KEY='af-habit-v2${p || "root"}';
const DEFAULTS=[{id:'1',name:'Move 20 min',done:false},{id:'2',name:'Drink water',done:false},{id:'3',name:'No doomscroll',done:false}];
let state=JSON.parse(localStorage.getItem(KEY)||'null')||{habits:DEFAULTS,streak:0,lastDay:''};
function today(){return new Date().toISOString().slice(0,10);}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function ensureDay(){
  const d=today();
  if(state.lastDay!==d){
    const allDone=state.habits.length&&state.habits.every(h=>h.done);
    if(state.lastDay&&allDone)state.streak+=1;
    else if(state.lastDay&&!allDone)state.streak=0;
    state.habits=state.habits.map(h=>({...h,done:false}));
    state.lastDay=d;save();
  }
}
function render(){
  ensureDay();
  document.getElementById('${p}streak').textContent='Streak: '+state.streak+' day'+(state.streak===1?'':'s');
  const ul=document.getElementById('${p}habits');ul.innerHTML='';
  state.habits.forEach((h,i)=>{
    const li=document.createElement('li');
    li.style.cssText='display:flex;align-items:center;gap:0.65rem;padding:0.65rem 0.75rem;background:var(--surface2);border-radius:8px;border:1px solid '+(h.done?'#134e4a':'var(--border)');
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=h.done;cb.id='${p}h'+h.id;
    cb.addEventListener('change',()=>{state.habits[i].done=cb.checked;save();render();});
    const label=document.createElement('label');label.htmlFor='${p}h'+h.id;label.textContent=h.name;
    label.style.cssText='flex:1;cursor:pointer;font-weight:500'+(h.done?';color:var(--ok)':'');
    const del=document.createElement('button');del.type='button';del.className='btn btn-ghost';
    del.style.cssText='padding:0.25rem 0.5rem;font-size:0.75rem';del.textContent='✕';
    del.addEventListener('click',()=>{state.habits.splice(i,1);save();render();});
    li.append(cb,label,del);ul.appendChild(li);
  });
  const done=state.habits.filter(h=>h.done).length;
  const pct=state.habits.length?Math.round((done/state.habits.length)*100):0;
  document.getElementById('${p}habit-bar').style.width=pct+'%';
  document.getElementById('${p}habit-pct').textContent=pct+'% today · '+done+'/'+state.habits.length;
}
document.getElementById('${p}add-habit').addEventListener('submit',e=>{
  e.preventDefault();const input=document.getElementById('${p}habit-name');const name=input.value.trim();
  if(!name)return;state.habits.push({id:String(Date.now()),name,done:false});input.value='';save();render();
});
render();
})();`;
  return { body, script };
}


function genDashboard(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="af-section" data-af-kind="dashboard" style="display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:1rem">
    <div class="card"><div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em">Active</div><div style="font-size:1.75rem;font-weight:700;color:var(--accent);margin-top:0.25rem" id="${p}stat-a">12</div></div>
    <div class="card"><div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em">Done</div><div style="font-size:1.75rem;font-weight:700;margin-top:0.25rem" id="${p}stat-b">48</div></div>
    <div class="card"><div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em">Score</div><div style="font-size:1.75rem;font-weight:700;margin-top:0.25rem" id="${p}stat-c">86</div></div>
  </div>
  <div class="card af-section">
    <strong style="display:block;margin-bottom:0.75rem">Quick notes</strong>
    <textarea id="${p}notes" class="field" rows="4" placeholder="Jot something…" style="resize:vertical;min-height:100px"></textarea>
    <div class="row" style="margin-top:0.75rem;justify-content:flex-end">
      <button type="button" id="${p}save-notes" class="btn">Save notes</button>
    </div>
    <p id="${p}saved" hidden style="margin-top:0.5rem;font-size:0.85rem;color:var(--ok)">Saved locally.</p>
  </div>
  <div class="card af-section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
      <strong>Pulse</strong>
      <button type="button" id="${p}reshuffle" class="btn btn-ghost" style="padding:0.35rem 0.65rem;font-size:0.75rem">Reshuffle</button>
    </div>
    <div id="${p}bars" style="display:flex;align-items:flex-end;gap:0.4rem;height:110px" role="img" aria-label="Activity chart"></div>
    <p id="${p}bar-hint" style="margin-top:0.65rem;font-size:0.8rem;color:var(--muted)">Click a bar to focus that day.</p>
  </div>`;
  const script = `
(function(){
const notes=document.getElementById('${p}notes');
notes.value=localStorage.getItem('af-dash-notes${p || "root"}')||'';
document.getElementById('${p}save-notes').addEventListener('click',()=>{
  localStorage.setItem('af-dash-notes${p || "root"}',notes.value);
  const s=document.getElementById('${p}saved');s.hidden=false;setTimeout(()=>{s.hidden=true;},1500);
});
const bars=document.getElementById('${p}bars');const hint=document.getElementById('${p}bar-hint');
let vals=[40,65,45,80,55,90,70];
function paintBars(){
  bars.innerHTML='';
  vals.forEach((v,i)=>{
    const d=document.createElement('button');d.type='button';
    d.style.cssText='flex:1;border:none;cursor:pointer;padding:0;background:linear-gradient(180deg,var(--accent),#0d9488);border-radius:6px 6px 2px 2px;height:'+v+'%;opacity:'+(0.55+i*0.06);
    d.title='Day '+(i+1)+': '+v;d.setAttribute('aria-label','Day '+(i+1)+', value '+v);
    d.addEventListener('click',()=>{document.getElementById('${p}stat-c').textContent=String(v);hint.textContent='Focused day '+(i+1)+' · score set to '+v;});
    bars.appendChild(d);
  });
}
paintBars();
document.getElementById('${p}reshuffle').addEventListener('click',()=>{vals=vals.map(()=>30+Math.round(Math.random()*70));paintBars();hint.textContent='Reshuffled pulse. Click a bar to focus.';});
setInterval(()=>{const a=document.getElementById('${p}stat-a');const n=Number(a.textContent)+(Math.random()>0.6?1:0);a.textContent=String(Math.min(n,99));},4000);
})();`;
  return { body, script };
}


function genLedger(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="ledger">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem">
      <h2 class="af-sec" style="margin:0">Line ledger</h2>
      <div class="row" style="gap:0.75rem">
        <span class="pill">In <strong id="${p}sum-in" class="mono" style="color:var(--ok)">$0</strong></span>
        <span class="pill">Out <strong id="${p}sum-out" class="mono" style="color:var(--danger)">$0</strong></span>
        <span class="pill">Bal <strong id="${p}sum-bal" class="mono" style="color:var(--accent)">$0</strong></span>
      </div>
    </div>
    <form id="${p}led-form" class="row" style="margin-bottom:1rem;align-items:stretch">
      <label class="sr-only" for="${p}led-desc">Description</label>
      <input id="${p}led-desc" class="field" style="flex:2;min-width:140px" placeholder="Coffee, paycheck…" required />
      <label class="sr-only" for="${p}led-amt">Amount</label>
      <input id="${p}led-amt" class="field mono" type="number" step="0.01" style="flex:1;min-width:90px" placeholder="0.00" required />
      <select id="${p}led-type" class="field" style="flex:0.9;min-width:100px" aria-label="Type">
        <option value="out">Expense</option>
        <option value="in">Income</option>
      </select>
      <button type="submit" class="btn">Add</button>
    </form>
    <ul id="${p}led-list" style="list-style:none;display:flex;flex-direction:column;gap:0.45rem"></ul>
    <p id="${p}led-empty" style="color:var(--muted);font-size:0.9rem">No lines yet — add income or expenses.</p>
  </div>`;
  const script = `
(function(){
const KEY='af-ledger-v1${p || "root"}';
let rows=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('${p}led-list');
const empty=document.getElementById('${p}led-empty');
function money(n){return (n<0?'-':'')+'$'+Math.abs(n).toFixed(2);}
function save(){localStorage.setItem(KEY,JSON.stringify(rows));}
function render(){
  list.innerHTML='';
  let inn=0,out=0;
  rows.forEach((r,i)=>{
    if(r.type==='in')inn+=r.amt; else out+=r.amt;
    const li=document.createElement('li');
    li.style.cssText='display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.65rem;background:var(--surface2);border-radius:8px;border:1px solid var(--border)';
    const tag=document.createElement('span');tag.className='pill';tag.textContent=r.type==='in'?'IN':'OUT';
    tag.style.color=r.type==='in'?'var(--ok)':'var(--danger)';
    const desc=document.createElement('span');desc.style.flex='1';desc.textContent=r.desc;
    const amt=document.createElement('strong');amt.className='mono';amt.textContent=money(r.type==='in'?r.amt:-r.amt);
    amt.style.color=r.type==='in'?'var(--ok)':'var(--danger)';
    const del=document.createElement('button');del.type='button';del.className='btn btn-ghost';
    del.style.cssText='padding:0.25rem 0.5rem;font-size:0.75rem';del.textContent='✕';
    del.addEventListener('click',()=>{rows.splice(i,1);save();render();});
    li.append(tag,desc,amt,del);list.appendChild(li);
  });
  empty.hidden=rows.length>0;
  document.getElementById('${p}sum-in').textContent=money(inn);
  document.getElementById('${p}sum-out').textContent=money(out);
  document.getElementById('${p}sum-bal').textContent=money(inn-out);
}
document.getElementById('${p}led-form').addEventListener('submit',e=>{
  e.preventDefault();
  const desc=document.getElementById('${p}led-desc').value.trim();
  const amt=Math.abs(Number(document.getElementById('${p}led-amt').value)||0);
  const type=document.getElementById('${p}led-type').value;
  if(!desc||!amt)return;
  rows.unshift({desc,amt,type,ts:Date.now()});
  document.getElementById('${p}led-desc').value='';
  document.getElementById('${p}led-amt').value='';
  save();render();
});
render();
})();`;
  return { body, script };
}



function genCountdown(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="countdown" style="text-align:center;padding:2rem 1.25rem">
    <h2 class="af-sec">Countdown</h2>
    <p style="color:var(--muted);font-size:0.9rem;margin-bottom:1rem">Set a target — live clock ticks every second.</p>
    <form id="${p}cd-form" class="row" style="justify-content:center;margin-bottom:1.25rem">
      <label class="sr-only" for="${p}cd-label">Label</label>
      <input id="${p}cd-label" class="field" style="flex:1;min-width:140px" placeholder="Launch / wedding / deadline" />
      <label class="sr-only" for="${p}cd-when">Target datetime</label>
      <input id="${p}cd-when" class="field" type="datetime-local" style="flex:1;min-width:180px" required />
      <button type="submit" class="btn">Set target</button>
    </form>
    <p id="${p}cd-name" style="font-weight:600;margin-bottom:0.75rem;color:var(--accent)"></p>
    <div id="${p}cd-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;max-width:420px;margin:0 auto 1rem">
      <div class="card" style="padding:0.75rem"><div class="mono" style="font-size:1.6rem;font-weight:700" id="${p}cd-d">0</div><div style="font-size:0.7rem;color:var(--muted)">Days</div></div>
      <div class="card" style="padding:0.75rem"><div class="mono" style="font-size:1.6rem;font-weight:700" id="${p}cd-h">0</div><div style="font-size:0.7rem;color:var(--muted)">Hours</div></div>
      <div class="card" style="padding:0.75rem"><div class="mono" style="font-size:1.6rem;font-weight:700" id="${p}cd-m">0</div><div style="font-size:0.7rem;color:var(--muted)">Mins</div></div>
      <div class="card" style="padding:0.75rem"><div class="mono" style="font-size:1.6rem;font-weight:700" id="${p}cd-s">0</div><div style="font-size:0.7rem;color:var(--muted)">Secs</div></div>
    </div>
    <div class="row" style="justify-content:center">
      <button type="button" id="${p}cd-pom" class="btn btn-ghost">Start 25m focus</button>
      <button type="button" id="${p}cd-reset" class="btn btn-ghost">Reset</button>
    </div>
    <p id="${p}cd-status" style="margin-top:1rem;font-size:0.85rem;color:var(--muted)">Waiting for a target…</p>
  </div>`;
  const script = `
(function(){
const KEY='af-countdown-v1${p || "root"}';
let state=JSON.parse(localStorage.getItem(KEY)||'null')||{label:'',target:0};
const nameEl=document.getElementById('${p}cd-name');
const status=document.getElementById('${p}cd-status');
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function paint(){
  const now=Date.now();
  if(!state.target){status.textContent='Waiting for a target…';return;}
  let diff=state.target-now;
  nameEl.textContent=state.label||'Target';
  if(diff<=0){
    document.getElementById('${p}cd-d').textContent='0';
    document.getElementById('${p}cd-h').textContent='0';
    document.getElementById('${p}cd-m').textContent='0';
    document.getElementById('${p}cd-s').textContent='0';
    status.textContent='Time is up!';status.style.color='var(--ok)';
    return;
  }
  const s=Math.floor(diff/1000);
  const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600);
  const m=Math.floor((s%3600)/60); const sec=s%60;
  document.getElementById('${p}cd-d').textContent=String(d);
  document.getElementById('${p}cd-h').textContent=String(h);
  document.getElementById('${p}cd-m').textContent=String(m);
  document.getElementById('${p}cd-s').textContent=String(sec);
  status.textContent='Ticking…';status.style.color='var(--muted)';
}
document.getElementById('${p}cd-form').addEventListener('submit',e=>{
  e.preventDefault();
  const label=document.getElementById('${p}cd-label').value.trim()||'Countdown';
  const when=document.getElementById('${p}cd-when').value;
  if(!when)return;
  state={label,target:new Date(when).getTime()};save();paint();
});
document.getElementById('${p}cd-pom').addEventListener('click',()=>{
  state={label:'25m focus',target:Date.now()+25*60*1000};save();paint();
});
document.getElementById('${p}cd-reset').addEventListener('click',()=>{
  state={label:'',target:0};save();
  ['${p}cd-d','${p}cd-h','${p}cd-m','${p}cd-s'].forEach(id=>document.getElementById(id).textContent='0');
  nameEl.textContent='';status.textContent='Waiting for a target…';
});
paint();setInterval(paint,1000);
})();`;
  return { body, script };
}


function genKanban(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="kanban">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem">
      <h2 class="af-sec" style="margin:0">Kanban board</h2>
      <form id="${p}kb-form" class="row">
        <label class="sr-only" for="${p}kb-title">Card title</label>
        <input id="${p}kb-title" class="field" style="min-width:160px" placeholder="New card…" required />
        <button type="submit" class="btn">Add to Backlog</button>
      </form>
    </div>
    <div style="display:grid;gap:0.65rem;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div class="kb-col" data-col="backlog"><strong style="display:block;margin-bottom:0.5rem;font-size:0.8rem;color:var(--muted)">Backlog</strong><div id="${p}col-backlog"></div></div>
      <div class="kb-col" data-col="doing"><strong style="display:block;margin-bottom:0.5rem;font-size:0.8rem;color:var(--muted)">Doing</strong><div id="${p}col-doing"></div></div>
      <div class="kb-col" data-col="done"><strong style="display:block;margin-bottom:0.5rem;font-size:0.8rem;color:var(--muted)">Done</strong><div id="${p}col-done"></div></div>
    </div>
  </div>`;
  const script = `
(function(){
const KEY='af-kanban-v1${p || "root"}';
const COLS=['backlog','doing','done'];
let cards=JSON.parse(localStorage.getItem(KEY)||'null')||[
  {id:'1',title:'Sketch flow',col:'backlog'},
  {id:'2',title:'Ship MVP',col:'doing'},
  {id:'3',title:'Celebrate',col:'done'}
];
function save(){localStorage.setItem(KEY,JSON.stringify(cards));}
function move(id,dir){
  const c=cards.find(x=>x.id===id); if(!c)return;
  const i=COLS.indexOf(c.col); const n=i+dir; if(n<0||n>=COLS.length)return;
  c.col=COLS[n]; save(); render();
}
function render(){
  COLS.forEach(col=>{
    const el=document.getElementById('${p}col-'+col); el.innerHTML='';
    cards.filter(c=>c.col===col).forEach(c=>{
      const d=document.createElement('div'); d.className='kb-card';
      const t=document.createElement('div'); t.textContent=c.title; t.style.fontWeight='500'; t.style.marginBottom='0.35rem';
      const row=document.createElement('div'); row.className='row'; row.style.gap='0.35rem';
      const left=document.createElement('button'); left.type='button'; left.className='btn btn-ghost';
      left.style.cssText='padding:0.2rem 0.45rem;font-size:0.7rem'; left.textContent='←'; left.disabled=c.col==='backlog';
      left.addEventListener('click',()=>move(c.id,-1));
      const right=document.createElement('button'); right.type='button'; right.className='btn btn-ghost';
      right.style.cssText='padding:0.2rem 0.45rem;font-size:0.7rem'; right.textContent='→'; right.disabled=c.col==='done';
      right.addEventListener('click',()=>move(c.id,1));
      const del=document.createElement('button'); del.type='button'; del.className='btn btn-ghost';
      del.style.cssText='padding:0.2rem 0.45rem;font-size:0.7rem;margin-left:auto'; del.textContent='✕';
      del.addEventListener('click',()=>{cards=cards.filter(x=>x.id!==c.id);save();render();});
      row.append(left,right,del); d.append(t,row); el.appendChild(d);
    });
  });
}
document.getElementById('${p}kb-form').addEventListener('submit',e=>{
  e.preventDefault();
  const input=document.getElementById('${p}kb-title');
  const title=input.value.trim(); if(!title)return;
  cards.unshift({id:String(Date.now()),title,col:'backlog'});
  input.value=''; save(); render();
});
render();
})();`;
  return { body, script };
}


function genQuiz(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="quiz">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 class="af-sec" style="margin:0">Quick quiz</h2>
      <span id="${p}qz-score" class="pill">Score 0/0</span>
    </div>
    <p id="${p}qz-q" style="font-weight:600;font-size:1.1rem;margin-bottom:1rem"></p>
    <div id="${p}qz-opts" class="row" style="flex-direction:column;align-items:stretch;gap:0.5rem"></div>
    <p id="${p}qz-fb" style="margin-top:0.85rem;font-size:0.9rem;min-height:1.3em"></p>
    <div class="row" style="margin-top:1rem">
      <button type="button" id="${p}qz-next" class="btn" hidden>Next</button>
      <button type="button" id="${p}qz-restart" class="btn btn-ghost">Restart</button>
    </div>
  </div>`;
  const script = `
(function(){
const QS=[
  {q:'What does HTML stand for?', opts:['HyperText Markup Language','Hot Mail','How To Meet Ladies','Home Tool Markup Language'], a:0},
  {q:'Which saves data in the browser?', opts:['localStorage','SMTP','FTP','CSS'], a:0},
  {q:'A self-contained app means…', opts:['Inline CSS/JS in one file','Needs a CDN','Requires React','Cloud only'], a:0},
  {q:'AppForge tip jars charge real money?', opts:['No — demo only','Yes always','Only on weekends','Via SMS'], a:0}
];
let i=0, score=0, locked=false;
const qEl=document.getElementById('${p}qz-q');
const opts=document.getElementById('${p}qz-opts');
const fb=document.getElementById('${p}qz-fb');
const next=document.getElementById('${p}qz-next');
const scoreEl=document.getElementById('${p}qz-score');
function paintScore(){scoreEl.textContent='Score '+score+'/'+QS.length;}
function show(){
  locked=false; fb.textContent=''; next.hidden=true;
  if(i>=QS.length){qEl.textContent='Done! You scored '+score+' of '+QS.length+'.';opts.innerHTML='';paintScore();return;}
  const cur=QS[i]; qEl.textContent=(i+1)+'. '+cur.q; opts.innerHTML='';
  cur.opts.forEach((o,idx)=>{
    const b=document.createElement('button'); b.type='button'; b.className='btn btn-ghost'; b.style.textAlign='left';
    b.textContent=o;
    b.addEventListener('click',()=>{
      if(locked)return; locked=true;
      if(idx===cur.a){score+=1;fb.textContent='Correct ✓';fb.style.color='var(--ok)';b.style.borderColor='var(--ok)';}
      else {fb.textContent='Not quite — answer: '+cur.opts[cur.a];fb.style.color='var(--danger)';}
      paintScore(); next.hidden=false;
    });
    opts.appendChild(b);
  });
  paintScore();
}
next.addEventListener('click',()=>{i+=1;show();});
document.getElementById('${p}qz-restart').addEventListener('click',()=>{i=0;score=0;show();});
show();
})();`;
  return { body, script };
}


function genInvoice(_title: string, _prompt: string, idPrefix = ''): Section {
  const p = idPrefix;
  const body = `
  <div class="card af-section" data-af-kind="invoice">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem">
      <div>
        <h2 class="af-sec" style="margin:0">Invoice stub</h2>
        <p style="color:var(--muted);font-size:0.8rem;margin-top:0.25rem">Local demo — not a real bill. No payments.</p>
      </div>
      <span class="pill mono" id="${p}inv-no">INV-001</span>
    </div>
    <div class="row" style="margin-bottom:0.75rem">
      <label class="sr-only" for="${p}inv-client">Client</label>
      <input id="${p}inv-client" class="field" style="flex:1;min-width:160px" placeholder="Client name" />
      <label class="sr-only" for="${p}inv-due">Due date</label>
      <input id="${p}inv-due" class="field" type="date" style="flex:0.8;min-width:140px" />
    </div>
    <form id="${p}inv-form" class="row" style="margin-bottom:1rem">
      <label class="sr-only" for="${p}inv-desc">Line description</label>
      <input id="${p}inv-desc" class="field" style="flex:2;min-width:140px" placeholder="Line item…" required />
      <label class="sr-only" for="${p}inv-qty">Qty</label>
      <input id="${p}inv-qty" class="field mono" type="number" min="1" value="1" style="width:70px" />
      <label class="sr-only" for="${p}inv-rate">Rate</label>
      <input id="${p}inv-rate" class="field mono" type="number" step="0.01" min="0" placeholder="Rate" style="width:100px" required />
      <button type="submit" class="btn">Add line</button>
    </form>
    <table style="width:100%;border-collapse:collapse;font-size:0.9rem" id="${p}inv-table">
      <thead><tr style="color:var(--muted);text-align:left">
        <th style="padding:0.4rem 0">Item</th><th>Qty</th><th>Rate</th><th>Total</th><th></th>
      </tr></thead>
      <tbody id="${p}inv-body"></tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:1rem;gap:1rem;align-items:center">
      <strong>Total <span id="${p}inv-total" class="mono" style="color:var(--accent)">$0.00</span></strong>
      <button type="button" id="${p}inv-print" class="btn">Mark sent (demo)</button>
    </div>
    <p id="${p}inv-msg" hidden style="margin-top:0.75rem;color:var(--ok);font-size:0.85rem"></p>
  </div>`;
  const script = `
(function(){
const KEY='af-invoice-v1${p || "root"}';
let state=JSON.parse(localStorage.getItem(KEY)||'null')||{client:'',due:'',lines:[{id:'1',desc:'Design sprint',qty:1,rate:800}],n:1};
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function money(n){return '$'+n.toFixed(2);}
function render(){
  document.getElementById('${p}inv-client').value=state.client||'';
  document.getElementById('${p}inv-due').value=state.due||'';
  document.getElementById('${p}inv-no').textContent='INV-'+String(state.n).padStart(3,'0');
  const body=document.getElementById('${p}inv-body'); body.innerHTML='';
  let total=0;
  state.lines.forEach((ln,i)=>{
    const t=ln.qty*ln.rate; total+=t;
    const tr=document.createElement('tr');
    tr.innerHTML='<td style="padding:0.45rem 0">'+ln.desc+'</td><td class="mono">'+ln.qty+'</td><td class="mono">'+money(ln.rate)+'</td><td class="mono">'+money(t)+'</td><td></td>';
    const td=tr.lastChild;
    const del=document.createElement('button'); del.type='button'; del.className='btn btn-ghost';
    del.style.cssText='padding:0.15rem 0.4rem;font-size:0.7rem'; del.textContent='✕';
    del.addEventListener('click',()=>{state.lines.splice(i,1);save();render();});
    td.appendChild(del); body.appendChild(tr);
  });
  document.getElementById('${p}inv-total').textContent=money(total);
}
['${p}inv-client','${p}inv-due'].forEach(id=>{
  document.getElementById(id).addEventListener('change',()=>{
    state.client=document.getElementById('${p}inv-client').value;
    state.due=document.getElementById('${p}inv-due').value; save();
  });
});
document.getElementById('${p}inv-form').addEventListener('submit',e=>{
  e.preventDefault();
  const desc=document.getElementById('${p}inv-desc').value.trim();
  const qty=Math.max(1,Number(document.getElementById('${p}inv-qty').value)||1);
  const rate=Math.max(0,Number(document.getElementById('${p}inv-rate').value)||0);
  if(!desc)return;
  state.lines.push({id:String(Date.now()),desc,qty,rate});
  document.getElementById('${p}inv-desc').value='';
  document.getElementById('${p}inv-rate').value='';
  save();render();
});
document.getElementById('${p}inv-print').addEventListener('click',()=>{
  state.n+=1; save(); render();
  const msg=document.getElementById('${p}inv-msg');
  msg.hidden=false; msg.textContent='Marked sent locally (demo — no email, no charge).';
});
render();
})();`;
  return { body, script };
}



const SECTION_BUILDERS: Record<
  TemplateKind,
  (title: string, prompt: string, idPrefix?: string) => Section
> = {
  todo: genTodo,
  tipjar: genTipjar,
  landing: genLanding,
  habit: genHabit,
  dashboard: genDashboard,
  ledger: genLedger,
  countdown: genCountdown,
  kanban: genKanban,
  quiz: genQuiz,
  invoice: genInvoice,
};

const KIND_LABELS: Record<TemplateKind, string> = {
  todo: 'Todo list',
  tipjar: 'Tip jar',
  landing: 'Landing / waitlist',
  habit: 'Habit tracker',
  dashboard: 'Dashboard',
  ledger: 'Line ledger',
  countdown: 'Countdown',
  kanban: 'Kanban board',
  quiz: 'Quiz',
  invoice: 'Invoice stub',
};

function composeSuite(kinds: TemplateKind[], title: string, prompt: string): string {
  const parts = kinds.map((kind, i) => {
    const prefix = `s${i}_`;
    const sec = SECTION_BUILDERS[kind](title, prompt, prefix);
    const label = KIND_LABELS[kind];
    return {
      body: `<section aria-label="${escapeHtml(label)}">${sec.body}</section>`,
      script: sec.script,
    };
  });
  const nav = `<nav class="row af-section" aria-label="Sections" style="gap:0.4rem;margin-bottom:0.5rem">${kinds
    .map((k) => `<span class="pill">${escapeHtml(KIND_LABELS[k])}</span>`)
    .join('')}</nav>`;
  const body = nav + parts.map((p) => p.body).join('\n');
  const script = parts.map((p) => p.script).join('\n');
  return wrapDoc(title, prompt.trim() || 'Multi-section app', body, script, true);
}

export function generateApp(prompt: string): GenerateResult {
  const kinds = pickKinds(prompt);
  const title = titleFromPrompt(prompt);
  if (kinds.length === 1) {
    const kind = kinds[0];
    const sec = SECTION_BUILDERS[kind](title, prompt, '');
    const html = wrapDoc(title, prompt.trim() || KIND_LABELS[kind], sec.body, sec.script, kind === 'kanban');
    return { html, kind, title };
  }
  const html = composeSuite(kinds, title, prompt);
  return { html, kind: 'suite', title };
}

export const EXAMPLE_PROMPTS = [
  { label: 'todo list', prompt: 'A clean todo list with checkboxes' },
  { label: 'tip jar', prompt: 'A tip jar for my creative work' },
  { label: 'habit tracker', prompt: 'A daily habit tracker with streaks' },
  { label: 'line ledger', prompt: 'A line ledger for expenses and income' },
  { label: 'countdown', prompt: 'A countdown timer to my product launch day' },
  { label: 'kanban', prompt: 'A kanban board with backlog doing and done' },
  { label: 'quiz', prompt: 'A quick trivia quiz with score' },
  { label: 'invoice', prompt: 'An invoice stub with line items for a client' },
  { label: 'waitlist', prompt: 'A waitlist landing page with email signup for my product launch' },
  { label: 'todo + habits', prompt: 'A todo list and habit tracker for morning routines' },
] as const;
