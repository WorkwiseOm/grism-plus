-- 00013_phase1_development_model.sql
--
-- Phase 1 development model layer: 70/20/10 IDP blend, multi-signal skill
-- progression. Implements the design in docs/PHASE_1_SCHEMA_PLAN.md.
--
-- This migration only ADDS objects:
--   - 3 enums:  development_blend_category, progression_signal_source,
--               progression_convergence_status
--   - 6 tables: development_blend_policies, idp_blend_snapshots,
--               idp_action_blend_allocations, skill_progression_rules,
--               skill_progression_events, skill_progression_rollups
--   - RLS, audit triggers, indexes, default-policy seed
--
-- It does NOT modify any 00001 table. Plan items that touch existing
-- tables (e.g., ojt_catalogue.expected_outcome, elearning_completion
-- derivation) are deferred to later targeted migrations until product
-- flow forces them.
--
-- All 6 new tables carry tenant_id directly, so write_audit_log()
-- (00010 child-table tenant resolution) needs no extension.
--
-- Do NOT apply this migration to cloud without:
--   1. local apply (e.g., supabase start) and a passing run of
--      scripts/verify_phase1_schema.ts
--   2. explicit operator approval

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

create type development_blend_category as enum ('experience', 'relationship', 'formal');

create type progression_signal_source as enum (
  'assessment',
  'ojt_manager_feedback',
  'coaching_feedback',
  'elearning_completion'
);

create type progression_convergence_status as enum (
  'insufficient',
  'emerging',
  'ready_for_review',
  'advanced'
);

-- ============================================================================
-- 2. development_blend_policies
-- ============================================================================
-- Tenant-configurable 70/20/10 default and per-scope overrides.
-- Lookup precedence at IDP-generation time (application logic, not enforced
-- at the schema level): competency > gap_category > tenant_default.

create table development_blend_policies (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  scope text not null check (scope in ('tenant_default', 'gap_category', 'competency')),
  gap_category gap_category,
  competency_id uuid references competencies(id) on delete cascade,
  experience_pct integer not null check (experience_pct between 0 and 100),
  relationship_pct integer not null check (relationship_pct between 0 and 100),
  formal_pct integer not null check (formal_pct between 0 and 100),
  rationale text,
  is_active boolean not null default true,
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (experience_pct + relationship_pct + formal_pct = 100),
  check (
    (scope = 'tenant_default' and gap_category is null and competency_id is null)
    or (scope = 'gap_category' and gap_category is not null and competency_id is null)
    or (scope = 'competency' and competency_id is not null and gap_category is null)
  )
);

create unique index uq_blend_policy_active_tenant_default
  on development_blend_policies (tenant_id)
  where scope = 'tenant_default' and is_active and deleted_at is null;

create unique index uq_blend_policy_active_gap_category
  on development_blend_policies (tenant_id, gap_category)
  where scope = 'gap_category' and is_active and deleted_at is null;

create unique index uq_blend_policy_active_competency
  on development_blend_policies (tenant_id, competency_id)
  where scope = 'competency' and is_active and deleted_at is null;

create index idx_blend_policy_tenant_scope
  on development_blend_policies (tenant_id, scope)
  where deleted_at is null;

-- ============================================================================
-- 3. idp_blend_snapshots
-- ============================================================================
-- Frozen blend used at IDP generation/review/approval. Approval queue reads
-- the latest non-deleted snapshot rather than recomputing from mutable inputs.
-- Multiple snapshots per IDP are allowed; uniqueness is by (idp_id, created_at).

create table idp_blend_snapshots (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  idp_id uuid not null references idps(id) on delete cascade,
  policy_id uuid references development_blend_policies(id) on delete set null,
  experience_pct integer not null check (experience_pct between 0 and 100),
  relationship_pct integer not null check (relationship_pct between 0 and 100),
  formal_pct integer not null check (formal_pct between 0 and 100),
  calculation_method text not null
    check (calculation_method in ('generated', 'manual_override', 'recalculated')),
  within_guardrail boolean not null default true,
  guardrail_notes text,
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (experience_pct + relationship_pct + formal_pct = 100)
);

