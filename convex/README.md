# Convex backend (All Gas wiring)

AppForge’s Vite shell runs fully offline with a local generator + `localStorage` projects.

This folder is the **real backend** for:

| Piece | Role |
|--------|------|
| `schema.ts` | `projects` + `buildRequests` tables |
| `projects.ts` | CRUD for generations |
| `firecrawl.ts` | Action: scrape URL → remix seed (`FIRECRAWL_API_KEY`) |
| `http.ts` | AgentMail webhook → `/agentmail/inbound` |
| `buildRequests.ts` | Email build-request ingress |

## Activate

```bash
npm install convex
npx convex login          # may need interactive auth
npx convex dev            # writes convex/_generated + .env.local
```

Then in the app:

1. Wrap root with `ConvexProvider` + `ConvexReactClient(import.meta.env.VITE_CONVEX_URL)`.
2. Replace `saveGenerationLocal` with `useMutation(api.projects.create)`.
3. Point “Seed from URL” at `useAction(api.firecrawl.scrapeForSeed)`.
4. Register AgentMail webhook → `https://<deployment>.convex.site/agentmail/inbound`.

If `npx convex login` / deploy hits an auth wall, keep shipping on the local shell — stubs stay authoritative for the All Gas stack.
