# Frontend Hooks

All server/async state lives in TanStack Query hooks here. No Zustand in hooks. No hooks in Zustand stores.

## File Map

| File | Exports | Query Keys |
|---|---|---|
| `useLeads.ts` | `useLeads(filters)`, `useLeadDetail(id)`, `useUpdateLead(id)` | `["leads","list",filters]`, `["leads","detail",id]` |
| `useAgent.ts` | `useStartPipeline()`, `useLiveRun(runId)`, `useRecentRuns()` | `["runs","list"]` |
| `useApprovals.ts` | `useApprovals()`, `useApproveEmail(id)`, `useRejectEmail(id)` | `["approvals","list"]` |
| `useAnalytics.ts` | `useAnalyticsSummary()`, `useFunnel()`, `useScoreDistribution()`, `useNicheBreakdown()` | `["analytics","*"]` |
| `useSettings.ts` | `useSettings()`, `useUpdateSettings()` | `["settings"]` |

## React Query Conventions

```typescript
// staleTime defaults
30_000   // most hooks (30s)
0        // approvals queue (always fresh)
```

Query key format: `["resource", "action", ...params]`

## `useLiveRun(runId)` — SSE + Snapshot Pattern

Complex hook — read carefully before modifying:
1. Opens `EventSource` immediately (SSE) — buffers events to `pendingRef` until snapshot is ready.
2. Fetches initial snapshot via `requests.get()` — merges `pendingRef` events into it.
3. Subsequent SSE events merge directly into `run.events` (dedup by `event.id`).
4. On SSE `"done"` message → merges remaining buffer → closes SSE → calls `invalidateAfterRun()`.
5. `invalidateAfterRun` busts: `["approvals"]`, `["leads"]`, `["runs"]`, `["analytics"]`.

SSE auth: `EventSource` can't send headers — uses `?token=<jwt>` query param.
In dev: token falls back to `"dev-qa-bypass"`.

## Mutation Pattern

```typescript
// All mutations follow this shape:
useMutation({
  mutationFn: (input) => requests.post<Result>(url, input),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["resource"] });
    toast.success("...");
  },
  onError: () => {
    toast.error("...");
  },
})
```

- Always invalidate the relevant query key on success.
- Always show a `toast.error` on failure.
- Never store mutation result in Zustand — let React Query own the server state.

## `requests` Helper (`lib/api/requests_helpers.ts`)

Axios instance with:
- `baseURL`: `NEXT_PUBLIC_API_URL`
- Auth interceptor: injects `Authorization: Bearer <token>` from `getSession()` (deduped via `_sessionPromise`).
- 401 interceptor: redirects to `/login` unless already on `/login`.

Available methods: `requests.get<T>`, `requests.post<T>`, `requests.patch<T>`, `requests.del<T>` — all unwrap `{ ok, data }` envelope.
