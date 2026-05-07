---
name: huashu-design
description: Huashu Design System — precision dark-mode SaaS aesthetic for Sift.ai. Enforces the exact token set, typographic scale, component patterns, and animation vocabulary of the Sift.ai design language. Blocks generic defaults and AI design clichés.
---

# Huashu Design System — Sift.ai Design Intelligence

## 1. CORE IDENTITY

**Aesthetic DNA:** Inngest × Linear × Vercel dark mode — obsidian surfaces, ember amber accents, terminal-green success states. Everything is deliberate, quiet, and precise. No decoration for decoration's sake.

**Design Philosophy:**
- Surfaces feel like brushed metal in dim light — rich but not flashy
- Amber is sacred — it appears only on interactive CTAs and active states
- White space is not empty — it's structural breathing room
- Every animation serves a purpose: it communicates state, not personality

---

## 2. DESIGN TOKENS (SOURCE OF TRUTH)

Always use these token classes. Never hardcode hex values.

### Background & Surface
| Layer | Token | Hex |
|---|---|---|
| App background | `bg-background` | `#0c0a09` |
| Card / panel surface | `bg-card` | `#1c1917` |
| Elevated surface | `bg-border/10` | — |
| Hover overlay | `hover:bg-border/30` | — |

### Brand Accent — Amber (ONLY for CTAs + active nav)
| Use | Token |
|---|---|
| Primary CTA background | `bg-lp-amber` |
| Active nav text | `text-lp-amber` |
| Active nav background | `bg-lp-amber/10` |
| Accent border glow | `border-lp-amber/20` |
| Muted amber fill | `bg-lp-amber/15` |

**Amber hex reference:** `#cab16a` — Desaturated, warm. Never replace with yellow or gold.

### Status Colors
| State | Text | Background |
|---|---|---|
| Success | `text-lp-green` | `bg-lp-green/15` |
| Error | `text-lp-red` | `bg-lp-red/15` |
| Warning | `text-lp-amber` | `bg-lp-amber/10` |
| Neutral/Running | `text-muted-foreground` | `bg-border/30` |

### Typography
| Role | Token | Notes |
|---|---|---|
| Primary text | `text-foreground` | `#fafaf9` |
| Secondary text | `text-muted-foreground` | `#a89984` |
| Disabled / hint | `text-muted-foreground/50` | — |
| Code / mono | `font-mono text-xs` | Always monospace for terminal output |

### Borders
| Use | Token | Hex |
|---|---|---|
| Standard border | `border-border` | `#44403c` |
| Subtle divider | `border-border/60` | — |
| Active highlight | `border-lp-amber/20` | — |
| Success highlight | `border-lp-green/20` | — |

---

## 3. SHAPE & GEOMETRY RULES

**Cards:** `rounded-none` — 0px border radius. NEVER round cards. Cards are architectural panels.

**Buttons (default):** `rounded-full` — Pills only. Shape conveys action vs. structure.

**Buttons (flush/embedded):** Use `shape="sharp"` or `rounded-none` when the button is inlined within a card surface (e.g., inside a table row, inside a panel header).

**Icons:** Lucide React, `w-4 h-4` for nav/inline, `w-5 h-5` for status indicators. strokeWidth `1.5` resting, `2` for active/emphasis.

**Spacing rhythm:** `p-3`, `p-4`, `p-5`, `p-6` — multiples of 4px. Never `p-7` or odd values.

---

## 4. COMPONENT ANATOMY

### Panel / Card
```tsx
<div className="bg-card border border-border rounded-none p-5">
  {/* header */}
  <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/60">
    <h2 className="text-sm font-semibold text-foreground">Panel Title</h2>
    <span className="text-xs text-muted-foreground">subtitle</span>
  </div>
  {/* body */}
</div>
```

### Status Dot (inline indicator)
```tsx
// idle
<span className="w-1.5 h-1.5 rounded-full bg-border" />
// running — CSS animate-spin or custom pulse
<span className="w-1.5 h-1.5 rounded-full border border-lp-amber border-t-transparent animate-spin" />
// done
<span className="w-4 h-4 text-lp-green">✓</span>
// error
<span className="w-1.5 h-1.5 rounded-full bg-lp-red" />
```

### Primary Button (CTA)
```tsx
<button className="bg-lp-amber text-background font-semibold text-sm px-5 py-2 rounded-full hover:bg-lp-amber/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
  Run Agent
</button>
```

### Input Field
```tsx
<input className="w-full bg-background border border-border rounded-none px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-lp-amber/50 transition-colors" />
```

### Log / Terminal Line
```tsx
<p className="font-mono text-xs text-muted-foreground leading-relaxed">
  <span className="text-lp-amber/60">›</span> {logMessage}
</p>
```

---

