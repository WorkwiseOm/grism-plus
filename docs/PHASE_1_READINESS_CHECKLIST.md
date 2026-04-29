# Phase 1 Readiness Checklist

Last updated: 2026-04-28.

This document is the closeout view for Phase 1. It separates what is already working locally from what still needs deployment, account, governance, or customer-facing approval before pilot use.

## Current Status

Phase 1 is locally functional for the core talent-development workflow:

- L&D admin can review IDPs, approve them, request changes, reject to draft, and generate guarded AI drafts.
- Employee can view their IDP, see the 70/20/10 blend, read L&D feedback, and submit OJT evidence.
- Manager can view direct reports, see the OJT evidence queue, and validate or return submitted evidence.
- L&D admin can edit competency taxonomy fields with impact counts and audited writes.
- Coach login is intentionally routed to a gated workspace until assigned-coachee RLS exists.

Phase 1 is **not yet pilot-ready** because external deployment and governance gates remain open.

## Completed Local Scope

| Area | Status | Notes |
| --- | --- | --- |
| Data loaders and app shell | Done | Role-aware navigation, server-side loaders, authenticated layouts. |
| Phase 1 development schema | Done on approved dev DB | `00013` applied and verified on the existing Supabase dev database only. |
| OJT evidence write flows | Done on approved dev DB | Employee submission and manager/admin validation RPCs verified with rollback-only checks. |
| L&D IDP approval queue | Done | Approval, return-for-changes, reject-to-draft, status filters, blend guardrails. |
| Employee IDP workspace | Done | IDP detail, blend panel, OJT assignment panel, evidence submission, latest L&D feedback. |
| Manager team cockpit | Done | Direct-report rollup and OJT validation queue. |
| Framework editor | Done for safe MVP edits | Direct taxonomy edits only; draft/publish/versioning deferred. |
| AI-assisted IDP draft | Done as guarded, opt-in path | Uses pseudonymisation, output validation, and structured error logging. No live call has been run by Codex. |
| Unberry integration | Adapter done | Local validation/mapping layer only. No live Unberry API call, credential, webhook, or import UI. |
| Notifications/nudges | Planning helpers done | Deterministic queue-row builder only. No email sending. |
| Coach | Safely gated | Coach no longer inherits manager workspace while coach RLS remains tenant-wide. |

## Verification Snapshot

Local verification on 2026-04-28:

- `npm run lint` - clean, with the known Next 15 `next lint` deprecation notice.
- `npm run typecheck` - clean.
- `npm test` - 172 passed, 13 skipped.
- `npm run build` - clean production build, 18 generated app routes.

Skipped tests are opt-in E2E tests that require live credentials and `RUN_E2E_TESTS=1`.

Remote verification on 2026-04-28:

- `master` is pushed to `origin/master` at `a382c28`.
- GitHub Actions CI workflow `lint / typecheck / test / build` - green on `a382c28`.
- CodeQL workflow `Analyze (javascript-typescript)` - green on `a382c28`.
- Branch protection on `master` confirmed via GitHub API: 2 required status checks (CI + CodeQL), strict status checks, 1 required PR review with stale dismissal, conversation resolution required, force-pushes and deletions blocked, `enforce_admins: false` (solo-dev override on direct admin pushes; bypass is logged by GitHub).

## Open Blockers

These are the remaining blockers before any pilot customer access.

