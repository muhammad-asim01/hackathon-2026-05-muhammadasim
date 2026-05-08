# Prompt Log — Muhammad Asim — sift.ai

## Top 5 prompts that worked

### 1. Phase 8 UI polish — structured multi-task execution across 5 sub-phases
**Context:** The app was functional but had no loading states, empty states, or error boundaries anywhere. I needed all of them added in one pass without breaking existing functionality.
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
**Output quality:** 5
**Model used:** Sonnet
**Approx tokens / cost:** ~$0.80

---


### 2. NicheTable pagination — reference the existing proven pattern
**Context:** The analytics NicheTable had no pagination. The LeadsTable already had pagination working perfectly. I needed the same pattern applied without re-inventing it.
**Prompt:**
```
here add the pagination like this have
[screenshot of LeadsTable pagination footer]
```
**Why it worked:** Pointing at an existing working component in the same codebase ("like this") let Claude reverse-engineer the exact pattern (state, offset calc, UI controls) and replicate it without guessing. No spec needed when the reference exists.
**Output quality:** 5
**Model used:** Sonnet
**Approx tokens / cost:** ~$0.30

---

### 4. Architecture consultation — text-only, no execution
**Context:** I wanted to understand whether Python could handle scraping while Node.js ran the API, in a single deployment. I didn't want any code written — just the architecture explained.
**Prompt:**
```
Do not execute i will just ask you you answer me
For scrapping i want to used python and using python it will scrap the data and from node js i only
called that apis so it is best according to my projects, like details scrapping for the website, and
get the complete audit details also how i can handle this like with in one backend deployments, like
i not want to seperate backend for python and for node not seperate deployment
You are expert system architect and 10+ years of experience in backend developments, and you know as
much about the node as well the python
```
**Why it worked:** "Do not execute" as the first words stopped any tool calls before they could start. Role-priming ("expert system architect, 10+ years") shaped the answer toward production-grade reasoning rather than toy examples. The "single deployment" constraint focused the answer on the real problem.
**Output quality:** 4
**Model used:** Sonnet
**Approx tokens / cost:** ~$0.15

---

### 5. SPEC.md + CLAUDE.md creation — provide the template, get the artifact
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
**Output quality:** 5
**Model used:** Sonnet
**Approx tokens / cost:** ~$0.40

---

## Bottom 3 prompts that wasted time

### 1. Vague question with no file or component reference
**What I asked:**
```
have you set a threshold for what rating things are returned
```
**What went wrong:** Too ambiguous — "threshold" could mean the scoring logic, a filter in the API, a UI filter, or a Prisma query. Claude started searching multiple files to guess which layer was meant. The answer existed in `CLAUDE.md` under Key Business Logic but the question didn't point there.
**What I should have done:** "In `backend/src/application/use-cases/pipeline/RunPipeline.ts`, what score threshold is used to skip leads, and where is it configurable?"

---

### 2. Architecture question that triggered an unintended tool call
**What I asked:**
```
like aws is paid where i have deployed freely
```
**What went wrong:** This was a follow-up to the hosting question — but it came without the "do not execute" guard from the previous prompt. Claude started calling Explore/search tools to look for deployment config files instead of just answering in text.
**What I should have done:** Prefix every pure-consultation follow-up with "Text answer only —" or keep the "do not execute" instruction in the same message block, not just the first one.

---

### 3. Brand rename without upfront file inventory
**What I asked:** (first attempt, prior session — interrupted)
Gave the rename instruction without running a grep first to map all occurrences.
**What went wrong:** Claude started editing visible files (Nav, Footer) but had no inventory of the 58+ total occurrences — so admin pages, audit error pages, backend startup logs, and package.json names would have been missed. The session was interrupted before the sweep could complete.
**What I should have done:** "First: grep the entire repo for 'Sift.ai' and give me the full file list. Second: edit all of them." Two explicit steps — inventory then edit — prevents partial renames.

---

## Workflow patterns I'll keep using
- **Numbered sub-phases for multi-step tasks** — give Claude a checklist it can tick off sequentially; prevents it from jumping ahead or missing steps
- **"Do not execute" as the first 3 words** on any pure consultation prompt — stops tool calls before they start
- **Reference existing patterns by screenshot or filename** instead of writing a spec — "do it like LeadsTable.tsx" is faster and more accurate than describing the behavior from scratch
- **Inventory sweep before bulk edits** — for any rename/refactor touching > 5 files, run the grep sweep first as a separate step, confirm the list, then edit
- **Paste the template, get the artifact** — for structured docs (SPEC.md, CLAUDE.md), providing the exact template format produces a correctly filled file in one shot

