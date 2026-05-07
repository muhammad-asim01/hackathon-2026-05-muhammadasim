# sift.ai

## What it is (1 sentence)
An AI-powered lead engine that scans OpenStreetMap for local businesses with weak digital presence, scores them 0–100 automatically, and drafts 180-word personalized outreach emails that wait in an approval queue before anything ever sends.

## Track
[ ] Internal Tool   [ ] Fintech Mini-App   [ ] Crypto/Web3   [x] Free-form

## Target user (1 sentence)
Solo digital agency operators and freelancers who earn by improving local businesses' online presence and need a steady pipeline of warm prospects without manual prospecting.

## The user's job-to-be-done (1 sentence)
Discover qualified local business leads, generate personalized outreach emails, and manage the entire pipeline from discovery to send — without spending hours on Google Maps and mail merge.

## Must-have features (3–5, no more)
1. **Scout Agent** — queries OSM Nominatim + Overpass API to find local businesses by niche and city — acceptance criteria: returns ≥ 5 real businesses for any valid niche + city pair within 60 s
2. **Analyst Agent** — crawls the website via Playwright + PageSpeed Insights, scores 0–100 — acceptance criteria: score appears on lead detail within 90 s; businesses scoring > 75 are auto-skipped and never emailed
3. **Writer Agent** — Claude Sonnet 4.6 drafts a 180-word email referencing a real review excerpt and a named website issue — acceptance criteria: draft is exactly 180 words, cites ≥ 1 specific audit finding
4. **Approval Queue** — holds every email draft before send — acceptance criteria: one-click approve or discard; zero emails leave the system without explicit sign-off
5. **Live Pipeline Dashboard** — SSE stream shows Scout → Analyst → Writer → Tracker progress in real time — acceptance criteria: agent steps update on screen without a page refresh

## Nice-to-have (won't block demo)
- Public shareable audit report page (prospect-facing URL, no auth required)
- Google Sheets auto-sync for approved leads
- Analytics page: lead volume by niche, score distribution funnel, conversion rate

## Tech stack
- Backend: Node.js 22 + TypeScript 5 (strict) + Express 5
- DB: PostgreSQL 16 via Prisma 6
- Frontend: Next.js 15 App Router + Tailwind CSS v4 + ShadCN UI
- Auth: NextAuth v5 (Google OAuth + dev bypass for local)
- Platform-specific feature: Server-Sent Events (real-time pipeline status); Playwright headless Chromium (website crawl)

## Architecture (5 lines max)
Five-agent pipeline (Scout → Analyst → Writer → Tracker → Reporter) orchestrated by a single `RunPipeline` use-case in Clean Architecture layers. Each agent is an isolated use-case; agents never call each other — the orchestrator wires them in sequence. Every step writes a `RunEvent` row that is streamed to the frontend via a long-lived SSE endpoint. The admin frontend uses TanStack Query for async state and Zustand for UI state; the public audit report is a server-rendered Next.js page with no auth. Single Node process — no message queue in Phase 1.

## Out of scope
- Automated email sending — approval is always required, emails never auto-fire
- Multi-user / team workspaces — single admin session only
- Mobile native app — responsive web only

## Risks I see
1. **OSM data sparsity** — some niche + city pairs return 0 results; mitigated by Nominatim free-text fallback and graceful empty-state UI
2. **Playwright memory on free VPS** — headless Chromium needs 500 MB+; mitigated by fresh browser per crawl + `finally` cleanup + sequential concurrency cap (3 max)
3. **Demo environment latency** — PageSpeed + OSM calls are slow on cold runs; mitigated by pre-seeded DB for demo day so judges see full data instantly; live run is optional bonus

## How I'll demo it (3 lines)
1. Open the Agent panel → type "dentist in Austin TX" → click Run → watch the live terminal update step by step as each agent completes
2. Open the Approval Queue → show the AI-drafted email with the real review citation → approve it with one click
3. Open the Lead detail for that business → copy the public audit report URL → open it in a new tab to show what the prospect sees