## 5. ANIMATION VOCABULARY

Only use these animation primitives. Do NOT reach for framer-motion (not installed). Use CSS keyframes defined in `globals.css`.

### Available Keyframes
```css
/* Slide up + fade in — for result cards, toasts */
@keyframes lp-slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Spring pop — for done state indicators */
@keyframes lp-step-done {
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

/* Shake — for form validation errors */
@keyframes lp-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}

/* Glow pulse — for running state indicators */
@keyframes lp-glow-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(202,177,106,0); }
  50%       { box-shadow: 0 0 0 4px rgba(202,177,106,0.15); }
}

/* Fade in — generic reveal */
@keyframes lp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

### Usage Pattern
```tsx
// Slide up on mount
<div style={{ animation: "lp-slide-up 0.4s ease both" }}>

// Step done spring pop
<span style={{ animation: "lp-step-done 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}>

// Error shake
<form style={{ animation: showError ? "lp-shake 0.35s ease both" : undefined }}>
```

### Transition Defaults
- State transitions: `transition-colors duration-150`
- Border/glow transitions: `transition-all duration-200`
- Never animate `width`, `height`, `top`, `left` — use `transform` and `opacity` only

---

## 6. PIPELINE / AGENT UI PATTERN

The canonical animation pattern for multi-step async processes in Sift.ai:

**Three states:** `idle` | `running` | `complete` | `error`

**Border color by state:**
- idle: `border-border/60`
- running: `border-lp-amber/20`
- complete: `border-lp-green/20`
- error: `border-lp-red/20`

**Step indicator states:**
```
idle    → dim gray dot
running → spinning amber ring (border-t-transparent animate-spin)
done    → spring-pop green checkmark (lp-step-done animation)
error   → solid red dot
```

**Simulation pattern (chained setTimeout, no external deps):**
```tsx
const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

function startPipeline() {
  let ms = 0;
  STEPS.forEach((step, i) => {
    timers.current.push(setTimeout(() => setStatus(step.id, "running"), ms));
    ms += 200;
    step.logs.forEach((log, j) => {
      timers.current.push(setTimeout(() => addLog(step.id, log), ms + j * step.intervalMs));
    });
    ms += step.logs.length * step.intervalMs + 240;
    timers.current.push(setTimeout(() => {
      setStatus(step.id, "done");
      if (i === STEPS.length - 1) setRunStatus("complete");
    }, ms));
    ms += 300;
  });
}

// Cleanup on unmount
useEffect(() => () => timers.current.forEach(clearTimeout), []);
```

---

## 7. LAYOUT RULES

### Admin Pages
- Page wrapper: `p-6 md:p-8 max-w-3xl` (centered, readable — NOT full-width)
- Section gap: `space-y-6` between major sections
- Panel header height: `h-14` with `flex items-center px-5`
- Sidebar width: `w-[220px]` — fixed, never resizable

### Mobile (< 768px)
- Sidebar: `hidden md:flex` — replaced by bottom `MobileNav`
- MobileNav: `md:hidden` at bottom of main column, `shrink-0`, `h-14`
- Content padding: `p-4` (reduced from `p-8`)
- Stack vertically: all panels go full-width on mobile

### Header
- Height: `h-14 shrink-0`
- Background: `bg-card border-b border-border/60`
- Contains: breadcrumb left + user avatar right

---

## 8. WHAT IS BANNED

**Never introduce:**
- New accent colors (only `lp-amber`, `lp-green`, `lp-red` are allowed)
- `rounded-lg` or `rounded-xl` on cards (panels are always `rounded-none`)
- `shadow-lg` or dark drop shadows — use border + subtle background tint for depth
- `Inter` font (system font stack or inherit from project)
- Emojis in UI (use Lucide icons only)
- Hardcoded hex values instead of design tokens
- `framer-motion` (not installed — use CSS keyframes + `setTimeout` chains)
- `animate-bounce` — too playful; use spring-physics CSS instead
- Multiple accent colors in the same component
- Gradient backgrounds on cards or buttons
- Box shadows for decoration — only use for functional elevation (dropdowns, modals)

---

## 9. QUICK CHECKLIST BEFORE DELIVERY

- [ ] All backgrounds use `bg-background` or `bg-card` tokens
- [ ] Active states use `text-lp-amber` only
- [ ] Cards are `rounded-none`, buttons are `rounded-full`
- [ ] Borders use `border-border` or `border-border/60`
- [ ] No hardcoded hex colors
- [ ] Animations use `lp-*` keyframes from globals.css
- [ ] No framer-motion imports (not installed)
- [ ] Mobile layout uses bottom nav + full-width panels
- [ ] Log/terminal output uses `font-mono text-xs text-muted-foreground`
- [ ] No emojis anywhere in the output
