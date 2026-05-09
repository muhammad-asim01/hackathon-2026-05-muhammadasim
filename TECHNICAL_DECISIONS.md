# Technical Decisions — sift.ai

> Rationale for key architectural and technology choices made during the hackathon.
> Last updated: May 9, 2026

---

## 1. Clean Architecture for a 3-day Hackathon

**Decision:** Use Clean Architecture (Domain / Application / Infrastructure / Interface) instead of a flat Express MVC.

**Why:** The agent pipeline has 5 distinct processing stages, each needing to call different external APIs (OSM, PageSpeed, Groq, Playwright, Gmail, Sheets). Clean Architecture isolates each external service behind an IPort interface, making it easy to:
- Swap adapters (e.g., MockLLMAdapter → GrokAdapter → AnthropicAdapter) without touching business logic
- Test use-cases with fake repos without mocking real databases
- Prevent "accidental coupling" — routes never skip to infrastructure directly

**Trade-off:** More boilerplate upfront (3 extra files per use-case). Paid off by Day 2 when the GrokAdapter needed a full rewrite — zero changes to use-case layer.

---

## 2. Python Sidecar for Web Scraping (not Node.js)

**Decision:** Website crawling and audit extraction runs in a separate FastAPI service (port 8001), not inside the Node.js API.

**Why:**
- Playwright for Python is the best-supported headless browser library. The Node Playwright bindings are fine but Python's ecosystem (BeautifulSoup, lxml, screenshot diffing) is richer for scraping.
- Isolates Chromium memory (~500 MB peak per crawl) from the Node.js API process. A memory spike in the scraper can't crash the API.
- Allows independent Railway deployment and scaling.

**Trade-off:** Two services to deploy and keep in sync. Mitigated by Railway deploying both in the same project.

**Rule enforced:** Node.js only calls Python via HTTP through `PythonScraperAdapter`. Never import Python modules from Node or vice versa. `PYTHON_SCRAPER_URL` env var controls the endpoint.

---

## 3. Groq Responses API as Primary LLM (Anthropic as Fallback)

**Decision:** Use Groq `openai/gpt-oss-20b` via the `/v1/responses` endpoint as the primary Writer agent model, with Anthropic Claude Sonnet 4.6 as fallback.

**Why:**
- Groq's inference is 3–5× faster than Anthropic at the same quality tier — critical for a pipeline that drafts emails for 10+ leads per run.
- The Responses API is the correct endpoint for `openai/gpt-oss-20b` (it's a reasoning model). Using `/v1/chat/completions` returns an empty response.
- Anthropic fallback ensures demos never silently fail if Groq is unavailable.

**Key gotcha:** `openai/gpt-oss-20b` is a reasoning model — it wraps JSON output in prose. Required a bracket-finding JSON extractor (`parseEmailJson`) rather than direct `JSON.parse(raw)`.

---

## 4. SSE for Real-Time Pipeline Updates (not WebSockets)

**Decision:** Use Server-Sent Events for streaming pipeline progress, not WebSockets.

**Why:**
- SSE is unidirectional (server → client), which is all the pipeline needs.
- No extra library — Express can serve `text/event-stream` natively.
- HTTP/1.1 compatible, works through Vercel reverse proxy and Railway without upgrade negotiation.
- Automatic reconnect built into the browser `EventSource` API.

**Trade-off:** SSE doesn't support custom request headers, so `Authorization: Bearer` can't be used. Worked around with a `?token=` query parameter that the middleware validates identically.

---

## 5. NextAuth v5 with Dual Providers (Credentials + Google)

**Decision:** Use NextAuth v5 for auth with both email/password (Credentials) and Google OAuth providers.

**Why:**
- Single source of truth for session state on the frontend.
- NextAuth v5's JWT callback lets us embed custom claims (role) in the token without a DB round-trip per request.
- Google OAuth is the main "wow" factor for a demo — judges can log in with their Google account immediately.

**Key decisions within auth:**
- Signup → redirects to `/login` with success banner, never auto-signs-in. Prevents confusion between "account created" and "you are now logged in."
- Google sign-in fires `events.signIn` (fire-and-forget, non-blocking) instead of `callbacks.signIn` (which would block login on DB failure).
- Dashboard layout exports `force-dynamic` + calls `auth()` to prevent cached HTML serving a stale session after logout.

---

## 6. Prisma 6 + Neon PostgreSQL (not an ORM-less approach)

**Decision:** Use Prisma as the ORM with Neon serverless PostgreSQL.

**Why:**
- Prisma's type-safe query builder eliminates raw SQL strings (per the never-do list).
- Neon's serverless PostgreSQL scales to zero between demo sessions — zero idle cost.
- Prisma migrations generate a full audit trail of schema changes.

**Rule enforced:** Prisma Client is only instantiated inside `infrastructure/persistence/`. Use-cases never import it directly. This is enforced by the Clean Architecture layer rule.

---

## 7. TanStack Query for Server State + Zustand for UI State (Strict Separation)

**Decision:** TanStack Query manages all async/server data. Zustand manages UI-only state (filters, modals, sidebar). Never cross the boundary.

**Why:**
- TanStack Query's caching, background refetch, and optimistic updates handle all the patterns needed (lead table, approval queue, pipeline status) without custom reducer boilerplate.
- Zustand for UI state prevents "ghost rerenders" — filter state changes don't invalidate server cache.

**The rule:** If it comes from an API, it lives in React Query. If it only exists in the browser session (sidebar open/closed, active modal), it lives in Zustand.

---

## 8. No Framer Motion — CSS Keyframes Only

**Decision:** All animations use CSS keyframes defined in `globals.css`, not Framer Motion.

**Why:** Framer Motion is not installed and is explicitly banned (per CLAUDE.md). The project already has `lp-slide-up`, `lp-fade-in`, and `lp-glow-pulse` keyframes covering all animation needs.

**Trade-off:** Less expressive than Framer Motion for complex gesture-based animations. Not needed for a dashboard product.

---

## 9. Sentry for Error Monitoring (not just logs)

**Decision:** Integrate Sentry for backend error tracking alongside Pino structured logging.

**Why:**
- Pino logs go to Railway's log drain — useful for debugging but requires manual searching.
- Sentry surfaces unhandled errors with full stack traces, request context, and user context in a searchable UI.
- `instrument.ts` is imported before everything else in `server.ts` to ensure all errors are captured, including startup errors.

---

## 10. Lead Score Threshold — Hard Cut at 75

**Decision:** Leads scoring > 75 are silently skipped; never enter the outreach queue.

**Why:** A business scoring > 75 has a reasonably strong digital presence — they are not a good prospect for digital agency outreach. Contacting them wastes the operator's time and risks sending irrelevant emails. The 0–75 range is further split: 0–55 = immediate outreach; 56–75 = offer free audit.

**Impact:** ~20–30% of discovered leads are typically skipped at the Analyst stage, keeping the Approval Queue focused.