create index idx_idp_blend_snapshots_idp_recent
  on idp_blend_snapshots (idp_id, created_at desc)
  where deleted_at is null;

-- ============================================================================
-- 4. idp_action_blend_allocations
-- ============================================================================
-- Per-action 70/20/10 classification used when computing snapshots.
-- Separate from idp_actions.modality because modality and blend category
-- are related but not identical (e.g., a workshop may be configured as
-- relationship-style for a specific tenant).
-- One active allocation per action; reclassification soft-deletes the prior
-- row and inserts a new one.

create table idp_action_blend_allocations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  idp_action_id uuid not null references idp_actions(id) on delete cascade,
  blend_category development_blend_category not null,
  effort_weight numeric(8,2) not null default 1 check (effort_weight >= 0),
  classification_source text not null
    check (classification_source in ('default_mapping', 'ai_suggested', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_action_blend_allocation_active
  on idp_action_blend_allocations (idp_action_id)
  where deleted_at is null;

-- ============================================================================
-- 5. skill_progression_rules
-- ============================================================================
-- Per-tenant/category/competency weighting and convergence rules for
-- multi-signal skill progression. Default rule prevents any single source
-- (especially elearning_completion) from advancing a skill alone via
-- min_distinct_sources >= 2 and max_single_source_contribution <= 0.50.

create table skill_progression_rules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  scope text not null check (scope in ('tenant_default', 'gap_category', 'competency')),
  gap_category gap_category,
  competency_id uuid references competencies(id) on delete cascade,
  assessment_weight numeric(5,2) not null check (assessment_weight >= 0),
  ojt_weight numeric(5,2) not null check (ojt_weight >= 0),
  coaching_weight numeric(5,2) not null check (coaching_weight >= 0),
  elearning_weight numeric(5,2) not null check (elearning_weight >= 0),
  min_distinct_sources integer not null default 2 check (min_distinct_sources >= 2),
  max_single_source_contribution numeric(5,2) not null default 0.50
    check (max_single_source_contribution > 0 and max_single_source_contribution <= 1),
  rationale text,
  is_active boolean not null default true,
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (assessment_weight + ojt_weight + coaching_weight + elearning_weight > 0),
  check (
    (scope = 'tenant_default' and gap_category is null and competency_id is null)
    or (scope = 'gap_category' and gap_category is not null and competency_id is null)
    or (scope = 'competency' and competency_id is not null and gap_category is null)
  )
);

create unique index uq_progression_rule_active_tenant_default
  on skill_progression_rules (tenant_id)
  where scope = 'tenant_default' and is_active and deleted_at is null;

create unique index uq_progression_rule_active_gap_category
  on skill_progression_rules (tenant_id, gap_category)
  where scope = 'gap_category' and is_active and deleted_at is null;

create unique index uq_progression_rule_active_competency
  on skill_progression_rules (tenant_id, competency_id)
  where scope = 'competency' and is_active and deleted_at is null;

create index idx_progression_rule_tenant_scope
  on skill_progression_rules (tenant_id, scope)
  where deleted_at is null;

-- ============================================================================
-- 6. skill_progression_events
-- ============================================================================
-- Append-only-ish: hard DELETE not blocked at trigger level (audit log
-- captures it), but soft-delete via deleted_at is the preferred path.
-- UPDATE is permitted because weight_applied may be recalculated when a
-- progression rule changes.
--
-- The (tenant_id, signal_source, source_table, source_id, competency_id)
-- partial unique index makes re-imports of the same source row idempotent.
-- The cross-field check enforces signal_source/source_table consistency.

create table skill_progression_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete restrict,
  signal_source progression_signal_source not null,
  source_table text not null
    check (source_table in (
      'assessments', 'ojt_evidence', 'coaching_briefs', 'elearning_enrolments'
    )),
  source_id uuid not null,
  signal_date date not null,
  score_0_100 integer check (score_0_100 between 0 and 100),
  proficiency_delta numeric(5,2),
  confidence_0_100 integer check (confidence_0_100 between 0 and 100),
  weight_applied numeric(5,2),
  summary text,
  created_by uuid references user_profiles(id) on delete set null,
  data_classification data_classification not null default 'restricted',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (signal_source = 'assessment' and source_table = 'assessments')
    or (signal_source = 'ojt_manager_feedback' and source_table = 'ojt_evidence')
    or (signal_source = 'coaching_feedback' and source_table = 'coaching_briefs')
    or (signal_source = 'elearning_completion' and source_table = 'elearning_enrolments')
  )
);

