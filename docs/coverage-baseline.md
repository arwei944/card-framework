# Coverage baseline

CardFrame uses **c8** for optional coverage:

```bash
npm run test:coverage
```

## Baseline policy (P2)

| Area | Target | Notes |
|------|--------|--------|
| Statements (overall) | ≥ 70% aspirational | Not yet a hard CI gate |
| Store / Security / Guardrail / ActionLogger | Prefer high coverage | Critical correctness paths |
| Evolution Agent auth helper | Covered via mocha | `tests/integration/evolution-agent-auth.test.js` |

CI currently runs `lint` + `guardrail` + `build` + `test` (see `.github/workflows/ci.yml`).  
Coverage is available locally; raising a hard threshold can be enabled once the report stabilizes.

## Optional sanitizer note

In-tree `Security.sanitizeHtml` is a **best-effort, zero-dependency** allowlist sanitizer (see threat model in `src/security/Security.js`).  
For hostile user-generated HTML, prefer a audited library such as **DOMPurify** (optional integration — **not** a runtime dependency of CardFrame).
