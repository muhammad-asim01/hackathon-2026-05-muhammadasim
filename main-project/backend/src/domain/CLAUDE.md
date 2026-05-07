# Domain Layer

Pure TypeScript — zero external dependencies. No Prisma, no Express, no LLM SDK.

## Error Hierarchy (`errors.ts`)

All errors extend `DomainError` (abstract):
```
DomainError
├── NotFoundError (404)        → LeadNotFoundError, RunNotFoundError, DraftNotFoundError
├── ValidationError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── ConflictError (409)        → RunAlreadyActiveError
├── RateLimitError (429)       → DailyQuotaExceededError
├── ExternalServiceError (502) → constructor(message, retryable, context?)
└── InternalError (500)
```

- Use `isDomainError(err): err is DomainError` type guard to narrow unknown errors.
- `ExternalServiceError` accepts a `retryable` boolean — set `true` for 429/503/overload responses.
- **Never** throw raw `new Error()` in use-cases — always use one of these typed classes.

## Entity Interfaces (`types.ts`)

All interfaces are `readonly` and import-free. Key entities:

| Interface | Key fields |
|---|---|
| `Lead` | id, publicId, gmapsPlaceId, businessName, address, city, niche, status, digitalScore, contactEmail |
| `Email` | id, leadId, subject, body, wordCount, status, recipientEmail |
| `PipelineRun` | id, prompt, niche, city, status, agentProgress, leadsFound/Scored/Drafted/Emailed |
| `RunEvent` | id, runId, agentName, level, message, timestamp |

## Enums

```typescript
// LeadStatus (backend Prisma values — NOT frontend display values)
"DISCOVERED" | "AUDITED" | "EMAIL_DRAFTED" | "PENDING_APPROVAL" |
"APPROVED" | "EMAIL_SENT" | "REPLIED" | "COLD" | "SKIPPED" | "REJECTED"

// RunStatus
"queued" | "running" | "complete" | "failed"

// EventLevel
"info" | "success" | "warning" | "error"

// EmailStatus (DraftStatus)
"pending" | "approved" | "rejected" | "sent"
```

> Frontend uses friendly aliases (`"new"`, `"contacted"`, `"approved"`, `"rejected"`, `"cold"`) that the leads router maps to backend status arrays via `resolveStatusFilter()`.
