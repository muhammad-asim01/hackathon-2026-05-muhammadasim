# sift.ai

## Stack
- Language: TypeScript 5 (strict, zero `any`)
- Backend framework: Express 5
- Frontend framework: Next.js 15 App Router (React 19)
- DB: PostgreSQL 16 via Prisma 6
- Package manager: npm
- Runtime: Node.js 22

## Architecture (1 paragraph)
The backend is a Clean Architecture Express 5 API on port 4000. Agents (Scout → Analyst → Writer → Tracker → Reporter) are isolated use-cases in `application/use-cases/`; the only orchestrator is `RunPipeline.ts`. Each agent writes `RunEvent` rows that are streamed to the frontend via a long-lived SSE endpoint. The frontend is a Next.js App Router app: an admin dashboard behind NextAuth v5 (Google OAuth) and public audit report pages with no auth. Data flows: user → API route → use-case → IPort interface → infrastructure adapter → Prisma → PostgreSQL. The 5 most important files are: `backend/src/application/use-cases/pipeline/RunPipeline.ts`, `backend/src/interface/http/routes/pipeline.router.ts`, `frontend/app/(admin)/dashboard/agent/page.tsx`, `frontend/hooks/useLeads.ts`, `backend/src/config/container.ts`.

## Directory map
- `main-project/backend/src/domain/`           — entities, value objects, errors (zero external deps)
- `main-project/backend/src/application/`      — use-cases + IPort interfaces (no framework imports)
- `main-project/backend/src/infrastructure/`   — Prisma repos, OSM/PageSpeed/LLM/Gmail adapters
- `main-project/backend/src/interface/http/`   — Express routes, middleware, Zod DTOs
- `main-project/frontend/app/`                 — Next.js App Router pages ((admin), (marketing), audit/)
- `main-project/frontend/components/`          — UI (admin/, marketing/, audit/, ui/ ShadCN primitives)
- `main-project/frontend/hooks/`               — TanStack Query hooks (useLeads, useRuns, useApprovals…)
- `main-project/frontend/stores/`              — Zustand UI state (filters, sidebar, modals)
- `main-project/frontend/lib/`                 — Axios client, shared types, utilities

## Conventions
- **Errors:** backend throws typed errors extending `DomainError` from `backend/src/domain/errors.ts`. Never throw raw strings or `new Error()` in use-cases.
- **Logging:** use `logger` from `backend/src/utils/logger.ts` (Pino structured). Never `console.log` in backend code.
- **DB access:** only inside `infrastructure/persistence/repositories/`. Use-cases call repos via injected IPort interfaces — never import Prisma client directly in a use-case.
- **Naming:** use-cases are `VerbNoun.ts` (e.g. `RunPipeline`, `GenerateOutreachEmail`). DB tables are `snake_case` plural. React Query keys: `["resource", "action", ...params]`.
- **State:** TanStack Query for all server/async data. Zustand for UI-only state (filters, modals, sidebar open/closed). Never store server data in Zustand. Never use React Query for pure UI state.
- **Design tokens:** use `bg-lp-amber`, `text-lp-green`, `text-lp-red`, `bg-card`, `bg-background`, `border-border`. Never hardcode hex values. Cards are always `rounded-none`. Buttons are `rounded-full`.

## Build / test / deploy commands
```bash
# Backend
cd main-project/backend
npm install
npm run dev          # Express on :4000
npm run build        # tsc compile
npm run lint         # ESLint
npx prisma migrate dev   # run pending migrations
npx prisma db seed       # seed demo data

# Frontend
cd main-project/frontend
npm install
npm run dev          # Next.js on :3000
npm run build
npm run lint

# E2E tests (from repo root)
npx playwright test
npx playwright show-report
```

## Things to NEVER do
- Never write raw SQL strings. Use Prisma query builder only.
- Never bypass the use-case layer from a route. Routes call use-cases; use-cases call repos.
- Never commit real secrets. Use `.env` (gitignored). Never hardcode API keys in source.
- Never edit `main-project/backend/prisma/migrations/` by hand. Generate via `npx prisma migrate dev`.
- Never import `@anthropic-ai/sdk` outside `infrastructure/external/llm/AnthropicAdapter.ts`.
- Never add `rounded-lg` or `rounded-xl` to cards — panels are always `rounded-none`.
- Never introduce new accent colors — only `lp-amber`, `lp-green`, `lp-red` are allowed.
- Never use `framer-motion` — it is not installed. Use CSS keyframes from `globals.css` (`lp-slide-up`, `lp-fade-in`, `lp-glow-pulse`, etc.).

## Open questions / known weirdness
- Google Sheets sync is scaffolded (`Tracker Agent`) but uses a mock adapter in dev — real Sheets OAuth not wired yet.
- Reporter Agent (end-of-day summary email) is partially implemented — event collection works, email send is mocked.
- Subscription tier enforcement is UI-only — no server-side gate enforcing plan limits yet.
- OSM data has no review counts or ratings — `reviewCount` defaults to 0 for OSM-sourced leads; Google ratings only appear if the Analyst agent runs PageSpeed on a real website.

## Useful sub-files
- `main-project/backend/CLAUDE.md`           — agent patterns, error handling, API rate limits, test conventions
- `main-project/frontend/CLAUDE.md`          — component patterns, Zustand usage, React Query key conventions, design system rules
- `main-project/backend/prisma/schema.prisma` — full data model (Lead, Run, RunEvent, Email, Settings, MapsCache)
- `main-project/frontend/styles/tokens.css`  — CSS custom properties for all design tokens
- `SPEC.md`                                — product spec, acceptance criteria, demo script
