# CardFrame Evolution Agent

> **Experimental · local-dev only**  
> This service can modify source files under a configured write whitelist.  
> Default bind is `127.0.0.1`. **Do not expose on a public network.**

## Current capabilities (as implemented)

| Capability | Status |
|------------|--------|
| HTTP health `/api/health` | Open (no auth) — reports `capabilities` |
| Write/mutate routes (`/api/evolve`, `/api/metrics`, merge, rollback, …) | **Require Bearer token** when `CARD_EVOLUTION_TOKEN` / `config.token` is set; **401 if token is unset** (unless `ALLOW_INSECURE_AUTH=1` for local tests only) |
| Bind | Default `127.0.0.1` |
| CORS | Whitelist `allowedOrigins` only (empty = no cross-origin; **not** `*`) |
| Write paths | Whitelist `allowedWritePaths` (default: `src/core/CardFrame.js`) |
| LLM evolution | Optional — only when `llmEndpoint` + API key env are configured |
| Default evolution method | **`heuristic`** (key/value style parameter patches) when no LLM |
| `dryRun` | **Default `true`** in `config.json` — apply + test then revert, no commit |
| Production (`NODE_ENV=production`) | Forces `dryRun=true` and `requireReview=true` |

`GET /api/health` returns:

```json
{
  "status": "ok",
  "capabilities": {
    "llm": false,
    "heuristic": true,
    "dryRun": true,
    "requireReview": true,
    "allowedWritePaths": ["src/core/CardFrame.js"],
    "bind": "127.0.0.1"
  }
}
```

## Quick start (localhost)

```bash
cd evolution-agent
npm install
# Required for mutate routes:
set CARD_EVOLUTION_TOKEN=dev-secret   # Windows PowerShell: $env:CARD_EVOLUTION_TOKEN="dev-secret"
npm start
```

Browser (explicit opt-in):

```javascript
const frame = new CardFrame(container, {
  evolution: {
    agentEndpoint: 'http://127.0.0.1:9100'
  }
});
```

Protected calls must send `Authorization: Bearer <token>`.

## Auth rules

1. **No token configured** → protected routes return **401** (safe default).  
2. **Token configured** → Bearer must match.  
3. **`ALLOW_INSECURE_AUTH=1`** → allow unauthenticated protected routes (tests / emergency local only).  
4. **`/api/health`** stays open so operators can inspect capabilities.

## Config (`src/config.json`)

| Key | Notes |
|-----|--------|
| `port` / `bind` | Default 9100 / `127.0.0.1` |
| `tokenEnv` | Default `CARD_EVOLUTION_TOKEN` |
| `reviewTokenEnv` | Merge gate |
| `allowedOrigins` | CORS allowlist |
| `allowedWritePaths` | Only these relative paths may be patched |
| `dryRun` | Default `true` |
| `requireReview` | Default `true` for merge |
| `llmEndpoint` / `llmApiKeyEnv` / `llmModel` | Optional LLM path |

## Honesty note

Without an LLM API key the agent only applies **heuristic** patches and still runs `npm test` before commit (unless `dryRun`). It is **not** a general-purpose AI coding agent in production form.

See also: `docs/architecture-overview.md` (current architecture), archived historical plans under `docs/archive/`.