create unique index uq_progression_event_source
  on skill_progression_events
    (tenant_id, signal_source, source_table, source_id, competency_id)
  where deleted_at is null;

create index idx_progression_events_employee_competency_date
  on skill_progression_events (employee_id, competency_id, signal_date desc)
  where deleted_at is null;

create index idx_progression_events_tenant_source
  on skill_progression_events (tenant_id, signal_source, source_table, source_id)
  where deleted_at is null;

-- ============================================================================
-- 7. skill_progression_rollups
-- ============================================================================
-- Current derived state per (employee, competency). Recomputed by server
-- logic / RPC after events are written. Intentionally separate from
-- competency_scores (which remains an assessment-only history) per
-- PHASE_1_SCHEMA_PLAN.md "Open Decisions Before SQL".

create table skill_progression_rollups (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete restrict,
  current_score_0_100 integer check (current_score_0_100 between 0 and 100),
  target_score_0_100 integer check (target_score_0_100 between 0 and 100),
  convergence_status progression_convergence_status not null default 'insufficient',
  distinct_signal_sources integer not null default 0
    check (distinct_signal_sources >= 0),
  contributing_sources progression_signal_source[] not null
    default array[]::progression_signal_source[],
  last_signal_at timestamptz,
  calculated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_progression_rollup_per_employee_competency
  on skill_progression_rollups (tenant_id, employee_id, competency_id)
  where deleted_at is null;

create index idx_progression_rollup_lookup
  on skill_progression_rollups (employee_id, competency_id)
  where deleted_at is null;

-- ============================================================================
-- 8. RLS ENABLE
-- ============================================================================

alter table development_blend_policies enable row level security;
alter table idp_blend_snapshots enable row level security;
alter table idp_action_blend_allocations enable row level security;
alter table skill_progression_rules enable row level security;
alter table skill_progression_events enable row level security;
alter table skill_progression_rollups enable row level security;

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================
-- Tenant-config tables (policies, rules): all tenant users read; admin writes.
-- IDP-derived (snapshots, allocations): follow parent IDP access path; admin writes.
-- Progression (events, rollups): subject + manager + admin read; admin writes.
-- Admin write policies also verify parent-row tenant ownership where a table
-- stores UUID references to existing Phase 0 entities. This prevents an admin
-- path from accidentally inserting a current-tenant row that points at another
-- tenant's IDP/action/employee/competency/source row.
--
-- Coach role is intentionally excluded from these new tables until
-- assignment-scoped coach RLS lands (tracked in PROGRESS.md backlog).
-- Service role bypasses RLS, so server-side write paths (IDP generation,
-- progression event recording, rollup recompute) work via the admin client.

-- 9.1 development_blend_policies
create policy "blend_policies_select" on development_blend_policies
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
  );
create policy "blend_policies_admin_write" on development_blend_policies
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
    and (
      competency_id is null
      or competency_id in (
        select c.id
        from competencies c
        join competency_frameworks f on f.id = c.framework_id
        where f.tenant_id = current_tenant_id()
          and c.deleted_at is null
          and f.deleted_at is null
      )
    )
    and (
      created_by is null
      or created_by in (
        select id from user_profiles
        where tenant_id = current_tenant_id() and deleted_at is null
      )
    )
  );

-- 9.2 skill_progression_rules
create policy "progression_rules_select" on skill_progression_rules
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
  );
create policy "progression_rules_admin_write" on skill_progression_rules
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
    and (
      competency_id is null
      or competency_id in (
        select c.id
        from competencies c
        join competency_frameworks f on f.id = c.framework_id
        where f.tenant_id = current_tenant_id()
          and c.deleted_at is null
          and f.deleted_at is null
      )
    )
    and (
      created_by is null
      or created_by in (
        select id from user_profiles
        where tenant_id = current_tenant_id() and deleted_at is null
      )
    )
  );

