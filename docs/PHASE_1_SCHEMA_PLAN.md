# Phase 1 Schema Plan

Status: planning baseline, no migration applied

Last updated: 2026-04-27

## Purpose

This plan turns Grism's Phase 1 feedback into a concrete database direction for:

- 70/20/10 IDP blend logic
- outcome-bearing OJT tasks and evidence validation
- multi-signal skill progression

It is intentionally a planning document. Do not push a cloud migration from this plan without a reviewed SQL migration, local verification, and explicit operator approval.

## Current Schema Baseline

Already landed in `00001_initial_schema.sql`:

- `idps`, `idp_milestones`, `idp_actions`
- `assessments`, `competency_scores`
- `ojt_catalogue`, `ojt_assignments`, `ojt_evidence`
- `elearning_catalogue`, `elearning_enrolments`
- `coaching_briefs`
- tenant-scoped RLS and audit triggers for the sensitive operational tables

Missing for Grism Phase 1:

- no first-class 70/20/10 blend category
- no stored IDP blend snapshot for approval screens
- no weighted progression event model
- no convergence rule preventing one source from advancing a skill alone
- no explicit connection from OJT validation to skill progression
- no explicit eLearning or coaching feedback signal model

## Recommended Migration Shape

Use a new migration after `00012_activate_vercel_subprocessor.sql`, likely:

```text
00013_phase1_development_model.sql
```

Do not edit `00001_initial_schema.sql`.

## New Enums

### `development_blend_category`

Values:

- `experience`
- `relationship`
- `formal`

Mapping guidance:

- Experience: OJT, stretch assignments, field rotation, workplace practice.
- Relationship: coaching, mentoring, buddy learning, peer learning.
- Formal: eLearning, classroom, workshop.

### `progression_signal_source`

Values:

- `assessment`
- `ojt_manager_feedback`
- `coaching_feedback`
- `elearning_completion`

### `progression_convergence_status`

Values:

- `insufficient`
- `emerging`
- `ready_for_review`
- `advanced`

`advanced` should require at least the configured minimum distinct signal sources. The default should be at least two sources.

## New Tables

### `development_blend_policies`

Purpose: tenant-configurable 70/20/10 default and skill-type overrides.

Suggested columns:

