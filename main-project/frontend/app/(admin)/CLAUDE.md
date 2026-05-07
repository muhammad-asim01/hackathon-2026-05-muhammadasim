# Admin App Routes

All routes under `(admin)/` are protected by `middleware.ts` — unauthenticated requests redirect to `/login`.

## Route Map

```
app/(admin)/
├── layout.tsx                    ← Admin shell: Sidebar + MobileNav + Header
├── dashboard/
│   ├── page.tsx                  ← /dashboard — KPI cards + quick stats
│   ├── agent/page.tsx            ← /dashboard/agent — pipeline runner
│   ├── leads/
│   │   ├── page.tsx              ← /dashboard/leads — LeadsTable
│   │   └── [id]/page.tsx         ← /dashboard/leads/:id — LeadDetail
│   ├── approvals/page.tsx        ← /dashboard/approvals — ApprovalQueue
│   ├── runs/
│   │   ├── page.tsx              ← /dashboard/runs — RunList
│   │   └── [id]/page.tsx         ← /dashboard/runs/:id — RunDetail with SSE log
│   ├── analytics/page.tsx        ← /dashboard/analytics — Recharts analytics
│   └── settings/page.tsx         ← /dashboard/settings — SettingsForm
└── login/page.tsx                ← /login — Google OAuth sign-in button
```

## Page Pattern

Pages are thin wrappers — they set `metadata` and render one component:
```typescript
// app/(admin)/dashboard/agent/page.tsx
export const metadata: Metadata = { title: "Agent | sift.ai" };
export default function AgentPage() {
  return <div className="p-6 lg:p-8"><AgentPanel /></div>;
}
```

Server components fetch metadata; client components own all interactivity.

## Auth

- `middleware.ts` at repo root protects all `/(admin)/*` paths.
- `login/page.tsx` uses `signIn("google")` from NextAuth v5.
- Admin layout checks session server-side with `auth()` and redirects if missing.

## Layout

- Sidebar: `w-[220px]` fixed, `hidden md:flex`.
- MobileNav: `md:hidden` bottom bar at `h-14`.
- Content area: `flex-1 overflow-auto`.
- Page wrapper: `p-6 lg:p-8` with `max-w-6xl` on most pages.

## `[id]` Dynamic Routes

Params are `Promise<{ id: string }>` in Next.js 15 App Router:
```typescript
// Always await params
const { id } = await params;
```