## Workflow patterns I'll stop
- **Vague location references** ("that file", "where I have it") — always name the file path or component explicitly
- **Chaining follow-up questions without restating constraints** — the "do not execute" guard from message 1 doesn't carry to message 4; restate it if the conversation has moved
- **Letting Opus run as default** — Sonnet handled every task in this session at full quality; Opus-level spend is not justified for code generation on a known codebase
- **Skipping plan mode on tasks that touch > 5 files** — the partial brand rename in the prior session would have been caught by a plan review before any edit ran


# Prompt Log — Muhammad Asim — sift.ai

> Maintained throughout the hackathon. Updated per session.
> Last updated: Fri May 8, 2026

---

## Top 5 prompts that worked

### 1. Sub-module CLAUDE.md generation blitz (13 files)

**Context:** After the first session it was clear Claude kept re-reading source files to understand architecture on every prompt. Needed a way to give scoped context per directory without re-reading everything from scratch. Decided to generate a CLAUDE.md for every meaningful subdirectory.

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

**Why it worked:** Scoped prompts with explicit "read first, don't invent" constraint produced accurate files. Each CLAUDE.md ended up ~80–120 lines — dense enough to be useful, short enough to fit in context without crowding.

**Output quality:** 5/5

**Model used:** Sonnet 4.6

**Approx tokens / cost:** ~$4–5 total across all 13 files

---

### 2. OAuth production failure diagnosis — CRLF root cause

**Context:** Production deploy on Vercel was redirecting OAuth callback to `localhost:3000` instead of the live domain. Had already checked NextAuth config, NEXTAUTH_URL, AUTH_URL. Everything looked correct locally.

**Prompt:**
```
The OAuth callback is redirecting to localhost:3000 on production even though AUTH_URL=https://saftai.vercel.app is set in GitHub Actions vars. 
The env var value is correct in the GitHub UI. The CI/CD pipeline prints it before the build. 
What could cause a correctly-set env var to produce wrong behavior only in production?
Focus on: how GitHub Actions reads vars.PRODUCTION, Windows line endings in the GitHub UI value field, and how Next.js reads AUTH_URL at build time vs runtime.
```

**Why it worked:** Providing the exact failure mode + what was already ruled out + specific areas to focus on made Claude zero in on the CRLF hypothesis immediately. Plan mode then confirmed it by tracing exactly where `\r` would corrupt the URL.

**Output quality:** 5/5

**Model used:** Sonnet 4.6

**Approx tokens / cost:** ~$1

---

### 3. CI/CD pipeline-layer CRLF fix (not application layer)

**Context:** After diagnosis, first instinct was to add `.trim()` in the Next.js source. Claude suggested this. User explicitly rejected it — "fix in CI/CD, not application code." Needed a clean pipeline-layer solution.

**Prompt:**
```
Fix the CRLF issue at the CI/CD layer only. Do not touch any application source files.
The fix should normalize env var values from GitHub vars.PRODUCTION before they are used in any step.
Use tr -d '\r' in the GitHub Actions YAML. Show me exactly which step to add it to and the precise shell command.
```

**Why it worked:** Explicit constraint ("CI/CD layer only, do not touch application source") prevented Claude from reverting to the .trim() approach. The fix was a single `tr -d '\r'` line added to the env normalization step.

**Output quality:** 5/5

**Model used:** Sonnet 4.6

**Approx tokens / cost:** ~$1.50

---

### 4. Notion hackathon workspace population — all 4 pages in parallel

**Context:** Notion MCP was connected. Needed to populate 4 existing pages (Prompt Log, Cost Log, Daily Standups, Reflection) with real content from today's session — not template placeholders.

**Prompt:**
```
Update all 4 Notion hackathon pages in parallel with real content from today (May 7, 2026):
- Prompt Log: 5 real prompts with context/why/quality/cost (not template text)
- Cost Log: May 7 row = $38, 2 sessions, 7 hours, $5.43/hr, notes about Sonnet 4.6 dominance
- Daily Standups: May 7 EOD fully filled; May 8 morning pre-filled; rest blank
- Reflection: All 7 sections with authentic content, not generic platitudes
Page IDs: [provided]. Use notion-update-page with children blocks, not page properties.
```