- `id uuid primary key`
- `tenant_id uuid not null`
- `scope text not null check (scope in ('tenant_default', 'gap_category', 'competency'))`
- `gap_category gap_category`
- `competency_id uuid references competencies(id)`
- `experience_pct integer not null`
- `relationship_pct integer not null`
- `formal_pct integer not null`
- `rationale text`
- `is_active boolean not null default true`
- `created_by uuid references user_profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Required checks:

- all percentages between 0 and 100
- `experience_pct + relationship_pct + formal_pct = 100`
- `tenant_default` rows have no `gap_category` or `competency_id`
- `gap_category` rows have `gap_category` and no `competency_id`
- `competency` rows have `competency_id`

Recommended seed:

- one active tenant default row per tenant: `70 / 20 / 10`

### `idp_blend_snapshots`

Purpose: freeze the blend used when an IDP is generated, reviewed, or approved. Approval screens should read this table rather than recomputing from mutable catalogue data.

Suggested columns:

- `id uuid primary key`
- `tenant_id uuid not null`
- `idp_id uuid not null references idps(id) on delete cascade`
- `policy_id uuid references development_blend_policies(id)`
- `experience_pct integer not null`
- `relationship_pct integer not null`
- `formal_pct integer not null`
- `calculation_method text not null check (calculation_method in ('generated', 'manual_override', 'recalculated'))`
- `within_guardrail boolean not null default true`
- `guardrail_notes text`
- `created_by uuid references user_profiles(id)`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

Rules:

- keep snapshots append-only except soft delete
- create a new snapshot when an IDP is materially edited
- approval queue shows the latest non-deleted snapshot
- warning state when `formal_pct` exceeds the configured guardrail without rationale

### `idp_action_blend_allocations`

Purpose: classify each IDP action into the 70/20/10 model and record the contribution used in the blend snapshot.

Suggested columns:

- `id uuid primary key`
- `tenant_id uuid not null`
- `idp_action_id uuid not null references idp_actions(id) on delete cascade`
- `blend_category development_blend_category not null`
- `effort_weight numeric(8,2) not null default 1`
- `classification_source text not null check (classification_source in ('default_mapping', 'ai_suggested', 'manual'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Default mapping:

- `ojt` -> `experience`
- `coaching` -> `relationship`
- `elearning` -> `formal`
- `ilt` -> `formal`
- `workshop` -> `formal`, unless later configured as relationship/experience for a specific workshop type

This separate table is preferable to overloading `idp_actions.modality`, because modality and development blend are related but not identical.

### `skill_progression_rules`

Purpose: define weighting and convergence requirements for a tenant, category, or competency.

Suggested columns:

- `id uuid primary key`
- `tenant_id uuid not null`
- `scope text not null check (scope in ('tenant_default', 'gap_category', 'competency'))`
- `gap_category gap_category`
- `competency_id uuid references competencies(id)`
- `assessment_weight numeric(5,2) not null`
- `ojt_weight numeric(5,2) not null`
- `coaching_weight numeric(5,2) not null`
- `elearning_weight numeric(5,2) not null`
- `min_distinct_sources integer not null default 2`
- `max_single_source_contribution numeric(5,2) not null default 0.50`
- `rationale text`
- `is_active boolean not null default true`
- `created_by uuid references user_profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Required checks:

- weights are non-negative
- total weight is greater than 0
- `min_distinct_sources >= 2`
- `max_single_source_contribution <= 1`

Recommended default:

- assessment: `0.35`
- OJT manager feedback: `0.30`
- coaching feedback: `0.20`
- eLearning completion: `0.15`
- minimum distinct sources: `2`

This keeps eLearning useful but prevents it from carrying skill advancement alone.

### `skill_progression_events`

Purpose: append-only evidence events from the four signal sources.

Suggested columns:

- `id uuid primary key`
- `tenant_id uuid not null`
- `employee_id uuid not null references employees(id)`
- `competency_id uuid not null references competencies(id)`
- `signal_source progression_signal_source not null`
- `source_table text not null`
- `source_id uuid not null`
- `signal_date date not null`
- `score_0_100 integer check (score_0_100 between 0 and 100)`
- `proficiency_delta numeric(5,2)`
- `confidence_0_100 integer check (confidence_0_100 between 0 and 100)`
- `weight_applied numeric(5,2)`
- `summary text`
- `created_by uuid references user_profiles(id)`
- `data_classification data_classification not null default 'restricted'`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

Recommended constraints:

- unique `(tenant_id, signal_source, source_table, source_id, competency_id)` where `deleted_at is null`
- `source_table` limited by check constraint to known source tables:
  - `assessments`
  - `ojt_evidence`
  - `coaching_briefs` for Phase 1 manager-side coaching brief output, or a future `coaching_sessions` table in Phase 2
  - `elearning_enrolments`

### `skill_progression_rollups`

Purpose: current derived state for UI and reporting. This can be materialized by server logic or database function after events are written.

Suggested columns:

- `id uuid primary key`
- `tenant_id uuid not null`
- `employee_id uuid not null references employees(id)`
- `competency_id uuid not null references competencies(id)`
- `current_score_0_100 integer check (current_score_0_100 between 0 and 100)`
- `target_score_0_100 integer check (target_score_0_100 between 0 and 100)`
- `convergence_status progression_convergence_status not null`
- `distinct_signal_sources integer not null default 0`
- `contributing_sources progression_signal_source[] not null default array[]::progression_signal_source[]`
- `last_signal_at timestamptz`
- `calculated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Recommended uniqueness:

- unique `(tenant_id, employee_id, competency_id)` where `deleted_at is null`

This table should not replace `competency_scores` immediately. Keep `competency_scores` as assessment-score history and use rollups for the broader Grism multi-signal model.

## Existing Table Changes

### `ojt_catalogue`

Add later if needed:

- `expected_outcome text`
- `success_criteria jsonb not null default '[]'::jsonb`

The existing `deliverable_type` and `observation_checklist` already cover part of this, so avoid duplicating unless the UI needs explicit fields.

### `ojt_evidence`

Existing fields already support validation notes and checklist responses. Prefer deriving manager-feedback progression events from:

- `validation_status = 'approved'`
- `validation_notes`
- `observation_checklist_responses`
- `validated_by`
- `validated_at`

Add only if implementation proves necessary:

- `manager_feedback_score_0_100 integer`
- `progression_event_id uuid references skill_progression_events(id)`

### `elearning_enrolments`

Existing fields support completion and score. Phase 1 can create `elearning_completion` progression events when:

- `status = 'completed'`
- `completed_at is not null`

Do not let this event alone advance a competency.

### `coaching_briefs`

Phase 1 keeps manager-side AI coaching briefs. Because Grism deferred coach-side session logs to Phase 2, avoid adding a full `coaching_sessions` table in the first migration unless the pilot pulls it forward.

For Phase 1, coaching feedback can be one of:

- a structured field added to `coaching_briefs`, if the brief is reviewed and scored by a manager
- a temporary admin/manager review action that writes directly to `skill_progression_events`

Do not implement broad coach write paths until coach assignment-scoped RLS is fixed.

## RLS Direction

### Read policies

For `development_blend_policies`:

- tenant users can select active tenant policies
- only admins can read deleted/inactive rows

For `idp_blend_snapshots` and `idp_action_blend_allocations`:

- follow the parent `idps` / `idp_actions` access path
- employees see their own IDP blend
- managers see direct reports
- L&D admins and superadmins see tenant rows
- coaches only after assignment-scoped RLS lands

For `skill_progression_events` and `skill_progression_rollups`:

- L&D admin and superadmin: tenant rows
- employee: own rows
- manager: direct-report rows
- coach: do not grant tenant-wide access; require `coach_assignments` first if coach views are in scope

### Write policies

Keep writes narrow:

- `development_blend_policies`: L&D admin/superadmin only
- `idp_blend_snapshots`: generated by admin-only IDP generation/review flows
- `idp_action_blend_allocations`: generated by admin-only IDP generation/review flows
- `skill_progression_events`: preferably via server-side API/RPC after source-specific validation
- `skill_progression_rollups`: server-side function or admin service path only

Avoid direct client inserts into progression events unless the policy is source-specific and extremely narrow.

## Audit and Indexing

Add audit triggers for:

- `development_blend_policies`
- `idp_blend_snapshots`
- `idp_action_blend_allocations`
- `skill_progression_rules`
- `skill_progression_events`
- `skill_progression_rollups`

Add indexes:

- `development_blend_policies(tenant_id, scope) where deleted_at is null`
- `idp_blend_snapshots(idp_id, created_at desc) where deleted_at is null`
- `idp_action_blend_allocations(idp_action_id) where deleted_at is null`
- `skill_progression_events(employee_id, competency_id, signal_date desc) where deleted_at is null`
- `skill_progression_events(tenant_id, signal_source, source_table, source_id) where deleted_at is null`
- `skill_progression_rollups(employee_id, competency_id) where deleted_at is null`

## Generation and Validation Flow

1. Load employee context and current gaps.
2. Select the applicable `development_blend_policy`.
3. Generate candidate milestones and actions.
4. Classify actions into `idp_action_blend_allocations`.
5. Calculate and store `idp_blend_snapshots`.
6. If formal learning exceeds guardrail and no skill-type rationale exists, block auto-approval and show an L&D warning.
7. On OJT validation, write `skill_progression_events` with `signal_source = 'ojt_manager_feedback'`.
8. On assessment import, write `skill_progression_events` with `signal_source = 'assessment'`.
9. On eLearning completion, write `skill_progression_events` with `signal_source = 'elearning_completion'`.
10. On reviewed coaching feedback, write `skill_progression_events` with `signal_source = 'coaching_feedback'`.
11. Recalculate `skill_progression_rollups`.
12. Advance only when convergence rules are satisfied.

## Testing Requirements

Migration verification:

- tables, enums, constraints, indexes, and RLS policies exist
- default 70/20/10 policy can be seeded
- invalid blend totals are rejected
- employee cannot read another employee's progression events
- manager can read direct reports only
- L&D admin can read tenant rows
- coach cannot read progression rows until assignment-scoped RLS exists

Application tests:

- IDP generation fixture produces a blend snapshot near 70/20/10
- formal-heavy fixture is blocked or warned
- OJT validation writes exactly one progression event
- eLearning completion writes a signal but cannot advance alone
- assessment import writes a signal idempotently
- rollup requires at least two distinct signal sources

## Open Decisions Before SQL

- Should `skill_progression_rollups` write into `competency_scores`, or stay separate for Phase 1?
  - Recommendation: keep separate.
- Should coaching feedback be sourced from `coaching_briefs` or a small Phase 1 feedback table?
  - Recommendation: avoid full coach sessions, but allow reviewed manager-side coaching feedback events.
- Should blend be calculated by effort hours, action count, or explicit action weight?
  - Recommendation: explicit `effort_weight`, seeded from catalogue effort when available.
- Should tenant default policies be seeded for existing demo tenants in the migration?
  - Recommendation: yes, seed 70/20/10 default for all tenants with no active policy.

## Next Implementation Step

Create and review `00013_phase1_development_model.sql` locally, then add TypeScript database types and focused RLS verification scripts. Do not apply it to cloud until local verification and operator approval are complete.
