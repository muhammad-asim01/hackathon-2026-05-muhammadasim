# Admin Components

Client components for the authenticated dashboard. All require `"use client"` unless they are pure presentational wrappers with no hooks or event listeners.

## Component Map

| Component | Description |
|---|---|
| `AgentPanel.tsx` | Pipeline runner UI — prompt input, run button, live SSE log viewer, step progress |
| `LeadsTable.tsx` | Filterable, sortable, paginated leads table — search, score range, status, niche filters |
| `LeadDetail.tsx` | 3-column lead detail view — audit scores, email drafts, status actions |
| `ApprovalQueue.tsx` | Card grid of pending email drafts — approve/reject per card |
| `RunList.tsx` | List of pipeline runs with status badges |
| `RunDetail.tsx` | Single run detail with terminal-style event log |
| `AnalyticsCharts.tsx` | Recharts: funnel, score distribution, niche breakdown |
| `SettingsForm.tsx` | Settings form — quotas, thresholds, niches, cities |
| `Sidebar.tsx` | Left nav — links, active state via `usePathname()` |
| `MobileNav.tsx` | Bottom nav for mobile (< 768px) |

## `AgentPanel` Pattern

Uses `useStartPipeline()` mutation + `useLiveRun(runId)` SSE hook:
```typescript
const start = useStartPipeline();
const { data: run } = useLiveRun(activeRunId);

// On submit:
const { runId } = await start.mutateAsync({ prompt, scoreThreshold, wordLimit });
setActiveRunId(runId);
```

Events render as terminal log lines: `font-mono text-xs text-muted-foreground`.
Step indicators: `idle` → gray dot, `running` → amber spinning ring, `done` → green checkmark (spring pop), `error` → red dot.

## `LeadsTable` Pattern

- Filters live in local `useState` — not Zustand (component-scoped).
- Passes filter object to `useLeads(filters)` → React Query refetches on filter change.
- Client-side sort on the current page (not the full dataset).
- Pagination: `page` state drives `filters.page` which invalidates the query.

## Design Tokens (enforced in all admin components)

- Backgrounds: `bg-background`, `bg-card`
- Borders: `border-border`, `border-border/60`
- Active/CTA: `text-lp-amber`, `bg-lp-amber`, `bg-lp-amber/10`
- Success: `text-lp-green`, `bg-lp-green/15`
- Error: `text-lp-red`, `bg-lp-red/15`
- Cards: `rounded-none` — never `rounded-lg`
- Buttons: `rounded-full` — always pills
- Log text: `font-mono text-xs`

## Animations

Only CSS keyframes from `globals.css` — no `framer-motion`:
- `lp-slide-up` — result cards, expanded filter panels
- `lp-fade-in` — table row reveal (with stagger via `animationDelay`)
- `lp-step-done` — spring-pop for completed pipeline steps
- `lp-glow-pulse` — running state indicator

## Skeleton Loading

Use inline skeleton rows matching layout sizes — never generic circular spinners:
```tsx
<tr className="animate-pulse">
  <td><div className="h-3 bg-border/40 rounded-none w-3/4" /></td>
</tr>
```
