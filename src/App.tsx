import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { EXAMPLE_PROMPTS, generateApp, type GenerateResult } from './lib/generator';
import {
  listRecentProjects,
  saveGenerationLocal,
  type ProjectRecord,
} from './lib/projects';
import { seedFromUrl } from './integrations/firecrawl';

type View = 'home' | 'studio';

const DEBOUNCE_MS = 350;

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
  const debounceRef = useRef<number | null>(null);

  const refreshRecent = useCallback(() => {
    setRecent(listRecentProjects(5));
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

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
    (p: string) => {
      const trimmed = p.trim();
      if (!trimmed) return;
      const gen = generateApp(trimmed);
      const rec = saveGenerationLocal({
        prompt: trimmed,
        title: gen.title,
        kind: gen.kind,
        html: gen.html,
      });
      openStudio(gen, rec, trimmed);
    },
    [openStudio],
  );

  const onBuild = () => runGenerate(prompt);

  const onChip = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    runGenerate(examplePrompt);
  };

  const onReopen = (rec: ProjectRecord) => {
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
    };
  }, []);

  const onRegenerate = () => {
    if (!prompt.trim()) return;
    runGenerate(prompt);
    showToast('Regenerated');
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
    if (!source) return;
    downloadHtml(source, result?.title ?? 'appforge');
    showToast('Downloaded .html');
  };

  const onCopy = async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      showToast('HTML copied to clipboard');
    } catch {
      showToast('Clipboard blocked — select source and copy manually');
    }
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

  const iframeSrcDoc = useMemo(() => previewHtml, [previewHtml]);
  const hasBuild = Boolean(source.trim());
  const modKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
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
            Vite · <em>Convex ready</em>
          </span>
        </button>
        {view === 'studio' && (
          <div className="topbar-actions">
            <button type="button" className="btn btn-secondary" onClick={onRegenerate}>
              Regenerate
            </button>
            <button type="button" className="btn btn-secondary" onClick={onNewPrompt}>
              New prompt
            </button>
            <button type="button" className="btn btn-secondary" onClick={onDownload} disabled={!hasBuild}>
              Download
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCopy} disabled={!hasBuild}>
              Copy HTML
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
              Type what you want. Get a working web app you can remix, download, and own.
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
                    onBuild();
                  }
                }}
              />
              <div className="prompt-footer">
                <div className="chips" role="group" aria-label="Example prompts">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      className="chip"
                      onClick={() => onChip(ex.prompt)}
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
                    disabled={!prompt.trim()}
                  >
                    Build
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

            <p className="hint">
              Local generator · no API key · {modKey}+Enter to Build
              {project ? ` · last project ${project.id.slice(0, 8)}` : ''}
            </p>
          </section>
        ) : (
          <section className="studio" aria-label="Remix studio">
            <div className="pane">
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
            <div className="pane">
              <div className="pane-header">
                <span>Live</span>
                <span className="pane-meta">{result?.title || 'preview'}</span>
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
