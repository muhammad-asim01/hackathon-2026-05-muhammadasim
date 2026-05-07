# Marketing App Routes

Public site — no authentication, SSR. Google-indexed pages.

## Route Map

```
app/(marketing)/
├── layout.tsx          ← Marketing shell: MarketingNav + FooterPublic
├── contact/
│   ├── page.tsx        ← /contact — contact form
│   └── contact-form.tsx ← client component with form state
├── pricing/page.tsx    ← /pricing — pricing tiers
├── privacy/page.tsx    ← /privacy — privacy policy
├── terms/page.tsx      ← /terms — terms of service
└── compare/page.tsx    ← /compare — comparison table vs competitors
```

The root `/` page (homepage) lives at `app/page.tsx` (not inside the `(marketing)` group) but uses the same `MarketingNav` and `FooterPublic`.

## Components (`components/marketing/`)

| Component | Description |
|---|---|
| `Hero.tsx` | Landing hero — headline, CTA button, demo screenshot |
| `FeaturesBento.tsx` | Asymmetric bento grid of feature highlights |
| `HowItWorks.tsx` | Step-by-step pipeline walkthrough |
| `PipelineTerminal.tsx` | Animated terminal showing agent log output (CSS keyframes only) |
| `TechStrip.tsx` | Logo strip of integrated tech |
| `CTABanner.tsx` | Bottom-of-page conversion banner |
| `MarketingNav.tsx` | Top nav with logo, links, sign-in button |
| `FooterPublic.tsx` | Site footer with links and legal |

## Design

Same design tokens as admin (`bg-background`, `lp-amber` for CTAs) — dark theme throughout. No rounded cards; consistent `rounded-none` panels.

## No Auth

Marketing routes have no `requireAuth` middleware. `middleware.ts` only protects `/(admin)/*` paths.

## Server Components

All marketing pages are React Server Components (no `"use client"`) except `contact-form.tsx` which needs form state. Never add TanStack Query or Zustand to marketing components.
