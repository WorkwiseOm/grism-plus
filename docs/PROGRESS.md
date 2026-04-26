# Progress — Grism Plus

## Phase 0 progress

### 2026-04-26 - Step 9 local readiness refresh

Local Step 9 readiness was rechecked after the Next 15 upgrade: lint, typecheck, tests, build, and `npm audit` all pass. `docs/STEP_9_DEPLOYMENT_GATES.md` now references the actual `subprocessors.reviewed_at` column, the README stack version matches Next 15, and `supabase/migrations/00012_activate_vercel_subprocessor.sql` is prepared but must not be applied until Vercel is live.

### 2026-04-26 — Next.js security upgrade spike complete

Local security-upgrade spike moved Next.js and `eslint-config-next` from 14.2.35 to 15.5.15, updated server-side cookie/header usage for Next 15's async request APIs, and added an npm override so Next's nested PostCSS resolves to `8.5.10`. Verification passed: lint, typecheck, tests, build, and `npm audit` (0 vulnerabilities). Follow-up: `next lint` is deprecated in Next 15 and should be migrated to the ESLint CLI before any future Next 16 upgrade.

### 2026-04-26 — Step 10 complete (Phase 1 execution plan)

`docs/PHASE_1_PLAN.md` now describes the Phase 1 scope, entry criteria, non-goals, product slices, cross-cutting work, pilot gates, build order, and known risks. It intentionally treats Phase 1 as a demo/pilot execution plan rather than a production readiness claim.

### 2026-04-26 — Step 9 prepared, external actions gated

`docs/STEP_9_DEPLOYMENT_GATES.md` records the first-deploy checks, required Vercel/GitHub/Supabase operator actions, environment variables, subprocessor activation rule, smoke checks, and stop conditions. No Vercel deploy or cloud migration has been run from Codex.

### 2026-04-26 — Step 6 complete (Anthropic AI client wrapper)

Step 6 adds the first application-level AI boundary: the official Anthropic TypeScript SDK, a small `src/lib/ai` wrapper for non-streaming Messages API calls, per-node prompt contracts for the four planned AI nodes (`idp_generation`, `modality_recommender`, `ojt_recommender`, `coaching_brief`), and mocked tests that prove no live Anthropic call is required during CI.

The prompt-safety contract was tightened at the same time: `PseudonymisedEmployee` now exposes only role/context fields plus an 8-hex-char pseudonym, and the AI wrapper rejects direct identifier keys (`email`, `employee_id`, `employee_number`, `tenant_id`, `user_profile_id`, etc.) before any SDK call. This turns the security-doc pseudonymisation promise into a compile-time and runtime boundary for future AI nodes.

### 2026-04-25 — Step 5 complete (Arwa Energy demo seed)

Demo fixture seeded into cloud Supabase: 1 tenant, 21 user_profiles, 20 employees with manager hierarchy, the Arwa Energy Core Competency Framework (5 categories × 4 competencies = 20 leaves + 5 parent rows), 196 competency_scores, 12 IDPs distributed across 8 pending_approval / 2 active / 1 draft / 1 completed (with the 8 pending IDPs hand-designed across the variety dimensions agreed in spec — category coverage, gap magnitude, originator, milestone count, modality mix), 12 assessments, 35 idp_milestones, 55 idp_actions, 10 OJT activities, 10 eLearning courses, 7 elearning_enrolments + 7 ojt_assignments tied to the active and completed IDPs.

Idempotent and deterministic: re-running the script produces identical row counts and IDP shape (deterministic via mulberry32 seeded on `DEMO_SEED_VARIANT`, default `'arwa-energy-demo-v1'`). The 5 persona passwords (Yusuf superadmin, Aisha ld_admin, Khalid/Fatima/Omar managers) are rotated each run and printed to stdout once; the other 16 users get random passwords that are generated and discarded immediately.

**Audit trigger silent-failure mode for child tables without direct tenant_id discovered during seed; resolved via per-table FK lookup in 00010 migration.** The original `write_audit_log()` in 00001 read `NEW.tenant_id` directly and swallowed missing-column errors, producing INSERT failures on `idp_milestones`, `idp_actions`, and `ojt_evidence` with non-obvious symptoms. Treated as a real production-runtime fix, committed separately ahead of the seed.

Commits:

