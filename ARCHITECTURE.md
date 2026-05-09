# Architecture Overview — sift.ai

> Last updated: May 9, 2026

---

## System Diagram

```
Browser (Next.js 15)
        │
        │  HTTPS
        ▼
┌─────────────────────────────────────────────────┐
│  Vercel (Frontend)                              │
│  Next.js 15 App Router · TypeScript 5           │
│  NextAuth v5 (Google OAuth + credentials)       │
│  TanStack Query · Zustand · ShadCN UI           │
└───────────────────┬─────────────────────────────┘
                    │  JWT / REST / SSE
                    ▼
┌─────────────────────────────────────────────────┐
│  Railway (Node.js API)                          │
│  Express 5 · TypeScript 5 strict · Port 3001   │
│  Clean Architecture (4 layers)                  │
│  Pino logging · Sentry error tracking           │
└────────┬───────────────────────┬────────────────┘
         │  HTTP                 │  Prisma ORM
         ▼                       ▼
┌────────────────┐    ┌──────────────────────────┐
│  Railway       │    │  Neon PostgreSQL 16       │
│  (Python       │    │  Tables: Lead, Run,       │
│  Sidecar)      │    │  RunEvent, Email,         │
│  FastAPI 8001  │    │  Settings, MapsCache,     │
│  Playwright    │    │  User                     │
│  Chromium      │    └──────────────────────────┘
└────────────────┘

External APIs
  ├── OSM Nominatim + Overpass (Scout)
  ├── PageSpeed Insights (Analyst)
  ├── Groq /v1/responses (Writer — primary)
  ├── Anthropic Claude Sonnet 4.6 (Writer — fallback)
  ├── Gmail SMTP (Reporter — mocked)
  └── Google Sheets (Tracker — mocked)
```

---

## Layer Breakdown (Clean Architecture)

```
src/
├── domain/           ← Entities, value objects, DomainError hierarchy. ZERO deps.
├── application/      ← Use-cases + IPort interfaces. No framework imports.
├── infrastructure/   ← Prisma repos, external API adapters, cron jobs.
└── interface/        ← Express routes, Zod DTOs, middleware.
```

**Rule:** every dependency arrow points inward. `interface` → `application` → `domain`. Infrastructure implements `application` ports. Nothing from `infrastructure` is ever imported in `application` or `domain`.

---

## Agent Pipeline

```
RunPipeline.ts (sole orchestrator)
    │
    ├── ScoutAgent        → OSM Nominatim geocoding + Overpass business search
    │                       Saves: Lead rows with name, address, website, category
    │
    ├── AnalystAgent      → HTTP call to Python sidecar (Playwright + PageSpeed)
    │                       Saves: Lead.score (0–100), audit JSON
    │                       Skip threshold: score > 75 → never enter outreach
    │
    ├── WriterAgent       → Groq Responses API → bracket-finding JSON extractor
    │                       Saves: Email draft (DraftStatus=pending)
    │                       Fallback: AnthropicAdapter if Groq unavailable
    │
    ├── TrackerAgent      → Google Sheets sync (MockSheetsAdapter in dev/prod)
    │                       Saves: RunEvent confirming sync
    │
    └── ReporterAgent     → Daily digest email (mocked in dev/prod)
                            Saves: RunEvent confirming report sent
```

Each agent writes `RunEvent` rows immediately → streamed to frontend via SSE.

---

## Frontend Page Map

```
app/
├── (marketing)/          ← Public landing page (no auth)
├── (admin)/              ← Protected behind NextAuth session
│   ├── dashboard/
│   │   ├── page.tsx          KPI tiles
│   │   ├── leads/page.tsx    Lead table (search + filters)
│   │   ├── leads/[id]/       Lead detail (3-column)
│   │   ├── approvals/        Approval queue (card grid)
│   │   ├── agent/page.tsx    Pipeline runs + SSE terminal
│   │   ├── analytics/        Recharts dashboards
│   │   └── settings/         Config form
└── audit/[publicId]/     ← Public shareable audit report (no auth, SSR)
```

---

## Auth Flow

```
Signup (email+password)
  → POST /api/auth/register → bcryptjs 12 rounds → User row
  → Redirect to /login with success banner (never auto-sign-in)

Login (email+password)
  → NextAuth credentials provider → JWT with role claim
  → mintBackendToken (reuses NEXTAUTH_SECRET) → API auth header

Login (Google OAuth)
  → NextAuth Google provider → JWT with role claim
  → events.signIn fire-and-forget → POST /api/auth/google-sync
  → upsertGoogleUser by googleId → auto-granted ADMIN role

API requests
  → Authorization: Bearer <JWT> → requireAuth middleware → Prisma User lookup
  → Dev bypass: x-dev-auth: dev-qa-bypass (NODE_ENV=development only)

SSE endpoint
  → ?token= query param (EventSource can't set headers) → same JWT validation
```

---

## Data Flow — Full Pipeline Run

```
POST /api/pipeline/runs  (trigger)
  → RunPipeline use-case
  → creates PipelineRun row (status=running)
  → ScoutAgent: Nominatim geocoding → Overpass query → Lead rows
  → SSE event: {type:"scout",leads:[...]}
  → AnalystAgent (per lead): Python sidecar → scores lead
  → SSE event: {type:"analyst",leadId,score}
  → WriterAgent (per scorable lead): Groq → Email draft row
  → SSE event: {type:"writer",leadId,draftId}
  → TrackerAgent: Sheets sync (mocked)
  → ReporterAgent: digest email (mocked)
  → PipelineRun status=completed
  → SSE event: {type:"complete"}

GET /api/pipeline/runs/:id/events  (SSE stream)
  → Long-poll; 200ms Prisma query interval; 10-min max; token= auth
```

---

## Key Infrastructure Files

| File | Responsibility |
|---|---|
| `src/config/container.ts` | DI wiring — all adapters registered here |
| `src/config/env.ts` | Zod-validated env vars (fails fast at startup) |
| `src/interface/http/server.ts` | Express app setup, Sentry, CORS, middleware |
| `src/interface/http/middleware/errorHandler.ts` | Maps DomainError.code → HTTP status |
| `src/application/use-cases/pipeline/RunPipeline.ts` | The only agent orchestrator |
| `src/instrument.ts` | Sentry DSN init (imported before everything else) |
| `prisma/schema.prisma` | Full data model — source of truth |
