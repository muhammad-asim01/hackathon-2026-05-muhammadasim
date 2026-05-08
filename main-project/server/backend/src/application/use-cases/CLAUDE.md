# Application Use-Cases

Each use-case is a single TypeScript class with one public method: `execute(input) → output`. No framework imports.

## Directory Layout

```
use-cases/
├── pipeline/
│   └── RunPipeline.ts          ← sole orchestrator; reads all agents
├── scout/
│   └── DiscoverBusinesses.ts   ← Scout agent: queries IMapsService, dedupes leads
├── analyst/
│   ├── AuditWebsite.ts         ← Analyst: PageSpeed + page crawl
│   └── AnalyzeReviews.ts       ← Analyst: LLM review summarizer
├── writer/
│   └── DraftEmail.ts           ← Writer: LLM email drafter
├── tracker/
│   └── TrackSpreadsheet.ts     ← Tracker: Google Sheets sync (mock in dev)
├── reporter/
│   └── SendDailySummary.ts     ← Reporter: end-of-day digest (email mocked in dev)
└── email/
    ├── ApproveEmail.ts
    └── RejectEmail.ts
```

## `RunPipeline` — Orchestrator

`execute({ prompt, scoreThreshold?, wordLimit? })`:
1. Creates a `PipelineRun` record → returns `runId` immediately (202 response).
2. Fires `_background()` as a fire-and-forget promise.
3. Background: runs Scout → per-lead: Analyst → Writer → Tracker, 3 leads in parallel (`BATCH_SIZE = 3`).
4. Each step calls `runRepo.addEvent(runId, { agentName, level, message })` immediately so the SSE stream receives updates in real time.
5. On completion/failure, updates run status + counters.

**Score threshold default:** 75 (leads scoring ≥ 75 are skipped as "already good").
**Word limit default:** 180 (email body word cap passed to DraftEmail).

## `DiscoverBusinesses` — Scout

- Queries `IMapsService` with the niche/city prompt.
- Dedupes by `gmapsPlaceId` against existing DB records.
- Skips places meeting any quality filter: no website, rating ≥ 4.8, or ≥ 400 reviews.
- Returns an array of raw place objects for downstream agents.

## `AnalyzeReviews` — Analyst LLM

- Sends up to 10 most-recent reviews to the LLM with a cached system prompt.
- Parses JSON response: `{ positives[], negatives[], excerpt, avgRating }`.
- Strips markdown code fences before `JSON.parse`.
- Throws `InternalError` if the LLM returns non-parseable JSON.

## `DraftEmail` — Writer

- Builds a personalized outreach email using LLM with business audit context.
- Respects `wordLimit` from pipeline settings.
- Persists the draft as an `Email` row with status `pending`.

## Email Actions

`ApproveEmail` and `RejectEmail` check current email status before mutating — throws `ConflictError` if the email is already in a terminal state.

## Pattern Rules

- Use-case filenames: `VerbNoun.ts` (PascalCase verb + noun).
- Constructor takes injected ports via interfaces only.
- Throw typed domain errors (`DomainError` subclasses) — never raw strings.
- Use `logger.child({ useCase: "ClassName", ...context })` for structured logging.
- Never import Prisma, Express, or Anthropic SDK — only port interfaces.