**Why it worked:** Parallel tool calls (4 simultaneous notion-update-page) completed in one round-trip. Specifying "not template text" and "authentic content" prevented Claude from producing filler copy.

**Output quality:** 5/5

**Model used:** Sonnet 4.6

**Approx tokens / cost:** ~$2

---

### 5. Sub-module CLAUDE.md — SSE endpoint pattern (most precise output)

**Context:** The SSE endpoint in `backend/src/interface/http/routes/pipeline.router.ts` has several non-obvious behaviors (dedup via Set, `?token=` auth fallback, 200ms poll interval, 10-min max). Needed this documented precisely so future Claude sessions don't "fix" it.

**Prompt:**
```
Read backend/src/interface/http/routes/pipeline.router.ts in full.
Document the SSE GET /runs/:id/events endpoint for CLAUDE.md:
- Poll interval, dedup mechanism, connection lifecycle
- Why ?token= is used instead of Authorization header (EventSource limitation)
- Max connection time
- What the "done" message contains
- What happens if the run errors mid-stream
Write it as factual documentation, not a tutorial. Every claim must be verifiable from the source file.
```

**Why it worked:** "Every claim must be verifiable from the source file" is the most effective grounding constraint I found. Eliminated all hallucinated details. Output matched the source exactly.

**Output quality:** 5/5

**Model used:** Sonnet 4.6

**Approx tokens / cost:** ~$0.80

---

## Bottom 3 prompts that wasted time

### 1. Application-layer .trim() fix for CRLF

**What I asked:** "Fix the AUTH_URL reading so trailing whitespace doesn't break it" (no explicit constraints on where to fix)

**What went wrong:** Claude added `.trim()` calls in 3 frontend files (env.ts, next.config.ts, auth.ts). Worked locally but treated symptoms not the cause. User explicitly reverted all changes. The correct fix was one line in the CI/CD pipeline, not 3 application-layer patches.

**What I should have done:** Specified "fix at the CI/CD layer only" in the original prompt. Constraints on *where* to fix are as important as what to fix.

---

### 2. QA Playwright seed fixes (all reverted)

**What I asked:** "Fix the 6 Playwright test failures" without specifying constraints

**What went wrong:** Claude diagnosed all 6 correctly (seed data ordering, missing Plumbing niche, missing recipientEmail, wrong niche distribution) and wrote the seed.ts fixes. User reverted everything. The actual direction was "fix the test infrastructure, not the seed data" — but that wasn't said in the prompt.

**What I should have done:** Asked "diagnose and list the failures first, don't write any fixes yet" — then discussed the fix strategy before generating code.

---

### 3. Spawning too many parallel Explore agents

**What I asked:** Launched 5 Explore agents simultaneously to read different parts of the codebase in one shot

**What went wrong:** Context bloat. Each agent returned full file excerpts. The combined output exceeded what the main context window could cleanly process. Some agent results were partially lost in compaction.

**What I should have done:** 2–3 parallel agents max. For large codebases, sequential targeted reads are cheaper than bulk parallel reads. The dedup-via-compaction cost exceeded the parallelism benefit.

---

## Workflow patterns I'll keep using

- **Sub-module CLAUDE.md files before any Claude work.** The 13 files generated on Day 1 paid for themselves by Day 2. Every prompt became shorter because context was pre-loaded.
- **Plan mode for anything touching > 3 files.** Consistently produced better output than free-form generation. The plan step catches wrong-file assumptions before they propagate.
- **"Read first, don't invent"** constraint on every documentation/CLAUDE.md prompt. Non-negotiable for accuracy.
- **Parallel Notion/API tool calls** for multi-page updates. 4 simultaneous updates instead of sequential = 4x faster.
- **Explicit layer constraints** in fix prompts: "CI/CD layer only", "use-case layer only", "do not touch infrastructure". Prevents Claude from taking the path of least resistance to a wrong layer.

---

## Workflow patterns I'll stop

- **Letting Claude pick where to fix something.** Without constraints, it defaults to the nearest code touch-point, not the architecturally correct layer.
- **Parallel agents > 3.** Context bloat cost exceeds parallelism benefit beyond 3 concurrent agents. Use 2–3 targeted agents, not 5–6 broad ones.