- `870980b` — feat: add Phase 1 demo seed (Arwa Energy fixture - 1 tenant, 21 users, 20 competencies, 12 IDPs, 10+10 catalogues, deterministic re-runs)
- `f059435` — fix: resolve audit_log.tenant_id for child tables without direct tenant_id column (idp_milestones, idp_actions, ojt_evidence)

### 2026-04-24 — Step 4 complete (vertical slice 2 closes Step 4)

Slice 2 adds the remaining middleware + UI layer on top of the infrastructure landed in the preceding migrations (00003–00007): cleanup (`getAll`/`setAll` cookie pattern, `@base-ui` removal, `auth_unknown_role_fallback` enum), password policy validator, idle timeout enforcement with throttled activity refresh (00008 + 00009), login rate limit wired into middleware against the `check_login_rate_limit` RPC, and the full MFA flow (enrolment page, challenge page, enforcement middleware branch).

**Manual MFA end-to-end verification** completed by Tariq on 2026-04-24 against cloud Supabase with a real TOTP authenticator. Both flows confirmed:

- First-time enrolment: sign-in → `/auth/mfa/enrol` → QR scan → 6-digit verify → `/admin` lands with session elevated to aal2.
- Returning-user challenge: sign-out → sign-in → `/auth/mfa/challenge` → 6-digit verify → `/admin`.

Slice 2 commits (most recent first):

- `60a592b` — test: middleware MFA redirect coverage; update sign-in-flow for MFA-required users
- `c7e96d1` — feat: middleware MFA enforcement (redirect aal1 users with required-MFA roles to enrol or challenge)
- `88e73ba` — feat: MFA challenge page with per-user rate limit
- `ac63c74` — feat: MFA enrolment page with QR code and TOTP verify
- `a37ba99` — feat: login rate limit middleware (5 failed attempts per 15 min per IP, writes login_failure/login_rate_limited events)
- `b24df97` — docs: log test parallelism trade-off as PROGRESS.md backlog item
- `1dbeee0` — docs: annotate 00009 as corrective migration for 00008 search_path bug
- `079a27b` — feat: idle timeout enforcement via RPC (per-tenant timeout, throttled activity updates)
- `a5378b4` — feat: password policy validator (12 chars, complexity) for signup/reset flows
- `8349ade` — chore: slice 2 cleanup (getAll/setAll cookie pattern, remove @base-ui, add auth_unknown_role_fallback enum, log coach role scope question)

Still open from slice 2 for Phase 1+:

- Coach-role landing page scope question — backlog entry above.
- Multi-test-user seeding to partition E2E tests and restore vitest file parallelism — backlog entry above.
- Pre-planted TOTP factor fixture so the `/admin` page-render test can be restored (currently skipped in `tests/auth/sign-in-flow.test.ts`).

### 2026-04-24 — Step 4 vertical slice 1 complete

Minimum slice verified end-to-end: sign-in page, auth middleware, role-based redirect, and three placeholder landing pages. The seeded `ld_admin` test user authenticates against cloud Supabase and lands on `/admin`; unauthenticated requests to protected routes redirect to `/auth/sign-in`. Six e2e tests pass under `RUN_E2E_TESTS=1`.

Commits (most recent first):

- `5e499ec` — test: e2e sign-in flow coverage (opt-in via RUN_E2E_TESTS)
- `1e1b778` — feat: placeholder landing pages for employee, manager, admin roles
- `2772a15` — feat: root page role-based redirect
- `782868c` — feat: minimal middleware (static asset bypass + auth-required redirect)
- `f71a630` — feat: sign-in page with email/password auth (Shadcn Card form)
- `bb96fae` — chore: `scripts/seed_test_user.ts` for Step 4 login verification (one tenant + one ld_admin user)
- `55e12a1` — chore: Shadcn components for auth UI (card, input, label, button, alert, form)

Supporting infrastructure migrations (ready for slice 2 wiring):

- `b9c496c` — `user_profiles.last_activity_at` column for idle-timeout middleware
- `8c3aa56` — `check_mfa_rate_limit()` per-user MFA failure rate limit
- `7fce4b9` — `user_mfa_required_but_missing()` helper + `mfa_factor_reset_by_admin` enum value
- `4eb1b96` — `check_login_rate_limit(inet)` + partial index + `login_rate_limited` enum value

