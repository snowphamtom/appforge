# AppForge

**LLM a world you can build perfectly** — prompt → one self-contained HTML app (inline CSS + JS) you can remix, download, and own.

Local `npm run dev` can call an LLM via `POST /api/generate` (API key stays on the server). Without a key — or on static GitHub Pages — the client falls back to keyword templates.

## Quick start

```bash
cd /workspace/appforge
npm install
cp .env.example .env   # then add a free key (GROQ/OPENROUTER) or OLLAMA_*, or XAI/GEMINI/OPENAI
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

Keys in `.env` / `.env.local` are re-read on each `/api/generate` request (via `loadEnv`) — no restart needed when those files appear or change. Restart only if you rely on shell-exported `process.env` vars set before `npm run dev`.

```bash
npm run build        # production / static build (no LLM API route)
npm run build:pages  # GH Pages base `/appforge/`
npm run preview      # serve the build
```

## LLM generation (local / dev)

1. Copy `.env.example` → `.env` (or `.env.local`).
2. Set one provider (priority **XAI → GEMINI → GROQ → OPENROUTER → OLLAMA → OPENAI**): **`XAI_API_KEY`**, **`GEMINI_API_KEY`**, free **`GROQ_API_KEY`** / **`OPENROUTER_API_KEY`**, local **`OLLAMA_BASE_URL`** + **`OLLAMA_MODEL`** (default `llama3.2:1b`), or `OPENAI_API_KEY`.
3. Models: xAI `grok-2-latest`; Gemini `gemini-2.5-flash`; Groq `llama-3.3-70b-versatile`; OpenRouter `openrouter/auto`; Ollama `llama3.2:1b`; OpenAI `gpt-4o-mini`.
4. Build sends `{ prompt }` to `/api/generate` (one-shot JSON). StoryForge prefers `/api/generate/stream` (SSE: `meta` → `delta*` → `done`) with `mode: "story"` + optional `priorHtml`, and falls back to `/api/generate`. Env files are loaded per request — no restart required for `.env` / `.env.local` changes.
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
6. **StoryForge** — verbal → visual: tell a story and watch a live interactive scene grow (see below).

## StoryForge

Mode inside AppForge (toggle **StoryForge** in the top bar). Not a separate product.

1. Open `http://localhost:5173` → click **StoryForge**.
2. Type or speak a story in the left transcript (or one-click a **mood preset** / commit beats with Enter). First-run strip shows type → stream → click; dismissible What's new lists stream / mic / bible / export / scrub / click.
3. After a ~1s typing pause — or on beat commit — the right iframe regenerates from the **full story so far**.
4. Preferred path: `POST /api/generate/stream` (SSE) streams HTML tokens; the iframe `srcDoc` updates on meaningful checkpoints (tag closes / ~1.2KB growth), then commits on `done`.
5. When a prior **committed** scene exists, the client sends `priorHtml` with `mode: "story"` so the world **evolves**. Mid-stream partials are not used as prior.
6. New beats **abort** in-flight streams; status shows **scene streaming…** / **scene updating…**.
7. Fallbacks: non-stream `POST /api/generate`, then offline `src/lib/storyScene.ts` if LLM/stream fails.
8. **World bible** — editable Characters / Setting / Props / Mood chips (heuristic extract from story + manual edits). Sent as `worldMemory` on generate/stream so scenes stay consistent; also honored offline. Draft (story + bible) persists in `localStorage`.
9. **Export pack** — from Story tools: **Scene .html**, **Transcript .md** / **.txt**, or **Pack .zip** (`story.md` + `scene.html` + `world-bible.json`, zero-dep client ZIP). Top-bar **Download** still saves the current scene HTML.
10. **Beat timeline** — committed beats are clickable. Prefer session HTML snapshots per beat for instant scrub; if a beat has no snapshot yet, StoryForge offline-forges a scene from the story truncated through that beat (does not overwrite the tip `priorHtml`). Status shows **scrubbing beat N**. Refresh / new forge returns to live tip.
11. **Mid-stream clicks** — while tokens stream, the scene HTML may be incomplete (props/buttons often not wired yet). The updating overlay uses `pointer-events: none` so it does not block the iframe; wait for stream **done** (or Refresh) for reliable click→state. Scrubbing a prior beat restores a finished snapshot.

Keeps one-shot Forge + remix studio unchanged. No Convex attach. No payments.

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
