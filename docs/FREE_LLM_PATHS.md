# Free LLM paths for AppForge (no paid spend)

Research notes for wiring local/cloud LLMs **without spending money**.  
Do **not** commit real API keys. Put them only in `.env` / `.env.local` (gitignored).

Last checked: 2026-09-06.

---

## 1. Ollama (local, $0)

**What:** Run open-weight models on this box; no cloud key required.

**Install (Linux):**

```bash
# needs zstd on some distros
sudo apt-get install -y zstd
curl -fsSL https://ollama.com/install.sh | sh
ollama serve   # if not already running as a service
```

API: `http://127.0.0.1:11434`

**Small models for low-RAM boxes:**

```bash
ollama pull llama3.2:1b
# alternatives: gemma2:2b, qwen2.5:0.5b
```

**Smoke:**

```bash
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "llama3.2:1b",
  "prompt": "Reply with exactly: OK",
  "stream": false
}'
```

**AppForge note:** Current `.env.example` priority is XAI → GEMINI → OPENAI. Ollama would need a separate local provider path (MANAGER-owned `llmGenerate` / generator) — not covered by this doc’s file edits.

**Caveats:** CPU-only inference is slow; box RAM must fit model + OS. Prefer 1B–2B for smoke.

---

## 2. Groq (cloud free tier — no card)

**Signup:** https://console.groq.com  
Sign up with Google / GitHub / email. **No credit card / waitlist** for the free tier.

**API key:**

1. Open console → **API Keys**
2. **Create API Key** → copy once (prefix `gsk_`)
3. Store as env var, e.g. `GROQ_API_KEY=...` (do not commit)

**Endpoint (OpenAI-compatible):**

- Base URL: `https://api.groq.com/openai/v1`
- Chat: `POST /chat/completions`

**Example smoke (after you have a key):**

```bash
export GROQ_API_KEY=gsk_...
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role":"user","content":"Say OK"}]
  }'
```

**Free-tier shape (verify live in console — limits change):**

- Ongoing rate-limited allowance (not a one-time dollar credit)
- Typical published figures ~30 RPM, ~6K TPM, ~500K TPD on smaller models (e.g. `llama-3.1-8b-instant`); larger models tighter
- Docs: https://console.groq.com/docs/quickstart

**AppForge wiring (future, MANAGER):** treat like OpenAI SDK with `baseURL=https://api.groq.com/openai/v1` and `GROQ_API_KEY`. Not in current `.env.example` yet.

**Cost rule:** Stay on free tier; do **not** add a payment method unless intentionally upgrading.

---

## 3. OpenRouter (cloud free models — no card to start)

**Signup:** https://openrouter.ai  
Sign in with email / Google / GitHub. **No card required** to create a key and call `:free` models.

**API key:**

1. Dashboard → **Keys** (or Settings → Keys)
2. **Create Key** → copy once (prefix `sk-or-`)
3. Store as `OPENROUTER_API_KEY=...` (do not commit)

**Endpoint (OpenAI-compatible):**

- Base URL: `https://openrouter.ai/api/v1`
- Chat: `POST /chat/completions`

**Free usage:**

- Append `:free` to a model id that has a free variant, e.g. `meta-llama/llama-3.2-3b-instruct:free`
- Or use router: `openrouter/free` (auto-picks a free model)
- Browse: https://openrouter.ai/models (filter free) and https://openrouter.ai/docs/guides/routing/model-variants/free

**Example smoke:**

```bash
export OPENROUTER_API_KEY=sk-or-...
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/free",
    "messages": [{"role":"user","content":"Say OK"}]
  }'
```

**Free-tier limits (commonly cited; confirm at https://openrouter.ai/docs/api-reference/limits and pricing):**

| Account | Free-model RPM | Free-model RPD |
| --- | --- | --- |
| $0 balance | ~20 | ~50 |
| ≥ $10 lifetime credits purchased | ~20 | ~1000 |

**Cost rule for this project:** Use **only** `:free` / `openrouter/free` with $0 balance. Do **not** buy credits unless product owners approve spend. Failed/retried free calls still count against daily quota.

**AppForge wiring (future, MANAGER):** OpenAI-compatible client with OpenRouter base URL + key. Not in current `.env.example` yet.

---

## 4. Recommendation order (zero spend)

1. **Ollama** — best for offline / no signup; quality limited by box RAM/CPU.
2. **Groq free tier** — fastest cloud path; signup + `gsk_` key; generous for prototyping.
3. **OpenRouter `:free`** — many models behind one key; strict daily caps (~50 RPD) unless credits bought (avoid for zero-spend).

Existing AppForge keys in `.env.example` (XAI / Gemini / OpenAI) may also have free/trial tiers; those are out of scope for this note.

---

## 5. What this agent did / did not do

- Documented signup + smoke curls only.
- Did **not** create real cloud accounts or API keys (needs human browser signup).
- Did **not** edit `src/lib/generator.ts` or `server/llmGenerate.ts`.
- Did **not** spend money or touch ceilinggate.
