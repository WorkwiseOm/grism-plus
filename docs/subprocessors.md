# Subprocessors — Grism Plus

This document lists every third-party service that processes customer data on behalf of Grism Plus. It is maintained for SOC 2 vendor management and for prospective customer security reviews.

Last reviewed: 2026-04-24 by Tariq Al-Maskari.

## How to read this register

Each entry documents: the vendor name, the purpose of the engagement, the categories of data processed, the vendor's hosting location, the vendor's SOC 2 and GDPR posture, and a link to the Data Processing Agreement (DPA) where available.

The corresponding `subprocessors` table in the production database holds the machine-readable version of this register and is used by the application for customer-facing transparency features.

## Active subprocessors

### Supabase (Supabase, Inc.)

- **Purpose:** Hosted Postgres database, authentication, row-level security, storage, Edge Functions, vector search
- **Data categories:** all customer data (employee records, assessments, IDPs, OJT evidence, coaching briefs, audit logs)
- **Hosting region:** Sydney, Australia (ap-southeast-2). MVP development project; region selected by operator default during provisioning, not by data residency policy. Production deployment region to be determined by data residency requirements of the first customer contract, most likely Frankfurt for GCC proximity.
- **SOC 2 status:** Type II certified
- **GDPR status:** compliant, DPA executed
- **DPA:** https://supabase.com/legal/dpa
- **Added:** 2026-04

### Vercel (Vercel, Inc.)

- **Purpose:** Next.js application hosting, serverless function execution, edge caching, custom domain TLS
- **Data categories:** request payloads in transit, server-side rendering payloads (may include PII), environment variables (secrets)
- **Hosting region:** Washington, D.C., USA (Vercel `iad1` region). Demo deployment at https://grism-plus-app.vercel.app, behind an app-level passcode gate (`src/lib/auth/demo-gate.ts`) and pointing at the development Supabase project — no production customer data flows through Vercel. Production-pilot region to be re-evaluated against the first customer contract's data-residency requirements (likely Frankfurt for GCC proximity); a region change at that point would land as a follow-up subprocessor migration.
- **SOC 2 status:** Type II certified
- **GDPR status:** compliant, DPA executed
- **DPA:** https://vercel.com/legal/dpa
- **Added:** 2026-04
- **Activated:** 2026-05-01 (migration `00012_activate_vercel_subprocessor.sql`)
- **Status:** Active — demo deployment only. Production-pilot review pending first customer contract.

### Anthropic (Anthropic PBC)

- **Purpose:** Claude API for four AI nodes: IDP generation, modality recommendation, OJT recommendation, coaching brief generation
- **Data categories:** pseudonymised employee role, competency gap summaries, IDP structure. Real employee names, emails, and tenant identifiers are **not** sent. Pseudonymisation is enforced in application code before every API call.
- **Hosting region:** United States
- **SOC 2 status:** Type II certified
- **GDPR status:** compliant, DPA available
- **DPA:** https://www.anthropic.com/legal/commercial-terms
- **Zero-retention:** enabled on the API account. Anthropic does not retain prompt or completion content beyond the duration of the request.
- **Added:** 2026-04

### Resend (Resend, Inc.)

- **Purpose:** Transactional email delivery for nudges, approval notifications, password resets, weekly digests
- **Data categories:** recipient email address, recipient display name, email subject and body (may reference employee development status in pseudonymised form)
- **Hosting region:** United States
- **SOC 2 status:** Type II certified
- **GDPR status:** compliant, DPA available
- **DPA:** https://resend.com/legal/dpa
- **Added:** 2026-04

### GitHub (GitHub, Inc. — a Microsoft subsidiary)

- **Purpose:** Source code hosting, CI/CD via Actions, dependency scanning via Dependabot, static analysis via CodeQL
- **Data categories:** application source code only. No customer data is stored in GitHub.
- **Hosting region:** United States (primary)
- **SOC 2 status:** Type II certified
- **GDPR status:** compliant
- **DPA:** https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement
- **Added:** 2026-04

## Candidate subprocessors — evaluation pending

These vendors are under consideration but not yet integrated. Entries here do not imply data sharing until integration is complete.

- **Vanta or Drata** — compliance automation, if/when organisational SOC 2 work begins
- **Snyk or Socket** — enhanced vulnerability scanning beyond Dependabot/CodeQL
- **Sentry** — error monitoring (Phase 3 or later)
- **LinkedIn Learning / Coursera** — external eLearning catalogue integration, scoped for post-MVP

## Removed subprocessors

None.

## Customer notification

Clients will be notified of material changes to this subprocessor list at least 30 days before a new subprocessor begins processing their data, by email to the tenant's designated security contact. Clients may object to a new subprocessor; objections are handled per the Definitive Agreement terms (to be finalised).

## Review cadence

This register is reviewed quarterly or immediately on addition/removal of any vendor. The review is recorded against the `subprocessors.reviewed_at` column in the application database.