Explicitly deferred to slice 2: rate-limit call wiring in middleware, MFA enforcement middleware, `/auth/mfa/enrol` and `/auth/mfa/challenge` pages, password policy validation route for signup/reset, idle-timeout enforcement (column is ready, logic is not), mocked middleware unit tests.

### 2026-04-23 — Step 3C complete

Subprocessor register seeded and reconciled with deployment reality. Five subprocessors persisted in cloud; `docs/subprocessors.md` updated to match (Sydney for Supabase dev project, Vercel marked not-yet-provisioned until Phase 0 Step 9).

Commit: `9917f75`

## Phase 1 inputs

### Unberry integration scope for Phase 1

- **Decision**: Unberry is the Phase 1 assessment platform. iMocha deferred to Phase 2 or Phase 3 based on client demand.
- **Rationale**: Single integration to build and validate before doubling surface area. Grism has provided Unberry's API doc, indicating partner momentum.

**Open questions that BLOCK Phase 1 IDP engine build** (must be answered before Phase 1 kickoff):

1. **Credentials** — does Grism Plus obtain its own Unberry API key, or does the integration flow through Grism's credentials? Affects auth architecture, error handling, rate limit allocation, and Data Processing Agreement scope.
2. **Product variant** — does Unberry offer a competency-development assessment distinct from its ATS/hiring product? The doc received describes a candidate/job-centric ATS API. Grism Plus needs employee/competency-centric assessment data. If no development variant exists, we must design a mapping layer that treats each Grism Plus employee as an Unberry "candidate" and each competency as a "job posting". Workable but not elegant.

**Action items**:

- Tariq to raise both questions with Grism before Phase 1 kickoff.
- Tariq to request webhook secret provisioning process and production API base URL from Grism (current doc references dev environment only: `ats-dev.unberry.com`).

## Backlog

