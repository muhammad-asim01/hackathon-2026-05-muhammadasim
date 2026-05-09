# sift.ai

## What it is (1 sentence)
An AI-powered lead engine that scans OpenStreetMap for local businesses with weak digital presence, scores them 0–100 automatically, drafts 180-word personalized outreach emails, and manages the full pipeline from discovery to approval — all behind a secure multi-auth admin dashboard.

## Track
[ ] Internal Tool   [ ] Fintech Mini-App   [ ] Crypto/Web3   [x] Free-form

## Target user (1 sentence)
Solo digital agency operators and freelancers who earn by improving local businesses' online presence and need a steady pipeline of warm prospects without manual prospecting.

## The user's job-to-be-done (1 sentence)
Discover qualified local business leads, automatically audit their digital presence, generate personalized outreach emails, and manage the entire pipeline from discovery to send — without spending hours on Google Maps and mail merge.

## Must-have features (delivered)

1. **Authentication System** — email/password registration + login, Google OAuth, dev bypass; NextAuth v5 with JWT; signup → login redirect with success banner; dashboard protected against back-button cache bypass
   - Acceptance criteria: ✅ Register → Login → Dashboard flow works; Google OAuth syncs user to DB; logout clears session and blocks dashboard access

2. **Scout Agent** — queries OSM Nominatim + Overpass API to find local businesses by niche and city; geocoding fixed (featuretype param removed, smart city-type candidate selection)
   - Acceptance criteria: ✅ Returns ≥ 5 real businesses for any valid niche + city pair within 60 s

3. **Analyst Agent** — crawls the website via Playwright (Python sidecar) + PageSpeed Insights, scores 0–100; businesses scoring > 75 are auto-skipped
   - Acceptance criteria: ✅ Score appears on lead detail within 90 s; high-score leads never enter outreach queue

4. **Writer Agent** — Groq `openai/gpt-oss-20b` (Responses API) drafts a 180-word email referencing a real website finding; bracket-finding JSON extractor handles reasoning-model output
   - Acceptance criteria: ✅ Draft is ~180 words, cites ≥ 1 specific audit finding; falls back to Anthropic Claude Sonnet 4.6 if Groq unavailable

5. **Approval Queue** — holds every email draft before send; one-click approve or discard; optimistic UI updates
   - Acceptance criteria: ✅ Zero emails leave the system without explicit sign-off; card resolves immediately on click

6. **Live Pipeline Dashboard** — SSE stream shows Scout → Analyst → Writer → Tracker progress in real time; dedup via Set, 200ms poll interval, ?token= auth fallback for EventSource
   - Acceptance criteria: ✅ Agent steps update on screen without a page refresh; 10-min max connection timeout

## Delivered nice-to-haves

- ✅ **Public shareable audit report page** — prospect-facing URL `/audit/[publicId]`, no auth required, server-rendered
- ✅ **Analytics page** — lead volume by niche, score distribution funnel, reply rate, niche breakdown (Recharts)
- ✅ **Settings page** — configurable daily email send limit, API key fields, pipeline parameters
- ✅ **Google OAuth → DB sync** — `events.signIn` fire-and-forget sync to `/api/auth/google-sync` internal endpoint; Google users auto-granted ADMIN role
- ⬜ Google Sheets auto-sync — scaffolded (Tracker Agent), mock adapter in dev

## Tech stack

- **Backend:** Node.js 22 + TypeScript 5 (strict, zero `any`) + Express 5
- **Database:** PostgreSQL 16 via Prisma 6 (hosted on Neon)
- **Frontend:** Next.js 15 App Router + Tailwind CSS v4 + ShadCN UI
- **Auth:** NextAuth v5 — Google OAuth + email/password (bcryptjs 12 rounds) + dev bypass
- **Python sidecar:** FastAPI + Playwright Chromium (headless) — website crawl + audit extraction (port 8001)
- **LLM chain:** Groq `openai/gpt-oss-20b` (primary, Responses API) → Anthropic Claude Sonnet 4.6 (fallback)
- **Platform features:** Server-Sent Events (real-time pipeline); Playwright headless Chromium (website crawl); JWE/JWT session tokens
- **Hosting:** Vercel (frontend) + Railway (Node API + Python sidecar) + Neon (PostgreSQL)

