/**
 * Server-side LLM HTML generation (dev middleware only).
 * API keys stay out of the client bundle.
 */

export type LlmProvider =
  | "xai"
  | "gemini"
  | "groq"
  | "openrouter"
  | "ollama"
  | "openai";

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: LlmProvider;
}

export interface LlmGenerateResult {
  html: string;
  title: string;
  kind: "llm";
  model: string;
}

/**
 * Priority: XAI → GEMINI → GROQ → OPENROUTER → OLLAMA → OPENAI
 * (first configured provider with a real key wins; stubs len≤20 ignored).
 * Free-tier friendly: Groq, OpenRouter, local Ollama.
 * Ollama activates when OLLAMA_BASE_URL, OLLAMA_MODEL, or OLLAMA_ENABLED=1 is set.
 */
/** Reject secure-card stubs / placeholders (e.g. len-8 Dam…). Real keys are longer. */
function isRealApiKey(value: string, minLen = 21): boolean {
  const v = value.trim();
  if (v.length < minLen) return false;
  // Common placeholder crumbs
  if (/^(dam|xxx|your-|changeme|placeholder|sk-o$)/i.test(v)) return false;
  return true;
}

export function resolveLlmConfig(env: Record<string, string>): LlmConfig | null {
  const xai = (env.XAI_API_KEY || "").trim();
  if (isRealApiKey(xai)) {
    const model = (env.XAI_MODEL || "").trim() || "grok-2-latest";
    return {
      apiKey: xai,
      baseUrl: "https://api.x.ai/v1",
      model: model === "grok-3" ? "grok-3" : model,
      provider: "xai",
    };
  }
  const gemini = (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "").trim();
  if (isRealApiKey(gemini)) {
    return {
      apiKey: gemini,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: (env.GEMINI_MODEL || "").trim() || "gemini-2.5-flash",
      provider: "gemini",
    };
  }
  const groq = (env.GROQ_API_KEY || "").trim();
  if (isRealApiKey(groq)) {
    return {
      apiKey: groq,
      baseUrl: "https://api.groq.com/openai/v1",
      model: (env.GROQ_MODEL || "").trim() || "llama-3.3-70b-versatile",
      provider: "groq",
    };
  }
  const openrouter = (env.OPENROUTER_API_KEY || "").trim();
  if (isRealApiKey(openrouter)) {
    return {
      apiKey: openrouter,
      baseUrl: "https://openrouter.ai/api/v1",
      model: (env.OPENROUTER_MODEL || "").trim() || "openrouter/free",
      provider: "openrouter",
    };
  }

  const ollamaEnabled =
    (env.OLLAMA_ENABLED || "").trim() === "1" ||
    Boolean((env.OLLAMA_BASE_URL || "").trim()) ||
    Boolean((env.OLLAMA_MODEL || "").trim());
  if (ollamaEnabled) {
    const base = ((env.OLLAMA_BASE_URL || "").trim() || "http://127.0.0.1:11434").replace(
      /\/$/,
      "",
    );
    return {
      apiKey: (env.OLLAMA_API_KEY || "").trim() || "ollama",
      baseUrl: `${base}/v1`,
      model: (env.OLLAMA_MODEL || "").trim() || "llama3.2:1b",
      provider: "ollama",
    };
  }

  const openai = (env.OPENAI_API_KEY || "").trim();
  if (isRealApiKey(openai)) {
    return {
      apiKey: openai,
      baseUrl: "https://api.openai.com/v1",
      model: (env.OPENAI_MODEL || "").trim() || "gpt-4o-mini",
      provider: "openai",
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

export type GenerateMode = "forge" | "story";

/** Compact world bible passed from StoryForge UI */
export interface WorldMemoryInput {
  characters?: string[];
  setting?: string[];
  props?: string[];
  mood?: string;
}

export interface GenerateOptions {
  /** Previous scene HTML so StoryForge can evolve instead of restarting */
  priorHtml?: string;
  mode?: GenerateMode;
  /** Living cast / places / props / mood for continuity */
  worldMemory?: WorldMemoryInput;
}

export const STORY_SYSTEM_PROMPT = `You are StoryForge inside AppForge — a live story→world engine.
The user tells a story beat by beat. You emit ONE complete self-contained HTML5 scene that visualizes and makes interactive the story so far.

Hard requirements:
1. Output ONLY a single complete HTML5 document starting with <!DOCTYPE html>. No markdown, no fences, no commentary.
2. Beautiful intentional dark UI (near-black, teal/cyan accents). Prefer IBM Plex Sans / Mono via Google Fonts. Avoid generic AI purple.
3. Fully realize THIS story — characters, places, objects, mood from the user's beats. Not a costume stub or placeholder shell.
4. LIVE interactivity required: clickable elements that change visible state (toggles, reveals, counters, inventory, dialogue choices, scene props). Use inline JS + localStorage if useful. Clicks must mutate the DOM — no dead decoration.
5. All CSS/JS inline (or in <style>/<script>). Google Fonts CSS OK. NO external JS CDNs.
6. Include a sensible <title> reflecting the story world.
7. No external network calls for core function (except optional Google Fonts).
8. If prior HTML is provided, EVOLVE that scene: keep working interactions and visual identity, then add/adapt for new beats. Do not throw away the world and restart from a blank template unless the story clearly demands a total scene change.
9. If a WORLD BIBLE is provided, honor it: keep named characters, places, props, and mood consistent across beats. Do not rename or drop established cast/props without story cause.`;

function stripFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:html|HTML)?\s*\n?/, "");
    s = s.replace(/\n?```\s*$/, "");
  }
  return s.trim();
}

function extractTitle(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (m?.[1]) {
    const t = m[1].replace(/\s*[·|–-]\s*AppForge\s*$/i, "").trim();
    if (t) return t.length > 80 ? t.slice(0, 77) + "…" : t;
  }
  const h = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h?.[1]) {
    const t = h[1].trim();
    if (t) return t.length > 80 ? t.slice(0, 77) + "…" : t;
  }
  const trimmed = fallback.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Untitled App";
  const t = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return t.length > 60 ? t.slice(0, 57) + "…" : t;
}

function formatWorldMemoryBlock(wm?: WorldMemoryInput): string {
  if (!wm) return "";
  const chars = (wm.characters || []).map((s) => s.trim()).filter(Boolean);
  const setting = (wm.setting || []).map((s) => s.trim()).filter(Boolean);
  const props = (wm.props || []).map((s) => s.trim()).filter(Boolean);
  const mood = (wm.mood || "").trim();
  if (!chars.length && !setting.length && !props.length && !mood) return "";
  const lines = ["WORLD BIBLE (honor these; keep continuity):"];
  if (chars.length) lines.push(`- Characters: ${chars.join(", ")}`);
  if (setting.length) lines.push(`- Setting: ${setting.join(", ")}`);
  if (props.length) lines.push(`- Props: ${props.join(", ")}`);
  if (mood) lines.push(`- Mood / tone: ${mood}`);
  return `\n\n${lines.join("\n")}\n`;
}

function buildUserPrompt(
  prompt: string,
  options?: GenerateOptions,
): string {
  const story = prompt.trim();
  const mode = options?.mode === "story" ? "story" : "forge";
  const prior = (options?.priorHtml || "").trim();

  if (mode === "story") {
    const bible = formatWorldMemoryBlock(options?.worldMemory);
    const priorBlock =
      prior.length > 0
        ? `\n\nPRIOR SCENE HTML (evolve this — keep live click→state interactions; extend for new beats):\n\`\`\`html\n${prior.slice(0, 120_000)}\n\`\`\`\n`
        : "\n\nNo prior scene yet — create the first interactive world from the story so far.\n";
    return `Story so far (all beats):\n\n${story}${bible}${priorBlock}\nEmit one complete interactive HTML scene for this story. Every meaningful prop/character cue should be clickable or stateful. Honor the world bible.`;
  }

  return `Build this as one perfect self-contained HTML app:\n\n${story}`;
}