-- 9.3 idp_blend_snapshots — follow parent idps access path
create policy "idp_blend_snapshots_select" on idp_blend_snapshots
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and idp_id in (
      select id from idps
      where tenant_id = current_tenant_id() and deleted_at is null
        and (
          current_role_is('ld_admin')
          or current_role_is('superadmin')
          or employee_id = current_employee_id()
          or employee_id in (
            select id from employees
            where manager_id = current_employee_id() and deleted_at is null
          )
        )
    )
  );
create policy "idp_blend_snapshots_admin_write" on idp_blend_snapshots
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
    and idp_id in (
      select id from idps
      where tenant_id = current_tenant_id() and deleted_at is null
    )
    and (
      policy_id is null
      or policy_id in (
        select id from development_blend_policies
        where tenant_id = current_tenant_id() and deleted_at is null
      )
    )
    and (
      created_by is null
      or created_by in (
        select id from user_profiles
        where tenant_id = current_tenant_id() and deleted_at is null
      )
    )
  );

-- 9.4 idp_action_blend_allocations — follow parent idp_actions chain
create policy "idp_action_blend_allocations_select"
  on idp_action_blend_allocations
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and idp_action_id in (
      select a.id
      from idp_actions a
      join idp_milestones m on m.id = a.milestone_id
      join idps i on i.id = m.idp_id
      where i.tenant_id = current_tenant_id()
        and i.deleted_at is null
        and m.deleted_at is null
        and a.deleted_at is null
        and (
          current_role_is('ld_admin')
          or current_role_is('superadmin')
          or i.employee_id = current_employee_id()
          or i.employee_id in (
            select id from employees
            where manager_id = current_employee_id() and deleted_at is null
          )
        )
    )
  );
create policy "idp_action_blend_allocations_admin_write"
  on idp_action_blend_allocations
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
    and idp_action_id in (
      select a.id
      from idp_actions a
      join idp_milestones m on m.id = a.milestone_id
      join idps i on i.id = m.idp_id
      where i.tenant_id = current_tenant_id()
        and i.deleted_at is null
        and m.deleted_at is null
        and a.deleted_at is null
    )
  );

-- 9.5 skill_progression_events — subject + manager + admin read; admin write
create policy "progression_events_select" on skill_progression_events
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
      or employee_id in (
        select id from employees
        where manager_id = current_employee_id() and deleted_at is null
      )
    )
  );
create policy "progression_events_admin_write" on skill_progression_events
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
    and employee_id in (
      select id from employees
      where tenant_id = current_tenant_id() and deleted_at is null
    )
    and competency_id in (
      select c.id
      from competencies c
      join competency_frameworks f on f.id = c.framework_id
      where f.tenant_id = current_tenant_id()
        and c.deleted_at is null
        and f.deleted_at is null
    )
    and (
      (
        signal_source = 'assessment'
        and source_table = 'assessments'
        and source_id in (
          select id from assessments
          where tenant_id = current_tenant_id()
            and employee_id = skill_progression_events.employee_id
            and deleted_at is null
        )
      )
      or (
        signal_source = 'ojt_manager_feedback'
        and source_table = 'ojt_evidence'
        and source_id in (
          select ev.id
          from ojt_evidence ev
          join ojt_assignments oa on oa.id = ev.ojt_assignment_id
          where oa.tenant_id = current_tenant_id()
            and oa.employee_id = skill_progression_events.employee_id
            and ev.deleted_at is null
            and oa.deleted_at is null
        )
      )
      or (
        signal_source = 'coaching_feedback'
        and source_table = 'coaching_briefs'
        and source_id in (
          select id from coaching_briefs
          where tenant_id = current_tenant_id()
            and employee_id = skill_progression_events.employee_id
            and deleted_at is null
        )
      )
      or (
        signal_source = 'elearning_completion'
        and source_table = 'elearning_enrolments'
        and source_id in (
          select id from elearning_enrolments
          where tenant_id = current_tenant_id()
            and employee_id = skill_progression_events.employee_id
            and deleted_at is null
        )
      )
    )
    and (
      created_by is null
      or created_by in (
        select id from user_profiles
        where tenant_id = current_tenant_id() and deleted_at is null
      )
    )
  );