## Architecture (5 lines max)

Five-agent pipeline (Scout → Analyst → Writer → Tracker → Reporter) orchestrated by a single `RunPipeline` use-case in Clean Architecture layers (Domain → Application → Infrastructure → Interface). Each agent is an isolated use-case; agents never call each other — the orchestrator wires them in sequence. Every step writes a `RunEvent` row streamed to the frontend via a long-lived SSE endpoint (`?token=` auth fallback for EventSource). The admin frontend uses TanStack Query for async state and Zustand for UI state; the public audit report is a server-rendered Next.js page with no auth. Auth uses NextAuth v5 with credentials + Google OAuth; the Express API validates JWTs via shared `NEXTAUTH_SECRET`; Google sign-ins fire-and-forget sync to a protected internal endpoint.

## Deployed URLs

| Service | URL |
|---|---|
| Frontend (admin + public) | https://saftai.vercel.app |
| Backend API | https://hackathon-2026-05-muhammadasim-production.up.railway.app |
| Python Scraper | https://python-scraper-production.up.railway.app (Railway internal) |
| Health check | `GET /api/health` → `{"status":"ok"}` |

## Out of scope
- Automated email sending — approval is always required, emails never auto-fire
- Multi-user / team workspaces — single admin session only
- Mobile native app — responsive web only
- Real Google Sheets OAuth — Tracker agent uses mock adapter in dev/prod

## Risks and mitigations

1. **OSM data sparsity** — some niche + city pairs return 0 results; mitigated by Nominatim free-text fallback, smart city-type candidate selection, graceful empty-state UI
2. **Playwright memory on Railway** — headless Chromium needs 500 MB+; mitigated by fresh browser per crawl + `finally` cleanup + sequential concurrency cap (3 max); Python sidecar runs in its own Railway service
3. **Demo environment latency** — PageSpeed + OSM calls are slow on cold runs; mitigated by pre-seeded DB for demo day so judges see full data instantly; live run is optional bonus
4. **Reasoning model JSON output** — Groq `openai/gpt-oss-20b` wraps JSON in prose; mitigated by bracket-finding extractor + system prompt `OUTPUT FORMAT — CRITICAL` constraint
5. **Railway cold starts** — Python sidecar has 120s health check timeout; mitigated by `railway.toml` health check config + `ON_FAILURE` restart policy (10 retries)

## How I'll demo it (5 minutes)

1. **Sign in** — Open `https://saftai.vercel.app/login` → sign in with Google → land on Dashboard showing live KPI tiles (leads discovered, emails drafted, approval rate)
2. **Run the pipeline** — Open Agent panel → type `"dentist in Austin TX"` → click Run → watch the live SSE terminal update step by step: Scout finds businesses → Analyst scores them → Writer drafts emails
3. **Approve an email** — Open Approval Queue → show the AI-drafted 180-word email with the real website finding cited → approve it with one click → card resolves instantly (optimistic update)
4. **Show the public report** — Open the Lead detail → copy the public audit URL → open in an incognito tab (no auth) to show what the prospect sees: full digital audit with score, findings, and recommendations
5. **Show analytics** — Open Analytics page → funnel chart showing Scout → Analyst → Writer conversion, score distribution histogram, niche breakdown — all live data from this run

## Demo data (pre-seeded)
`npx prisma db seed` populates: 15 leads across 5 niches, 3 pipeline runs (1 complete, 1 in-progress, 1 failed), 6 email drafts (3 pending, 2 approved, 1 rejected), realistic score distribution (5 leads ≤ 55, 4 leads 56–75, 6 leads > 75 auto-skipped).
