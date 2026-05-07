# Sift.ai

> AI-Powered Local Business Lead Generation & Client Acquisition Engine

---

## What Is Sift.ai?

Sift.ai is an automated outreach system built for digital agencies and freelancers. It discovers local businesses worldwide that have a weak online presence, performs a full digital audit, analyzes their Google reviews, and generates a deeply personalized outreach email — all logged automatically to a Google Sheet CRM.

**One sentence:** Find struggling businesses, understand their exact problems, send the right email, win the client.

---

## The Pipeline

```
User Prompt
    │
    ▼
Scout Agent         ← Google Maps + Google Search
    │
    ▼
Analyst Agent       ← Website crawl + PageSpeed + Review sentiment
    │
    ▼
Writer Agent        ← Claude Sonnet → Personalized email
    │
    ▼
Tracker Agent       ← Google Sheets CRM log
    │
    ▼
Reporter Agent      ← End-of-day email summary
```

---

## Core Problem

- 400M+ small businesses globally — 70% have broken or missing online presence
- Agency owners spend hours manually searching for leads with no system
- Generic cold emails get < 2% reply rates
- No tool combines: discovery + audit + review analysis + personalized email + CRM in one pipeline

---

## Solution

A daily automated pipeline that:
1. **Finds** 3 businesses/day with weak digital presence via Google Maps
2. **Audits** their website (speed, SEO, mobile, SSL, UX) — scores 0–100
3. **Reads** their Google reviews — extracts what customers love and hate
4. **Writes** a 180-word personalized email referencing specific findings
5. **Logs** everything to Google Sheets with follow-up dates
6. **Reports** daily summary to the team

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + TypeScript |
| Architecture | Clean / Modular |
| AI Engine | Claude Sonnet 4.6 (Anthropic API) |
| Business Discovery | Google Maps Places API |
| Website Audit | Puppeteer + Google PageSpeed Insights API |
| Review Data | Google Places API |
| CRM | Google Sheets API v4 |
| Email Delivery | Gmail API |
| Job Scheduling | BullMQ + Redis (Phase 3) / Cron (Phase 1) |
| Frontend | Next.js + ShadCN + Tailwind + TanStack Query + Zustand |
| Hosting | AWS EC2 t3.micro |

---

## MVP Phases

| Phase | What Ships | Timeline |
|---|---|---|
| 1 — Core Pipeline | Scout → Write → Track (email-only) | Week 1–2 |
| 2 — Intelligence | Website audit + review analysis | Week 2–3 |
| 3 — Automation | Cron scheduling + follow-up system | Week 3 |
| 4 — Dashboard | Next.js UI for pipeline monitoring | Week 4 |
| 5 — Scale | BullMQ queues + PostgreSQL migration | Post-MVP |

---

## Business Model

| Service | Project Price | Monthly Retainer |
|---|---|---|
| Website Design & Dev | $500 – $3,000 | $200 – $500/mo |
| SEO & Google Ranking | $300 – $1,000 | $300 – $800/mo |
| Social Media Management | $200 – $500 | $300 – $700/mo |
| Full Package | $800 – $4,000 | $600 – $1,500/mo |

**Break-even:** 1 client at $500 = 3–6 months of full operating costs (~$12/mo).

---

## Scoring System

| Score | Meaning | Action |
|---|---|---|
| 0–30 | No website / completely broken | Contact immediately |
| 31–55 | Major issues (speed, SEO, UX) | Contact immediately |
| 56–75 | Some issues, clear opportunity | Contact with free audit offer |
| 76–100 | Solid presence | Skip |

---

## Running Cost

- Claude API (Sonnet 4.6): ~$2–3/month at 3 businesses/day
- AWS EC2 t3.micro: ~$8.50/month
- Google Maps API: Free (within 200 calls/day free tier)
- Gmail + Sheets API: Free
- **Total: ~$11–12/month**

---

## Target Markets

**Priority 1:** United States, United Kingdom, Canada, Australia
**Priority 2:** UAE, Saudi Arabia, Singapore
**Priority 3:** All English-capable businesses worldwide

**Target niches:** restaurants, clinics, law firms, gyms, salons, hotels, pharmacies, auto workshops, tutoring centres, retail shops

---

## Follow-Up Rules

- Day 0: First outreach email sent
- Day 3: One follow-up from a different angle (team approval required)
- Day 7: Lead marked cold, never contacted again

---

## Audit Checklist (per business)

- [ ] Website load speed (target < 3s)
- [ ] Mobile responsiveness
- [ ] HTTPS / SSL active
- [ ] Meta title + description present
- [ ] Google Business Profile claimed + complete
- [ ] Clear call-to-action visible
- [ ] Contact form or phone number present
- [ ] Customer reviews / social proof
- [ ] Content freshness (last updated)
- [ ] Schema markup

---

## Email Structure

1. **Line 1** — Reference something specific (a review, their location, their niche)
2. **Lines 2–3** — Name 2 specific issues found, framed as opportunities
3. **Lines 4–5** — Introduce the service offer, lead with their biggest pain point
4. **Line 6** — Offer a free audit or 10-minute call
5. **Line 7** — Close with a question to drive a reply

**Hard limit:** 180 words. Never mention competitor names. Never close with a statement.

---

## Repository Structure

```
main-project/
├── backend/
│   ├── src/
│   │   ├── agents/          # Scout, Analyst, Writer, Tracker, Reporter
│   │   ├── services/        # Google Maps, PageSpeed, Gmail, Sheets
│   │   ├── jobs/            # Cron + BullMQ pipeline orchestration
│   │   ├── config/          # Env, constants
│   │   └── utils/           # Logger, error handler, rate limiter
│   └── CLAUDE.md
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # ShadCN + custom components
│   ├── stores/              # Zustand state
│   ├── lib/                 # Axios client + React Query hooks
│   └── CLAUDE.md
├── CLAUDE.md                # Project-level context
└── OVERVIEW.md   # This file
```

---

## CLAUDE.md Quick Reference

| File | Purpose |
|---|---|
| `~/.claude/CLAUDE.md` | Global: TypeScript strict, no any, prefer functional, never commit secrets |
| `/CLAUDE.md` | Project: stack, architecture, build commands, conventions |
| `/backend/CLAUDE.md` | Agent patterns, error handling, API rate limits |
| `/frontend/CLAUDE.md` | Component patterns, Zustand usage, query key conventions |

---

*Sift.ai — Confidential. Built with Claude Sonnet 4.6 + Node.js + Next.js.*