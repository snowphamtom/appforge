/**
 * Vite plugin: POST /api/generate → LLM HTML (dev server only).
 * Keys never ship in the client bundle.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { generateWithLlm, resolveLlmConfig } from './llmGenerate.ts';

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

export function appforgeGenerateApi(): Plugin {
  return {
    name: 'appforge-generate-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url !== '/api/generate') {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const raw = await readBody(req);
          let prompt = '';
          try {
            const parsed = JSON.parse(raw || '{}') as { prompt?: unknown };
            prompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';
          } catch {
            sendJson(res, 400, { error: 'Invalid JSON body' });
            return;
          }

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
              hint: 'Set XAI_API_KEY or OPENAI_API_KEY in .env and restart npm run dev',
            });
            return;
          }

          const result = await generateWithLlm(prompt, config);
          sendJson(res, 200, result);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generate failed';
          sendJson(res, 502, { error: message, code: 'LLM_ERROR' });
        }
      });
    },
  };
}
