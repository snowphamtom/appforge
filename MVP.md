# AppForge MVP — scope

**Date:** 2026-09-06  
**Goal:** Working prompt → generate → live iframe remix loop, with All Gas stack stubs (Convex + Firecrawl + AgentMail).

## Iterated studio

**Note:** Iterated studio (local polish) — 2026-09-06 3:40 PM CT  
Clearer Prompt / Source / Live labels, ⌘/Ctrl+Enter Build hint on home, empty-state when no build, recent localStorage projects (last 5) with click-to-reopen, template quality bump (typography + one interactive beat each). Vite `base` stays `/` for local; `npm run build:pages` sets `GITHUB_PAGES=1` → `/appforge/` for GH Pages. Convex remains stubs only (no live deploy attach).

## In scope (v0)

- Vite + React + TypeScript SPA at `/workspace/appforge`
- Home: prompt textarea, Build, example chips, keyboard Build hint
- Local generator (no LLM API): todo / tipjar / landing / habit / dashboard
- Studio: editable HTML (Source) + sandboxed iframe (Live), debounced preview, empty-state
- Regenerate, New prompt, Download `.html`, Copy HTML
- Recent projects list (localStorage, last 5) on home
- URL seed UI (Firecrawl stub)
- Local project persistence (`localStorage`)
- `convex/` stubs: schema, projects CRUD, Firecrawl action, AgentMail HTTP ingress
- README + this MVP.md
- `npm run build` succeeds; `npm run build:pages` for GH Pages base; `npm run dev` serves UI

## Out of scope (v0)

- Live Convex deployment / auth (leave stubs if auth wall)
- Real Firecrawl scrapes without API key
- Live AgentMail mailbox
- Multi-user accounts / billing
- External LLM generation
- Prize / sweepstakes / phone-claim flows (explicitly excluded)
- Touching `/workspace/ceilinggate` or its CSS

## Success criteria

1. `npm install && npm run dev` shows AppForge UI  
2. Example chip → interactive preview in iframe  
3. Edit source → preview updates  
4. Download / copy work  
5. Clear path documented for Convex plug-in  

## Fences

- OFF PHONE · Fee ≠ prize · no fake prize $ · silent to Taylor
