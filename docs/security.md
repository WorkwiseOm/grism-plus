# Security — Grism Plus

Status: **SOC 2 technically ready; certification deferred until sales trigger.**

Last reviewed: 2026-04-23 by Tariq Al-Maskari.

This document describes Grism Plus's security posture, the controls we have implemented, the controls that depend on Tilqai-Grism joint governance, and the gap between our current state and a full SOC 2 Type II certification. It is intended to be reviewable by a prospective customer's security team.

## Scope

Grism Plus is a multi-tenant SaaS talent development platform. It processes employee PII, assessment scores, and development journey data on behalf of enterprise clients. Grism Plus is jointly owned and operated by Tilqai and Grism under a Memorandum of Understanding pending a Definitive Agreement.

The security posture described here applies to the production application stack. Development environments follow a similar but relaxed posture, documented in `docs/env-reference.md`.

## Trust Services Criteria alignment

Grism Plus targets compliance with the following SOC 2 Trust Services Criteria:

- **Security** (common criteria — mandatory)
- **Availability** — commitments on uptime, backup, disaster recovery
- **Confidentiality** — commitments on data handling, encryption, access control

Privacy and Processing Integrity are not currently in scope for MVP but will be reviewed at Phase 4.

## Architecture security controls

### Tenant isolation

Every row of business data in Grism Plus carries a `tenant_id` that references the owning client. Row-level security policies enforced at the Postgres level prevent any query — authenticated or otherwise — from crossing tenant boundaries. RLS is enabled on every table; policies are defined in migration `00001_initial_schema.sql`.

Helper functions `current_tenant_id()`, `current_role_is()`, and `current_employee_id()` run with `security definer` and read the authenticated user's context. They return NULL safely when no auth context is present, which causes all subsequent RLS predicates to fail-closed rather than fail-open.

### Authentication and session management

Authentication is handled by Supabase Auth, which is itself SOC 2 Type II certified as part of Supabase Platform.

Per-tenant configuration on the `tenants` table controls:

- `session_timeout_minutes` — default 720 (12 hours). Access tokens expire after this period.
- `idle_timeout_minutes` — default 30. Inactive sessions are revoked.
- `mfa_required_roles` — default `['ld_admin', 'superadmin']`. Users with these roles must complete MFA enrolment before accessing production data.

Authentication events — successful logins, failures, password resets, MFA challenges, session revocations — are recorded in the `security_events` table. This stream is append-only at the database level (triggers block UPDATE and DELETE).

### Role-based access control

Five roles are defined: `employee`, `manager`, `ld_admin`, `coach`, `superadmin`.

- `employee` — sees only their own records
- `manager` — sees their own records plus direct reports
- `coach` — read-only access to assigned coachees
- `ld_admin` — tenant-wide administrative access
- `superadmin` — cross-tenant support access, used only by Tilqai-Grism operational staff under documented access review

Access reviews are conducted quarterly and logged in the `access_reviews` table.

### Data classification

Every PII-bearing table carries a `data_classification` column with one of four values:

- `public` — may be disclosed externally
- `internal` — restricted to tenant members
- `confidential` — PII, access on need-to-know basis
- `restricted` — sensitive PII (competency scores, coaching notes), access requires explicit justification

Classifications are propagated to every audit log entry. Data of higher classification triggers stricter handling in exports and backups.

### Audit logging

Every mutation (INSERT, UPDATE, DELETE) on a PII-bearing table writes an entry to `audit_log` capturing:

- Actor identity (Supabase Auth user ID)
- Tenant context
- Entity table and row ID
- Full before and after state as JSONB
- Data classification of the record
- IP address and user agent from the request context
- Timestamp

`audit_log` is append-only. Database triggers block UPDATE and DELETE on the table even for the database superuser at the application layer. Physical deletion of audit rows requires direct database access at the Supabase infrastructure level, which is itself audited by Supabase.

Tables covered: `idps`, `idp_milestones`, `idp_actions`, `ojt_assignments`, `ojt_evidence`, `competency_scores`, `employees`, `assessments`, `user_profiles`, `coaching_briefs`, `elearning_enrolments`, `retention_policies`.

### Data retention

The `retention_policies` table holds tenant-configurable retention periods per entity type. Example policy: "delete employee records 2 years after `deleted_at`." Retention enforcement is implemented as a scheduled Supabase Edge Function in Phase 3; until then, retention is policy-only.

### Soft delete

