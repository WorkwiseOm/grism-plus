# OJT reference — Grism Plus

Last reviewed: 2026-04-25 by Tariq Al-Maskari.

## Purpose

Single reference for the **on-the-job training (OJT)** modality in Grism Plus: what an OJT activity is in our model, how it is catalogued per tenant, how it is assigned to an employee against an IDP milestone, and how completion evidence is captured and validated.

This doc is for engineers and product collaborators. Customer-facing copy lives in product screens (Phase 1+).

## Status

**Phase 0 — scaffolding only.** The data model is in place; the lifecycle UI and the recommender are not.

| Layer | State |
|---|---|
| Schema (`ojt_catalogue`, `ojt_assignments`, `ojt_evidence`) | landed in `supabase/migrations/00001_initial_schema.sql` |
| Tenant-isolation RLS | landed |
| Audit logging | landed (per-table FK resolution for `ojt_evidence` added in `00010`) |
| Demo seed (10 activities, 7 assignments tied to active IDPs) | landed via `scripts/seed_phase1_demo.ts` |
| OJT recommender (AI node) | **not yet implemented** — Phase 1 |
| Evidence validation UI | **not yet implemented** — Phase 1 |
| Modality-balance heuristic for IDP planning | **not yet implemented** — Phase 1 |

## Source of truth

- **Schema:** `supabase/migrations/00001_initial_schema.sql` § "MODALITY TABLES" (`ojt_catalogue`, `ojt_assignments`, `ojt_evidence`).
- **Demo seed activities:** `scripts/demo/catalogues.ts` (`OJT_CATALOGUE` constant). The demo list is illustrative for the Arwa Energy fixture only — it is **not** a curated production catalogue.
- **Audit:** `audit_log` rows for `ojt_assignments` and `ojt_evidence` writes are emitted by the trigger in `supabase/migrations/00010_audit_log_tenant_resolution.sql` (child-table tenant resolution).

## Open questions for Phase 1

- Catalogue authoring UX — admin-curated per tenant, AI-suggested, or both?
- Evidence rubric — free-text reflection plus optional structured checklist (`observation_checklist`), per activity, with weighted scoring?
- Recommender prompt scope — what subset of `ojt_catalogue` rows is sent to Claude per recommendation, and how is it pseudonymised? Pseudonymisation policy is in [`security.md`](security.md) § "AI and third-party data handling".

## Caveats

- The seed activities are not a Grism-curated catalogue. Real per-tenant catalogue authoring is a Phase 1 deliverable.
- No external OJT vendor or partner integration is in scope for MVP. Subprocessor candidates are tracked in [`subprocessors.md`](subprocessors.md).
- Filename note: this document was created as `ojt-reference.md` because the codebase, schema, and seed all use the OJT (on-the-job training) terminology; no `oll` taxonomy exists in the project. Rename if a different scope was intended.
