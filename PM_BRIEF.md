# PM Brief — sift.ai

> **Project:** sift.ai · **Owner:** Muhammad Asim · **Demo:** Mon May 11, 2026
> **Status as of May 9, 2026:** All systems live. Full pipeline functional end-to-end.

---

## What Is This?

sift.ai is an AI-powered lead generation engine for digital agencies. It scans OpenStreetMap for local businesses with weak online presence, scores them 0–100, drafts 180-word personalized outreach emails, and manages the entire outreach pipeline from discovery to approval — behind a secure admin dashboard.

**The core loop:**
1. Operator enters a niche + city (e.g., "plumbers in Austin")
2. Scout agent finds 5–20 businesses from OSM/Overpass
3. Analyst agent crawls each website via PageSpeed + Playwright, scores them
4. Writer agent drafts a personalized email referencing a real audit finding
5. Operator approves or rejects each draft in the Approval Queue
6. Sent emails are tracked; follow-up cadence auto-managed (Day 0 → 3 → 7)

---

## Target User

Solo digital agency operators and freelancers who earn by improving local businesses' online presence. They need a steady pipeline of warm prospects without spending hours on Google Maps + manual mail merge.

**Pain being solved:** Prospecting takes 3–5 hours/day manually. sift.ai reduces it to 10 minutes.

---

## Scope (Hackathon)

| Category | In Scope | Out of Scope |
|---|---|---|
| Auth | Email/password + Google OAuth | Team workspaces, SSO |
| Discovery | OSM Nominatim + Overpass API | Google Maps API (paid) |
| Audit | PageSpeed + Playwright crawl | Full SEO audit suite |
| Email | AI-drafted, human-approved | Auto-send, scheduling |
| Pipeline | SSE real-time stream | Background job queue |
| Tracking | Google Sheets (mock) | CRM integrations |
| Reporting | Daily digest (mocked) | Analytics exports |
| Platform | Web admin + public audit report | Mobile native app |

---

## Milestones Delivered

| Date | Milestone | Status |
|---|---|---|
| May 6 | Clean Architecture backend scaffold, Prisma schema, all 5 agents stubbed | ✅ |
| May 7 | OAuth CRLF production fix, 13 CLAUDE.md context files, Notion workspace | ✅ |
| May 8 | Pipeline agents functional (Scout/Analyst/Writer), Phase 1C QA pass | ✅ |
| May 9 | Full auth system (signup/login/OAuth), Railway python-scraper deployed | ✅ |
| May 10 | Final polish, pre-seed demo DB, demo script rehearsal | 🔜 |
| May 11 | **Demo Day** | 🔜 |

---

## Live URLs

| Service | URL |
|---|---|
| Frontend (admin + public) | https://saftai.vercel.app |
| Backend API | https://hackathon-2026-05-muhammadasim-production.up.railway.app |
| Health check | `GET /api/health` → `{"status":"ok"}` |
| Notion hub | https://www.notion.so/sift-ai-Hackathon-Hub-359c2c19ff1581098dd4d933a7c26962 |

---

## Key Metrics (Demo Day Targets)

| Metric | Target |
|---|---|
| Leads discovered per run | ≥ 5 real businesses |
| Scout latency | < 60 s |
| Analyst latency | < 90 s per lead |
| Email draft quality | ~180 words, ≥ 1 specific audit finding cited |
| Zero auto-sends | 100% — every email requires explicit approval |
| Auth | Login + Google OAuth both functional in prod |

---

## Budget Summary

| Day | Spend | Notes |
|---|---|---|
| Thu May 7 | $38 | Architecture + OAuth diagnosis + 13 CLAUDE.md files |
| Fri May 8 | ~$22 | Pipeline agent fixes + Phase 1C QA |
| Sat May 9 | ~$35 | Auth system + E2E QA + Railway deployment |
| **Total** | **~$95** | Remaining budget: ~$205 vs $300 cap |

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| OSM returns 0 results for demo niche | Low | Pre-seed DB with 20 leads for demo day |
| Railway cold start (Python sidecar) | Medium | Health-check warmup script before demo |
| Groq API rate limit mid-demo | Low | Anthropic fallback auto-triggers |
| PageSpeed quota on demo day | Low | 25k/day cap — well within range |
| Live pipeline latency impression | Medium | Show pre-run leads first, run live as a bonus |
