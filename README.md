# Grism Plus

Multi-tenant talent development execution platform — joint Tilqai × Grism product.

## Status

**Phase 0 — Foundation.** Auth, security posture, RLS, demo seed, and middleware are landed; CI, deploy, and AI client wrapper are still in progress. **Not production ready.** No pilot tenants are connected.

The current `/admin`, `/manager`, and `/employee` landing pages are placeholders. Real Phase 1 product screens require a Stitch wireframe in `/design` before code is written — see [`CLAUDE.md`](CLAUDE.md) → "UI design protocol".

## Stack

- **App:** Next.js 14 (App Router) + TypeScript
- **DB / Auth / Storage:** Supabase (Postgres 17, Auth, RLS, Edge Functions)
- **UI:** Shadcn/UI + Tailwind CSS
- **Tests:** Vitest

## Local commands

```bash
npm run dev            # Next.js dev server (localhost:3000)
npm run lint           # ESLint (next lint)
npm run typecheck      # tsc --noEmit
npm test               # Vitest, default unit + skipped E2E
npm run build          # Next.js production build
npm run types:generate # regenerate src/lib/types/database.ts from cloud schema
```

## Environment setup

All required env vars live in [`.env.local.example`](.env.local.example). Copy it to `.env.local` and fill in real values from the Supabase dashboard.

For topology details (cloud Supabase project, session pooler, Free-tier vs production differences), see [`docs/env-reference.md`](docs/env-reference.md). Secret-handling guidance lives in [`docs/security.md`](docs/security.md) — `.env.local` is gitignored and must never be committed.

## Database and migrations

Schema lives in [`supabase/migrations/`](supabase/migrations/) and is applied with `npx supabase db push --db-url …` (the session-pooler URL is constructed from `SUPABASE_DB_PASSWORD`).

**Hard stop:** never run `supabase config push` against the cloud project. The cloud dashboard is the source of truth for Supabase Auth settings; `config.toml` is local-dev plus versioned documentation of intent. See [`CLAUDE.md`](CLAUDE.md) → "Hard stops".

## Testing

`npm test` runs the default Vitest suite — fast, mock-based unit tests with no external dependencies. E2E tests are opt-in and skipped by default; they require:

- a running `npm run dev` on `localhost:3000`
- seeded users (`scripts/seed_test_user.ts` for the single-user auth flow; `scripts/seed_phase1_demo.ts` for the Arwa Energy demo fixture)
- env vars `RUN_E2E_TESTS=1` and a captured test password (e.g., `TEST_USER_PASSWORD=…`) — see the per-file headers in [`tests/`](tests/) for exact requirements

The suite currently runs with `fileParallelism: false` because tests share cloud DB state. See [`docs/PROGRESS.md`](docs/PROGRESS.md) backlog.

## Demo seed

`npx tsx scripts/seed_phase1_demo.ts` populates a single-tenant Arwa Energy fixture: 1 tenant, 21 user_profiles, 20 employees, a 20-competency framework, 12 IDPs across all status states, and OJT + eLearning catalogues. Idempotent and deterministic (mulberry32 seeded on `DEMO_SEED_VARIANT`). Persona credentials are generated fresh on each run and printed once to stdout — they are **not** persisted to disk and are **not** included in this repo.

## Security posture

Grism Plus targets SOC 2 Type II, currently posture-ready but **not certified**. Certification is gated on organisational work (policies, training, governance) and is deferred until a sales trigger requires it. Read [`docs/security.md`](docs/security.md) for the full posture, RLS model, audit trail design, AI / third-party data handling, and the explicit gap list.

The subprocessor register lives at [`docs/subprocessors.md`](docs/subprocessors.md) and is mirrored in the application's `subprocessors` table.

## Repo map

```
src/                — Next.js app, components, server-side helpers
supabase/migrations — schema + RLS, applied via `supabase db push`
scripts/            — seed scripts (test user, demo fixture, schema verifier)
tests/              — Vitest suites (unit + opt-in E2E)
docs/               — security, env reference, progress log, subprocessors,
                       OJT reference, module library
design/             — Stitch wireframes (.pen) for Phase 1+ product screens
```

## Phase milestones

Phase progress is tracked in [`docs/PROGRESS.md`](docs/PROGRESS.md). Phase 1 (IDP engine, OJT recommender, coaching briefs) starts after Phase 0 closes — open Phase 0 work is in the Backlog section of that file.
