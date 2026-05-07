# Sift.ai — Master Architecture & Execution Plan

> Generated: 2026-05-05  
> Status: Approved by owner — ready to execute Phase 0  
> Author: Senior Architect session (Claude Sonnet 4.6)

---

## Table of Contents

1. [Project Understanding](#1-project-understanding)
2. [Decisions & Constraints](#2-decisions--constraints)
3. [System Architecture](#3-system-architecture)
4. [Backend Plan](#4-backend-plan)
5. [Frontend Plan](#5-frontend-plan)
6. [Data Models (Prisma)](#6-data-models-prisma)
7. [Phased Execution Plan](#7-phased-execution-plan)
8. [Task Breakdown](#8-task-breakdown)
9. [Timeline](#9-timeline)
10. [Scaling Plan](#10-scaling-plan)
11. [Best Practices](#11-best-practices)
12. [Open Items](#12-open-items)

---

## 1. Project Understanding

### Current State (as of 2026-05-05)

| Area | Status |
|---|---|
| `main-project/backend/` | **Empty** |
| `main-project/frontend/` | **Empty** |
| `package.json` (root) | Playwright + `@types/node` only — no app code |
| `tests/example.spec.ts` | Default Playwright placeholder |
| `project-overview/` | Full spec docs + Inngest design system |
| CLAUDE.md files | Root only — sub-files planned, not yet created |

**This is a fully greenfield project. No source code exists yet.**

### Architecture Pattern (planned)
Modular agent pipeline — Clean Architecture (domain → application → infrastructure → interface):

```
User Prompt → Scout → Analyst → Writer → Tracker → Reporter
              (Maps)  (PageSpeed) (Claude) (Sheets+DB) (Gmail)
```

### What's Already Built
- Playwright e2e test infrastructure (skeleton only)
- Comprehensive product specs
- Inngest-style dark design system (`Design.md`)
- CLAUDE.md root file

### What's Missing (Everything else)
- Backend: package.json, tsconfig, eslint, all 5 agents, 4 service wrappers, cron, logger, rate limiter
- Frontend: Next.js scaffold, Tailwind v4 + tokens, ShadCN, all pages, Zustand stores, API client
- Data layer: Prisma schema, Postgres, Google Sheets mirror
- Auth: NextAuth on admin routes
- Secrets: `.env.example`

---

## 2. Decisions & Constraints

| Question | Decision |
|---|---|
| Single or multi-tenant? | **Single-tenant** — solo operator (your agency only) |
| Auth | Admin dashboard requires **NextAuth**. User/public pages: no auth. |
| Approvals | Day-0 emails → Pending Approval queue → you + moderators approve → send. Day-3 follow-ups → same. |
| Pipeline trigger | **Both**: daily cron (9am) + manual "Run Pipeline" button in dashboard |
| Search input | User supplies a prompt per run (e.g., "restaurants in Austin") |
| Storage | **PostgreSQL + Prisma** from day 1 (for scale). Google Sheets = secondary mirror only. |
| Maps dedup | `MapsCache` table with 30-day TTL — never re-bill same business |
| API style | **REST** — Node.js + Express |
| Architecture | **Clean Architecture** (use-cases / ports / repos / entities) |
| Job system (MVP) | `node-cron` + sequential `await` — BullMQ added in post-MVP scale phase |
| LLM calls | Each agent has its own call. `ILLMProvider` port → `AnthropicAdapter` now. Provider-swappable later (OpenAI, Grok). |
| MVP scope order | **UI FIRST** — admin dashboard + marketing site with mock data, then wire backend |
| Dev environment | Local Windows machine |
| Env secrets | `.env.example` files — owner fills in real keys |
| Email identity | TBD — to be clarified before Phase 6 |
| NextAuth provider | TBD — Google OAuth / GitHub / magic link |
| Real-time updates | **SSE** (Server-Sent Events) for pipeline run live status |
| Public audit page | `/audit/[publicId]` — prospect-facing free audit view (no auth) |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PUBLIC WEB SURFACE                         │
│    Landing • Pricing • Compare • Privacy • Terms • Contact          │
│    /audit/[publicId]  ← prospect-facing audit page (no auth)        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│                   ADMIN DASHBOARD (NextAuth-gated)                  │
│   Lead Inbox • Lead Detail • Approval Queue • Pipeline Runs •       │
│   Settings • Analytics                                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST (Axios + React Query)
                           │ + SSE for live pipeline events
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND  (Express + TS, Clean Arch)             │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │  Interface   │   │ Application  │   │   Infrastructure     │    │
│  │   (HTTP)     │──▶│ (use-cases)  │──▶│ (repos + adapters)   │    │
│  │ controllers  │   │   ports      │   │                      │    │
│  │   routes     │   │              │   │                      │    │
│  └──────────────┘   └──────┬───────┘   └──────────────────────┘    │
│                            │                                        │
│                            ▼                                        │
│                ┌─────────────────────────┐                          │
│                │      Domain Layer       │                          │
│                │  Lead, Audit, Email,    │                          │
│                │  Run, Niche entities   │                          │
│                └─────────────────────────┘                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────────┐
        ▼                  ▼                          ▼
┌────────────────┐  ┌────────────────┐    ┌──────────────────────┐
│    Pipeline    │  │ Cron Scheduler │    │  External Adapters   │
│  Orchestrator  │  │  (node-cron)   │    │ Maps • PageSpeed •   │
│                │  │                │    │ Gmail • Sheets •     │
│  Scout →       │  │  Daily 09:00   │    │ LLMProvider iface →  │
│  Analyst →     │  │  Follow-ups    │    │   AnthropicAdapter   │
│  Writer →      │  │  18:00 Report  │    │   (later: OpenAI,    │
│  Tracker →     │  │                │    │    Grok)             │
│  Reporter      │  │                │    │                      │
└───────┬────────┘  └────────────────┘    └──────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PostgreSQL (Prisma ORM) — source of truth              │
│   leads • audits • emails • runs • events • niches • cache_maps     │
│                                                                     │
│   ┌─────────────────────────────┐                                   │
│   │ Google Sheets (mirror sync) │  ← Tracker writes here too        │
│   └─────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Data Flow Rules

1. Scout deduplicates against `MapsCache` before calling Maps API (saves quota + cost).
2. Each agent is a *use-case* in the application layer — agents never call each other directly.
3. **Pipeline Orchestrator** chains them and persists `RunEvent`s after each step.
4. LLM calls go through `ILLMProvider` port → `AnthropicAdapter`. Swap provider by registering new adapter in `container.ts`.
5. Day-0 emails: Writer → Tracker stores as `PENDING_APPROVAL` → admin clicks Approve → Gmail sends. **No auto-send ever.**
6. Every `RunEvent` row is both the audit trail and the SSE source for the live dashboard.

---

## 4. Backend Plan

### Folder Structure

```
main-project/backend/
├── package.json
├── tsconfig.json                 # strict: true, no any
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── domain/                   # pure business — zero framework deps
    │   ├── entities/
    │   │   ├── Lead.ts
    │   │   ├── Audit.ts
    │   │   ├── EmailDraft.ts
    │   │   ├── PipelineRun.ts
    │   │   └── Niche.ts
    │   ├── value-objects/
    │   │   ├── LeadScore.ts      # 0–100, action thresholds
    │   │   └── EmailWordCount.ts # enforces 180-word limit
    │   └── errors/
    │
    ├── application/              # use-cases + ports (interfaces)
    │   ├── ports/
    │   │   ├── ILeadRepository.ts
    │   │   ├── IAuditRepository.ts
    │   │   ├── IRunRepository.ts
    │   │   ├── IMapsService.ts
    │   │   ├── IPageSpeedService.ts
    │   │   ├── IEmailSender.ts
    │   │   ├── ISheetsSync.ts
    │   │   ├── ILLMProvider.ts        # ← provider abstraction
    │   │   └── IEventBus.ts           # for SSE
    │   ├── use-cases/
    │   │   ├── scout/DiscoverBusinesses.ts
    │   │   ├── analyst/AuditWebsite.ts
    │   │   ├── analyst/AnalyzeReviews.ts
    │   │   ├── writer/GenerateOutreachEmail.ts
    │   │   ├── tracker/LogLead.ts
    │   │   ├── tracker/ApproveAndSendEmail.ts
    │   │   ├── reporter/SendDailySummary.ts
    │   │   ├── pipeline/RunPipeline.ts    # orchestrator
    │   │   └── leads/{ListLeads,GetLead,UpdateLeadStatus}.ts
    │   └── dto/                          # request/response shapes
    │
    ├── infrastructure/
    │   ├── persistence/
    │   │   ├── prisma/PrismaClient.ts
    │   │   └── repositories/
    │   │       ├── LeadRepository.ts
    │   │       ├── AuditRepository.ts
    │   │       └── RunRepository.ts
    │   ├── external/
    │   │   ├── google/
    │   │   │   ├── MapsService.ts
    │   │   │   ├── PageSpeedService.ts
    │   │   │   ├── GmailService.ts
    │   │   │   └── SheetsService.ts
    │   │   ├── llm/
    │   │   │   ├── AnthropicAdapter.ts
    │   │   │   ├── OpenAIAdapter.ts.todo    # placeholder for later
    │   │   │   └── GrokAdapter.ts.todo
    │   │   └── puppeteer/PageCrawler.ts
    │   ├── jobs/
    │   │   ├── DailyPipelineJob.ts          # node-cron 0 9 * * *
    │   │   └── FollowUpJob.ts               # node-cron 0 10 * * *
    │   ├── events/SSEEventBus.ts
    │   └── cache/MapsCache.ts
    │
    ├── interface/
    │   ├── http/
    │   │   ├── server.ts
    │   │   ├── middleware/
    │   │   │   ├── auth.ts            # JWT verify (NextAuth-issued)
    │   │   │   ├── rateLimit.ts
    │   │   │   ├── errorHandler.ts
    │   │   │   └── requestLogger.ts
    │   │   ├── routes/
    │   │   │   ├── leads.routes.ts
    │   │   │   ├── pipeline.routes.ts
    │   │   │   ├── audits.routes.ts
    │   │   │   ├── emails.routes.ts
    │   │   │   ├── settings.routes.ts
    │   │   │   ├── analytics.routes.ts
    │   │   │   └── public.routes.ts
    │   │   └── controllers/
    │   └── validators/               # zod schemas per route
    │
    ├── config/
    │   ├── env.ts                    # zod-validated env loader
    │   ├── constants.ts
    │   └── container.ts              # DI wiring (manual factory)
    │
    └── utils/
        ├── logger.ts                 # pino
        ├── rateLimiter.ts            # token bucket for Maps API
        └── wordCount.ts
```

### Dependencies

```jsonc
// Runtime
"express", "cors", "helmet", "compression",
"@anthropic-ai/sdk",
"@googlemaps/google-maps-services-js",
"googleapis",            // Gmail + Sheets + PageSpeed
"puppeteer",
"@prisma/client", "prisma",
"node-cron",
"zod",
"pino", "pino-http",
"jsonwebtoken",          // verify NextAuth tokens
"express-rate-limit",
"dotenv"

// Dev
"typescript", "tsx", "@types/*",
"eslint", "@typescript-eslint/*",
"vitest",                // unit tests (no Jest config overhead)
"supertest"             // HTTP integration tests
```

### Job System (MVP)

| Job | Schedule | Use-Case Called |
|---|---|---|
| `DailyPipelineJob` | `0 9 * * *` | `RunPipeline` |
| `FollowUpJob` | `0 10 * * *` | Flags Day-3 candidates for moderator review |
| `ReporterJob` | `0 18 * * *` | `SendDailySummary` |

BullMQ + Redis added **post-MVP** when load exceeds 10 leads/day.

### REST API Surface

```
# Public (no auth)
GET    /api/health
GET    /api/public/audit/:publicId

# Admin (NextAuth JWT required)
GET    /api/leads?status=&score=&niche=&search=
GET    /api/leads/:id
PATCH  /api/leads/:id

POST   /api/pipeline/run           { prompt: string }
GET    /api/pipeline/runs
GET    /api/pipeline/runs/:id
GET    /api/pipeline/runs/:id/events   ← SSE stream

GET    /api/emails?status=pending_approval
POST   /api/emails/:id/approve
POST   /api/emails/:id/reject
PATCH  /api/emails/:id             { body: string }  ← inline edit

GET    /api/settings
PATCH  /api/settings

GET    /api/analytics/funnel
GET    /api/analytics/replies
```

---

## 5. Frontend Plan

### Folder Structure

```
main-project/frontend/
├── app/
│   ├── (marketing)/                   # public site — no auth
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # landing
│   │   ├── pricing/page.tsx
│   │   ├── compare/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   └── contact/page.tsx
│   ├── audit/[publicId]/page.tsx      # prospect audit view
│   ├── (admin)/                       # NextAuth-gated
│   │   ├── layout.tsx                 # sidebar shell
│   │   ├── dashboard/page.tsx
│   │   ├── leads/page.tsx             # inbox table
│   │   ├── leads/[id]/page.tsx        # detail
│   │   ├── approvals/page.tsx
│   │   ├── runs/page.tsx
│   │   ├── runs/[id]/page.tsx         # live SSE events
│   │   ├── settings/page.tsx
│   │   └── analytics/page.tsx
│   ├── api/auth/[...nextauth]/route.ts
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                            # ShadCN primitives
│   ├── marketing/                     # Hero, PricingTable, FeatureGrid, FAQ, FooterPublic
│   ├── admin/                         # Sidebar, Topbar, LeadTable, LeadDetailPanel,
│   │                                  #   AuditCard, EmailDraftCard, RunStatusList,
│   │                                  #   ApprovalCard
│   └── shared/                        # ThemeProvider, EmptyState, ErrorBoundary, Skeleton
├── lib/
│   ├── api.ts                         # Axios instance + auth interceptor (Phase UI-2)
│   ├── queryClient.ts                 # React Query config (Phase UI-2)
│   ├── auth.ts                        # NextAuth config
│   ├── mock/                          # Phase UI-1 mock fixtures
│   │   ├── leads.ts
│   │   ├── runs.ts
│   │   ├── emails.ts
│   │   └── analytics.ts
│   └── utils.ts                       # cn() + helpers
├── stores/                            # Zustand — UI state only (not server data)
│   ├── uiStore.ts
│   └── leadFilterStore.ts
├── hooks/                             # React Query hooks (Phase UI-2)
│   ├── useLeads.ts
│   ├── useRunPipeline.ts
│   ├── useApprovals.ts
│   └── useRunEvents.ts                # SSE hook
├── styles/
│   └── tokens.css                     # Inngest design tokens from Design.md
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

### Design System (from Design.md — Inngest-Inspired)

**Theme:** Dark — "Midnight Grid Console"

| Token | Value | Role |
|---|---|---|
| `--color-background-charcoal` | `#0c0a09` | Page bg, primary dark surfaces |
| `--color-surface-dark-gray` | `#1c1917` | Cards, inputs, elevated surfaces |
| `--color-text-white` | `#ffffff` | Primary headlines |
| `--color-text-light-gray` | `#f6f6f6` | Body text |
| `--color-text-medium-gray` | `#a89984` | Tertiary / captions |
| `--color-border-accent-gray` | `#44403c` | Subtle borders on dark |
| `--color-amber-glow` | `#cab16a` | **Single accent** — CTAs, active states |
| `--color-highlight-green` | `#59a569` | Success states |
| `--color-muted-red` | `#ea6962` | Error states |

**Typography:**
- Headlines → Whyte / Whyte Inktrap (substitute: Montserrat / Cabinet Grotesk)
- Body → CircularXX (substitute: Inter)
- Mono → CircularXXMono (substitute: Space Mono)

**Shapes:** Cards = `0px` radius. Buttons = `9999px` radius. Default = `4px`.

**Rules:**
- Amber Glow is the **only** accent — never introduce others
- No rectangular buttons — use `0px` (embedded) or `9999px` (pill)
- Shadows are always low-opacity (`rgba(0,0,0,0.05–0.1)`)

### Page Priority

| Priority | Pages |
|---|---|
| P0 | Landing, Pricing, Compare, Privacy, Terms, Contact, Admin Dashboard, Lead Inbox, Lead Detail, Approval Queue, Public Audit View |
| P1 | Pipeline Runs list + Detail, Settings |
| P2 | Analytics |

### Three-Phase UI Build

#### Phase UI-1 — Static (mock data, no backend)
- All marketing pages
- Complete admin dashboard shell with NextAuth
- All admin pages driven by mock fixtures
- Public audit page with mock data

#### Phase UI-2 — API Integration
- Axios client + React Query replacing all mock data
- Manual "Run Pipeline" modal connected to `POST /api/pipeline/run`
- Approval actions call real endpoints
- `useRunEvents(runId)` SSE hook for live run detail

#### Phase UI-3 — Polish
- Loading skeletons on every list/detail
- Toast system (sonner)
- Empty states + error boundaries per segment
- Analytics charts wired to real aggregations

---

## 6. Data Models (Prisma)

```prisma
model Lead {
  id           String      @id @default(cuid())
  publicId     String      @unique @default(cuid())  // /audit/[publicId]
  businessName String
  niche        String
  city         String
  country      String
  websiteUrl   String?
  phone        String?
  gmapsPlaceId String      @unique                   // dedup key
  score        Int                                   // 0–100
  status       LeadStatus  @default(DISCOVERED)
  discoveredAt DateTime    @default(now())
  audit        Audit?
  emails       Email[]
  run          PipelineRun? @relation(fields: [runId], references: [id])
  runId        String?
}

enum LeadStatus {
  DISCOVERED
  AUDITED
  EMAIL_DRAFTED
  PENDING_APPROVAL
  EMAIL_SENT
  REPLIED
  COLD
  SKIPPED
}

model Audit {
  id             String   @id @default(cuid())
  leadId         String   @unique
  lead           Lead     @relation(fields: [leadId], references: [id])
  pageSpeedScore Int?
  loadTimeMs     Int?
  hasSSL         Boolean
  hasMobileMeta  Boolean
  hasMetaTags    Boolean
  hasCTA         Boolean
  reviewSummary  Json     // { positives: [...], negatives: [...], avgRating, count }
  rawFindings    Json
  auditedAt      DateTime @default(now())
}

model Email {
  id             String       @id @default(cuid())
  leadId         String
  lead           Lead         @relation(fields: [leadId], references: [id])
  cadence        EmailCadence                  // DAY_0 | DAY_3
  subject        String
  body           String                        // 180-word limit enforced at write time
  wordCount      Int
  status         EmailStatus  @default(PENDING_APPROVAL)
  approvedBy     String?
  sentAt         DateTime?
  gmailMessageId String?
  createdAt      DateTime     @default(now())
}

enum EmailCadence { DAY_0 DAY_3 }
enum EmailStatus  { PENDING_APPROVAL APPROVED REJECTED SENT FAILED }

model PipelineRun {
  id           String    @id @default(cuid())
  prompt       String
  status       RunStatus @default(QUEUED)
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?
  leadsFound   Int       @default(0)
  leadsScored  Int       @default(0)
  leadsEmailed Int       @default(0)
  errorMessage String?
  events       RunEvent[]
  leads        Lead[]
}

enum RunStatus { QUEUED RUNNING SUCCEEDED FAILED }

model RunEvent {
  id        String      @id @default(cuid())
  runId     String
  run       PipelineRun @relation(fields: [runId], references: [id])
  agent     String      // SCOUT | ANALYST | WRITER | TRACKER | REPORTER
  level     String      // INFO | WARN | ERROR
  message   String
  payload   Json?
  createdAt DateTime    @default(now())
}

model Niche {
  id     String  @id @default(cuid())
  slug   String  @unique
  label  String
  active Boolean @default(true)
}

model Settings {
  id              String   @id @default("singleton")
  dailyQuota      Int      @default(3)
  targetNiches    String[]
  targetCountries String[]
  emailIdentity   String?
  updatedAt       DateTime @updatedAt
}

model MapsCache {
  placeId   String   @id           // Google Maps place_id
  payload   Json
  fetchedAt DateTime @default(now())
  expiresAt DateTime               // 30-day TTL
}
```

### Google Sheets Mirror Schema (append-only, one row per lead)

```
Date | Business Name | Niche | City | Score | Status | Email Sent | Reply | Notes | LeadId
```

### Scoring Reference

| Score | Meaning | Action |
|---|---|---|
| 0–30 | No website / completely broken | Contact immediately |
| 31–55 | Major issues (speed, SEO, UX) | Contact immediately |
| 56–75 | Some issues, clear opportunity | Free audit offer |
| 76–100 | Solid presence | Skip (no contact) |

---

## 7. Phased Execution Plan

| Phase | Goal | Key Output |
|---|---|---|
| **0 — Foundation** | Repo bootstrapping | tsconfig, prisma, .env.example, eslint, design tokens |
| **1 — UI-1 Static** | All admin + marketing pages with mock data | Fully clickable, navigable dashboard |
| **2 — Backend Skeleton** | Express + Prisma + DI + auth middleware | `GET /api/health` works, DB migrated |
| **3 — Core Pipeline** | Scout → Writer → Tracker (no Analyst yet) | First real lead generated end-to-end via CLI |
| **4 — UI-2 Integration** | Wire frontend to real API | Lead inbox shows real data, manual run button works |
| **5 — Intelligence** | Analyst agent (PageSpeed + reviews + Puppeteer) | Real audit scores + review sentiment |
| **6 — Approvals + Gmail** | Email approval queue + Gmail send | Click "Approve" → email actually sends |
| **7 — Automation** | Cron + follow-ups + reporter | Daily 9am pipeline, EOD summary email |
| **8 — UI-3 Polish + Public** | Skeletons, public audit page, analytics | Production-feel app |
| **9 — Sheets + Hardening** | Sheets mirror, Maps cache, rate limits, tests | Cost-controlled, observable, tested |

---

## 8. Task Breakdown

### Phase 0 — Foundation (~1 day)

- [ ] **0.1** Create root `tsconfig.base.json` (`strict: true`, `noImplicitAny`, `exactOptionalPropertyTypes`)
- [ ] **0.2** Expand `.gitignore` (node_modules, .env, .next, dist, prisma/migrations lock)
- [ ] **0.3** Create `main-project/backend/package.json` with scripts: `dev`, `build`, `start`, `lint`, `test`, `db:migrate`, `db:generate`, `db:studio`
- [ ] **0.4** Create `main-project/frontend/package.json` (Next.js 15 + Tailwind v4 + ShadCN)
- [ ] **0.5** Bootstrap Next.js into `main-project/frontend/`
- [ ] **0.6** Install ShadCN + generate components: `button card table input dialog sheet badge skeleton sonner`
- [ ] **0.7** Create `main-project/frontend/styles/tokens.css` with all CSS vars from Design.md
- [ ] **0.8** Configure `tailwind.config.ts` to map design tokens (colors, fonts, radii, shadows, spacing)
- [ ] **0.9** Root layout with Whyte/CircularXX font loading (Google Fonts substitutes: Montserrat + Inter)
- [ ] **0.10** Backend: `npm i` all deps; create `tsconfig.json`, `eslint.config.js`
- [ ] **0.11** Create `.env.example` for both backend and frontend
- [ ] **0.12** Create `main-project/backend/CLAUDE.md` and `main-project/frontend/CLAUDE.md`

### Phase 1 — UI-1 Static (~5–7 days)

#### 1A. Marketing Site
- [ ] **1.1** Marketing layout: sticky nav (logo + links + "Login" CTA pill), public footer
- [ ] **1.2** Landing hero (Whyte 72px headline, Amber Glow CTA pill, geometric abstract bg)
- [ ] **1.3** Landing "How it works" — 5-step pipeline visualization
- [ ] **1.4** Landing features grid + "Trusted by" logo strip
- [ ] **1.5** Pricing page (Starter / Pro / Agency tiers with comparison checklist)
- [ ] **1.6** Compare page (Sift.ai vs manual research vs Apollo vs ZoomInfo — feature table)
- [ ] **1.7** Privacy policy, Terms of service, Contact Us pages

#### 1B. Admin Shell + Auth
- [ ] **1.8** NextAuth `[...nextauth]/route.ts` (credentials + Google provider, env-driven)
- [ ] **1.9** `(admin)/layout.tsx`: collapsible icon sidebar + topbar + user avatar menu
- [ ] **1.10** Sidebar nav items: Dashboard / Leads / Approvals / Runs / Settings / Analytics
- [ ] **1.11** Auth gate: redirect unauthenticated `(admin)/*` requests to `/login`

#### 1C. Admin Pages (mock data)
- [ ] **1.12** Mock data fixtures: `lib/mock/leads.ts`, `runs.ts`, `emails.ts`, `analytics.ts`
- [ ] **1.13** Dashboard overview: 4 KPI cards (leads today, pending approvals, sent, reply rate) + recent runs + recent leads
- [ ] **1.14** Lead Inbox: table with score-coded badges, filters (score range, status multi-select, niche, search)
- [ ] **1.15** Lead Inbox: pagination + sortable column headers
- [ ] **1.16** Lead Detail: 3-column layout — business meta | audit findings + reviews | email draft preview
- [ ] **1.17** Lead Detail: action bar (Approve / Reject / Edit Email / Mark Cold)
- [ ] **1.18** Approval Queue: card grid of pending emails, inline edit, approve/reject buttons
- [ ] **1.19** Pipeline Runs list: status pill timeline, counters per run
- [ ] **1.20** Run Detail: event log list (mock), per-agent progress tracker
- [ ] **1.21** Settings: masked API keys form, daily quota input, target niches/countries multi-select
- [ ] **1.22** Analytics: funnel chart + reply rate over time + score distribution (recharts)

#### 1D. Public Audit Page
- [ ] **1.23** `/audit/[publicId]/page.tsx`: score circle, audit checklist, review highlights, "Book a call" CTA

### Phase 2 — Backend Skeleton (~2 days)

- [ ] **2.1** `prisma/schema.prisma` with all models from §6
- [ ] **2.2** `prisma migrate dev --name init` + generate client
- [ ] **2.3** `src/config/env.ts` zod-validated env loader (fails fast on missing keys)
- [ ] **2.4** `src/utils/logger.ts` (pino with secret redaction)
- [ ] **2.5** `src/interface/http/server.ts` Express with helmet, cors, compression, pino-http
- [ ] **2.6** `GET /api/health` → `{ ok: true, db: "up" }`
- [ ] **2.7** `src/config/container.ts` manual DI factory wiring
- [ ] **2.8** `src/interface/http/middleware/auth.ts` JWT verify middleware
- [ ] **2.9** `src/interface/http/middleware/errorHandler.ts` domain error → HTTP status mapping

### Phase 3 — Core Pipeline (~3 days)

- [ ] **3.1** Domain entities: `Lead`, `EmailDraft`, `PipelineRun` + value objects `LeadScore`, `EmailWordCount`
- [ ] **3.2** `IMapsService` port + `MapsService` adapter (Places text search + place details)
- [ ] **3.3** `MapsCache` repo (30-day TTL — Scout consults before billing API)
- [ ] **3.4** `DiscoverBusinesses` use-case (Scout): query → filter → dedupe by `gmapsPlaceId`
- [ ] **3.5** `ILLMProvider` port: `generate(systemPrompt, userPrompt, opts): Promise<string>`
- [ ] **3.6** `AnthropicAdapter` with prompt caching on system prompt (`@anthropic-ai/sdk`)
- [ ] **3.7** `GenerateOutreachEmail` use-case (Writer) — hard 180-word validator, retries once if over
- [ ] **3.8** `ILeadRepository` port + Prisma implementation
- [ ] **3.9** `LogLead` use-case (Tracker): persist Lead + Email as `PENDING_APPROVAL`
- [ ] **3.10** `RunPipeline` orchestrator: Scout → Analyst placeholder → Writer → Tracker; persists `PipelineRun` + `RunEvent`s
- [ ] **3.11** CLI script: `tsx src/cli/run-pipeline.ts "restaurants in Austin"` — end-to-end smoke test
- [ ] **3.12** Unit tests (vitest): word-count validator, score threshold logic, email structure
- [ ] **3.13** Routes: `POST /api/pipeline/run`, `GET /api/pipeline/runs`, `GET /api/leads`, `GET /api/leads/:id`

### Phase 4 — UI-2 Integration (~2 days)

- [ ] **4.1a** `lib/api/requests_helpers.ts` Axios instance with NextAuth session token interceptor
including all Request GET,POST,PATCH,DELETE,PUT

- [ ] **4.1b** `lib/api/urls_helpers.ts` Axios instance with NextAuth session token interceptor

- [ ] **4.2** `config/queryClient.ts` React Query with 30s stale time + `onError` toast
- [ ] **4.3** `hooks/useLeads.ts` (list query + detail query + status mutation)
- [ ] **4.4** `hooks/useRunPipeline.ts` (mutation + invalidate runs)
- [ ] **4.5** `hooks/useApprovals.ts` (list + approve/reject mutations)
- [ ] **4.6** Replace mock data on Lead Inbox + Detail pages with real hooks
- [ ] **4.7** "Run Pipeline" button → modal (prompt input) → `POST /api/pipeline/run` → success toast
- [ ] **4.8** Sonner toast setup for all success/error feedback

### Phase 5 — Intelligence — Analyst (~3 days)

- [ ] **5.1** `IPageSpeedService` port + `PageSpeedService` adapter
- [ ] **5.2** `Puppeteer PageCrawler` (headless, 10s timeout): SSL, meta, CTA, contact form, mobile meta detection
- [ ] **5.3** `AuditWebsite` use-case: crawl + PageSpeed → emit `Audit` row + calculated `LeadScore`
- [ ] **5.4** `AnalyzeReviews` use-case: pull Places reviews → LLM with prompt cache → `{positives, negatives, avgRating}`
- [ ] **5.5** Wire Analyst into `RunPipeline` between Scout and Writer; skip lead if `score > 75`
- [ ] **5.6** Update Writer prompt template to consume audit findings + review summary

### Phase 6 — Approvals + Gmail (~2 days)

- [ ] **6.1** `IEmailSender` port + `GmailService` OAuth adapter
- [ ] **6.2** `ApproveAndSendEmail` use-case: validate status → Gmail send → update `Email.status = SENT`
- [ ] **6.3** `POST /api/emails/:id/approve` + `POST /api/emails/:id/reject` routes
- [ ] **6.4** `GET /api/emails?status=pending_approval` + Approval Queue page API integration
- [ ] **6.5** Inline email body edit in approval card → save draft → approve → send

### Phase 7 — Automation (~2 days)

- [ ] **7.1** `DailyPipelineJob` cron `0 9 * * *` → calls `RunPipeline`
- [ ] **7.2** `FollowUpJob` cron `0 10 * * *` → queries leads with `EMAIL_SENT` and `sentAt <= now - 3d` → flags for Day-3 review
- [ ] **7.3** `SendDailySummary` use-case + `ReporterJob` cron `0 18 * * *`
- [ ] **7.4** `SSEEventBus` implementation + `GET /api/pipeline/runs/:id/events` endpoint
- [ ] **7.5** `hooks/useRunEvents(runId)` SSE hook → live update Run Detail page
- [ ] **7.6** Mark leads `COLD` if no reply after 7 days (FollowUpJob handles)

### Phase 8 — UI-3 Polish + Public Audit (~2 days)

- [ ] **8.1** `GET /api/public/audit/:publicId` endpoint (no auth, public)
- [ ] **8.2** Wire `/audit/[publicId]` page to real data
- [ ] **8.3** Loading skeletons on every list + detail page
- [ ] **8.4** Empty states + error boundaries on every route segment
- [ ] **8.5** Analytics page wired to real aggregation endpoints

### Phase 9 — Sheets Mirror + Hardening (~2 days)

- [ ] **9.1** `ISheetsSync` port + `SheetsService` adapter — append row after each `LogLead`
- [ ] **9.2** `express-rate-limit` on public routes (10 req/min/IP) + admin routes (60 req/min)
- [ ] **9.3** Token-bucket rate limiter for Maps API (200/day hard cap with safety buffer)
- [ ] **9.4** Vitest integration tests for `RunPipeline` happy path + error path
- [ ] **9.5** Playwright e2e: login → run pipeline → approve email → verify in inbox
- [ ] **9.6** README + local dev setup guide + deployment notes for EC2

---

## 9. Timeline

| Week | Phases | Deliverable |
|---|---|---|
| **Week 1** | 0 + 1A + 1B | Foundation done; marketing site live locally; admin shell with NextAuth |
| **Week 2** | 1C + 1D + start 2 | All admin pages with mock data; public audit page; backend skeleton |
| **Week 3** | 2 + 3 + 4 | Backend live; pipeline runs real leads end-to-end; UI shows real data |
| **Week 4** | 5 + 6 + 7 | Audit scoring + approvals + Gmail send + daily cron = **MVP SHIPPED** |
| **Week 5+** | 8 + 9 | Polish, Sheets mirror, hardening, analytics, public audit |

---

## 10. Scaling Plan

| Bottleneck | When it Hits | Upgrade Path |
|---|---|---|
| Sequential pipeline blocks event loop | >10 leads/day | Replace `RunPipeline` with **BullMQ + Redis** queue (one job per agent step) |
| Maps API free tier (200/day) | Scaling beyond 3/day | Move to billed tier; tighten `MapsCache` TTL to 90 days |
| Puppeteer cold start latency | >5 audits parallel | Pool of 3 reusable browser contexts; warm on startup |
| LLM cost | High volume | Switch to Anthropic Message Batches API; raise prompt-cache hit rate via system-prompt optimization |
| Postgres on t3.micro | >100k leads | Migrate to RDS / Supabase; add composite index on `(status, score, niche)` |
| Single server | Team grows | Split into API server + Worker server (BullMQ consumer) |
| Sheets API rate | >10 appends/min | Switch from per-row append to batched daily snapshot |

**t3.micro carries you to ~30 leads/day comfortably. Beyond that: add Redis + bump to t3.small.**

---

## 11. Best Practices

### Security
- All secrets validated by zod on boot — crash if missing
- Never log API keys or full email bodies (pino `redact` config)
- `publicId` uses `cuid()` (unguessable) — separate from internal DB `id`
- NextAuth HTTP-only secure cookies; backend verifies signed JWT
- `helmet` + strict CORS allowlist (admin origin only)
- `/api/public/*` rate-limited aggressively (10 req/min/IP)

### Cost Optimization
- `MapsCache` (30-day TTL) — never bill Maps API twice for the same business
- Anthropic prompt caching on Writer + Analyst system prompts
- PageSpeed + Maps results stored at lead level; re-run only on explicit "re-audit" action
- Cron jobs at fixed times only — no polling loops
- If Scout finds no businesses for the prompt, skip Analyst + Writer entirely

### LLM Provider Abstraction
- All calls go through `ILLMProvider` port
- Current impl: `AnthropicAdapter` (claude-sonnet-4-6)
- To add OpenAI: implement `OpenAIAdapter`, register in `container.ts` — zero domain changes
- Cost tracking happens at the port boundary so you can compare cost per lead per provider

### Logging & Observability
- Structured pino logs with `runId` + `leadId` correlation fields
- Every agent action emits a `RunEvent` row — audit trail + SSE source
- Frontend error boundaries per route segment
- `/api/health` checks DB liveness on every call

### Code Quality
- TypeScript `strict: true`, `noImplicitAny` across both apps
- Domain layer has zero framework imports — testable with plain Node
- Use-cases tested with vitest using in-memory repository fakes
- Every external API response validated with zod before entering the domain

---

## 12. Open Items

These don't block Phase 0, but must be decided before the relevant phase:

| Item | Needed By | Options |
|---|---|---|
| NextAuth provider | Phase 1B (task 1.8) | Google OAuth / GitHub / Email magic link |
| Email sending identity | Phase 6 (task 6.1) | Personal Gmail OAuth / dedicated workspace account |
| Pricing tier names + prices | Phase 1A (task 1.5) | Placeholder OK, or specify Starter/Pro/Agency pricing |
| Brand name on landing | Phase 1A (task 1.2) | "Sift.ai" confirmed? |

---

*Sift.ai Master Plan — Confidential. Built with Claude Sonnet 4.6.*  
*Last updated: 2026-05-05*
