/**
 * Server-side LLM HTML generation (dev middleware only).
 * API keys stay out of the client bundle.
 */

export type LlmProvider = 'xai' | 'gemini' | 'openai';

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: LlmProvider;
}

export interface LlmGenerateResult {
  html: string;
  title: string;
  kind: 'llm';
  model: string;
}

export function resolveLlmConfig(env: Record<string, string>): LlmConfig | null {
  const xai = (env.XAI_API_KEY || '').trim();
  if (xai) {
    const model = (env.XAI_MODEL || '').trim() || 'grok-2-latest';
    return {
      apiKey: xai,
      baseUrl: 'https://api.x.ai/v1',
      model: model === 'grok-3' ? 'grok-3' : model,
      provider: 'xai',
    };
  }
  const gemini = (env.GEMINI_API_KEY || '').trim();
  if (gemini) {
    return {
      apiKey: gemini,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: (env.GEMINI_MODEL || '').trim() || 'gemini-2.0-flash',
      provider: 'gemini',
    };
  }
  const openai = (env.OPENAI_API_KEY || '').trim();
  if (openai) {
    return {
      apiKey: openai,
      baseUrl: 'https://api.openai.com/v1',
      model: (env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini',
      provider: 'openai',
    };
  }
  return null;
}

export const SYSTEM_PROMPT = `You are AppForge, an expert product designer and front-end engineer.
Your sole job: from the user's prompt, emit ONE complete, self-contained HTML5 web app that fully realizes their world.

Hard requirements:
1. Output ONLY a single complete HTML5 document starting with <!DOCTYPE html>. No markdown, no fences, no commentary before or after.
2. Beautiful intentional dark UI (near-black backgrounds, teal/cyan accents). Prefer linking IBM Plex Sans / IBM Plex Mono via Google Fonts. Avoid generic "AI purple" aesthetics.
3. Fully realize the user's specific world from the prompt — not a generic shell with placeholder copy. Names, copy, interactions, and structure should match what they asked for.
4. All CSS and JS must be inline (or in <style>/<script> tags in the document). Google Fonts CSS links are OK. Do NOT use external JS CDNs (no React/Vue/jQuery from CDN) so offline/blob preview works.
5. Working interactivity: buttons, forms, localStorage where useful, keyboard support. Accessible (labels, focus states, semantic HTML) and responsive.
6. Include a sensible <title> reflecting the app.
7. No external network calls required for core functionality (except optional Google Fonts).`;

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:html|HTML)?\s*\n?/, '');
    s = s.replace(/\n?```\s*$/, '');
  }
  return s.trim();
}

function extractTitle(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (m?.[1]) {
    const t = m[1].replace(/\s*[·|–-]\s*AppForge\s*$/i, '').trim();
    if (t) return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  const h = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h?.[1]) {
    const t = h[1].trim();
    if (t) return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  const trimmed = fallback.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Untitled App';
  const t = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

export async function generateWithLlm(
  prompt: string,
  config: LlmConfig,
): Promise<LlmGenerateResult> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Build this as one perfect self-contained HTML app:\n\n${prompt.trim()}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `LLM HTTP ${res.status}${body ? `: ${body.slice(0, 240)}` : ''}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== 'string') {
    throw new Error('LLM returned empty content');
  }

  const html = stripFences(raw);
  if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
    throw new Error('LLM response was not an HTML document');
  }

  return {
    html,
    title: extractTitle(html, prompt),
    kind: 'llm',
    model: config.model,
  };
}
