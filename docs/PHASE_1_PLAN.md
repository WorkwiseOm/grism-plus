# Phase 1 Plan - Grism Plus

Status: draft execution plan

Last updated: 2026-04-26

## Purpose

Phase 1 turns the Phase 0 foundation into a usable talent-development workflow for the Arwa Energy demo tenant and the first pilot conversations. It should prove the core loop:

1. Assessment data surfaces competency gaps.
2. L&D reviews and approves an IDP.
3. Employees, managers, and coaches execute the plan through eLearning, OJT, and coaching actions.
4. Progress, evidence, and activity stay auditable.

Phase 1 is not the production hardening phase. It must still avoid architectural shortcuts that would make pilot hardening expensive later.

## Entry Criteria

Phase 1 should not start until these Phase 0 gates are complete:

- CI exists and runs lint, typecheck, tests, and build.
- First Vercel deployment path is proven, or a deploy blocker list exists with owners.
- Anthropic AI wrapper exists with mocked tests and prompt-safety guards.
- Arwa Energy demo seed can be re-run deterministically.
- `.env.local.example`, `docs/env-reference.md`, and `docs/security.md` describe the current environment and data-handling assumptions.
- Branch protection is configured in GitHub settings to require the CI check.

## Non-Goals

Do not include these in Phase 1 unless a pilot requires them:

- Billing, pricing, subscriptions, or tenant self-service provisioning.
- Full SOC 2 Type II certification evidence collection.
- Broad coach workflow suite beyond assigned-coachee read/execution needs.
- SCORM/xAPI implementation.
- Multi-assessment-provider support beyond the chosen Unberry path.
- Production-scale observability, on-call, or incident runbooks.

## Product Slices

### Slice 1 - Data Access and Route Foundations

Goal: create reusable server-side data loaders and role-aware query boundaries before screen implementation.

Deliverables:

- Shared app shell for authenticated product screens.
- Server-side route guards stay in place for `/admin`, `/manager`, and `/employee`.
- Query helpers for:
  - current employee context
  - IDP summary
  - IDP detail with milestones and actions
  - manager team rollup
  - framework tree
- Explicit loading, empty, and authorization states.

Security requirements:

- No service-role reads in product pages unless a server API route verifies the caller first.
- Coach views must not ship to pilot unless assigned-coachee RLS is implemented.
- IDP and evidence queries must stay tenant-scoped through RLS, not only app filters.

### Slice 2 - L&D Admin IDP Approval Queue

Primary persona: L&D admin.

Goal: let an L&D admin review, approve, return, or edit generated/manual IDPs.

Suggested route:

- `/admin/idps`
- `/admin/idps/[id]`

Core screen:

- Queue grouped by status: pending approval, draft, active, completed.
- Filters for department, manager, gap category, modality mix, and risk/overdue state.
- IDP review panel with employee role context, competency gaps, milestones, recommended actions, and narrative.
- Approve, return for revision, or edit actions with confirmation where appropriate.

Acceptance checks:

- L&D admin can approve a pending IDP.
- Employee and manager cannot access the approval queue.
- Approval writes audit_log rows through existing triggers.
- Returned IDPs preserve prior version context.

### Slice 3 - Employee IDP View

Primary persona: employee.

Goal: give an employee a clear "what do I do next" screen for their active or pending IDP.

Suggested route:

- `/employee/idp`
- `/employee/idps/[id]`

Core screen:

- IDP hero summary: current role, target role, status, progress, target date.
- "What's next" action strip.
- Milestone timeline with eLearning, OJT, and coaching actions.
- Narrative tab.
- Activity tab.
- People tab for manager, coach, and L&D owner.

Acceptance checks:

- Employee can see only their own IDPs.
- Employee can update allowed progress fields only.
- OJT evidence upload/submission flow is explicit and auditable.
- Empty state handles employees with no active IDP.

### Slice 4 - Manager Team and Coachee View

Primary persona: manager.

Goal: give managers a daily-driver team rollup and drilldown into each direct report's development plan.

Suggested routes:

- `/manager`
- `/manager/team`
- `/manager/team/[employeeId]`

Core screen:

- Team KPI strip.
- Action queue for pending approvals, overdue evidence validation, and coaching gaps.
- Dense team table with IDP status, progress, last activity, and next action.
- Right-side drawer or detail route for a selected direct report.

Acceptance checks:

- Manager sees only direct reports plus their own employee record.
- Manager cannot access tenant-wide admin data.
- Evidence validation and manager notes are visible to the employee where required.
- Direct navigation to employee/admin pages still redirects correctly.

### Slice 5 - Framework Editor

Primary persona: L&D admin.

Goal: manage competency frameworks safely without breaking active IDPs.

Suggested route:

- `/admin/frameworks`
- `/admin/frameworks/[frameworkId]`

Core screen:

- Framework tree with categories and leaf competencies.
- Edit panel for competency fields and proficiency descriptors.
- Coverage panel showing employees, IDPs, and catalogue entries affected by edits.
- Draft/publish flow with confirmation.

Schema questions to resolve before implementation:

- Keep proficiency levels as JSONB on `competencies`, or split into normalized tables.
- Decide whether Phase 1 supports draft framework versions or only edits current demo data.
- Decide how published framework changes affect active IDPs.

