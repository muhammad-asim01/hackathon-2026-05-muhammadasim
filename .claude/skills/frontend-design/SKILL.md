---
name: frontend-design
description: SiftAi Frontend Engineer. Bridges design intent and production code for the Next.js 15 + Tailwind v4 + ShadCN stack. Enforces correct patterns for server vs client components, React Query hooks, Zustand stores, and type-safe API calls. Blocks common Next.js App Router anti-patterns.
---

# SiftAi Frontend Engineering Skill

## 1. STACK CONSTANTS

**Always verify before importing any library:**
```bash
# Check package.json first
cat package.json | grep -E '"(framer-motion|gsap|@tanstack|zustand|axios|recharts)"'
```

| Library | Version | Import Pattern |
|---|---|---|
| Next.js | 15 (App Router) | — |
| React | 19 | `import { ... } from "react"` |
| TypeScript | 5 | strict mode, `exactOptionalPropertyTypes: false` |
| Tailwind CSS | v4 | `@import "tailwindcss"` — no config file |
| ShadCN UI | custom | `@/components/ui/` |
| TanStack Query | v5 | `useQuery`, `useMutation` from `@tanstack/react-query` |
| Zustand | v5 | `import { create } from "zustand"` |
| Axios | latest | `@/lib/api` — never call `fetch` directly |
| Lucide React | latest | icon imports |
| Recharts | latest | chart components |
| Sonner | latest | `toast()` notifications |

---

## 2. COMPONENT DECISION TREE

```
Does the component need:
├── useState / useEffect / event listeners / browser APIs?
│   └── YES → "use client" at top
└── NO → Server Component (default, no directive needed)
    └── Fetches data? → Call directly with async/await
```

**CRITICAL RSC rules for Next.js App Router:**
- Never import server-only code into client components
- `auth()` → server components only; `useSession()` → client components only
- Async layout/page components are valid (no need for `"use client"`)
- Context providers MUST be wrapped in a `"use client"` component

---

## 3. FILE STRUCTURE CONVENTIONS

```
frontend/
├── app/
│   ├── (admin)/          # Auth-gated routes — layout has sidebar
│   │   ├── layout.tsx    # async server component — calls auth()
│   │   └── dashboard/
│   │       ├── page.tsx  # server component — renders client islands
│   │       ├── leads/
│   │       ├── runs/
│   │       ├── approvals/
│   │       └── settings/
│   ├── (marketing)/      # Public SSR — no auth
│   ├── audit/[publicId]/ # Public prospect-facing
│   └── api/auth/         # NextAuth handlers
├── components/
│   ├── ui/               # ShadCN primitives — DO NOT modify structure
│   ├── admin/            # Admin-specific layout components
│   └── marketing/        # Marketing-specific components
├── hooks/                # React Query hooks — use*.ts
├── stores/               # Zustand stores — use*.ts
├── lib/
│   ├── api.ts            # Axios instance with auth interceptor
│   └── utils.ts          # cn() and misc
└── styles/
    └── tokens.css        # Design tokens
```

---

## 4. REACT QUERY PATTERNS

### Query Key Convention
```typescript
["leads", "list", filters]      // paginated/filtered list
["leads", "detail", id]         // single resource
["runs", "list"]                 // pipeline runs
["approvals", "list"]            // pending emails — staleTime: 0
["audit", publicId]              // public audit report
```

### Hook Template
```typescript
// hooks/useLeads.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Lead, LeadFilters } from "@/types";

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ["leads", "list", filters],
    queryFn: (): Promise<Lead[]> =>
      api.get("/leads", { params: filters }).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useApproveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/leads/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals", "list"] }),
  });
}
```

### staleTime Rules
| Data type | staleTime |
|---|---|
| Leads list / detail | `30_000` (30s) |
| Pipeline runs | `30_000` |
| Approval queue | `0` (real-time feel) |
| Settings | `Infinity` (set once) |

### Loading / Error States
```tsx
const { data, isLoading, isError, error } = useLeads(filters);

if (isLoading) return <LeadsSkeleton />;
if (isError) return <ErrorState message={error.message} />;
return <LeadsList leads={data} />;
```

---

## 5. ZUSTAND STORE PATTERNS

Only use Zustand for **UI state**: filters, sidebar open/close, modal visibility, selected rows. Never store server data here.

```typescript
// stores/useLeadFilters.ts
import { create } from "zustand";

interface LeadFiltersStore {
  search: string;
  status: "all" | "new" | "contacted" | "cold";
  setSearch: (search: string) => void;
  setStatus: (status: LeadFiltersStore["status"]) => void;
  reset: () => void;
}

const defaults = { search: "", status: "all" as const };

export const useLeadFilters = create<LeadFiltersStore>((set) => ({
  ...defaults,
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
  reset: () => set(defaults),
}));
```

**Hard rules:**
- Never `set({ data: await fetch(...) })` — that's React Query's job
- Never use Zustand for form state — use `useState` or `react-hook-form`
- Store names: `use<Resource><Concern>.ts` e.g. `useLeadFilters.ts`, `useSidebarStore.ts`

---

## 6. API CLIENT USAGE