export async function generateWithLlm(
  prompt: string,
  config: LlmConfig,
  options?: GenerateOptions,
): Promise<LlmGenerateResult> {
  const mode = options?.mode === "story" ? "story" : "forge";
  const system = mode === "story" ? STORY_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(prompt, options);
  const res =
    config.provider === "gemini"
      ? await fetch(
          `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: mode === "story" ? 0.75 : 0.7 },
            }),
          },
        )
      : await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            ...(config.provider === "openrouter"
              ? {
                  "HTTP-Referer": "https://snowphamtom.github.io/appforge/",
                  "X-Title": "AppForge",
                }
              : {}),
          },
          body: JSON.stringify({
            model: config.model,
            temperature: mode === "story" ? 0.75 : 0.7,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userPrompt },
            ],
          }),
        });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LLM HTTP ${res.status}${body ? `: ${body.slice(0, 240)}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    config.provider === "gemini"
      ? data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("")
      : data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("LLM returned empty content");
  }

  const html = stripFences(raw);
  if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
    throw new Error("LLM response was not an HTML document");
  }

  return {
    html,
    title: extractTitle(html, prompt),
    kind: "llm",
    model: config.model,
  };
}

/** SSE / stream event emitted by generateWithLlmStream */
export type LlmStreamEvent =
  | { type: "meta"; model: string; provider: LlmProvider }
  | { type: "delta"; text: string }
  | { type: "done"; result: LlmGenerateResult };

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Aborted");
    err.name = "AbortError";
    throw err;
  }
}

