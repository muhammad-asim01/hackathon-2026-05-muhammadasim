# Config Layer

## `container.ts` — Dependency Injection

Manual DI container. Wires everything together in one place. Import order matters: repos → external services → use-cases → RunPipeline.

```
container
├── prisma (PrismaClient)
├── leadRepo  (LeadRepository)
├── runRepo   (RunRepository)
├── emailRepo (EmailRepository)
├── llm       (AnthropicAdapter | MockLLMAdapter)
├── emailSender (GmailService | MockEmailSender)
├── mapsService (OSMMapsService)
├── pageSpeedService (PageSpeedService)
├── pageCrawler (PageCrawler — Playwright)
└── runPipeline (RunPipeline — composed from all above)
```

**Mock selection logic:**
- `llm`: always `AnthropicAdapter` unless `ANTHROPIC_API_KEY` is absent (falls back to `MockLLMAdapter`).
- `emailSender`: `GmailService` when `GMAIL_REFRESH_TOKEN` is set, else `MockEmailSender`.

**Graceful shutdown:** `container.ts` registers `SIGINT`/`SIGTERM` handlers to:
1. Close Playwright browser (`pageCrawler.close()`).
2. Disconnect Prisma (`prisma.$disconnect()`).

## `env.ts` — Validated Environment

Reads `process.env` and exports typed, validated config object. Use this instead of `process.env.X` directly anywhere in the codebase. All fields have explicit types (no implicit `string | undefined`).

Key env vars:
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma connection string |
| `ANTHROPIC_API_KEY` | Yes (prod) | Falls back to mock adapter if absent |
| `NEXTAUTH_SECRET` | Yes | Shared with frontend for JWT validation |
| `GMAIL_*` | Yes (prod) | All 5 Gmail OAuth vars required for real email |
| `PAGESPEED_API_KEY` | Yes (prod) | Google PageSpeed API |
| `PORT` | No | Defaults to 4000 |

## Rules

- Never read `process.env` directly outside `env.ts`.
- Never import from `container.ts` inside use-cases or domain — only routes/app.ts.
- Adding a new external service: add the env var to `env.ts`, wire the adapter in `container.ts`.
