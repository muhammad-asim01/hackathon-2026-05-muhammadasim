# Infrastructure — Persistence (Repositories)

All DB access lives here. Use-cases never import Prisma directly.

## Pattern

Every repository:
1. Accepts the Prisma client via constructor injection.
2. Maps `Prisma.Lead` → domain `Lead` via a local `toDomain()` function.
3. Implements the corresponding `IXxxRepository` port interface.
4. Throws typed domain errors (`LeadNotFoundError`, etc.) — never raw errors.

## `LeadRepository`

Implements `ILeadRepository`. Key details:

**`findMany(filter)`** — builds a `where` clause conditionally:
- `status` can be a single value or `readonly LeadStatus[]` (IN query).
- `digitalScore` accepts `{ lte?, gte? }` for range filtering.
- `search` does `OR` across `businessName`, `city`, `address`, `website`.
- Returns `{ leads: Lead[], total: number }` for pagination.

**`update(id, data)`** — uses conditional spread to avoid overwriting fields with `undefined`:
```typescript
await prisma.lead.update({ where: { id }, data: { ...data } });
```

**`toDomain()`** maps Prisma camelCase + snake_case columns to the domain interface. Fields not yet populated by the pipeline (e.g., `digitalScore`) are allowed to be `null`.

## `RunRepository`

Implements `IRunRepository`.

**`addEvent(runId, event)`** — inserts a `RunEvent` row immediately. SSE polling in the pipeline router picks up new rows every 200ms via `getEvents(runId)`.

**`getEventsByRunIds(ids)`** — batch-fetches events for multiple runs in one query and returns a `Map<runId, RunEvent[]>`. Avoids N+1 on the runs list endpoint.

## `EmailRepository`

Stores email drafts. `approve()` and `reject()` are atomic updates that also set `approvedAt` / `sentAt` timestamps and validate that the email is in the `pending` state first.

## Rules

- **Never** write raw SQL strings. Use Prisma query builder only.
- **Never** expose Prisma types outside this layer — always map to domain interfaces.
- All DB migrations go through `npx prisma migrate dev` — never edit `migrations/` by hand.
- Prisma schema source of truth: `prisma/schema.prisma`.
