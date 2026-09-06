/**
 * Post-commit StoryForge interactivity leap.
 * When the LLM scene lacks click→state handlers, wrap the document with a
 * small delegated script (same spirit as offline generateStoryScene).
 * Mid-stream partials should NOT call this — only committed / done HTML.
 */

const MARKER = 'data-af-interact="1"';
const STYLE_ID = 'af-story-interact-css';
const SCRIPT_ID = 'af-story-interact-js';

function alreadyInjected(html: string): boolean {
  return (
    html.includes(MARKER) ||
    html.includes(`id="${SCRIPT_ID}"`) ||
    html.includes(`id='${SCRIPT_ID}'`)
  );
}

/** Offline storyScene already ships click→state — leave it alone. */
function isOfflineStoryScene(html: string): boolean {
  return (
    html.includes('storyforge-lit') ||
    /Offline scene\s*[·•|]/i.test(html) ||
    (html.includes('id="btn-reset"') && html.includes('id="btn-all"'))
  );
}

const INTERACT_CSS = `/* AppForge post-commit interactivity */
#af-story-toast{position:fixed;left:50%;bottom:1.1rem;transform:translateX(-50%) translateY(120%);
  z-index:99999;max-width:min(92vw,420px);padding:.55rem .9rem;border-radius:999px;
  background:#12181f;border:1px solid #2dd4bf;color:#e8eef6;font:600 13px/1.35 system-ui,sans-serif;
  box-shadow:0 8px 28px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:transform .22s ease,opacity .22s ease}
#af-story-toast.af-show{transform:translateX(-50%) translateY(0);opacity:1}
.af-hot{cursor:pointer!important;outline:1px dashed transparent;outline-offset:3px;transition:outline-color .15s,filter .15s,box-shadow .15s}
.af-hot:hover{outline-color:rgba(45,212,191,.55);filter:brightness(1.06)}
.af-hot.af-lit,.af-hot[aria-pressed="true"]{outline:2px solid #2dd4bf;outline-offset:3px;
  box-shadow:0 0 0 3px rgba(45,212,191,.18);filter:brightness(1.08)}
.af-hot.af-open{box-shadow:0 0 0 3px rgba(94,234,212,.25)}
[data-af-panel][hidden],.af-panel-closed{display:none!important}`;

