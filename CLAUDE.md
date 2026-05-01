# CLAUDE.md

## Hard stops

- Never run `supabase config push` against the cloud project. The cloud dashboard is the source of truth for Auth settings. `config.toml` is local-dev only + versioned documentation of intent. `config push` would overwrite dashboard values with local-dev settings. If a setting needs to change in cloud, change it in the dashboard and reflect the intent in `config.toml` as comments.

## Review protocol

- **Show, don't reference.** When proposing content for user review (file diffs, new file contents, SQL, proposed edits), paste the content verbatim in the assistant response body. Do not direct the reviewer to tool output with phrases like "shown above" or "see the diff in the cat output" — tool results are easy to skip or scroll past and are not a durable review surface. Tool output proves execution. The message body presents content for review. Never conflate the two. If content is too long to paste, split the review into smaller reviewable chunks rather than offloading to tool logs.

## UI design protocol

- **Phase 0 placeholder screens may be built directly in Shadcn without Stitch wireframes.** Auth screens, role-based landing pages, and similar infrastructure UIs are throwaway placeholders that will be replaced or significantly evolved in Phase 1. Designing them in Stitch would be wireframing for the bin.

- **From Phase 1 onwards, every real product screen MUST have a reviewed Stitch design before code is written.** "Real product screen" means: a screen the user will actually use to do work (IDP approval, IDP view, manager coachee view, framework editor), or a screen that will be shown to a client or used in a demo. Workflow:
  1. Write the brief in claude.ai (data shape, user goal, edge cases, error states)
  2. Generate the design in Stitch
  3. Save the reviewed design artifact to `/design` in this repo. Preferred artifact: `.pen` when a Stitch MCP/export is available. Acceptable artifact when MCP is unavailable: a Stitch export snapshot with `screen.png`, `code.html`, and a README that marks the HTML as reference-only.
  4. Review wireframe with Tariq (and Grism where their eLearning UX expertise applies)
  5. Build production components from the reviewed design using the repo's Next.js, Shadcn/UI, Tailwind, route guards, data loaders, and RLS model. Generated Stitch HTML must not be copied wholesale into `src/`.

- **Stitch is NOT required for:**
  - Modal confirmations, toast notifications, standard form validation states
  - Simple CRUD lists where Shadcn templates suffice
  - Settings/profile pages with no novel interaction model
  - Any frontend work where the implementation is <200 lines and follows established patterns

- **Hard stop:** No real product screen ships to pilot clients without a reviewed Stitch design artifact in `/design` at the corresponding commit.

## Current phase

**Phase 0 — Closed 2026-05-01.** All ten steps shipped (history below).

**Phase 1 — Execution.** Core L&D / employee / manager / framework workflows are locally functional and visually polished against the Stitch design contract; demo is live at https://grism-plus-app.vercel.app behind an app-level passcode gate. Schema migrations 00013 (development model) and 00014 (OJT evidence write flows) applied to the dev Supabase project. Open work tracked in `docs/PHASE_1_READINESS_CHECKLIST.md`.

Phase 0 step history:

- Step 1 — Next.js 14 + Shadcn baseline
- Step 2 — Cloud Supabase provisioning (`grism-plus-dev`, Sydney, Free tier)
- Step 3A — v2 schema applied to cloud (23 tables, RLS, audit triggers)
- Step 3B — CI scaffolding (Dependabot, CodeQL, CODEOWNERS, PR template), SOC 2 security posture docs, PII pseudonymisation utility, auth hardening docs reconciled with Free-tier constraints
- Step 3C — SOC 2 subprocessor register seeded (5 vendors)
- Step 4 — Auth + middleware + MFA + idle timeout + login rate limit + password policy validator. Manual end-to-end MFA verification confirmed 2026-04-24.
- Step 5 — Arwa Energy demo seed: 1 tenant, 21 users, 20 competencies, 12 IDPs, 10+10 catalogues; idempotent and deterministic.
- Step 6 — Anthropic AI client wrapper (`src/lib/ai/`) with prompt-safety guards, pseudonymised employee context, and mocked tests.
- Step 7 — Docs pass (README replacement, OJT + module-library skeletons, env-reference refresh).
- Step 8 — CI hardening: branch protection on `master` with 2 required status checks (`lint / typecheck / test / build` + `Analyze (javascript-typescript)`), strict status checks, force-push and deletion blocked.
- Step 9 — First Vercel deployment closed 2026-05-01 at https://grism-plus-app.vercel.app (iad1 region, behind app-level passcode gate against the dev Supabase project). Subprocessor activation migration 00012 applied with iad1 location.
- Step 10 — Phase 1 execution plan (`docs/PHASE_1_PLAN.md`).

## Live deployment

- URL: https://grism-plus-app.vercel.app (Vercel `iad1`, US East / Washington DC).
- Access gate: app-level passcode gate (`src/lib/auth/demo-gate.ts`) enforced by middleware step 0 when both `DEMO_AUTH_RELAXED=true` and `DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION=true` are set in Vercel production env. Vercel Pro doesn't include Deployment Protection on production aliases on this plan, so the app-level gate is the network-layer protection.
- Demo persona switcher renders behind the passcode gate; signs in via `/api/auth/demo-sign-in`, resolves password from per-persona env var server-side, never exposes credentials to the client.
- Maintenance: persona passwords rotate every time `scripts/seed_phase1_demo.ts` runs locally. Re-sync to Vercel with `npx tsx scripts/sync-demo-passwords-to-vercel.ts --redeploy`.

## Design decisions log

- 2026-04 — Cloud Supabase project provisioned in Sydney region. Accepted for MVP dev despite Muscat-to-Sydney latency (~150ms+). Region will be reconsidered when production deployment is scoped.
- 2026-05-01 — First Vercel deployment shipped to `iad1` (Vercel's default for the team), not Frankfurt as originally documented in `00002_seed_subprocessors.sql` and `docs/subprocessors.md`. Reconciled because the deploy is internal-demo-only behind a passcode gate against the dev Supabase project; subprocessor register now reflects iad1 reality. Frankfurt move is framed as the future production-pilot decision against the first customer contract's data-residency requirements; would land as a follow-up subprocessor migration.
