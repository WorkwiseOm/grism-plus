# Progress — Grism Plus

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
- Pseudonym collision space — current 4-hex-char pseudonyms provide 65,536 unique values. Birthday-paradox collision probability reaches ~50% at ~300 employees per tenant. Risk: AI conflates two employees with same pseudonym in a single coaching brief. Step 4 deliverable: expand to 8 hex chars (4.3B values, collision-negligible at enterprise scale) OR use sequential pseudonym IDs stored per-session (no collision possible, traceable, reversible for debugging).
- Supabase Pro tier upgrade — unlocks Time-box user sessions, Inactivity timeout, and other session controls. Revisit in Phase 4 when scoping production deployment or when a client security review specifically demands it.
- Incident response runbook — Phase 4 deliverable. Scope with Grism JSC and first pilot client security review input. Skeleton now would be speculative and would likely need full rewrite later.
- MFA enforcement UI and enrolment flow — Step 4 deliverable. Will check tenants.mfa_required_roles array at login and gate ld_admin/superadmin roles on MFA completion.
- Subprocessor register fidelity — add handling_notes text column to subprocessors table and backfill: (a) Anthropic's zero-retention-enabled assertion, (b) Anthropic's pseudonymisation-in-app-code-before-every-API-call enforcement claim, (c) GitHub's no-customer-data explicit negation, (d) any future vendor handling assertions that don't fit as data category labels. Phase 4 deliverable, or earlier if a customer security review demands it.
- RLS aal2 requirement for ld_admin-accessed sensitive tables — supplement middleware MFA enforcement with RLS guards on coaching_briefs, competency_scores, ojt_evidence, and audit_log requiring (auth.jwt() ->> 'aal')::text = 'aal2' for ld_admin role. Phase 4 deliverable or earlier on security review request. Defence-in-depth layer; middleware remains primary enforcer.
- MFA recovery codes (`mfa_recovery_codes` table + enrolment-time code generation + recovery-code challenge path). Currently MFA reset requires admin intervention via `supabase.auth.admin.mfa.deleteFactor`. Acceptable for MVP and early pilots where admin availability is high. Before wider rollout: generate 10 one-time recovery codes at enrolment (hashed with argon2 server-side), show once, allow use on challenge screen. Phase 4 deliverable, or earlier if a customer security review demands it.
- Email notification on `mfa_enrolled` events — when a new authenticator is bound to an account, send an email via Resend to the account holder ("An authenticator was added. If this wasn't you, contact admin.") to mitigate the forced-enrolment-race attack. Deferred because it depends on Resend integration (Step 5+). Activation trigger: when the first nudge email is sent end-to-end in Step 5, this email notification must ship in the same commit or the next commit. This prevents the feature from being perpetually deferrable.
- MFA multi-device friendlyName — if users commonly enrol multiple factors (new device, old device), consider per-device friendlyName like "Grism Plus - <device hint>" so users can distinguish entries in their authenticator app. Currently all factors show "Grism Plus". Phase 4 or when user feedback indicates confusion.
