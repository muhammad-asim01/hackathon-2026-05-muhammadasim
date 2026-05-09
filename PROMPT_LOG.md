# Prompt Log — Muhammad Asim — sift.ai

> Maintained throughout the hackathon. Updated per session.
> Last updated: Sat May 9, 2026

---

## Top Prompts That Worked

### 1. Sub-module CLAUDE.md generation blitz (13 files in one session)

**Context:** After the first session Claude kept re-reading source files to understand architecture on every prompt. Needed a way to give scoped context per directory without re-reading everything from scratch every time.

**Prompt:**
```
Create a CLAUDE.md for main-project/backend/src/domain/ that documents:
- The full DomainError hierarchy with all subclasses and their constructor signatures
- All entity interfaces (Lead, Email, PipelineRun, RunEvent) with field names and types
- All enums with their exact string values
- The LeadStatus backend vs frontend mismatch (ALL_CAPS backend, friendly aliases frontend)
- What is banned in this layer (no external deps, no Prisma, no Express)
Read the actual source files first before writing. Do not invent anything.
```
(Repeated with directory-specific instructions for each of the 13 directories.)

**Why it worked:** Scoped prompts with explicit "read first, don't invent" constraint produced accurate files. Each CLAUDE.md ended up ~80–120 lines — dense enough to be useful, short enough to fit in context without crowding. Day 2 prompts were noticeably shorter because the architecture was already pre-loaded.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$4–5 total across all 13 files

---

### 2. OAuth production failure diagnosis — CRLF root cause

**Context:** Production deploy on Vercel was redirecting OAuth callback to `localhost:3000` instead of the live domain. Had already checked NextAuth config, NEXTAUTH_URL, AUTH_URL. Everything looked correct locally.

**Prompt:**
```
The OAuth callback is redirecting to localhost:3000 on production even though 
AUTH_URL=https://saftai.vercel.app is set in GitHub Actions vars.
The env var value is correct in the GitHub UI. The CI/CD pipeline prints it before the build.
What could cause a correctly-set env var to produce wrong behavior only in production?
Focus on: how GitHub Actions reads vars.PRODUCTION, Windows line endings in the GitHub UI 
value field, and how Next.js reads AUTH_URL at build time vs runtime.
```

**Why it worked:** Providing the exact failure mode + what was already ruled out + specific areas to focus on made Claude zero in on the CRLF hypothesis immediately. Plan mode confirmed it by tracing exactly where `\r` would corrupt the URL.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$1

---

### 3. Layer-constrained fix — CI/CD not application code

**Context:** After the CRLF diagnosis, first instinct was to add `.trim()` in Next.js source. Claude suggested this. User explicitly rejected it — "fix in CI/CD, not application code."

**Prompt:**
```
Fix the CRLF issue at the CI/CD layer only. Do not touch any application source files.
The fix should normalize env var values from GitHub vars.PRODUCTION before they are used in any step.
Use tr -d '\r' in the GitHub Actions YAML. Show me exactly which step to add it to 
and the precise shell command.
```

**Why it worked:** Explicit constraint ("CI/CD layer only, do not touch application source") prevented Claude from reverting to the .trim() approach. The fix was a single `tr -d '\r'` line added to the env normalization step — one line instead of 3 application patches.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$1.50

---

### 4. E2E QA instruction — analyze bug then fix (do not just fix)

**Context:** Auth flow was complete but untested end-to-end. Needed a systematic QA pass that caught real bugs, not just "run tests and see if they pass."

**Prompt:**
```
Now test the login end to end testing with the login flow. When user signup then redirect 
to signinpage and when signin then the admindashboard is access. 
Do proper QA => analyze bug => then fixed it
```

**Why it worked:** The three-step instruction (`QA => analyze bug => fixed it`) forced Claude to report what it found before writing fixes. It caught 3 real bugs that would have been invisible from code review alone:
1. `registerAndSignIn` was auto-signing-in users instead of redirecting to login (wrong UX)
2. Browser back-button served cached dashboard after logout (Cache-Control: no-store needed)
3. PostHog script blocked by CSP (missing `us-assets.i.posthog.com` in `script-src`)

