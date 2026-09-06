# AppForge MVP — scope

**Date:** 2026-09-06  
**Goal:** Prompt → LLM-forged (or template) self-contained HTML → live iframe remix loop. All Gas stubs (Convex + Firecrawl + AgentMail) unchanged.

## Iterated studio

**Note:** StoryForge first-run onboard — 2026-09-06 ~5:15 PM CT  
Onboarding strip + empty-state 3 steps (type/speak → stream → click props); 3 mood demo presets (rainy alley / cozy attic / orbit garden); dismissible collapsible What's new chip (stream/mic/bible/export/scrub/click) via localStorage. No Convex / paid APIs.

**Note:** StoryForge post-commit interactivity — 2026-09-06 ~5:15 PM CT  
After streamed/LLM scene `done`, `injectInteractiveScene(html)` wraps the document with delegated click→state (props/characters/buttons/images → highlight, inventory toast, open/close). Mid-stream partials untouched; offline `storyScene` unchanged. Timeline scrub re-applies inject.

**Note:** StoryForge export + beat timeline — 2026-09-06 ~5:15 PM CT  
Export scene `.html`, transcript `.md`/`.txt`, and client ZIP pack (`story.md` + `scene.html` + `world-bible.json`). Beat timeline scrubs via session HTML snapshots (offline re-forge fallback). Stream/mic/memory/Forge unchanged.

**Note:** StoryForge world memory (bible) — 2026-09-06 ~5:05 PM CT  
Living cast/setting/props/mood panel; heuristic extract + manual chips; passed into stream/one-shot/offline prompts; session + localStorage draft persistence.

**Note:** StoryForge live HTML stream — 2026-09-06 ~5:00 PM CT  
SSE `/api/generate/stream` yields token deltas; StoryForge updates iframe `srcDoc` on HTML checkpoints; abort on new beat; non-stream `/api/generate` + offline `storyScene` remain fallbacks.

**Note:** StoryForge speech + stream polish — 2026-09-06 ~5:00 PM CT  
Web Speech mic dictate→commit beat (graceful unsupported fallback); clearer queued/updating status; ~1s debounce; hardened abort; demo story auto-forge; preview update overlay (no paid speech).

**Note:** StoryForge mode — 2026-09-06 ~4:55 PM CT  
Verbal→visual story stream: `mode: "story"` + `priorHtml` on `/api/generate`; live iframe; debounce + beat commit; offline `storyScene` fallback. One-shot forge unchanged.

**Note:** Free-tier LLM + template leap — 2026-09-06 ~4:40 PM CT  
Providers: XAI→GEMINI→GROQ→OPENROUTER→OLLAMA→OPENAI; local Ollama `llama3.2:1b`; expanded templates (ledger/countdown/kanban/quiz/invoice + multi-section suites).

**Note:** Gemini key support — 2026-09-06 ~4:05 PM CT  
`POST /api/generate` via Vite middleware (xAI → Gemini → OpenAI); `GEMINI_API_KEY` + OpenAI-compat endpoint; async Build + “Forging your world…”; fallback toast for no key / Pages. Prior: LLM wiring, mobile studio stack, Pages base `/appforge/`.

## In scope (v0 / v0.1)

- Vite + React + TypeScript SPA at `/workspace/appforge`
- Home: prompt textarea, Build, example chips, keyboard Build hint
- **LLM generation** (local dev): XAI→GEMINI→GROQ→OPENROUTER→OLLAMA→OPENAI → `kind: 'llm'`
- Local generator fallback: todo / tipjar / landing / habit / dashboard / ledger / countdown / kanban / quiz / invoice (+ suites)
- Studio: editable HTML (Source) + sandboxed iframe (Live), debounced preview, empty-state
- Regenerate, New prompt, Download `.html`, Copy HTML
- Recent projects list (localStorage, last 5) on home
- URL seed UI (Firecrawl stub)
- Local project persistence (`localStorage`)
- `convex/` stubs: schema, projects CRUD, Firecrawl action, AgentMail HTTP ingress
- README + this MVP.md + `.env.example`
- `npm run build` succeeds (static Pages = templates only); `npm run build:pages`; `npm run dev` serves UI + API

## Out of scope (v0)

- Live Convex deployment / auth (leave stubs if auth wall) — **do not attach to quirky-rhinoceros-204**
- Real Firecrawl scrapes without API key
- Live AgentMail mailbox
- Multi-user accounts / billing
- LLM backend on GitHub Pages (static host cannot call LLM without a separate backend)
- Prize / sweepstakes / phone-claim flows (explicitly excluded)
- Touching `/workspace/ceilinggate` or its CSS

## Success criteria

1. `npm install && npm run dev` shows AppForge UI  
2. With API key: prompt → LLM HTML in studio; without: templates + toast  
3. Example chip → interactive preview in iframe  
4. Edit source → preview updates  
5. Download / copy work  
6. Clear path documented for Convex plug-in and LLM keys  

## Fences

- OFF PHONE · Fee ≠ prize · no fake prize $ · silent to Taylor · no ceilinggate · no Convex attach to quirky-rhinoceros-204
