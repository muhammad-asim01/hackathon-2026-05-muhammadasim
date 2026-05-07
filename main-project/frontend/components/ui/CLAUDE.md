# UI Primitives (ShadCN-based)

Customized ShadCN components tuned for the Huashu dark theme. Do not use raw ShadCN defaults — these overrides are load-bearing.

## Available Primitives

| Component | Key Customizations |
|---|---|
| `button.tsx` | Default shape: `rounded-full`. `shape="sharp"` prop for `rounded-none` (inline/surface-flush contexts). Primary variant: `bg-lp-amber text-background`. |
| `badge.tsx` | Supports `variant`: `"default"`, `"success"` (`text-lp-green bg-lp-green/15`), `"error"` (`text-lp-red bg-lp-red/15`), `"warning"` (`text-lp-amber bg-lp-amber/10`), `"muted"` (`text-muted-foreground bg-border/30`). |
| `card.tsx` | Always `rounded-none`. Background `bg-card`. Border `border-border`. |
| `input.tsx` | `bg-background border-border rounded-none`. Focus: `border-lp-amber/50`. |
| `dialog.tsx` | Modal overlay. `rounded-none` content panel. |
| `sheet.tsx` | Slide-in panel (used for mobile filters). |
| `skeleton.tsx` | `bg-border/40 animate-pulse rounded-none`. |
| `sonner.tsx` | Toast config — dark theme, `bg-card border-border`. |
| `label.tsx` | Form label above inputs. |
| `table.tsx` | Base table primitives — used inside `LeadsTable`. |

## Badge Variants and Score

Use `scoreVariant(score)` from `lib/types.ts` to get the correct badge variant:
```typescript
<Badge variant={scoreVariant(lead.digitalScore)}>
  {lead.digitalScore ?? "—"}
</Badge>
```

Score mapping:
- `≤ 30` → `"error"` (red)
- `≤ 55` → `"warning"` (amber)
- `> 55` → `"default"` (foreground)
- `null` → `"muted"` (gray)

## Rules

- Never import from `@shadcn/ui` directly — always from `@/components/ui/`.
- Never override `rounded-*` on cards or add `shadow-lg`.
- Never add new color variants to badge/button — only the existing 5 variants.
- Always use `cn()` from `lib/utils` for conditional class composition.
