# siftai Backend — Engineering Guide

## Stack

- Node.js 22+ · TypeScript 5 (`strict: true`, zero `any`)
- Express 5 · Zod validation on every route
- Prisma 6 · PostgreSQL (source of truth)
- Pino structured logging
- Vitest + Supertest for tests

## Architecture — Clean Architecture

```
src/
├── domain/          # Entities, value objects, domain errors — ZERO external deps
├── application/     # Use-cases + IPort interfaces — NO framework imports
├── infrastructure/  # Prisma repos, external API adapters, cron jobs
└── interface/       # Express routes, controllers, middleware
```

**Flow:** `interface` calls `application` (use-case) via ports → use-case calls `infrastructure` via injected port impls → data returns up the chain.

## Agent Patterns

- One agent = one use-case file in `application/use-cases/{agent}/`
- Agents **never** call each other directly — `RunPipeline.ts` is the only orchestrator
- Every agent step persists a `RunEvent` row immediately (SSE stream + audit trail)
- All LLM calls go through `ILLMProvider` port — **never** import `@anthropic-ai/sdk` outside `AnthropicAdapter.ts`
- To swap LLM provider: register a new adapter in `config/container.ts`

## Error Handling Rules

- Domain errors **must** extend `DomainError` with a `code: string` and HTTP hint
- Use-cases throw only `DomainError` subclasses — never raw `Error`
- `errorHandler.ts` middleware maps `DomainError.code` → HTTP status (centralized)
- External API failures: wrap in `ExternalServiceError` with `retryable: boolean`
- Log the error at the boundary where it is caught, not where it is thrown

## Rate Limits — Hard Caps

| API | Free Limit | Internal Cap |
|---|---|---|
| Google Maps Places | 200 req/day | 15 req/day (safety margin) |
| PageSpeed Insights | 25,000 req/day | No cap needed for MVP |
| Anthropic Claude | No hard limit | Use prompt caching — target 90%+ cache hit rate |
| Gmail | 500 emails/day | Soft limit of 50/day in Settings |

**Maps dedup:** Always query `MapsCache` first. Only call the API if `placeId` is missing or `expiresAt` has passed.

## Environment Variables

- All env vars validated with Zod in `config/env.ts` on app startup
- App **crashes immediately** with a descriptive message if any required var is missing
- **Never** access `process.env.*` directly outside `config/env.ts`
- Import the validated `env` object everywhere else: `import { env } from "@/config/env"`

## Database Conventions

- Use Prisma transactions for any write that touches 2+ tables
- Always filter with `status: { not: "COLD" }` on lead queries unless intentionally including cold leads
- Index all filter fields: `(status, score, niche, discoveredAt)` — add in migration if missing
- `MapsCache.expiresAt` is always `fetchedAt + 30 days` — enforce in the adapter, not the caller

## TypeScript Rules

- `strict: true`, `noImplicitAny: true` — zero `any` types, use `unknown` when type is truly dynamic
- Always use `import type` for type-only imports: `import type { Lead } from "@/domain/entities/Lead"`
- All async functions must handle rejections — eslint rule `@typescript-eslint/no-floating-promises` is error
- Prefer `readonly` arrays and object properties in domain entities

## Testing Conventions

- Unit tests: vitest + in-memory repository fakes for domain use-cases
- Integration tests: supertest against a test Postgres DB (separate `DATABASE_URL_TEST`)
- Test file naming: `*.test.ts` co-located next to the file being tested
- Never mock Prisma — use a real test DB or in-memory fakes that implement the IRepository interface