| Blocker | Owner | Required action |
| --- | --- | --- |
| Vercel app-code smoke | Operator with Vercel access | Use a Vercel-authenticated browser or automation bypass token to verify app routes reach Next.js, not just Vercel SSO. |
| Client IP trust | Operator with Vercel access | Verify the trusted header source for rate limiting before public pilot. |
| Subprocessor activation | Tariq approval | Apply `00012_activate_vercel_subprocessor.sql` only after the intended Vercel project is confirmed as active for Grism Plus. |
| Anthropic data-retention setting | Tariq / Anthropic account owner | Verify account data-retention posture before live AI use with pilot data. |
| Live AI smoke | Tariq approval required | Run one explicit, pseudonymised admin-triggered AI draft only after Anthropic settings and cost acceptance are confirmed. |
| Unberry production shape | Grism / Unberry owner | Confirm credentials, API base URL, webhook signing, allowed fields, and whether the product covers development assessments. |
| Resend/email activation | Tariq approval | Keep email/nudges disabled until Resend is intentionally activated and subprocessor posture is current. |
| Coach RLS | Engineering | Add assigned-coachee model and RLS before enabling real coach screens. Current coach workspace is intentionally gated. |

## Manual Product Review Checklist

Use the local app and the seeded demo personas to review:

- `/admin/idps`
  - status filters work.
  - pending IDP can be approved when blend guardrail passes.
  - request-changes comment is saved and visible later.
  - reject-to-draft preserves feedback and increments version.
  - AI draft button is visible but should not be used with live Anthropic until retention/cost are approved.
- `/employee/idp`
  - employee sees only their own plans.
  - latest L&D feedback is visible.
  - OJT evidence submission flow is clear.
- `/manager/team`
  - manager sees only direct reports.
  - evidence validation queue is visible.
  - approve/request-changes/reject validation actions are clear.
- `/admin/frameworks`
  - competency edit form works for allowed L&D admin.
  - impact counts are understandable before save.
  - publish/versioning remains clearly deferred.
- `/coach`
  - coach sees the gated message, not manager data.

## Local Demo Mode Caveat

A local-only persona switcher is wired into `/auth/sign-in` to reduce auth friction during Phase 1 review. It is **strictly localhost-only** and **must not be enabled in any deployed environment**.

Activation requires all three of the following at the same time:

- `NODE_ENV` is not `production` (Vercel sets `production` on every deploy, so this fails on Vercel by definition).
- `DEMO_AUTH_RELAXED=true` in `.env.local` (off by default).
- The request's Host header resolves to a loopback address (`localhost`, `127.0.0.1`, or `::1`).

When all three hold, the sign-in page surfaces a "Local demo only" panel with one button per seeded persona, and middleware MFA enforcement is skipped so L&D admin / superadmin screens are reviewable without TOTP. The persona switcher only lists personas whose password env var is actually set; missing entries are silently hidden, never error.

Persona passwords come from per-persona env vars in `.env.local` (placeholders documented in `.env.local.example`). The committed code holds only the persona id, label, and email — never the password. The seed script (`scripts/seed_phase1_demo.ts`) rotates these passwords on every run; copy the values from the seed's stdout tempfile into `.env.local` after each rotation.

Defence-in-depth tests live in `tests/auth/demo-mode.test.ts`, `tests/auth/demo-personas.test.ts`, and `tests/auth/demo-action.test.ts` — they assert the gate stays closed for every Vercel-style host, every `NODE_ENV=production` combination, and every missing/wrong-cased flag value. The server action also re-evaluates the gate at submit time, so a stale page rendered on localhost cannot be replayed against a deployed server.

This shortcut **does not weaken production auth**: deployed Vercel builds never satisfy the gate, normal Supabase Auth + MFA + role guards remain in force, and no fake roles are injected at the application layer.

## Deferred From Phase 1

These are deliberately not part of the Phase 1 closeout:

- Full framework draft/publish/version-history model.
- Full coach workspace and assigned-coachee data model.
- Unberry live API/webhook ingestion.
- Email delivery and scheduled nudge sending.
- Production SOC 2 Type II certification.
- Broad mobile polish beyond the authenticated shell and existing responsive layout.
- Production customer deployment under final domain.

## Recommended Next Steps

1. Perform the local manual product review checklist above.
2. Close Vercel app-code smoke and client-IP-trust checks.
3. Decide whether to activate Vercel in the subprocessor register.
4. Only then run a pilot-readiness review with Grism stakeholders.
