/**
 * Vite plugin: POST /api/generate → LLM HTML (dev server only).
 * Also POST /api/generate/stream → SSE token stream for StoryForge live preview.
 * Keys never ship in the client bundle.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import {
  generateWithLlm,
  generateWithLlmStream,
  resolveLlmConfig,
  type WorldMemoryInput,
} from './llmGenerate.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer | string) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function writeSse(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

type ParsedBody = {
  prompt: string;
  priorHtml: string;
  generateMode: 'forge' | 'story';
  worldMemory?: WorldMemoryInput;
};

function parseWorldMemory(raw: unknown): WorldMemoryInput | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const list = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const out = v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    return out.length ? out : undefined;
  };
  const characters = list(o.characters);
  const setting = list(o.setting);
  const props = list(o.props);
  const mood =
    typeof o.mood === 'string' && o.mood.trim() ? o.mood.trim().slice(0, 80) : undefined;
  if (!characters && !setting && !props && !mood) return undefined;
  return { characters, setting, props, mood };
}

function parseGenerateBody(raw: string): ParsedBody | { error: string } {
  try {
    const parsed = JSON.parse(raw || '{}') as {
      prompt?: unknown;
      priorHtml?: unknown;
      mode?: unknown;
      worldMemory?: unknown;
    };
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';
    const priorHtml =
      typeof parsed.priorHtml === 'string' ? parsed.priorHtml : '';
    const generateMode: 'forge' | 'story' =
      parsed.mode === 'story' ? 'story' : 'forge';
    const worldMemory = parseWorldMemory(parsed.worldMemory);
    return { prompt, priorHtml, generateMode, worldMemory };
  } catch {
    return { error: 'Invalid JSON body' };
  }
}

export function appforgeGenerateApi(): Plugin {
  return {
    name: 'appforge-generate-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const isStream = url === '/api/generate/stream';
        const isGenerate = url === '/api/generate';
        if (!isStream && !isGenerate) {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Accept',
          );
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const raw = await readBody(req);
          const parsed = parseGenerateBody(raw);
          if ('error' in parsed) {
            sendJson(res, 400, { error: parsed.error });
            return;
          }
          const { prompt, priorHtml, generateMode, worldMemory } = parsed;

          if (!prompt.trim()) {
            sendJson(res, 400, { error: 'prompt is required' });
            return;
          }

          const mode = server.config.mode || 'development';
          const env = {
            ...process.env,
            ...loadEnv(mode, server.config.envDir || process.cwd(), ''),
          } as Record<string, string>;

          const config = resolveLlmConfig(env);
          if (!config) {
            sendJson(res, 503, {
              error: 'No API key',
              code: 'NO_API_KEY',
              hint: 'Set XAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, OLLAMA_BASE_URL, or OPENAI_API_KEY in .env / .env.local',
            });
            return;
          }

          if (isStream) {
            const ac = new AbortController();
            const onClose = () => ac.abort();
            req.on('close', onClose);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            // Flush headers early for proxies
            if (typeof (res as ServerResponse & { flushHeaders?: () => void }).flushHeaders === 'function') {
              (res as ServerResponse & { flushHeaders: () => void }).flushHeaders();
            }

            try {
              for await (const ev of generateWithLlmStream(prompt, config, {
                mode: generateMode,
                priorHtml: priorHtml || undefined,
                worldMemory,
                signal: ac.signal,
              })) {
                if (ac.signal.aborted || res.writableEnded) break;
                if (ev.type === 'meta') {
                  writeSse(res, 'meta', {
                    model: ev.model,
                    provider: ev.provider,
                  });
                } else if (ev.type === 'delta') {
                  writeSse(res, 'delta', { text: ev.text });
                } else if (ev.type === 'done') {
                  writeSse(res, 'done', ev.result);
                }
              }
            } catch (err) {
              if (!ac.signal.aborted && !res.writableEnded) {
                const message =
                  err instanceof Error ? err.message : 'Generate failed';
                const name = err instanceof Error ? err.name : '';
                if (name !== 'AbortError') {
                  writeSse(res, 'error', {
                    error: message,
                    code: 'LLM_ERROR',
                  });
                }
              }
            } finally {
              req.off('close', onClose);
              if (!res.writableEnded) res.end();
            }
            return;
          }

          const result = await generateWithLlm(prompt, config, {
            mode: generateMode,
            priorHtml: priorHtml || undefined,
            worldMemory,
          });
          sendJson(res, 200, result);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generate failed';
          sendJson(res, 502, { error: message, code: 'LLM_ERROR' });
        }
      });
    },
  };
}
