# AppForge

**LLM a world you can build perfectly** — prompt → one self-contained HTML app (inline CSS + JS) you can remix, download, and own.

Local `npm run dev` can call an LLM via `POST /api/generate` (API key stays on the server). Without a key — or on static GitHub Pages — the client falls back to keyword templates.

## Quick start

```bash
cd /workspace/appforge
npm install
cp .env.example .env   # then add XAI_API_KEY or OPENAI_API_KEY
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

**Restart `npm run dev` after changing `.env`** so the Vite middleware picks up the key.

```bash
npm run build        # production / static build (no LLM API route)
npm run build:pages  # GH Pages base `/appforge/`
npm run preview      # serve the build
```

## LLM generation (local / dev)

1. Copy `.env.example` → `.env`.
2. Set **`XAI_API_KEY`** (preferred — [api.x.ai](https://api.x.ai), OpenAI-compatible) **or** `OPENAI_API_KEY`.
3. Models: xAI `grok-2-latest` (or `grok-3` via `XAI_MODEL`); OpenAI `gpt-4o-mini`.
4. Restart `npm run dev`. Build sends `{ prompt }` to `/api/generate` and returns `{ html, title, kind: 'llm', model }`.
5. On failure (no key / network / static host), AppForge uses local templates and toasts: *Using local templates (add API key for LLM)*.

Example chips use the same path: LLM when the key is present, otherwise fast local templates.

### GitHub Pages note

The static Pages host **cannot** call the LLM — there is no Node backend. Deployed Pages keeps the template fallback. Use local/`npm run dev` (or any host with the Vite middleware / a small Express proxy) for LLM forging.

## Product loop

1. **Home** — big prompt + example chips (todo, tip jar, landing, habit tracker).
2. **Build** — LLM forge when configured; else keyword → template HTML.
3. **Studio** — left: editable source; right: sandboxed iframe (debounced live update).
4. **Remix** — Regenerate / New prompt / Download `.html` / Copy HTML to clipboard.
5. **URL seed** — optional Firecrawl stub seeds a prompt from a URL (live scrape via Convex).

## Stack

| Layer | Status |
|--------|--------|
| Vite + React + TypeScript | **Live** |
| LLM generate API (`server/`, Vite middleware) | **Live** (dev only) |
| Local HTML templates | **Live** (`src/lib/generator.ts`) — Pages / no-key fallback |
| Local project history | **Live** (`localStorage` via `src/lib/projects.ts`) |
| Convex (`projects`, `buildRequests`) | **Stubbed** — see `convex/` |
| Firecrawl URL remix | **Stubbed client** + Convex action |
| AgentMail build ingress | **Stubbed** webhook in `convex/http.ts` |

UI: IBM Plex, dark industrial — not generic AI purple.

## Convex + Firecrawl + AgentMail (All Gas)

Local shell works without Convex. To plug in the real backend:

```bash
npm install convex
npx convex login    # interactive — may hit an auth wall in CI/boxes
npx convex dev      # generates convex/_generated + VITE_CONVEX_URL
```

1. Set `FIRECRAWL_API_KEY` in the Convex dashboard.
2. Wrap the React tree with `ConvexProvider`.
3. Swap `saveGenerationLocal` → `api.projects.create`.
4. Point “Seed from URL” → `api.firecrawl.scrapeForSeed`.
5. Register AgentMail inbound → `https://<deploy>.convex.site/agentmail/inbound`.

Details: [`convex/README.md`](./convex/README.md).

If Convex auth/deploy is blocked, keep using the Vite shell — stubs document the contract.

## Scope

See [`MVP.md`](./MVP.md).

## Notes

- Do not treat tip/demo amounts as prizes; generated tip jar is demo-only (no real payments).
- Generated apps are offline-capable HTML files you own (no external JS CDNs).
- Never commit real API keys; `.env` is gitignored.