The phrase "do proper QA" without prescribing the exact steps let Claude choose the right verification approach (Playwright + browser simulation) rather than just running unit tests.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$4

---

### 5. Scenario-based feature request — Google OAuth tracking

**Context:** Google OAuth login was working, but sign-ins weren't being persisted to the database. Needed DB sync without blocking the auth flow or exposing the internal endpoint publicly.

**Prompt:**
```
One more scenario when user login using google can you track this into db
```

**Why it worked:** Short, clear scenario statement. Claude correctly identified the right architecture:
- `events.signIn` (fire-and-forget, doesn't block login) over `callbacks.signIn` (blocks on failure)
- Protected internal endpoint with `x-internal-secret` header reusing `NEXTAUTH_SECRET`
- `upsertGoogleUser` with Prisma `upsert` by `googleId` (stable across email changes)
- Didn't over-engineer it (no separate auth service, no message queue)

The scenario framing ("when user login using google") is better than asking for "an architecture for OAuth user persistence" — it let Claude design the right solution bottom-up from the user journey.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$3

---

### 6. Railway deployment root cause — pasted error logs verbatim

**Context:** Python-scraper was failing on Railway with `Cannot find module '/app/index.js'`. Railway was treating the FastAPI app as a Node.js project despite the Dockerfile being present.

**Prompt:**
```
[pasted full Railway build + deploy error logs]
Python-scraper deployment errors: Cannot find module '/app/index.js' ... fixed it
```

**Why it worked:** Pasting the full error logs (not a summary) let Claude see the exact failure chain:
- Railway auto-detected Node.js (Railpack) because `root_directory` wasn't set
- Railpack ignored the Dockerfile and ran `npm ci` → `node /app/index.js`

"Fixed it" (imperative) without prescribing the approach let Claude choose the correct fix: update `root_directory` + `dockerfile_path` + builder via Railway MCP rather than patching the Dockerfile to fake Node.js compatibility. 

The subsequent `$PORT` not-expanding bug was fixed by identifying that Railway's start command override runs as exec form (no shell), not the Dockerfile CMD's shell form — so clearing the override was the right fix, not adding a shell wrapper.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$2

---

### 7. Architecture consultation — "do not execute" guard

**Context:** Wanted to understand the Python+Node.js sidecar architecture before committing to it. Didn't want any code written — just the architecture explained.

**Prompt:**
```
Do not execute i will just ask you you answer me
For scrapping i want to used python and using python it will scrap the data and from node js 
i only called that apis so it is best according to my projects, like details scrapping for 
the website, and get the complete audit details also how i can handle this like with in one 
backend deployments, like i not want to seperate backend for python and for node not seperate deployment
You are expert system architect and 10+ years of experience in backend developments, and you know 
as much about the node as well the python
```

**Why it worked:** "Do not execute" as the first words stopped any tool calls before they could start. Role-priming ("expert system architect, 10+ years") shaped the answer toward production-grade reasoning rather than toy examples. The "single deployment" constraint focused the answer on the real problem (how to co-locate Python + Node without separate Railway services).

**Output quality:** 4/5
**Model:** Sonnet 4.6
**Approx cost:** ~$0.15

---

### 8. Numbered sub-phases for UI polish

**Context:** The app was functional but had no loading states, empty states, or error boundaries anywhere. Needed all of them added in one pass without breaking existing functionality.

**Prompt:**
```
You are expert Ui/UX developer which will fixed all the design fixed and execute the phase 8:
8.1: Verify/complete GET /api/public/audit/:publicId public endpoint
8.2: Wire /audit/[publicId] page from mock data to real API
8.3: Loading skeletons on every list + detail page
8.4: Empty states + error boundaries (error.tsx) on every route segment
8.5: Confirm analytics wired to real aggregation endpoints
```

**Why it worked:** Numbered sub-phases gave Claude an ordered checklist to tick off. Assigning a role ("expert UI/UX developer") front-loaded the right context before the task list. Each phase was atomic enough to verify independently.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$0.80

---

### 9. Reference the existing pattern — NicheTable pagination

**Context:** The analytics NicheTable had no pagination. The LeadsTable already had pagination working perfectly. Needed the same pattern applied without re-inventing it.

**Prompt:**
```
here add the pagination like this have
[screenshot of LeadsTable pagination footer]
```

**Why it worked:** Pointing at an existing working component in the same codebase ("like this") let Claude reverse-engineer the exact pattern (state, offset calc, UI controls) and replicate it without guessing. No spec needed when the reference exists.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$0.30

---

### 10. SPEC.md + CLAUDE.md creation — paste the template, get the artifact

**Context:** Hackathon submission required SPEC.md and CLAUDE.md committed to the repo in specific formats. Rather than describing the format, I pasted both templates verbatim.

**Prompt:**
```
I write SPEC.md,
template
# <Project Name>
## What it is (1 sentence)
...
[full SPEC template]

CLAUDE.md
template
# <Project Name>
## Stack
...
[full CLAUDE template]

as committed artifacts make to create these files
```

**Why it worked:** Pasting the exact template removed all ambiguity about format. "As committed artifacts" signaled these were real files to write to disk, not code blocks to show in chat. Claude filled in all fields from existing codebase knowledge — no back-and-forth needed.

**Output quality:** 5/5
**Model:** Sonnet 4.6
**Approx cost:** ~$0.40

---

## Prompts That Wasted Time

### 1. Application-layer .trim() fix for CRLF (wrong layer)

**What I asked:** "Fix the AUTH_URL reading so trailing whitespace doesn't break it" (no explicit constraint on where to fix)

**What went wrong:** Claude added `.trim()` calls in 3 frontend files (env.ts, next.config.ts, auth.ts). Worked locally but treated symptoms not the cause. User explicitly reverted all changes. The correct fix was one line in the CI/CD pipeline.

**Lesson:** Constraints on *where* to fix are as important as *what* to fix. Always specify the layer.

---

### 2. QA Playwright seed fixes — reverted because strategy was wrong

**What I asked:** "Fix the 6 Playwright test failures" without specifying constraints

**What went wrong:** Claude diagnosed all 6 correctly and wrote the seed.ts fixes. User reverted everything. The actual direction was "fix the test infrastructure, not the seed data" — but that wasn't said in the prompt.

**Lesson:** Ask "diagnose and list the failures first, don't write any fixes yet" — then discuss strategy before generating code.

---

### 3. Parallel Explore agents > 3 — context bloat

**What I asked:** Launched 5 Explore agents simultaneously to read different parts of the codebase in one shot

**What went wrong:** Each agent returned full file excerpts. Combined output exceeded what the main context window could cleanly process. Some results were partially lost in compaction.

**Lesson:** 2–3 parallel agents max. Sequential targeted reads are cheaper than bulk parallel reads for large codebases.

---

### 4. Vague location reference with no file path

**What I asked:** "Have you set a threshold for what rating things are returned"

**What went wrong:** Too ambiguous — "threshold" could mean scoring logic, an API filter, a UI filter, or a Prisma query. Claude started searching multiple files to guess which layer was meant. The answer existed in `CLAUDE.md` under Key Business Logic.

**Lesson:** Always name the file path or component explicitly. "In `RunPipeline.ts`, what score threshold is used to skip leads?" is one tool call instead of five.

---

### 5. Architecture question without "do not execute" carried forward

**What I asked:** "like aws is paid where i have deployed freely" (follow-up to architecture question)

**What went wrong:** The "do not execute" guard from the previous message didn't carry. Claude started calling Explore/search tools to look for deployment config files.

**Lesson:** Restate "text answer only" on every pure-consultation follow-up. Guards from message 1 don't persist to message 4.

---

## Workflow Patterns — Keep Using

- **Sub-module CLAUDE.md files before any Claude work.** The 13 files generated on Day 1 paid for themselves every subsequent session. Context pre-loading is the highest ROI prompt investment.
- **"Do not execute" as the first 3 words** on any pure consultation prompt — stops tool calls before they start.
- **Reference existing patterns by screenshot or filename** instead of writing a spec — "do it like LeadsTable.tsx" is faster and more accurate than describing the behavior from scratch.
- **Inventory sweep before bulk edits** — for any rename/refactor touching > 5 files, run grep sweep first as a separate step, confirm the list, then edit.
- **Paste the template, get the artifact** — for structured docs (SPEC.md, CLAUDE.md), providing the exact template format produces a correctly filled file in one shot.
- **Plan mode for anything touching > 3 files** — consistently produced better output than free-form generation. The plan step catches wrong-file assumptions before they propagate.
- **Explicit layer constraints** in fix prompts: "CI/CD layer only", "use-case layer only", "do not touch infrastructure". Prevents Claude from taking the path of least resistance to the wrong layer.
- **"QA => analyze bug => then fixed it"** — three-step instruction forces diagnosis before fixes. Catches runtime bugs invisible from code review.
- **Parallel Notion/API tool calls** for multi-page updates. 4 simultaneous updates instead of sequential = 4x faster.
- **Paste full error logs verbatim** for deployment/runtime failures — summaries lose the signal. Claude needs the exact stack trace, not a paraphrase.

## Workflow Patterns — Stop

- **Letting Claude pick where to fix something.** Without constraints, it defaults to the nearest code touch-point, not the architecturally correct layer.
- **Parallel agents > 3.** Context bloat cost exceeds parallelism benefit beyond 3 concurrent agents.
- **Vague location references** ("that file", "where I have it") — always name the file path or component explicitly.
- **Chaining follow-up questions without restating constraints** — the "do not execute" guard from message 1 doesn't carry to message 4.
- **Letting Opus run as default** — Sonnet handled every task in this hackathon at full quality. No Opus was needed or used.
- **Skipping plan mode on tasks that touch > 5 files** — the partial brand rename in a prior session would have been caught by plan review before any edit ran.

---

## Session Summary — All Work Completed

### Thu May 7, 2026 — Architecture + Context Setup
- OAuth CRLF production bug diagnosed + fixed at CI/CD layer
- 13 sub-module CLAUDE.md files generated (6 backend + 7 frontend)
- Notion hackathon workspace populated (4 pages)
- SPEC.md + root CLAUDE.md committed

### Fri May 8, 2026 — Pipeline Agents + Phase 1C QA
- **Bug #6:** OSMMapsService geocoding — removed invalid `featuretype` param, added smart city-type candidate selection
- **Bug #7:** GrokAdapter — full rewrite to Groq Responses API (`/v1/responses`, new request/response shape)
- **Bug #8:** Writer Agent JSON extraction — bracket-finding parser + system prompt OUTPUT FORMAT constraint
- **Phase 1C QA** — all 7 admin pages verified with Playwright; 5 bugs found + fixed:
  - Approve/reject optimistic updates
  - Analytics KPI tiles not refreshing after approve/reject
  - Analytics charts using hardcoded mock data
  - Settings password fields outside form (browser warnings)
  - `isResolved` missing "sent" status

### Sat May 9, 2026 — Auth System + Deployment
- **Signup page** — `app/signup/page.tsx` + `SignupForm.tsx` matching login design; amber glow + grid texture
- **Backend auth stack** — Prisma migration (nullable passwordHash, provider, googleId), UserRepository upsertGoogleUser, SyncGoogleUser use-case, auth.router (register/login/google-sync endpoints), container wiring, JWT middleware
- **Frontend auth** — NextAuth v5 credentials + Google OAuth, JWT callback with role claim, mintBackendToken
- **E2E QA** — 3 bugs caught + fixed:
  - Signup auto-sign-in (should redirect to login with success banner)
  - Browser back-button serving cached dashboard after logout (Cache-Control: no-store)
  - PostHog CSP violation
- **Dashboard logout guard** — `force-dynamic` export + `auth()` check + HTTP no-store headers
- **Google OAuth → DB sync** — `events.signIn` fire-and-forget, protected `/api/auth/google-sync` endpoint, users auto-granted ADMIN role
- **Railway python-scraper** — fixed Railpack override (set DOCKERFILE builder), fixed `$PORT` expansion (cleared start command override, Dockerfile CMD handles it via `sh -c`)