async function* iterOpenAiCompatStream(
  res: Response,
): AsyncGenerator<string> {
  if (!res.body) throw new Error("LLM stream returned no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
          };
          const piece = json.choices?.[0]?.delta?.content;
          if (typeof piece === "string" && piece.length > 0) yield piece;
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

async function* iterGeminiSseStream(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error("Gemini stream returned no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const piece = json.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || "")
            .join("");
          if (piece) yield piece;
        } catch {
          /* skip */
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Stream LLM HTML generation (OpenAI-compat + Gemini SSE).
 * Yields meta → delta* → done. Caller handles AbortSignal via options.signal.
 */
export async function* generateWithLlmStream(
  prompt: string,
  config: LlmConfig,
  options?: GenerateOptions & { signal?: AbortSignal },
): AsyncGenerator<LlmStreamEvent> {
  const mode = options?.mode === "story" ? "story" : "forge";
  const system = mode === "story" ? STORY_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(prompt, options);
  const signal = options?.signal;

  assertNotAborted(signal);
  yield { type: "meta", model: config.model, provider: config.provider };

  let res: Response;
  if (config.provider === "gemini") {
    res = await fetch(
      `${config.baseUrl}/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: mode === "story" ? 0.75 : 0.7 },
        }),
        signal,
      },
    );
  } else {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.provider === "openrouter"
          ? {
              "HTTP-Referer": "https://snowphamtom.github.io/appforge/",
              "X-Title": "AppForge",
            }
          : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: mode === "story" ? 0.75 : 0.7,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
      signal,
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LLM HTTP ${res.status}${body ? `: ${body.slice(0, 240)}` : ""}`,
    );
  }

  let raw = "";
  const chunks =
    config.provider === "gemini"
      ? iterGeminiSseStream(res)
      : iterOpenAiCompatStream(res);

  for await (const piece of chunks) {
    assertNotAborted(signal);
    raw += piece;
    yield { type: "delta", text: piece };
  }

  assertNotAborted(signal);
  const html = stripFences(raw);
  if (!/<!DOCTYPE\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
    throw new Error("LLM stream response was not an HTML document");
  }

  yield {
    type: "done",
    result: {
      html,
      title: extractTitle(html, prompt),
      kind: "llm",
      model: config.model,
    },
  };
}
