# Audit App Route

Public prospect-facing audit report — no authentication required.

## Route

```
app/audit/
└── [publicId]/
    └── page.tsx    ← /audit/:publicId — AuditReport component
```

## Data Fetching

Server-side fetch via native `fetch()` (not Axios — no auth interceptor needed):
```typescript
await fetch(`${apiUrl}/public/audit/${publicId}`, {
  next: { revalidate: 30 },  // ISR: revalidate every 30s
})
```

Returns `PublicAuditLead` (all analyst fields optional — may be empty before Analyst agent runs).

- `404` from API → `notFound()` → Next.js 404 page.
- Any other error → returns `null` → also `notFound()`.
- `NEXT_PUBLIC_API_URL` env var must be available at build time.

## Component

`components/audit/AuditReport.tsx` — server-renderable (no `"use client"`):
- Displays business name, city, niche, contact info.
- Shows `digitalScore` with color coding (matches `scoreVariant()` logic).
- Shows PageSpeed, mobile score, SSL badge when available.
- Shows review sentiment, top issue, excerpt.
- Includes a public CTA for the prospect.

## Metadata

`generateMetadata` fetches the same data to produce per-page title/description for SEO:
```
Title: "Digital Audit — <businessName> | sift.ai"
Description: "Automated digital presence audit for <businessName>, <city>. Score: X/100."
```

## Design

Same dark design tokens as the admin panel (`bg-background`, `text-lp-amber`, etc.) for brand consistency. No sidebar or admin navigation — full-width layout.
