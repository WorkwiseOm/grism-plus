# Module library reference — Grism Plus

Last reviewed: 2026-04-26 by Tariq Al-Maskari.

## Purpose

Single reference for the **eLearning module library** in Grism Plus: the digital, externally-hosted (or SCORM-deliverable) courses that complement OJT activities in an IDP. This doc covers the catalogue model, enrolment lifecycle, and external-integration assumptions.

This doc is for engineers and product collaborators. Customer-facing copy lives in product screens (Phase 1+).

In the Grism Phase 1 alignment feedback, formal learning is the "10%" layer of the 70/20/10 development model. eLearning remains important, but Phase 1 must not let catalogue availability make generated IDPs formal-learning-heavy by default.

## Status

**Phase 0 — scaffolding only.** Data model in place, no integration to any external module provider, no enrolment UI.

| Layer | State |
|---|---|
| Schema (`elearning_catalogue`, `elearning_enrolments`) | landed in `supabase/migrations/00001_initial_schema.sql` |
| Tenant-isolation RLS | landed |
| Audit logging | landed (`elearning_enrolments` audited; `elearning_catalogue` is a tenant-config table) |
| Demo seed (10 modules, 7 enrolments tied to active IDPs) | landed via `scripts/seed_phase1_demo.ts` |
| eLearning recommender (AI node) | **not yet implemented** — Phase 1 |
| Enrolment lifecycle UI | **not yet implemented** — Phase 1 |
| 70/20/10 formal-learning cap/guardrail | **not yet implemented** — Phase 1 |
| External catalogue sync (LinkedIn Learning, Coursera, etc.) | **not yet implemented** — post-MVP, candidate vendors listed in [`subprocessors.md`](subprocessors.md) |
| SCORM `scorm_endpoint` integration | **not yet implemented** — Phase 2+ |

## Source of truth

- **Schema:** `supabase/migrations/00001_initial_schema.sql` § "MODALITY TABLES" (`elearning_catalogue`, `elearning_enrolments`).
- **Demo seed modules:** `scripts/demo/catalogues.ts` (`ELEARNING_CATALOGUE` constant). The seed list is illustrative for the Arwa Energy fixture only — provider names and `external_url` values are placeholder strings, **not** real vendor links and **not** an endorsement of any vendor.
- **External vendor candidates:** [`subprocessors.md`](subprocessors.md) § "Candidate subprocessors — evaluation pending". No external module vendor is currently a Grism Plus subprocessor.

## Open questions for Phase 1

- Provider integration approach — direct vendor APIs, SCORM 1.2/2004 packaging, or both? Single per-tenant primary provider, or mixed?
- Completion-attestation source of truth — `elearning_enrolments.status` updated by webhook, manual mark-complete by user, or both with conflict resolution?
- Recommender prompt scope — same pseudonymisation policy as the OJT recommender; see [`security.md`](security.md) § "AI and third-party data handling".
- Catalogue ownership — Grism-curated cross-tenant pool, per-tenant overrides, or pure per-tenant authoring?
- Progression weighting — how eLearning completion contributes to a skill-progression signal without being sufficient to advance a competency level alone.

## Caveats

- The seed modules are placeholder strings, not real courses. Provider names in the seed (e.g., generic vendor labels) are illustrative; no integration or commercial relationship is implied.
- No external eLearning vendor processes Grism Plus customer data today. Activation of any such vendor must be reflected in [`subprocessors.md`](subprocessors.md) and customer-notified per the standard subprocessor change protocol.
- Pre/post-work automation for ILT, 30/60/90-day workshop reinforcement, SCORM, and external catalogue sync are Phase 2+ unless a pilot contract explicitly changes the scope.
