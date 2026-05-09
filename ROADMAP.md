# Post-Hackathon Roadmap — sift.ai

> Created: May 9, 2026 · Demo: May 11, 2026
> This document covers what comes after the hackathon MVP — making sift.ai shippable as a real product.

---

## Current State (Hackathon MVP)

All core features are live and functional:
- ✅ 5-agent pipeline (Scout → Analyst → Writer → Tracker → Reporter)
- ✅ Full auth (email/password + Google OAuth)
- ✅ Approval queue with optimistic UI
- ✅ Real-time SSE pipeline dashboard
- ✅ Public shareable audit report pages
- ✅ Analytics dashboard (Recharts)
- ✅ Deployed: Vercel + Railway + Neon

Known stubs (won't break demo, but not production-ready):
- ⬜ Google Sheets sync is mocked
- ⬜ Reporter digest email is mocked
- ⬜ Subscription tier limits are UI-only (no server-side enforcement)
- ⬜ Email SMTP not wired (drafts approved but not sent)

---

## Phase 1 — Production Hardening (Week 1–2 post-demo)

### 1.1 Features

- [ ] **Real email sending** — wire Gmail SMTP adapter; connect approved drafts to actual send flow; respect `dailySendLimit` from Settings
- [ ] **Google Sheets OAuth** — replace MockSheetsAdapter with real OAuth2 flow; allow operators to sync leads to their own Sheet
- [ ] **Follow-up cadence** — auto-schedule Day 3 and Day 7 follow-ups based on initial send date; mark cold after Day 7 no-reply
- [ ] **Bulk approve** — checkbox select + "Approve all" in Approval Queue; critical for high-volume runs

### 1.2 Security

- [ ] **Server-side subscription gate** — today plan limits are UI-only; add middleware in `requireAuth` that checks `User.plan` and rejects requests that exceed limits
- [ ] **Rate limiting** — add `express-rate-limit` per IP + per authenticated user on all `/api/*` routes
- [ ] **Secrets rotation** — rotate all API keys committed to Railway env before public launch; audit `.env.example` for leaked defaults
- [ ] **SSRF protection** — validate `PYTHON_SCRAPER_URL` at startup; reject crawl targets that resolve to RFC 1918 addresses
- [ ] **CSP audit** — tighten `Content-Security-Policy` beyond current PostHog patch; add `report-uri` for violation monitoring
- [ ] **Input sanitization** — all user-supplied strings (niche, city, email content) pass through Zod at the route boundary; confirm no raw interpolation into OSM or Playwright calls

### 1.3 Database

- [ ] **Indexes** — add composite indexes on `Lead(status, score)`, `Email(leadId, cadence)`, `RunEvent(runId, createdAt)` — queries on these columns are unbounded today
- [ ] **Pagination on all list queries** — `RunEvent` rows can grow unbounded per run; enforce cursor-based pagination in the SSE query loop
- [ ] **Soft deletes** — add `deletedAt` to `Lead` and `Email`; never hard-delete (needed for audit trail and follow-up cadence logic)
- [ ] **MapsCache TTL enforcement** — cron job to purge expired `MapsCache` rows (TTL check exists in code; cleanup job does not)
- [ ] **Connection pooling** — configure Prisma connection pool size for Railway's Railway shared instances; default pool is too large for Neon's free tier

### 1.4 QA

- [ ] **Expand Playwright suite** — current suite covers happy paths; add: failed login, wrong password, pipeline run with 0 results, approval reject flow, Settings save
- [ ] **Load test** — 10 concurrent pipeline runs; verify SSE broadcast doesn't starve the DB connection pool
- [ ] **Seed data coverage** — add seed data for edge cases: 0-score lead, max-score lead, expired email cadence, no-website lead
- [ ] **E2E CI gate** — Playwright suite currently runs manually; add to GitHub Actions on PR to `main`

### 1.5 Monitoring

- [ ] **Sentry source maps** — upload TypeScript source maps to Sentry at build time so stack traces map to `.ts` not `.js`
- [ ] **Uptime monitoring** — add Railway health check ping to UptimeRobot (or Sentry Crons) for both Node API and Python sidecar
- [ ] **PostHog events** — instrument key conversion events: run triggered, lead approved, email sent, user signed up
- [ ] **Cost alerting** — Railway + Neon + Groq + Anthropic budget alerts; hard-cap Railway spend at $50/month
- [ ] **Error rate dashboard** — Sentry project-level alert: > 5% error rate on any route triggers PagerDuty/Slack ping

---

## Phase 2 — Growth Features (Month 1–2)

- [ ] **Multi-user / team workspaces** — per-user lead ownership, invite flow, role-based access (ADMIN / MEMBER)
- [ ] **Email template library** — save and reuse Writer agent prompts per niche; operators build a library of high-converting angles
- [ ] **CRM integrations** — replace mocked Sheets adapter with real HubSpot / Pipedrive / Airtable connections via OAuth
- [ ] **Audit report white-labeling** — operators can set their agency name + logo on the public `/audit/[publicId]` page
- [ ] **Billing** — Stripe integration; free tier (50 leads/month) → Pro ($49/month, 500 leads) → Agency ($149/month, unlimited)
- [ ] **Mobile-responsive approval queue** — operators want to approve drafts from their phone on the go

---

## Phase 3 — Platform (Month 3+)

- [ ] **Background job queue** — replace SSE-poll loop with BullMQ + Redis; pipeline runs become durable jobs, not in-memory processes
- [ ] **Webhook integrations** — fire webhooks on lead scored / email approved / email bounced → operator's existing workflow tools
- [ ] **Public API** — REST API for programmatic lead discovery; enables power users to embed sift.ai in their own tooling
- [ ] **Reply tracking** — inbound email parsing (Gmail webhook) to detect replies; auto-advance lead status from `contacted` to `replied`

---

## Non-Goals (Permanent)

- Automated email sending without human approval (legal + deliverability risk)
- Real-time Google Maps scraping (Terms of Service violation; OSM is the correct data source)
- Full SEO audit (out of scope; PageSpeed + Playwright crawl covers the 20% that drives 80% of the pitch)