All domain tables carry a `deleted_at` column. Deletion is logical by default — the row is marked deleted, continues to exist for audit and retention purposes, and becomes invisible to RLS queries. Hard deletion happens only through the retention enforcement job or explicit data subject requests.

### Encryption

Data in transit uses TLS 1.3 for all public traffic (enforced by Vercel for the application and by Supabase for the database API). Internal service calls between Edge Functions and the database use Supabase's managed TLS connections.

Data at rest is encrypted by Supabase at the disk level using AES-256. Field-level encryption for specific columns is not currently implemented; it will be evaluated if a specific customer security review requires it.

Secrets (API keys, service role keys, SMTP credentials) are stored in Vercel environment variables and Supabase project settings. No secret is ever committed to source control. `.env.local` is in `.gitignore`.

### AI and third-party data handling

Four AI nodes in Grism Plus send data to Anthropic's Claude API:

- IDP generation — sends employee role, target role, and competency gap list
- Modality recommender — sends competency gap context
- OJT recommender — sends competency gap, employee role, and OJT catalogue candidates
- Coaching brief — sends IDP status and recent OJT activity

**PII pseudonymisation for AI prompts is a Phase 1 commitment.** Before sending employee data to Claude, the application replaces real names with stable session-scoped pseudonyms (e.g., `Employee_A1B2`). Employee IDs, email addresses, and tenant names are never sent. Anthropic is documented in our subprocessor register (`docs/subprocessors.md`). Anthropic is SOC 2 Type II certified and offers a Data Processing Agreement.

Zero-day retention is enabled on Anthropic API calls where available.

## Infrastructure controls

### Hosting

- **Application** — Vercel (SOC 2 Type II certified, HIPAA BAA available)
- **Database, Auth, Storage, Edge Functions** — Supabase Platform (SOC 2 Type II certified)
- **Email** — Resend (SOC 2 Type II certified)
- **AI** — Anthropic (SOC 2 Type II certified)

### Change management

- All code changes flow through pull requests
- CI enforces type-check, lint, and RLS test suite on every PR
- Dependabot enabled for dependency vulnerability alerts
- GitHub CodeQL enabled for static analysis
- Merges to `main` require approval from at least one reviewer
- Production deployments to Vercel are gated on `main` branch status

### Backup and recovery

- Supabase automated daily backups retained for 7 days (free tier) / 30 days (paid tier)
- Point-in-time recovery available on paid tier — target for Phase 4
- Quarterly restore drill planned from Phase 4 onward, documented in `docs/runbooks/restore-drill.md`
- RTO target: 4 hours. RPO target: 24 hours. These targets tighten in Phase 4.

### Vulnerability management

- Dependabot for npm and GitHub Actions
- CodeQL for static analysis of TypeScript and SQL
- Third-party penetration test planned before first paid pilot (Phase 4 gate)
- Vulnerability disclosure policy at `/security` on the production domain — Phase 4 deliverable

## Incident response

Incident response procedures are documented in `docs/runbooks/incident-response.md` (Phase 1 deliverable). Severity tiers:

- **SEV-0** — data breach confirmed, customer notification required
- **SEV-1** — production outage affecting multiple tenants
- **SEV-2** — production outage affecting single tenant
- **SEV-3** — degraded service, workaround available
- **SEV-4** — non-production issue

On-call rotation and communication protocols are Phase 4 deliverables.

## Known gaps against full SOC 2 Type II

This section is maintained openly so that internal and external reviewers understand current posture honestly.

### Technical gaps closing in Phase 1

- PII pseudonymisation for AI prompts — in progress
- Incident response runbook — in progress
- Data export and deletion workflows — in progress

### Organisational gaps — deferred until sales trigger

- Formal written information security policies (20+ documents expected)
- Employee security awareness training programme
- Background check process for privileged users
- Joint Tilqai-Grism security governance committee and CISO-equivalent role (belongs in Definitive Agreement, not MoU)
- Annual risk assessment
- Formal business continuity plan and disaster recovery testing
- Vendor management programme beyond subprocessor register
- Formal access review schedule and evidence retention

### Certification itself

Grism Plus is not currently SOC 2 certified. Certification is achievable within 9–12 months once organisational work begins. Technical posture will not be the rate-limiter.

## Reporting a security issue

Security issues should be reported privately to [TBD — security contact for Tilqai-Grism joint product, to be established in Phase 4]. Until that contact is published, issues can be reported to security@tilqai.om.

## Review cadence

This document is reviewed quarterly by the Joint Steering Committee or immediately after any material change to architecture, vendor relationships, or controls.
