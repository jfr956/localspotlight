# Repository Guidelines

## Project Structure & Module Organization

The repository currently holds specification docs in `context/`; keep these as the authoritative product brief. When implementing, scaffold a Next.js App Router project under `apps/web/` with feature folders in `app/(dashboard)`, `app/(auth)`, and shared utilities in `app/lib/`. Store shared UI primitives in `packages/ui/`, reusable server logic in `packages/core/`, and Supabase migrations plus RLS policies in `supabase/migrations/`. Media assets, prompts, and fixtures belong in `apps/web/public/` and `packages/core/prompts/`. Treat `.cursor/plans/local-928c70a6.plan.md` as the source of truth for architectural decisions.

## Build, Test, and Development Commands

- `pnpm install` — set up the monorepo workspace (Node 20.x).
- `pnpm dev` — run the Next.js dev server with hot reload at `http://localhost:3000`.
- `pnpm lint` — execute ESLint with the shared config (`next/core-web-vitals`, Tailwind, hooks).
- `pnpm test` — run Vitest unit suites; keep coverage output in `coverage/`.
- `pnpm test:e2e` — execute Playwright flows against a local Supabase instance started via `supabase start`.

## Coding Style & Naming Conventions

Follow TypeScript strict mode with 2-space indentation. Components live under PascalCase directories (`PostSchedulerCard/`), server utilities use camelCase filenames (`scheduleJobs.ts`), and React hooks begin with `use`. Run `pnpm lint --fix` and `pnpm exec prettier --write` before committing. Tailwind utility ordering should follow the `@tailwindcss/classnames-order` plugin, and all prompts or schemas must be checked into version control as JSON or TypeScript constants.

## Testing Guidelines

Write Vitest unit tests alongside source files as `*.test.ts`. Group Playwright specs in `apps/web/tests/e2e/` with descriptive names like `automation-policy.spec.ts`. Aim for 80% line coverage on core automation modules and include RLS regression tests in `supabase/tests/` that assert cross-org isolation using the Supabase CLI. When adding AI prompts, capture golden outputs under `packages/core/prompts/__snapshots__/`.

## Commit & Pull Request Guidelines

Initialize Git if absent and adopt Conventional Commits (`feat:`, `fix:`, `chore:`). Each PR needs: summary of changes, linked Linear/Jira ticket, screenshots or CLI logs for UI/API work, and a checklist confirming lint/tests executed. Request review from security when altering Supabase policies or automation guardrails.

## Security & Configuration Tips

Never bypass row-level security; every new table must include `org_id` plus matching policies. Store Google refresh tokens encrypted via Supabase secrets, and keep service keys outside client bundles. When running locally, load environment vars through `.env.local` and reference the `context/Business Context & Implementation Notes.md` checklist before enabling Autopilot features.
