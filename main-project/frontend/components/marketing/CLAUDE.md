# Marketing Components

Static, server-renderable components for the public site. No TanStack Query, no Zustand, no `"use client"` unless the component has event listeners or form state.

## Component Purpose

| Component | Notes |
|---|---|
| `MarketingNav.tsx` | Top nav — logo left, links center, sign-in right. `"use client"` for mobile hamburger menu toggle if present. |
| `Hero.tsx` | Full-width hero section. Asymmetric layout (text left, asset right). CTA uses `rounded-full` amber button. |
| `FeaturesBento.tsx` | CSS Grid bento — asymmetric tile layout. No 3-equal-column patterns. Cards are `rounded-none`. |
| `HowItWorks.tsx` | Numbered steps or timeline. Server component. |
| `PipelineTerminal.tsx` | Simulated terminal output — uses CSS `lp-fade-in` keyframe with cascade delays. No `framer-motion`. |
| `TechStrip.tsx` | SVG logo strip, no interactivity. |
| `CTABanner.tsx` | Conversion banner near footer. Amber CTA button. |
| `FooterPublic.tsx` | Links grid + copyright. Server component. |

## Rules

- No emojis — use Lucide icons.
- No `framer-motion` — use `globals.css` keyframes.
- No new accent colors — only `lp-amber`, `lp-green`, `lp-red`.
- No `rounded-lg`/`rounded-xl` on cards — always `rounded-none`.
- All interactive elements: `cursor-pointer`, hover feedback via `transition-colors duration-150`.
- CTA buttons: `rounded-full bg-lp-amber text-background`.
