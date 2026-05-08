# Interface Layer — HTTP (Express Routes)

Routes are the only layer allowed to import `container` and call use-cases. No business logic here.

## Response Envelope

All responses use `{ ok: boolean; data: T }` on success and `{ ok: false; error: { code, message, issues? } }` on error. The frontend `requests_helpers.ts` unwraps `res.data.data` automatically.

## Routers

| Router | Prefix | Description |
|---|---|---|
| `leads.router.ts` | `/api/leads` | List/detail/update leads |
| `pipeline.router.ts` | `/api/pipeline` | Start run, list runs, run detail, SSE stream |
| `emails.router.ts` | `/api/emails` | List pending approvals, approve/reject |
| `analytics.router.ts` | `/api/analytics` | Summary, funnel, score distribution, niche breakdown |
| `settings.router.ts` | `/api/settings` | Get/update system settings |
| `public.router.ts` | `/api/public` | Unauthenticated audit endpoint for prospect-facing pages |

## Auth Middleware (`middleware/auth.ts`)

`requireAuth` checks for a valid Bearer token in `Authorization` header:
- In production: validates against NextAuth JWT (`NEXTAUTH_SECRET`).
- In dev: `Authorization: Bearer dev-qa-bypass` is accepted (hardcoded bypass).
- Attaches `req.user` if valid; calls `next(new UnauthorizedError())` if not.

## Error Middleware (`middleware/errorHandler.ts`)

Four-argument Express error handler — catches all errors passed via `next(err)`:
1. `DomainError` → maps `httpStatus`, returns structured JSON.
2. `ZodError` → 400 with `issues[]` array for field-level validation feedback.
3. Unknown → 500 `INTERNAL_ERROR`.

Errors are **only** logged here (the catch boundary), not at throw sites.

## SSE Endpoint — `GET /api/pipeline/runs/:id/events`

- Uses `EventSource` (browser native) — can't send Authorization headers.
- Auth: `?token=<jwt>` query param fallback.
- Polls `runRepo.getEvents(id)` every **200ms**, deduplicates already-sent event IDs via a `Set`.
- Streams two message types:
  - `{ type: "event", data: RunEvent }` — each pipeline log line.
  - `{ type: "done", data: PipelineRun }` — final snapshot when `status === "complete" | "failed"`.
- Max duration: **10 minutes** (safety timeout).
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

## DTO Mapping (`dto.ts`)

`toLeadDTO(lead: Lead)` and `toEmailDTO(email: Email, lead: Lead)` convert domain objects to frontend-safe shapes. Frontend status values (`new`, `contacted`) are derived from backend enum values here.

## Status Mapping (Leads)

Frontend filter values → backend `LeadStatus` arrays (in `leads.router.ts`):
```
"new"       → ["DISCOVERED", "AUDITED", "EMAIL_DRAFTED", "PENDING_APPROVAL"]
"contacted" → ["EMAIL_SENT", "REPLIED"]
"approved"  → "APPROVED"
"rejected"  → "REJECTED"
"cold"      → ["COLD", "SKIPPED"]
```

## Zod Validation

Every route uses `schema.safeParse(req.query | req.body)`. On failure: `next(new ValidationError(...))`.
Query param coercion: `z.coerce.number()` for numeric params (strings from URL → numbers).

## Adding a New Route

1. Create `routes/myresource.router.ts` with Express `Router()`.
2. Import `container` for use-cases / repos.
3. Add `requireAuth` to every non-public route.
4. Add Zod schema for body/query.
5. Register with `app.use("/api/myresource", myresourceRouter)` in `app.ts`.
