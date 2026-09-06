import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { EXAMPLE_PROMPTS, generateApp, type GenerateResult } from './lib/generator';
import { generateStoryScene } from './lib/storyScene';
import {
  createSpeechRecognition,
  isSpeechSupported,
  transcriptsFromEvent,
  type SpeechRec,
} from './lib/speech';
import {
  listRecentProjects,
  saveGenerationLocal,
  type ProjectRecord,
} from './lib/projects';
import { seedFromUrl } from './integrations/firecrawl';

type View = 'home' | 'studio' | 'story';

const DEBOUNCE_MS = 350;
const STORY_DEBOUNCE_MS = 1000;

const TEMPLATE_LABELS: Record<string, string> = {
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
  suite: 'Multi-section',
  llm: 'LLM forged',
  story: 'StoryForge scene',
};

type LlmGenerateOpts = {
  priorHtml?: string;
  mode?: 'forge' | 'story';
  signal?: AbortSignal;
};

async function tryLlmGenerate(
  prompt: string,
  opts: LlmGenerateOpts = {},
): Promise<GenerateResult> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      priorHtml: opts.priorHtml,
      mode: opts.mode ?? 'forge',
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    let code = '';
    try {
      const err = (await res.json()) as { code?: string; error?: string };
      code = err.code || err.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(code || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    html?: string;
    title?: string;
    kind?: string;
    model?: string;
  };
  if (!data.html || typeof data.html !== 'string') {
    throw new Error('Invalid LLM response');
  }
  return {
    html: data.html,
    title: data.title || 'Untitled App',
    kind: 'llm',
    model: data.model,
  };
}

function downloadHtml(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'appforge'}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

const STORY_EXAMPLES = [
  'A lantern flickers in a rainy alley. A cat watches from a fire escape.',
  'She finds a brass key stamped with a moon. The door it opens is only painted on the wall.',
  'Click the lantern — the alley brightens and a hidden mural appears.',
] as const;