Acceptance checks:

- Only L&D admin/superadmin can edit frameworks.
- Published data changes are auditable.
- Destructive changes require confirmation.
- Active IDPs referencing deprecated competencies remain readable.

### Slice 6 - AI-Assisted IDP and Recommendations

Primary personas: L&D admin, manager.

Goal: use the Step 6 Anthropic wrapper for controlled, pseudonymised AI assistance.

AI nodes:

- `idp_generation`
- `modality_recommender`
- `ojt_recommender`
- `coaching_brief`

Implementation rules:

- All Anthropic calls go through `src/lib/ai/anthropic.ts`.
- All employee context goes through `pseudonymiseEmployee()`.
- Payloads must not contain direct identifiers rejected by `assertNoForbiddenPromptKeys()`.
- Prompt inputs and model outputs must be logged at the right abstraction level without storing raw PII.
- Live-call tests remain opt-in; CI uses mocks.

Acceptance checks:

- IDP generation can produce a draft from a fixed, pseudonymised fixture.
- OJT recommender only sees filtered candidate summaries, not full catalogue tables.
- Coaching brief does not include employee names, email addresses, tenant IDs, or employee IDs.
- Failed AI calls write structured `error_log` rows with `ai_node`.

### Slice 7 - Unberry Assessment Integration

Primary persona: L&D admin.

Goal: ingest assessment results from Unberry into the Grism Plus competency model.

Blocking questions:

- Does Grism Plus use its own Unberry credentials or Grism-owned credentials?
- Does Unberry expose a competency-development product, or only candidate/job APIs?
- What is the production base URL?
- How are webhook signatures provisioned and rotated?
- What fields are legally allowed to store and display in Grism Plus?

Implementation shape:

- Start with manual/imported fixture mapping if API credentials are not ready.
- Build an adapter layer that maps Unberry result concepts into `assessments` and `competency_scores`.
- Store raw provider payload only if there is a clear retention and PII policy.
- Add webhook verification before accepting provider callbacks.

Acceptance checks:

- Assessment import creates or updates competency scores deterministically.
- Re-import is idempotent.
- Cross-tenant assessment data cannot be read or written.
- Provider failures do not block existing IDP screens.

### Slice 8 - Notifications and Nudges

Primary persona: employee, manager, L&D admin.

Goal: send useful reminders without creating noisy automation.

Candidate events:

- IDP waiting for approval.
- OJT evidence waiting for validation.
- Milestone overdue.
- Coaching action inactive for 21 days.
- MFA enrolment notification when first transactional email ships.

Implementation rules:

- Use `nudges_sent` as the audit surface.
- Do not send emails until Resend is configured and subprocessor posture is current.
- Every automated nudge needs a dedupe rule and retry policy.

## Cross-Cutting Work

### App Shell and Navigation

Build a restrained enterprise app shell:

- consistent top bar
- role-aware sidebar
- tenant/product identity
- sign-out affordance
- route breadcrumbs for deep screens

Avoid marketing-page composition. These are operational screens.

### Data Model Hardening

Phase 1 must decide:

- whether coach workflows are in pilot scope
- whether `coach_assignments` is required before pilot
- whether framework versioning is normalized or JSONB-backed for MVP
- whether activity feeds come from `audit_log`, explicit event tables, or both

### Testing Strategy

Required test layers:

- Unit tests for pure helpers and AI prompt guards.
- Mocked component/data-loader tests where practical.
- E2E tests for auth, role routing, and one happy path per core workflow.
- RLS verification scripts for any new table or policy.

Keep cloud-state E2E tests opt-in unless test users are partitioned enough to restore parallelism.

### Accessibility and UX Quality

Minimum screen quality:

- Keyboard reachable primary actions.
- Clear focus states.
- Form validation near the field.
- Confirm destructive operations.
- Empty/loading/error states for every data-bearing screen.
- Tables usable on laptop widths without horizontal chaos.

## Pilot Readiness Gates

Before any pilot user gets access:

- CI is required in GitHub branch protection.
- Vercel deployment is proven from `master`.
- Production client-IP source for rate limiting is verified.
- Next.js dependency audit is addressed or risk-accepted with a written rationale.
- Coach RLS is assignment-scoped, or coach login is disabled and documented.
- Anthropic account data-retention settings are verified.
- Subprocessor register matches actual active services.
- No demo credentials are stored in git, docs, issue trackers, or screenshots.

## Suggested Build Order

1. Deploy and environment gates.
2. Data loaders and app shell.
3. L&D admin IDP approval queue.
4. Employee IDP detail.
5. Manager team rollup.
6. AI-assisted draft generation behind an admin-only path.
7. Framework editor.
8. Unberry adapter/import path.
9. Notifications and nudges.
10. Pilot hardening pass.

## Known Risks

- Unberry API product fit is still unresolved.
- Current coach RLS is tenant-wide and must be fixed before coach exposure.
- Framework editor may force schema changes if real versioning is required.
- AI prompt quality cannot be evaluated from mocks alone; live-call evaluation needs a safe fixture set.
- Next.js audit currently reports vulnerabilities that require a major-version path to resolve cleanly.
- Current E2E tests share cloud state and will slow down as workflows grow.
