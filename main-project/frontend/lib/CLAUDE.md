# Frontend Lib

Shared utilities, types, and API infrastructure.

## `types.ts` — Frontend DTOs

Mirror what every `/api/*` endpoint returns after `{ ok, data }` is unwrapped.

Key types:
- `Lead` — includes `contactEmail?`, `digitalScore?`, `reviewSentiment?`, `topIssue?`
- `LeadDetail extends Lead` — adds `emails: EmailDraft[]`
- `EmailDraft` — includes `recipientEmail: string | null`, `status: DraftStatus`
- `PipelineRun` — includes `agentProgress: AgentProgress`, `events?: RunEvent[]`
- `PublicAuditLead` — all analyst fields optional (accessible before Analyst agent runs)
- `PagedResult<T>` — `{ data: T[]; meta: { total, page, limit } }`

Helper functions (exported from `types.ts`):
```typescript
scoreVariant(score?: number): "error" | "warning" | "muted" | "default"
scoreTier(score?: number): string  // human-readable label for score range
```

Frontend status aliases (different from backend Prisma enums):
```typescript
type LeadStatus = "new" | "contacted" | "approved" | "rejected" | "cold"
type DraftStatus = "pending" | "approved" | "rejected" | "sent"
```

## `api/urls_helpers.ts` — API URL Constants

```typescript
API_URLS.leads.list               // "/leads"
API_URLS.leads.detail(id)         // "/leads/:id"
API_URLS.leads.update(id)         // "/leads/:id"
API_URLS.runs.start               // "/pipeline/run"
API_URLS.runs.list                // "/pipeline/runs"
API_URLS.runs.detail(id)          // "/pipeline/runs/:id"
API_URLS.runs.events(id)          // "/pipeline/runs/:id/events"
API_URLS.emails.list              // "/emails"
API_URLS.emails.approve(id)       // "/emails/:id/approve"
API_URLS.emails.reject(id)        // "/emails/:id/reject"
API_URLS.analytics.summary        // "/analytics/summary"
API_URLS.analytics.nicheBreakdown // "/analytics/niche-breakdown"
API_URLS.settings                 // "/settings"
API_URLS.public.audit(publicId)   // "/public/audit/:publicId"
```

## `api/requests_helpers.ts` — Axios Client

See `hooks/CLAUDE.md` for full details. Key exports: `requests.{ get, post, patch, del }`.

## `utils.ts`

`cn(...classes)` — Tailwind class merger (clsx + tailwind-merge). Use everywhere for conditional classes.

## `auth.ts` (root level)

NextAuth v5 config. Uses Google OAuth provider. Exposes `auth()` for server components and `handlers` for `app/api/auth/[...nextauth]/route.ts`. Session includes `accessToken` forwarded to backend.
