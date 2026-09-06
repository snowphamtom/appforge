# AppForge

**Prompt → live web app preview you can remix.**

Type a sentence, get a self-contained HTML app (inline CSS + JS) with a split-view editor and live iframe preview. No external LLM required for v0.

## Quick start

```bash
cd /workspace/appforge
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

```bash
npm run build    # production build
npm run preview  # serve the build
```

## Product loop

1. **Home** — big prompt + example chips (todo, tip jar, landing, habit tracker).
2. **Build** — local keyword → template generator emits intentional interactive HTML.
3. **Studio** — left: editable source; right: sandboxed iframe (debounced live update).
4. **Remix** — Regenerate / New prompt / Download `.html` / Copy HTML to clipboard.
5. **URL seed** — optional Firecrawl stub seeds a prompt from a URL (live scrape via Convex).

## Stack

| Layer | Status |
|--------|--------|
| Vite + React + TypeScript | **Live** |
| Local HTML generator | **Live** (`src/lib/generator.ts`) |
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
- Generated apps are offline-capable HTML files you own.