export default function App() {
  const [view, setView] = useState<View>('home');
  const [prompt, setPrompt] = useState('');
  const [urlSeed, setUrlSeed] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [source, setSource] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [recent, setRecent] = useState<ProjectRecord[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [forging, setForging] = useState(false);

  // StoryForge state
  const [storyText, setStoryText] = useState('');
  const [storyBeats, setStoryBeats] = useState<string[]>([]);
  const [storyDraft, setStoryDraft] = useState('');
  const [storyHtml, setStoryHtml] = useState('');
  const [storyTitle, setStoryTitle] = useState('StoryForge');
  const [storyUpdating, setStoryUpdating] = useState(false);
  const [storyUsedFallback, setStoryUsedFallback] = useState(false);
  const [storyModel, setStoryModel] = useState<string | undefined>();
  const [storyQueued, setStoryQueued] = useState(false);
  const [storyListening, setStoryListening] = useState(false);
  const [speechSupported] = useState(() => isSpeechSupported());

  const debounceRef = useRef<number | null>(null);
  const storyDebounceRef = useRef<number | null>(null);
  const forgeAbortRef = useRef(0);
  const storyTicketRef = useRef(0);
  const storyAbortRef = useRef<AbortController | null>(null);
  const storyHtmlRef = useRef('');
  const storyTextRef = useRef('');
  const storyDraftRef = useRef('');
  const speechRecRef = useRef<SpeechRec | null>(null);
  const speechBaseDraftRef = useRef('');
  const previewBlobRef = useRef<string | null>(null);

  const refreshRecent = useCallback(() => {
    setRecent(listRecentProjects(5));
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    storyHtmlRef.current = storyHtml;
  }, [storyHtml]);

  useEffect(() => {
    storyTextRef.current = storyText;
  }, [storyText]);

  useEffect(() => {
    storyDraftRef.current = storyDraft;
  }, [storyDraft]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const openStudio = useCallback(
    (gen: GenerateResult, rec: ProjectRecord, promptText: string) => {
      setResult(gen);
      setSource(gen.html);
      setPreviewHtml(gen.html);
      setProject(rec);
      setPrompt(promptText);
      setView('studio');
      refreshRecent();
    },
    [refreshRecent],
  );

  const runGenerate = useCallback(
    async (p: string) => {
      const trimmed = p.trim();
      if (!trimmed) return;
      const ticket = ++forgeAbortRef.current;
      setForging(true);
      let gen: GenerateResult;
      let usedFallback = false;
      try {
        try {
          gen = await tryLlmGenerate(trimmed);
        } catch {
          if (ticket !== forgeAbortRef.current) return;
          gen = generateApp(trimmed);
          usedFallback = true;
        }
        if (ticket !== forgeAbortRef.current) return;
        const rec = saveGenerationLocal({
          prompt: trimmed,
          title: gen.title,
          kind: gen.kind,
          html: gen.html,
        });
        openStudio(gen, rec, trimmed);
        if (usedFallback) {
          showToast('Using local templates (add API key for LLM)');
        }
      } finally {
        if (ticket === forgeAbortRef.current) setForging(false);
      }
    },
    [openStudio, showToast],
  );

  const runStoryGenerate = useCallback(
    async (fullStory: string) => {
      const trimmed = fullStory.trim();
      if (!trimmed) return;

      if (storyDebounceRef.current) {
        window.clearTimeout(storyDebounceRef.current);
        storyDebounceRef.current = null;
      }
      setStoryQueued(false);

      storyAbortRef.current?.abort();
      const ac = new AbortController();
      storyAbortRef.current = ac;
      const ticket = ++storyTicketRef.current;
      setStoryUpdating(true);

      const prior = storyHtmlRef.current.trim() || undefined;
      let gen: GenerateResult;
      let usedFallback = false;

      try {
        try {
          gen = await tryLlmGenerate(trimmed, {
            mode: 'story',
            priorHtml: prior,
            signal: ac.signal,
          });
        } catch (err) {
          if (ac.signal.aborted || ticket !== storyTicketRef.current) return;
          // AbortError / fetch abort should never become an offline scene
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (err instanceof Error && err.name === 'AbortError') return;
          gen = generateStoryScene(trimmed);
          usedFallback = true;
        }
        if (ac.signal.aborted || ticket !== storyTicketRef.current) return;

        setStoryHtml(gen.html);
        setStoryTitle(gen.title);
        setStoryModel(gen.model);
        setStoryUsedFallback(usedFallback);
        storyHtmlRef.current = gen.html;

        saveGenerationLocal({
          prompt: trimmed,
          title: gen.title,
          kind: gen.kind,
          html: gen.html,
        });
        refreshRecent();
        if (usedFallback) {
          showToast('Using offline StoryForge scene (add API key for LLM)');
        }
      } finally {
        if (ticket === storyTicketRef.current) {
          setStoryUpdating(false);
          setStoryQueued(false);
        }
      }
    },
    [refreshRecent, showToast],
  );

  const scheduleStoryGenerate = useCallback(
    (fullStory: string) => {
      if (storyDebounceRef.current) window.clearTimeout(storyDebounceRef.current);
      setStoryQueued(true);
      storyDebounceRef.current = window.setTimeout(() => {
        storyDebounceRef.current = null;
        setStoryQueued(false);
        void runStoryGenerate(fullStory);
      }, STORY_DEBOUNCE_MS);
    },
    [runStoryGenerate],
  );

  const openStoryForge = () => {
    setView('story');
  };

  const onStoryTextChange = (value: string) => {
    setStoryText(value);
    storyTextRef.current = value;
    const beats = value
      .split(/\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    setStoryBeats(beats);
    if (value.trim()) scheduleStoryGenerate(value);
    else {
      if (storyDebounceRef.current) {
        window.clearTimeout(storyDebounceRef.current);
        storyDebounceRef.current = null;
      }
      setStoryQueued(false);
    }
  };

  const commitBeat = useCallback(
    (raw?: string) => {
      const draft = (raw ?? storyDraftRef.current).trim();
      if (!draft) return;
      const base = storyTextRef.current.trim();
      const next = base ? `${base}\n\n${draft}` : draft;
      setStoryText(next);
      storyTextRef.current = next;
      setStoryDraft('');
      storyDraftRef.current = '';
      const beats = next
        .split(/\n+/)
        .map((b) => b.trim())
        .filter(Boolean);
      setStoryBeats(beats);
      if (storyDebounceRef.current) {
        window.clearTimeout(storyDebounceRef.current);
        storyDebounceRef.current = null;
      }
      setStoryQueued(false);
      void runStoryGenerate(next);
    },
    [runStoryGenerate],
  );

  const stopSpeech = useCallback(() => {
    const rec = speechRecRef.current;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
      speechRecRef.current = null;
    }
    setStoryListening(false);
  }, []);

  const toggleSpeech = useCallback(() => {
    if (!speechSupported) {
      showToast('Speech dictation not supported in this browser');
      return;
    }
    if (storyListening) {
      stopSpeech();
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) {
      showToast('Speech dictation not supported in this browser');
      return;
    }
    speechBaseDraftRef.current = storyDraftRef.current;
    speechRecRef.current = rec;
    rec.onresult = (ev) => {
      const { interim, final } = transcriptsFromEvent(ev);
      if (final) {
        const base = speechBaseDraftRef.current.trim();
        const spoken = final.trim();
        const combined = base ? `${base} ${spoken}`.trim() : spoken;
        stopSpeech();
        commitBeat(combined);
        showToast('Beat dictated');
        return;
      }
      if (interim) {
        const base = speechBaseDraftRef.current;
        const next = base ? `${base} ${interim}`.trim() : interim;
        setStoryDraft(next);
        storyDraftRef.current = next;
      }
    };
    rec.onerror = (ev) => {
      const code = ev.error || 'error';
      stopSpeech();
      if (code === 'aborted' || code === 'no-speech') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        showToast('Mic permission blocked — allow microphone to dictate');
        return;
      }
      showToast(`Speech error: ${code}`);
    };
    rec.onend = () => {
      if (speechRecRef.current === rec) {
        speechRecRef.current = null;
        setStoryListening(false);
      }
    };
    try {
      rec.start();
      setStoryListening(true);
      showToast('Listening… speak a beat');
    } catch {
      speechRecRef.current = null;
      setStoryListening(false);
      showToast('Could not start microphone');
    }
  }, [commitBeat, showToast, speechSupported, stopSpeech, storyListening]);

  const onBuild = () => {
    void runGenerate(prompt);
  };

  const onChip = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    void runGenerate(examplePrompt);
  };

  const onReopen = (rec: ProjectRecord) => {
    if (rec.kind === 'story' || rec.prompt.split('\n').length > 1) {
      setStoryText(rec.prompt);
      setStoryBeats(
        rec.prompt
          .split(/\n+/)
          .map((b) => b.trim())
          .filter(Boolean),
      );
      setStoryHtml(rec.html);
      setStoryTitle(rec.title);
      storyHtmlRef.current = rec.html;
      setView('story');
      showToast('Reopened StoryForge scene');
      return;
    }
    openStudio(
      { html: rec.html, kind: rec.kind, title: rec.title },
      rec,
      rec.prompt,
    );
    showToast('Reopened project');
  };

  const onSourceChange = (value: string) => {
    setSource(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPreviewHtml(value);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (storyDebounceRef.current) window.clearTimeout(storyDebounceRef.current);
      storyAbortRef.current?.abort();
      const rec = speechRecRef.current;
      if (rec) {
        try {
          rec.onresult = null;
          rec.onerror = null;
          rec.onend = null;
          rec.abort();
        } catch {
          /* ignore */
        }
        speechRecRef.current = null;
      }
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = null;
      }
    };
  }, []);

  const onRegenerate = () => {
    if (!prompt.trim() || forging) return;
    void (async () => {
      await runGenerate(prompt);
      showToast('Regenerated');
    })();
  };

  const onNewPrompt = () => {
    setView('home');
    setResult(null);
    setSource('');
    setPreviewHtml('');
    setProject(null);
    refreshRecent();
  };

  const onDownload = () => {
    const html = view === 'story' ? storyHtml : source;
    const title = view === 'story' ? storyTitle : (result?.title ?? 'appforge');
    if (!html) return;
    downloadHtml(html, title);
    showToast('Downloaded .html');
  };

  const onCopy = async () => {
    const html = view === 'story' ? storyHtml : source;
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      showToast('HTML copied to clipboard');
    } catch {
      showToast('Clipboard blocked — select source and copy manually');
    }
  };

  const onOpenPreview = () => {
    const html = view === 'story' ? storyHtml : source;
    if (!html.trim()) return;
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    previewBlobRef.current = url;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      showToast('Popup blocked — allow popups to open preview');
      return;
    }
    showToast('Opened preview in new tab');
  };

  const onUrlSeed = async () => {
    const u = urlSeed.trim();
    if (!u) return;
    setSeeding(true);
    try {
      const seeded = await seedFromUrl(u);
      setPrompt(seeded.promptHint);
      showToast(seeded.message);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'URL seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const loadStoryExample = () => {
    stopSpeech();
    const demo = STORY_EXAMPLES.join('\n\n');
    setStoryText(demo);
    storyTextRef.current = demo;
    setStoryDraft('');
    storyDraftRef.current = '';
    setStoryBeats(
      demo
        .split(/\n+/)
        .map((b) => b.trim())
        .filter(Boolean),
    );
    // Fresh world for demo magic — do not evolve prior HTML
    setStoryHtml('');
    storyHtmlRef.current = '';
    setStoryTitle('StoryForge');
    setStoryUsedFallback(false);
    setStoryModel(undefined);
    if (storyDebounceRef.current) {
      window.clearTimeout(storyDebounceRef.current);
      storyDebounceRef.current = null;
    }
    setStoryQueued(false);
    showToast('Demo story loaded — forging the scene…');
    void runStoryGenerate(demo);
  };

  const iframeSrcDoc = useMemo(() => previewHtml, [previewHtml]);
  const storyIframeSrcDoc = useMemo(() => storyHtml, [storyHtml]);
  const hasBuild = Boolean(source.trim());
  const hasStory = Boolean(storyHtml.trim());
  const modKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘'
      : 'Ctrl';

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={onNewPrompt} aria-label="AppForge home">
          <span className="brand-mark" aria-hidden>
            AF
          </span>
          AppForge
          <span className="stack-badge">
            Vite · <em>StoryForge</em>
          </span>
        </button>
        <nav className="mode-tabs" aria-label="App mode">
          <button
            type="button"
            className={`mode-tab${view === 'home' || view === 'studio' ? ' mode-tab-active' : ''}`}
            onClick={onNewPrompt}
          >
            Forge
          </button>
          <button
            type="button"
            className={`mode-tab${view === 'story' ? ' mode-tab-active' : ''}`}
            onClick={openStoryForge}
          >
            StoryForge
          </button>
        </nav>
        {(view === 'studio' || view === 'story') && (
          <div className="topbar-actions">
            {view === 'studio' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onRegenerate}
                disabled={forging}
              >
                {forging ? 'Forging…' : 'Regenerate'}
              </button>
            )}
            {view === 'story' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => storyText.trim() && void runStoryGenerate(storyText)}
                disabled={storyUpdating || !storyText.trim()}
              >
                {storyUpdating ? 'Updating…' : 'Refresh scene'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onNewPrompt}>
              New prompt
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onDownload}
              disabled={view === 'story' ? !hasStory : !hasBuild}
            >
              Download
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCopy}
              disabled={view === 'story' ? !hasStory : !hasBuild}
            >
              Copy HTML
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenPreview}
              disabled={view === 'story' ? !hasStory : !hasBuild}
              title="Open current HTML in a new tab via blob URL"
            >
              Open preview
            </button>
          </div>
        )}
      </header>

      <main className="main">
        {view === 'home' ? (
          <section className="home" aria-labelledby="home-title">
            <p className="home-kicker">Prompt → live app</p>
            <h1 id="home-title">Build an app from a sentence</h1>
            <p className="home-lead">
              Type what you want. Get a working web app you can remix, download, and own — or open{' '}
              <button type="button" className="text-link" onClick={openStoryForge}>
                StoryForge
              </button>{' '}
              to watch a world grow as you tell a story.
            </p>

            <div className="prompt-card">
              <div className="field-label" id="prompt-label">
                Prompt
              </div>
              <label className="sr-only" htmlFor="prompt">
                App prompt
              </label>
              <textarea
                id="prompt"
                aria-labelledby="prompt-label"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the app you want… e.g. a habit tracker for morning routines"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!forging) onBuild();
                  }
                }}
                disabled={forging}
              />
              <div className="prompt-footer">
                <div className="chips" role="group" aria-label="Example prompts">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      className="chip"
                      onClick={() => onChip(ex.prompt)}
                      disabled={forging}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
                <div className="build-group">
                  <span className="kbd-hint" title="Keyboard shortcut">
                    <kbd>{modKey}</kbd>
                    <span aria-hidden>+</span>
                    <kbd>Enter</kbd>
                    <span className="kbd-hint-text">to Build</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onBuild}
                    disabled={!prompt.trim() || forging}
                    aria-busy={forging}
                  >
                    {forging ? 'Forging…' : 'Build'}
                  </button>
                </div>
              </div>
            </div>

            <div className="url-seed">
              <label className="sr-only" htmlFor="url-seed">
                Remix from URL
              </label>
              <input
                id="url-seed"
                type="url"
                value={urlSeed}
                onChange={(e) => setUrlSeed(e.target.value)}
                placeholder="Optional: paste a URL to seed a remix (Firecrawl)"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onUrlSeed}
                disabled={!urlSeed.trim() || seeding}
              >
                {seeding ? 'Fetching…' : 'Seed from URL'}
              </button>
            </div>

            {recent.length > 0 && (
              <section className="recent" aria-labelledby="recent-title">
                <h2 id="recent-title" className="recent-title">
                  Recent projects
                </h2>
                <ul className="recent-list">
                  {recent.map((rec) => (
                    <li key={rec.id}>
                      <button
                        type="button"
                        className="recent-item"
                        onClick={() => onReopen(rec)}
                      >
                        <span className="recent-item-title">{rec.title}</span>
                        <span className="recent-item-meta">
                          <span className="recent-kind">{rec.kind}</span>
                          <span>{formatWhen(rec.updatedAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {forging && (
              <p className="forging-status" role="status" aria-live="polite">
                Forging your world…
              </p>
            )}

            <p className="hint">
              LLM when API key set · local templates fallback · {modKey}+Enter to Build
              {project ? ` · last project ${project.id.slice(0, 8)}` : ''}
            </p>
          </section>
        ) : view === 'story' ? (
          <section className="storyforge" aria-label="StoryForge">
            <div className="studio-status" role="status">
              <span className="studio-status-label">StoryForge</span>
              <span className="studio-status-value">
                {storyUsedFallback
                  ? 'offline scene'
                  : storyModel
                    ? `LLM · ${storyModel}`
                    : hasStory
                      ? 'live scene'
                      : 'waiting'}
              </span>
              <span className="studio-status-sep" aria-hidden>
                ·
              </span>
              <span className="studio-status-title" title={storyTitle}>
                {storyTitle}
              </span>
              <span className="studio-status-sep" aria-hidden>
                ·
              </span>
              <span className="studio-status-beats">{storyBeats.length} beats</span>
              {storyUpdating ? (
                <span className="scene-updating" aria-live="polite">
                  scene updating…
                </span>
              ) : storyQueued ? (
                <span className="scene-queued" aria-live="polite">
                  scene queued…
                </span>
              ) : storyListening ? (
                <span className="scene-listening" aria-live="polite">
                  listening…
                </span>
              ) : null}
            </div>

            <div className="pane pane-story">
              <div className="pane-header">
                <span>Story</span>
                <span className="pane-meta">{storyBeats.length} beats</span>
              </div>
              <div className="story-body">
                <p className="story-intro">
                  Tell a story. The live preview evolves as beats land — clicks in the scene should
                  change state, not sit as costume stubs.
                </p>
                <label className="sr-only" htmlFor="story-transcript">
                  Story transcript
                </label>
                <textarea
                  id="story-transcript"
                  className="story-transcript"
                  value={storyText}
                  onChange={(e) => onStoryTextChange(e.target.value)}
                  placeholder="Type your story… pauses (~1s) refresh the scene. Dictate or add beats below."
                  spellCheck
                />
                {storyBeats.length > 0 && (
                  <ol className="story-beats" aria-label="Committed beats">
                    {storyBeats.map((b, i) => (
                      <li key={`${i}-${b.slice(0, 24)}`}>
                        <span className="beat-n">{i + 1}</span>
                        <span className="beat-t">{b}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="story-compose">
                  <label className="sr-only" htmlFor="story-draft">
                    Next beat
                  </label>
                  <input
                    id="story-draft"
                    type="text"
                    className="story-draft"
                    value={storyDraft}
                    onChange={(e) => {
                      setStoryDraft(e.target.value);
                      storyDraftRef.current = e.target.value;
                    }}
                    placeholder={
                      storyListening
                        ? 'Listening… speak a beat'
                        : 'Next beat — Enter to commit'
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitBeat();
                      }
                    }}
                    disabled={storyListening}
                  />
                  <button
                    type="button"
                    className={`btn btn-mic${storyListening ? ' btn-mic-live' : ''}${!speechSupported ? ' btn-mic-unsupported' : ''}`}
                    onClick={toggleSpeech}
                    disabled={!speechSupported}
                    aria-pressed={storyListening}
                    title={
                      speechSupported
                        ? storyListening
                          ? 'Stop dictation'
                          : 'Dictate beat (Web Speech)'
                        : 'Speech not supported in this browser'
                    }
                    aria-label={
                      speechSupported
                        ? storyListening
                          ? 'Stop dictation'
                          : 'Dictate beat with microphone'
                        : 'Speech dictation not supported'
                    }
                  >
                    <span aria-hidden>{storyListening ? '⏹' : '🎤'}</span>
                    <span className="btn-mic-label">
                      {storyListening ? 'Stop' : 'Mic'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => commitBeat()}
                    disabled={!storyDraft.trim() || storyListening}
                  >
                    Commit beat
                  </button>
                </div>
                {!speechSupported && (
                  <p className="speech-fallback-note" role="note">
                    Mic dictation unavailable here — type beats instead (Chrome/Edge usually support
                    free Web Speech).
                  </p>
                )}
                <div className="story-tools">
                  <button type="button" className="btn btn-secondary" onClick={loadStoryExample}>
                    Load demo story
                  </button>
                  <span className="kbd-hint">
                    <kbd>Enter</kbd>
                    <span className="kbd-hint-text">
                      commits beat · ~1s pause refreshes scene
                      {speechSupported ? ' · Mic dictates a beat' : ''}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pane pane-live">
              <div className="pane-header">
                <span>Live</span>
                <div className="pane-header-right">
                  <span className="pane-meta">{storyTitle}</span>
                  {hasStory && (
                    <button
                      type="button"
                      className="pane-action"
                      onClick={onOpenPreview}
                      title="Open preview in new tab"
                    >
                      Open ↗
                    </button>
                  )}
                </div>
              </div>
              {hasStory ? (
                <div className="preview-shell">
                  <iframe
                    className="preview-frame"
                    title="StoryForge live preview"
                    sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
                    srcDoc={storyIframeSrcDoc}
                  />
                  {storyUpdating && (
                    <div className="preview-updating" aria-hidden>
                      <span>Updating scene…</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state empty-state-live" role="status">
                  <p className="empty-title">Scene waits for a story</p>
                  <p className="empty-body">
                    Type on the left (or load the demo). When you pause or commit a beat, the
                    interactive world appears here.
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="studio" aria-label="Remix studio">
            <div className="studio-status" role="status">
              <span className="studio-status-label">
                {result?.kind === 'llm' ? 'Source' : 'Template'}
              </span>
              <span className="studio-status-value">
                {result
                  ? result.kind === 'llm'
                    ? `LLM${result.model ? ` · ${result.model}` : ''}`
                    : (TEMPLATE_LABELS[result.kind] ?? result.kind)
                  : '—'}
              </span>
              <span className="studio-status-sep" aria-hidden>
                ·
              </span>
              <span
                className="studio-status-title"
                title={result?.title || undefined}
              >
                {result?.title || 'No build yet'}
              </span>
            </div>
            <div className="pane pane-source">
              <div className="pane-header">
                <span>Source</span>
                <span className="pane-meta">{result?.kind ?? 'app'}</span>
              </div>
              {hasBuild ? (
                <textarea
                  className="source-editor"
                  value={source}
                  onChange={(e) => onSourceChange(e.target.value)}
                  spellCheck={false}
                  aria-label="Editable HTML source"
                />
              ) : (
                <div className="empty-state" role="status">
                  <p className="empty-title">No build yet</p>
                  <p className="empty-body">
                    Go home, enter a prompt, then press Build (or {modKey}+Enter). Your HTML will
                    appear here to remix.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={onNewPrompt}>
                    Back to Prompt
                  </button>
                </div>
              )}
            </div>
            <div className="pane pane-live">
              <div className="pane-header">
                <span>Live</span>
                <div className="pane-header-right">
                  <span className="pane-meta">{result?.title || 'preview'}</span>
                  {hasBuild && (
                    <button
                      type="button"
                      className="pane-action"
                      onClick={onOpenPreview}
                      title="Open preview in new tab"
                    >
                      Open ↗
                    </button>
                  )}
                </div>
              </div>
              {hasBuild ? (
                <iframe
                  className="preview-frame"
                  title="Live app preview"
                  sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
                  srcDoc={iframeSrcDoc}
                />
              ) : (
                <div className="empty-state empty-state-live" role="status">
                  <p className="empty-title">Live preview waits for a build</p>
                  <p className="empty-body">
                    After you Build from Prompt, the interactive app runs here.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