const INTERACT_JS = `(function(){
  if (window.__AF_STORY_INTERACT__) return;
  window.__AF_STORY_INTERACT__ = true;
  var inv = [];
  try { inv = JSON.parse(localStorage.getItem('af-story-inv') || '[]'); if (!Array.isArray(inv)) inv = []; } catch (e) { inv = []; }
  function save(){ try { localStorage.setItem('af-story-inv', JSON.stringify(inv.slice(-24))); } catch (e) {} }
  function ensureToast(){
    var t = document.getElementById('af-story-toast');
    if (t) return t;
    t = document.createElement('div');
    t.id = 'af-story-toast';
    t.setAttribute('role','status');
    t.setAttribute('aria-live','polite');
    document.body.appendChild(t);
    return t;
  }
  var toastTimer = null;
  function toast(msg){
    var t = ensureToast();
    t.textContent = msg;
    t.classList.add('af-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('af-show'); }, 2200);
  }
  function labelOf(el){
    return (
      el.getAttribute('data-prop') ||
      el.getAttribute('data-character') ||
      el.getAttribute('data-item') ||
      el.getAttribute('data-name') ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('alt') ||
      (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0,64) ||
      el.tagName.toLowerCase()
    );
  }
  function isHot(el){
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('a[href], input, textarea, select, label, [contenteditable="true"]')) return false;
    if (el.hasAttribute('data-af-skip')) return false;
    if (el.matches('button, .prop, [data-prop], [data-character], [data-item], [data-interactive], [role="button"], img[data-prop], img[alt], [data-af-hot]')) return true;
    if (el.matches('[data-open], [data-toggle], details > summary')) return true;
    return false;
  }
  function markHot(root){
    var sel = 'button,.prop,[data-prop],[data-character],[data-item],[data-interactive],[role="button"],img[alt],[data-open],[data-toggle],details > summary';
    root.querySelectorAll(sel).forEach(function(el){
      if (el.closest('[data-af-skip]')) return;
      el.classList.add('af-hot');
      if (!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON' && el.tagName !== 'SUMMARY') {
        el.setAttribute('tabindex','0');
      }
    });
  }
  function toggleLit(el){
    var on = el.classList.toggle('af-lit');
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    return on;
  }
  function handleOpenClose(el){
    var targetSel = el.getAttribute('data-open') || el.getAttribute('data-toggle');
    if (targetSel) {
      var panel = document.querySelector(targetSel);
      if (panel) {
        var hide = panel.hasAttribute('hidden') || panel.classList.contains('af-panel-closed');
        if (hide) {
          panel.removeAttribute('hidden');
          panel.classList.remove('af-panel-closed');
          el.classList.add('af-open');
          toast('Opened · ' + labelOf(el));
        } else {
          panel.setAttribute('hidden','');
          panel.classList.add('af-panel-closed');
          el.classList.remove('af-open');
          toast('Closed · ' + labelOf(el));
        }
        return true;
      }
    }
    if (el.tagName === 'SUMMARY') return false;
    var details = el.closest('details');
    if (details && el === details.querySelector('summary')) return false;
    return false;
  }
  function onActivate(el){
    if (handleOpenClose(el)) return;
    var on = toggleLit(el);
    var name = labelOf(el);
    if (el.hasAttribute('data-prop') || el.hasAttribute('data-item') || el.classList.contains('prop') || el.tagName === 'IMG') {
      if (on) {
        if (inv.indexOf(name) === -1) inv.push(name);
        save();
        toast('Collected · ' + name + (inv.length ? '  (' + inv.length + ')' : ''));
      } else {
        inv = inv.filter(function(x){ return x !== name; });
        save();
        toast('Put back · ' + name);
      }
      return;
    }
    if (el.hasAttribute('data-character') || /character|cast|npc/i.test(el.className || '')) {
      toast((on ? 'Speaking with · ' : 'Stepped back · ') + name);
      return;
    }
    toast((on ? 'Activated · ' : 'Cleared · ') + name);
  }
  markHot(document);
  document.addEventListener('click', function(ev){
    var t = ev.target;
    if (!t || !t.closest) return;
    var el = t.closest('.af-hot, button, .prop, [data-prop], [data-character], [data-item], [data-interactive], [role="button"], img[alt], [data-open], [data-toggle], summary');
    if (!el || !isHot(el)) return;
    if (!el.classList.contains('af-hot')) el.classList.add('af-hot');
    onActivate(el);
  }, false);
  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el = ev.target;
    if (!el || !isHot(el)) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'SUMMARY' || el.tagName === 'A') return;
    ev.preventDefault();
    onActivate(el);
  }, false);
  toast('Scene live · click props & characters');
})();`;

/**
 * Inject click→state interactivity into a committed scene HTML document.
 * Idempotent; no-ops for empty, already-injected, or offline storyScene HTML.
 */
export function injectInteractiveScene(html: string): string {
  const raw = (html ?? '').trim();
  if (!raw) return html ?? '';
  if (alreadyInjected(raw)) return html;
  if (isOfflineStoryScene(raw)) return html;

  const styleTag = `<style id="${STYLE_ID}">${INTERACT_CSS}</style>`;
  const scriptTag = `<script id="${SCRIPT_ID}">${INTERACT_JS}</script>`;
  const toastEl = `<div id="af-story-toast" role="status" aria-live="polite"></div>`;

  let out = raw;

  // Mark <html> so re-entry is cheap
  if (/<html\b/i.test(out)) {
    out = out.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => {
      if (/\bdata-af-interact\b/i.test(attrs)) return `<html${attrs}>`;
      return `<html${attrs} ${MARKER}>`;
    });
  } else {
    // Fragment — wrap lightly so script can run in iframe srcDoc
    out = `<!DOCTYPE html><html lang="en" ${MARKER}><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${out}</body></html>`;
  }

  if (!out.includes(`id="${STYLE_ID}"`)) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${styleTag}\n</head>`);
    } else if (/<body\b/i.test(out)) {
      out = out.replace(/<body\b([^>]*)>/i, `<body$1>${styleTag}`);
    } else {
      out = styleTag + out;
    }
  }

  const payload = `${toastEl}\n${scriptTag}`;
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${payload}\n</body>`);
  } else if (/<\/html>/i.test(out)) {
    out = out.replace(/<\/html>/i, `${payload}\n</html>`);
  } else {
    out = `${out}\n${payload}`;
  }

  return out;
}
