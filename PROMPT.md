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