-- 9.6 skill_progression_rollups — same shape as events
create policy "progression_rollups_select" on skill_progression_rollups
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
      or employee_id in (
        select id from employees
        where manager_id = current_employee_id() and deleted_at is null
      )
    )
  );
create policy "progression_rollups_admin_write" on skill_progression_rollups
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
    and employee_id in (
      select id from employees
      where tenant_id = current_tenant_id() and deleted_at is null
    )
    and competency_id in (
      select c.id
      from competencies c
      join competency_frameworks f on f.id = c.framework_id
      where f.tenant_id = current_tenant_id()
        and c.deleted_at is null
        and f.deleted_at is null
    )
  );

-- ============================================================================
-- 10. updated_at TRIGGERS
-- ============================================================================
-- Reuses set_updated_at() defined in 00001. Only tables that carry
-- updated_at are wired here; events and rollups intentionally don't have
-- updated_at (events are append-only-ish; rollups use calculated_at).

create trigger development_blend_policies_set_updated_at
  before update on development_blend_policies
  for each row execute function set_updated_at();

create trigger idp_action_blend_allocations_set_updated_at
  before update on idp_action_blend_allocations
  for each row execute function set_updated_at();

create trigger skill_progression_rules_set_updated_at
  before update on skill_progression_rules
  for each row execute function set_updated_at();

-- ============================================================================
-- 11. AUDIT TRIGGERS
-- ============================================================================
-- All 6 new tables have tenant_id directly; write_audit_log() (00010
-- child-table tenant resolution) reads NEW.tenant_id without a parent
-- lookup. No update to the trigger function is needed.
--
-- Volume note: skill_progression_rollups is updated after every event,
-- so audit writes scale with progression-event count. Acceptable at MVP
-- scale; if rollup recompute becomes hot, derive rollups via a server-
-- side function or materialized view backed by skill_progression_events
-- and drop the rollup audit trigger.

create trigger development_blend_policies_audit
  after insert or update or delete on development_blend_policies
  for each row execute function write_audit_log();

create trigger idp_blend_snapshots_audit
  after insert or update or delete on idp_blend_snapshots
  for each row execute function write_audit_log();

create trigger idp_action_blend_allocations_audit
  after insert or update or delete on idp_action_blend_allocations
  for each row execute function write_audit_log();

create trigger skill_progression_rules_audit
  after insert or update or delete on skill_progression_rules
  for each row execute function write_audit_log();

create trigger skill_progression_events_audit
  after insert or update or delete on skill_progression_events
  for each row execute function write_audit_log();

create trigger skill_progression_rollups_audit
  after insert or update or delete on skill_progression_rollups
  for each row execute function write_audit_log();

-- ============================================================================
-- 12. SEED DEFAULTS FOR EXISTING TENANTS
-- ============================================================================
-- Idempotent: only inserts when no active tenant_default row exists.
-- Re-running the migration after additional tenants are seeded will
-- backfill defaults for them; existing tenant_default rows are untouched.

insert into development_blend_policies
  (tenant_id, scope, experience_pct, relationship_pct, formal_pct, rationale, is_active)
select
  t.id, 'tenant_default', 70, 20, 10,
  'Default 70/20/10 development blend seeded by migration 00013.',
  true
from tenants t
where not exists (
  select 1 from development_blend_policies p
  where p.tenant_id = t.id
    and p.scope = 'tenant_default'
    and p.is_active
    and p.deleted_at is null
);

insert into skill_progression_rules
  (tenant_id, scope,
   assessment_weight, ojt_weight, coaching_weight, elearning_weight,
   min_distinct_sources, max_single_source_contribution,
   rationale, is_active)
select
  t.id, 'tenant_default',
  0.35, 0.30, 0.20, 0.15,
  2, 0.50,
  'Default multi-signal progression weights seeded by migration 00013. eLearning carries weight (0.15) but cannot advance a skill alone (max_single_source_contribution = 0.50, min_distinct_sources = 2).',
  true
from tenants t
where not exists (
  select 1 from skill_progression_rules r
  where r.tenant_id = t.id
    and r.scope = 'tenant_default'
    and r.is_active
    and r.deleted_at is null
);

-- ============================================================================
-- END 00013
-- ============================================================================
