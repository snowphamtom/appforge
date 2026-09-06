/**
 * StoryForge stream → live iframe helpers.
 * Turns partial LLM HTML into previewable srcDoc at meaningful checkpoints.
 */

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:html|HTML)?\s*\n?/, '');
    s = s.replace(/\n?```\s*$/, '');
  }
  return s.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function extractTitleFromHtml(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (m?.[1]) {
    const t = m[1].replace(/\s*[·|–-]\s*(AppForge|StoryForge)\s*$/i, '').trim();
    if (t && !/^streaming/i.test(t)) return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  const h = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h?.[1]) {
    const t = h[1].trim();
    if (t) return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  const trimmed = fallback.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'StoryForge';
  const t = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

/** Build a previewable document from a partial stream (close open tags). */
export function htmlFromPartialStream(accumulated: string): string | null {
  let s = stripFences(accumulated);
  if (!s) return null;
  const hasDoc = /<!DOCTYPE\s+html/i.test(s) || /<html[\s>]/i.test(s);
  if (!hasDoc) {
    if (s.length < 80) return null;
    const escaped = escapeHtml(s);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Streaming…</title><style>body{margin:0;background:#070a0e;color:#8b9bb0;font:13px/1.45 ui-monospace,monospace;padding:1rem;white-space:pre-wrap;word-break:break-word}.t{color:#2dd4bf;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.75rem}</style></head><body><div class="t">StoryForge · streaming</div>${escaped}</body></html>`;
  }
  if (/<\/html>/i.test(s)) return s;
  let out = s;
  if (!/<\/body>/i.test(out)) {
    if (!/<body[\s>]/i.test(out)) {
      if (!/<\/head>/i.test(out)) out += '\n</head>';
      out +=
        '\n<body style="margin:0;background:#070a0e;color:#8b9bb0;font:14px system-ui,sans-serif;padding:1.25rem"><p style="color:#2dd4bf;font-size:12px;letter-spacing:.06em;text-transform:uppercase">Streaming scene…</p></body>';
    } else {
      out +=
        '\n<p data-af-streaming style="position:fixed;bottom:8px;right:10px;margin:0;padding:4px 8px;border-radius:999px;background:#12181f;border:1px solid #243040;color:#2dd4bf;font:11px ui-monospace,monospace;opacity:.85;z-index:9999">streaming…</p>\n</body>';
    }
  }
  if (!/<\/html>/i.test(out)) out += '\n</html>';
  return out;
}

/** Whether accumulated stream text crossed a meaningful preview checkpoint. */
export function shouldEmitHtmlCheckpoint(
  lastCheckpointLen: number,
  accumulated: string,
): boolean {
  const nextLen = accumulated.length;
  if (nextLen <= lastCheckpointLen) return false;
  const preview = htmlFromPartialStream(accumulated);
  if (!preview) return false;
  // First paint
  if (lastCheckpointLen === 0) return true;
  const slice = accumulated.slice(lastCheckpointLen);
  if (
    /<\/(?:style|head|body|html|script|div|section|main|header|footer)>/i.test(
      slice,
    )
  ) {
    return true;
  }
  // Periodic growth (~1.2KB of new tokens since last paint)
  if (nextLen - lastCheckpointLen >= 1200) return true;
  return false;
}

export type StreamGenerateCallbacks = {
  onMeta?: (info: { model: string; provider?: string }) => void;
  onPartialHtml?: (html: string, meta: { title: string; streaming: boolean }) => void;
};

export type StreamGenerateResult = {
  html: string;
  title: string;
  kind: 'llm';
  model?: string;
};

/**
 * Consume POST /api/generate/stream (SSE). Updates onPartialHtml at checkpoints.
 * Falls through with throw on HTTP/SSE errors so caller can use non-stream fallback.
 */
export async function tryLlmGenerateStream(
  prompt: string,
  opts: {
    priorHtml?: string;
    mode?: 'forge' | 'story';
    signal?: AbortSignal;
  } & StreamGenerateCallbacks = {},
): Promise<StreamGenerateResult> {
  const res = await fetch('/api/generate/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
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

  if (!res.body) throw new Error('No stream body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let lastCheckpointLen = 0;
  let model: string | undefined;
  let finalResult: StreamGenerateResult | null = null;
  let eventName = 'message';

  const flushCheckpoint = (force = false) => {
    if (!force && !shouldEmitHtmlCheckpoint(lastCheckpointLen, accumulated)) {
      return;
    }
    const preview = htmlFromPartialStream(accumulated);
    if (!preview) return;
    lastCheckpointLen = accumulated.length;
    const title = extractTitleFromHtml(preview, prompt);
    opts.onPartialHtml?.(preview, { title, streaming: true });
  };

  const handleEvent = (event: string, dataRaw: string) => {
    if (!dataRaw) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataRaw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (event === 'meta') {
      model = typeof data.model === 'string' ? data.model : model;
      opts.onMeta?.({
        model: model || '',
        provider: typeof data.provider === 'string' ? data.provider : undefined,
      });
      return;
    }
    if (event === 'delta') {
      const text = typeof data.text === 'string' ? data.text : '';
      if (!text) return;
      accumulated += text;
      flushCheckpoint(false);
      return;
    }
    if (event === 'done') {
      const html = typeof data.html === 'string' ? data.html : stripFences(accumulated);
      const title =
        typeof data.title === 'string'
          ? data.title
          : extractTitleFromHtml(html, prompt);
      const m = typeof data.model === 'string' ? data.model : model;
      finalResult = { html, title, kind: 'llm', model: m };
      opts.onPartialHtml?.(html, { title, streaming: false });
      return;
    }
    if (event === 'error') {
      const msg =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.code === 'string' && data.code) ||
        'Stream error';
      throw new Error(msg);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message';
          continue;
        }
        if (line.startsWith('data:')) {
          const dataRaw = line.slice(5).trim();
          handleEvent(eventName, dataRaw);
          eventName = 'message';
          continue;
        }
        if (line.trim() === '') {
          eventName = 'message';
        }
      }
    }
    // trailing buffer
    if (buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith('data:')) {
        handleEvent(eventName, line.slice(5).trim());
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  if (!finalResult) {
    // Provider closed without done — try to finalize from accumulation
    const html = stripFences(accumulated);
    if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
      throw new Error('Stream ended without HTML');
    }
    finalResult = {
      html,
      title: extractTitleFromHtml(html, prompt),
      kind: 'llm',
      model,
    };
  }

  return finalResult;
}
