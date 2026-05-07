# Sift.ai Frontend — Engineering Guide

## Stack

- Next.js 15 App Router · React 19 · TypeScript 5
- Tailwind CSS v4 · ShadCN UI primitives in `components/ui/`
- TanStack Query v5 — server / async state
- Zustand v5 — UI-only state (filters, sidebar, modals)
- NextAuth v5 — admin authentication
- Axios — HTTP client
- Recharts — charts
- Sonner — toasts

## Route Groups

```
app/
├── (marketing)/        # Public site — no auth, SSR
├── (admin)/            # NextAuth-gated, layout has sidebar
├── audit/[publicId]/   # Prospect-facing audit — no auth, public
└── api/auth/           # NextAuth handlers
```

`middleware.ts` protects all `/(admin)/*` routes — redirect to `/login` if unauthenticated.

## Design System — CRITICAL RULES

Source: `project-overview/Design.md` | Tokens: `styles/tokens.css`

| Rule | Value |
|---|---|
| Background | `bg-background` (`#0c0a09`) |
| Cards | `bg-card` + `rounded-none` (0px) — never add border-radius to cards |
| Buttons (default) | `rounded-full` (9999px) — `shape="pill"` is the default |
| Buttons (embedded CTA) | `shape="sharp"` for inlined/surface-flush buttons |
| Primary accent | `bg-lp-amber` / `text-lp-amber` — **only** for CTAs and active nav states |
| Success | `text-lp-green` / `bg-lp-green/15` |
| Error | `text-lp-red` / `bg-lp-red/15` |
| Borders | `border-border` (`#44403c`) — always use this token |
| Muted text | `text-muted-foreground` (`#a89984`) |

Never introduce new accent colors. `lp-amber` is the only brand accent.

## Component Rules

- All UI primitives from `components/ui/` (ShadCN-based, customized for dark theme)
- Page-level layout components in `components/admin/` or `components/marketing/`
- `"use client"` only when the component uses: hooks, event listeners, browser APIs
- Server components fetch data directly; client components use React Query hooks

## State Management — Strict Separation

| Data type | Tool | Location |
|---|---|---|
| Server / async data | TanStack Query | `hooks/use*.ts` |
| UI state (filters, modals, sidebar) | Zustand | `stores/*.ts` |
| Auth session | NextAuth `auth()` / `useSession()` | Built-in |

**Never** store server data in Zustand. **Never** use React Query for pure UI state.

## React Query Conventions

```typescript
// Query key format: ["resource", "action", ...params]
["leads", "list", filters]       // list with filters
["leads", "detail", id]          // single item
["runs", "list"]                  // pipeline runs
["approvals", "list"]             // pending emails
```

Default `staleTime`: `30_000` (30 seconds). Set `staleTime: 0` for approval queue (real-time feel).

## Data Fetching Pattern

```typescript
// hooks/useLeads.ts
export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ["leads", "list", filters],
    queryFn: () => api.get<Lead[]>("/leads", { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}
```

All API calls go through `lib/api.ts` (Axios instance with auth interceptor). Never call `fetch` directly.

## Auth Pattern

- `auth()` for server components: `const session = await auth()`
- `useSession()` for client components
- Token forwarded to backend in Axios interceptor via `Authorization: Bearer <token>`
- `NEXTAUTH_SECRET` is shared between frontend and backend — must be identical

## TypeScript Rules

- `exactOptionalPropertyTypes: false` (relaxed for React prop patterns)
- Use `React.ComponentProps<typeof ComponentName>` to extend ShadCN component types
- Type all React Query `queryFn` return types explicitly
- No `any` — use `unknown` or generics for dynamic shapes

## Linting

Next.js built-in ESLint config is active. Run `npm run lint` before committing.