- Data classification modelled as Postgres enum (public/internal/confidential/restricted) — adequate for MVP and SOC 2 readiness. Consider promoting to a reference table if per-classification metadata (handling rules, retention defaults, UI colours) becomes needed. Tracked as post-MVP item.
- Session idle timeout enforcement — Step 4 deliverable. Supabase Auth's `inactivity_timeout` is Pro-tier only; enforce in Next.js middleware that checks time-since-`last_activity_at` against `tenants.idle_timeout_minutes` on every authenticated request and forces re-auth past threshold.
- Rate limiting (5 failed sign-ins per 15-minute rolling window per IP) — Step 4 deliverable. Next.js middleware with pg-backed counter keyed on IP and outcome=failure. Supabase Auth native `sign_in_sign_ups` left at default 30/5-min as safety net (Option B).
- Pseudonym collision space — resolved in Step 6 by expanding employee pseudonyms from 4 to 8 hex chars (4.3B values, collision-negligible at enterprise scale for expected tenant sizes) and tightening `PseudonymisedEmployee` to expose only role/context fields plus the pseudonym. Sequential per-session pseudonym maps remain a possible future improvement if debugging traceability becomes necessary.
- Supabase Pro tier upgrade — unlocks Time-box user sessions, Inactivity timeout, and other session controls. Revisit in Phase 4 when scoping production deployment or when a client security review specifically demands it.
- Incident response runbook — Phase 4 deliverable. Scope with Grism JSC and first pilot client security review input. Skeleton now would be speculative and would likely need full rewrite later.
- MFA enforcement UI and enrolment flow — Step 4 deliverable. Will check tenants.mfa_required_roles array at login and gate ld_admin/superadmin roles on MFA completion.
- Subprocessor register fidelity — add handling_notes text column to subprocessors table and backfill: (a) Anthropic's zero-retention-enabled assertion, (b) Anthropic's pseudonymisation-in-app-code-before-every-API-call enforcement claim, (c) GitHub's no-customer-data explicit negation, (d) any future vendor handling assertions that don't fit as data category labels. Phase 4 deliverable, or earlier if a customer security review demands it.
- RLS aal2 requirement for ld_admin-accessed sensitive tables — supplement middleware MFA enforcement with RLS guards on coaching_briefs, competency_scores, ojt_evidence, and audit_log requiring (auth.jwt() ->> 'aal')::text = 'aal2' for ld_admin role. Phase 4 deliverable or earlier on security review request. Defence-in-depth layer; middleware remains primary enforcer.
- MFA recovery codes (`mfa_recovery_codes` table + enrolment-time code generation + recovery-code challenge path). Currently MFA reset requires admin intervention via `supabase.auth.admin.mfa.deleteFactor`. Acceptable for MVP and early pilots where admin availability is high. Before wider rollout: generate 10 one-time recovery codes at enrolment (hashed with argon2 server-side), show once, allow use on challenge screen. Phase 4 deliverable, or earlier if a customer security review demands it.
- Email notification on `mfa_enrolled` events — when a new authenticator is bound to an account, send an email via Resend to the account holder ("An authenticator was added. If this wasn't you, contact admin.") to mitigate the forced-enrolment-race attack. Deferred because it depends on Resend integration (Step 5+). Activation trigger: when the first nudge email is sent end-to-end in Step 5, this email notification must ship in the same commit or the next commit. This prevents the feature from being perpetually deferrable.
- MFA multi-device friendlyName — if users commonly enrol multiple factors (new device, old device), consider per-device friendlyName like "Grism Plus - <device hint>" so users can distinguish entries in their authenticator app. Currently all factors show "Grism Plus". Phase 4 or when user feedback indicates confusion.
- Coach role landing page and Phase 1 scope — currently mapped to `/manager` view since coaches supervise coachees and manager view approximates. Revisit before Phase 1 kickoff: does coach need a dedicated `/coach` landing with a coachee list view, or does manager view remain appropriate? Phase 1 scope question for the IDP coaching modality.
- Test suite runs serially (vitest fileParallelism: false) because E2E tests share cloud DB state on the single seeded test user's user_profiles.last_activity_at row. Trade-off: suite gets slower as tests are added. Mitigation for Phase 1+: seed multiple test users and partition tests by user, restoring parallelism. Not urgent for MVP — expected Phase 0/Phase 1 test suite stays under 50 files.
- Audit trigger pattern documentation — `write_audit_log()` now has per-table CASE branches for child tables (idp_milestones, idp_actions, ojt_evidence). As new tables are added to the schema, especially child tables without direct `tenant_id` columns, this function MUST be updated. Consider adding a CI check that fails if a new audited table is missing from the function's CASE statement. Phase 4 deliverable; not urgent for MVP but useful as the schema grows.
- Coach RLS hardening before pilot/production exposure of coach screens — current state: RLS for `employees`, `idps`, and related tables grants the `coach` role tenant-wide visibility under existing tenant-isolation predicates (no per-assignment join is gated on). For Phase 0/demo scaffolding this is intentional — it lets a coach persona browse the seed without an assignment table, and the `/manager` landing already serves coaches. Before any pilot or production exposure of coach-facing screens, this must be replaced with assigned-coachee access. Likely shape: a `coach_assignments` (or equivalent) table linking the coach's user/employee row to their coachee employee rows, plus per-table RLS predicates on `employees`, `idps`, `idp_milestones`, `idp_actions`, `competency_scores`, and any future `coaching_briefs` rows that require `EXISTS (SELECT 1 FROM coach_assignments ca WHERE ca.coach_id = current_employee_id() AND ca.coachee_id = <row>.employee_id)`. Treat as a Phase 1 scope decision if coach workflows are in pilot scope; otherwise as a pre-production hardening gate. Distinct from the earlier "Coach role landing page" backlog item, which addresses UI scope; this entry addresses the data-layer authorisation boundary regardless of UI shape. `docs/security.md` § "Role-based access control" has been updated to flag that the assignment-scoped predicate is aspirational, not the current implementation.
- IP header trust for rate limiting — middleware currently reads `x-real-ip` then the first `x-forwarded-for` value. Safe only if the production edge/platform overwrites client-supplied forwarding headers. Before public pilot/production: verify the Vercel→Supabase request chain end-to-end, document the trusted client-IP source, and adjust middleware to use the platform-provided signal (e.g., the runtime-provided `request.ip` if available, or whichever hop Vercel documents as trusted). Until then, rate-limit bypass via spoofed headers is theoretically possible; impact is contained to login attempts, and Supabase Auth's 30/5-min native cap remains in force as a backstop. Phase 4 deployment hardening, not a local-dev blocker. See `docs/security.md` § "Client-IP source for rate limiting and audit" for the in-depth note.