```typescript
// lib/api.ts exports a pre-configured Axios instance with auth
import { api } from "@/lib/api";

// GET with params
const leads = await api.get<Lead[]>("/leads", { params: { status: "new" } });

// POST with body
const run = await api.post<PipelineRun>("/runs", { niche, city });

// DELETE
await api.delete(`/leads/${id}`);
```

**Never use `fetch()` directly.** The Axios instance handles:
- Base URL from `NEXT_PUBLIC_API_URL`
- `Authorization: Bearer <token>` injection
- Response type safety

---

## 7. AUTH PATTERNS

```typescript
// Server component (layout, page, server action)
import { auth } from "@/auth";
const session = await auth();
if (!session) redirect("/login");

// Client component
import { useSession } from "next-auth/react";
const { data: session } = useSession();
const userEmail = session?.user?.email;
```

**Token forwarding:** The Axios interceptor in `lib/api.ts` reads the session token via `getSession()` and attaches it as `Authorization: Bearer`. Never manually attach tokens in hooks.

---

## 8. TYPESCRIPT RULES

```typescript
// Extend ShadCN component types correctly
type ButtonProps = React.ComponentProps<typeof Button> & {
  loading?: boolean;
};

// Type React Query queryFn explicitly
queryFn: (): Promise<Lead[]> => api.get("/leads").then(r => r.data)

// No `any` — use unknown or generics
function parseResponse<T>(raw: unknown): T {
  return raw as T; // at least constrain with a guard
}

// Optional props pattern (exactOptionalPropertyTypes: false)
interface Props {
  className?: string;
  onSuccess?: () => void;
}
```

---

## 9. TAILWIND v4 SPECIFICS

**Config file:** None — Tailwind v4 uses CSS-first config via `@import "tailwindcss"` in globals.css.

**Custom tokens** are defined in `styles/tokens.css` using `@theme`:
```css
@theme {
  --color-lp-amber: #cab16a;
  --color-lp-green: #86b38a;
  --color-lp-red: #c47060;
  --color-background: #0c0a09;
  --color-card: #1c1917;
  --color-border: #44403c;
  --color-foreground: #fafaf9;
  --color-muted-foreground: #a89984;
}
```

**Do NOT:**
- Create `tailwind.config.ts` (v4 doesn't use it)
- Use `@apply` for complex utilities (prefer inline classes)
- Use `theme()` function in CSS (use CSS variables directly)

**Arbitrary values** — use sparingly:
```tsx
// OK — one-off pixel-perfect value
<div className="w-[220px]">

// OK — design token not in Tailwind
<div style={{ animation: "lp-slide-up 0.4s ease both" }}>

// NOT OK — should use token
<div className="bg-[#cab16a]">  // use bg-lp-amber instead
```

---

## 10. COMMON PAGE PATTERNS

### Admin Page (Server Component + Client Island)
```tsx
// app/(admin)/dashboard/leads/page.tsx
import type { Metadata } from "next";
import { LeadsPanel } from "@/components/admin/LeadsPanel"; // "use client"

export const metadata: Metadata = { title: "Leads | Sift.ai" };

export default function LeadsPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Businesses discovered by the Scout Agent
        </p>
      </div>
      <LeadsPanel />
    </div>
  );
}
```

### Client Panel with React Query
```tsx
// components/admin/LeadsPanel.tsx
"use client";

import { useLeads } from "@/hooks/useLeads";
import { useLeadFilters } from "@/stores/useLeadFilters";

export function LeadsPanel() {
  const filters = useLeadFilters();
  const { data: leads, isLoading } = useLeads(filters);

  if (isLoading) return <LeadsSkeleton />;
  return <LeadsTable leads={leads ?? []} />;
}
```

### Toast Notifications
```typescript
import { toast } from "sonner";

// Success
toast.success("Email approved and queued");

// Error
toast.error("Failed to connect to API");

// Loading (returns ID for dismissal)
const id = toast.loading("Running agent...");
toast.dismiss(id);
```

---

## 11. ANTI-PATTERNS TO BLOCK

| Anti-pattern | Correct approach |
|---|---|
| `"use client"` on layout files | Layout is always server component |
| `fetch()` in hooks | Use `api.get()` from `@/lib/api` |
| Server data in Zustand | Server data lives in React Query |
| `useState` for approval queue data | `useQuery` with `staleTime: 0` |
| `any` type | `unknown` + type guard or generic |
| `import { ... } from "framer-motion"` | Not installed — use CSS keyframes |
| `tailwind.config.ts` edits | Edit `styles/tokens.css` for new tokens |
| Hardcoded `#cab16a` | Use `bg-lp-amber` token |
| `rounded-lg` on admin cards | `rounded-none` — panels are always sharp |
| `h-screen` on hero sections | `min-h-[100dvh]` |
| Multiple API call locations | All calls through `@/lib/api` only |
| `console.log` in production code | Remove or use structured logger |

---

## 12. LINTING & BUILD CHECKS

```bash
# Before committing
npm run lint          # Next.js ESLint
npx tsc --noEmit     # TypeScript check (no output files)

# Dev server
npm run dev           # Port 3000

# Production build test
npm run build         # Check for any build errors
```

**Windows note:** If `npm run build` fails with ENOENT on `app-build-manifest.json`, run `rm -rf .next && npm run build` — this is a known Windows file-system race condition in Next.js static page collection, not a code bug.
