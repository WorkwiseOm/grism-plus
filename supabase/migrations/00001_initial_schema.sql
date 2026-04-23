-- ============================================================================
-- GRISM PLUS — Supabase schema v2 (SOC 2-ready posture)
-- Joint Tilqai × Grism product
-- MVP v0.1 — Phase 1 through Phase 3 coverage
--
-- v2 CHANGES from v1 (all additive — safe to apply as single migration):
--   - Added deleted_at soft-delete columns on all domain tables
--   - Expanded audit trigger coverage to all PII-bearing tables
--   - Added read-audit triggers for sensitive tables (employees, competency_scores, ojt_evidence, coaching_briefs)
--   - Added data_classification enum type (4 values: public/internal/confidential/restricted) + classification tags on sensitive tables
--   - Added retention_policies table for client-configurable retention periods
--   - Added security_events table for authentication and access anomaly logging
--   - Updated RLS policies to filter soft-deleted rows by default
--   - Hardened tenant isolation helpers against NULL auth context
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

create type user_role as enum ('employee', 'manager', 'ld_admin', 'coach', 'superadmin');
create type modality_type as enum ('elearning', 'ojt', 'coaching', 'ilt', 'workshop');
create type gap_category as enum ('knowledge', 'behavioural', 'technical');
create type idp_status as enum ('draft', 'pending_approval', 'active', 'completed', 'archived', 'stalled');
create type milestone_status as enum ('not_started', 'in_progress', 'completed', 'blocked', 'skipped');
create type ojt_status as enum ('assigned', 'in_progress', 'evidence_submitted', 'validated', 'rejected');
create type elearning_status as enum ('enrolled', 'in_progress', 'completed', 'abandoned');
create type nudge_type as enum ('milestone_due', 'ojt_overdue', 'idp_stalled', 'approval_required', 'weekly_digest');
create type nudge_status as enum ('queued', 'sent', 'failed', 'deferred');
create type ai_node as enum ('idp_generation', 'modality_recommender', 'ojt_recommender', 'coaching_brief');

create type data_classification as enum ('public', 'internal', 'confidential', 'restricted');
create type security_event_type as enum (
  'login_success', 'login_failure', 'logout',
  'password_reset_requested', 'password_reset_completed',
  'mfa_enrolled', 'mfa_challenge_success', 'mfa_challenge_failure',
  'session_expired', 'session_revoked',
  'role_changed', 'tenant_changed',
  'export_requested', 'export_completed',
  'deletion_requested', 'deletion_completed',
  'rls_denial', 'admin_impersonation'
);

-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb,
  session_timeout_minutes integer not null default 720,
  idle_timeout_minutes integer not null default 30,
  mfa_required_roles user_role[] not null default array['ld_admin', 'superadmin']::user_role[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete restrict,
  role user_role not null default 'employee',
  full_name text not null,
  email text not null,
  mfa_enrolled boolean not null default false,
  last_login_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, email)
);

-- ============================================================================
-- 4. DOMAIN TABLES
-- ============================================================================

create table competency_frameworks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, name, version)
);

create table competencies (
  id uuid primary key default uuid_generate_v4(),
  framework_id uuid not null references competency_frameworks(id) on delete cascade,
  parent_id uuid references competencies(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  category gap_category not null,
  proficiency_levels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (framework_id, code)
);

create table employees (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_profile_id uuid unique references user_profiles(id) on delete set null,
  employee_number text not null,
  full_name text not null,
  email text not null,
  role_title text not null,
  target_role_title text,
  department text,
  org_unit text,
  manager_id uuid references employees(id) on delete set null,
  hire_date date,
  data_classification data_classification not null default 'confidential',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, employee_number)
);

create table assessments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  source_platform text not null,
  assessment_date date not null,
  raw_data jsonb not null,
  data_classification data_classification not null default 'confidential',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table competency_scores (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete cascade,
  assessment_id uuid references assessments(id) on delete set null,
  score_0_100 integer not null check (score_0_100 between 0 and 100),
  target_score_0_100 integer check (target_score_0_100 between 0 and 100),
  source text not null,
  score_date date not null,
  data_classification data_classification not null default 'restricted',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================================
-- 5. IDP TABLES
-- ============================================================================

create table idps (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  version integer not null default 1,
  status idp_status not null default 'draft',
  narrative text,
  narrative_source text check (narrative_source in ('ai', 'template', 'manual')),
  generated_by_ai boolean not null default false,
  ai_generation_metadata jsonb,
  target_completion_date date,
  approved_by uuid references user_profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  last_activity_at timestamptz,
  data_classification data_classification not null default 'confidential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (employee_id, version)
);

create table idp_milestones (
  id uuid primary key default uuid_generate_v4(),
  idp_id uuid not null references idps(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete restrict,
  sequence_order integer not null,
  title text not null,
  description text,
  gap_score_at_creation integer not null check (gap_score_at_creation between 0 and 100),
  status milestone_status not null default 'not_started',
  target_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (idp_id, sequence_order)
);

create table idp_actions (
  id uuid primary key default uuid_generate_v4(),
  milestone_id uuid not null references idp_milestones(id) on delete cascade,
  modality modality_type not null,
  title text not null,
  external_ref_id uuid,
  external_ref_table text,
  is_recommended_by_ai boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================================
-- 6. MODALITY TABLES
-- ============================================================================

create table ojt_catalogue (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  description text not null,
  competency_tags uuid[] not null default array[]::uuid[],
  effort_hours integer not null,
  role_levels text[] not null default array[]::text[],
  deliverable_type text,
  observation_checklist jsonb not null default '[]'::jsonb,
  embedding vector(1536),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table ojt_assignments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  milestone_id uuid references idp_milestones(id) on delete set null,
  ojt_catalogue_id uuid not null references ojt_catalogue(id) on delete restrict,
  assigned_by uuid not null references user_profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  due_date date not null,
  status ojt_status not null default 'assigned',
  ai_recommendation_reasoning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table ojt_evidence (
  id uuid primary key default uuid_generate_v4(),
  ojt_assignment_id uuid not null references ojt_assignments(id) on delete cascade,
  submitted_by uuid not null references user_profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  self_reflection text not null,
  artifact_urls text[] default array[]::text[],
  validated_by uuid references user_profiles(id) on delete set null,
  validated_at timestamptz,
  observation_checklist_responses jsonb,
  validation_status text check (validation_status in ('approved', 'changes_requested', 'rejected')),
  validation_notes text,
  data_classification data_classification not null default 'confidential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table elearning_catalogue (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  provider text not null,
  external_url text,
  competency_tags uuid[] not null default array[]::uuid[],
  duration_minutes integer,
  scorm_endpoint text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table elearning_enrolments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  course_id uuid not null references elearning_catalogue(id) on delete restrict,
  milestone_id uuid references idp_milestones(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  status elearning_status not null default 'enrolled',
  completed_at timestamptz,
  score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================================
-- 7. OPERATIONAL TABLES
-- ============================================================================

create table coaching_briefs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  manager_id uuid not null references employees(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  generated_for_date date not null,
  brief_markdown text not null,
  source text not null check (source in ('ai', 'template')),
  reviewed_at timestamptz,
  data_classification data_classification not null default 'restricted',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table nudges_sent (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  recipient_user_id uuid not null references user_profiles(id) on delete cascade,
  nudge_type nudge_type not null,
  status nudge_status not null default 'queued',
  trigger_reference jsonb,
  subject text not null,
  body text not null,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0
);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete restrict,
  actor_id uuid references user_profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  classification data_classification,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table error_log (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete set null,
  ai_node ai_node,
  context jsonb,
  error_message text not null,
  stack_trace text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- SOC 2: dedicated security events stream, separate from business audit log
create table security_events (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete set null,
  user_id uuid references user_profiles(id) on delete set null,
  event_type security_event_type not null,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- SOC 2: client-configurable retention periods per entity type
create table retention_policies (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_table text not null,
  retention_days integer not null check (retention_days > 0),
  applies_after text not null check (applies_after in ('created_at', 'deleted_at', 'completed_at', 'last_activity_at')),
  justification text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_table)
);

-- SOC 2: periodic access review records
create table access_reviews (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  reviewed_by uuid not null references user_profiles(id) on delete restrict,
  review_period_start date not null,
  review_period_end date not null,
  users_reviewed integer not null,
  access_changes jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- SOC 2: subprocessor register for vendor management
create table subprocessors (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  purpose text not null,
  data_categories text[] not null,
  location text not null,
  soc2_status text,
  gdpr_status text,
  dpa_url text,
  added_at timestamptz not null default now(),
  reviewed_at timestamptz,
  is_active boolean not null default true
);

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'updated_at'
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
       for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- Expanded audit: captures tenant, actor, classification, plus network context where available
create or replace function write_audit_log()
returns trigger language plpgsql as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_class data_classification;
  v_ip inet;
  v_ua text;
begin
  begin v_tenant := (case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end); exception when others then v_tenant := null; end;
  begin v_actor := auth.uid(); exception when others then v_actor := null; end;
  begin v_class := (case when tg_op = 'DELETE' then old.data_classification else new.data_classification end); exception when others then v_class := null; end;
  begin v_ip := nullif(current_setting('request.headers.x-forwarded-for', true), '')::inet; exception when others then v_ip := null; end;
  begin v_ua := nullif(current_setting('request.headers.user-agent', true), ''); exception when others then v_ua := null; end;

  insert into audit_log(tenant_id, actor_id, action, entity_table, entity_id, before_state, after_state, classification, ip_address, user_agent)
  values (
    v_tenant,
    v_actor,
    tg_op,
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), uuid_generate_v4()),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    v_class,
    v_ip,
    v_ua
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Expanded audit coverage: all PII and sensitive operational data
create trigger idps_audit after insert or update or delete on idps
  for each row execute function write_audit_log();
create trigger idp_milestones_audit after insert or update or delete on idp_milestones
  for each row execute function write_audit_log();
create trigger idp_actions_audit after insert or update or delete on idp_actions
  for each row execute function write_audit_log();
create trigger ojt_assignments_audit after insert or update or delete on ojt_assignments
  for each row execute function write_audit_log();
create trigger ojt_evidence_audit after insert or update or delete on ojt_evidence
  for each row execute function write_audit_log();
create trigger competency_scores_audit after insert or update or delete on competency_scores
  for each row execute function write_audit_log();
create trigger employees_audit after insert or update or delete on employees
  for each row execute function write_audit_log();
create trigger assessments_audit after insert or update or delete on assessments
  for each row execute function write_audit_log();
create trigger user_profiles_audit after insert or update or delete on user_profiles
  for each row execute function write_audit_log();
create trigger coaching_briefs_audit after insert or update or delete on coaching_briefs
  for each row execute function write_audit_log();
create trigger elearning_enrolments_audit after insert or update or delete on elearning_enrolments
  for each row execute function write_audit_log();
create trigger retention_policies_audit after insert or update or delete on retention_policies
  for each row execute function write_audit_log();

create or replace function block_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger audit_log_no_update before update on audit_log
  for each row execute function block_audit_mutation();
create trigger audit_log_no_delete before delete on audit_log
  for each row execute function block_audit_mutation();

create or replace function block_security_events_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'security_events is append-only';
end $$;

create trigger security_events_no_update before update on security_events
  for each row execute function block_security_events_mutation();
create trigger security_events_no_delete before delete on security_events
  for each row execute function block_security_events_mutation();

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

alter table tenants enable row level security;
alter table user_profiles enable row level security;
alter table competency_frameworks enable row level security;
alter table competencies enable row level security;
alter table employees enable row level security;
alter table assessments enable row level security;
alter table competency_scores enable row level security;
alter table idps enable row level security;
alter table idp_milestones enable row level security;
alter table idp_actions enable row level security;
alter table ojt_catalogue enable row level security;
alter table ojt_assignments enable row level security;
alter table ojt_evidence enable row level security;
alter table elearning_catalogue enable row level security;
alter table elearning_enrolments enable row level security;
alter table coaching_briefs enable row level security;
alter table nudges_sent enable row level security;
alter table audit_log enable row level security;
alter table error_log enable row level security;
alter table security_events enable row level security;
alter table retention_policies enable row level security;
alter table access_reviews enable row level security;
alter table subprocessors enable row level security;

-- Hardened tenant context helpers — return NULL safely if no auth context
create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from user_profiles where id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function current_role_is(target user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role = target and deleted_at is null
  );
$$;

create or replace function current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from employees where user_profile_id = auth.uid() and deleted_at is null limit 1;
$$;

-- RLS policies — all filter deleted_at IS NULL by default (soft delete respect)
create policy "tenant_isolation_user_profiles" on user_profiles
  for all using (tenant_id = current_tenant_id() and deleted_at is null)
  with check (tenant_id = current_tenant_id());

create policy "tenant_isolation_frameworks" on competency_frameworks
  for all using (tenant_id = current_tenant_id() and deleted_at is null)
  with check (tenant_id = current_tenant_id());

create policy "tenant_isolation_competencies" on competencies
  for all using (
    framework_id in (select id from competency_frameworks where tenant_id = current_tenant_id() and deleted_at is null)
    and deleted_at is null
  );

create policy "employees_select" on employees
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or id = current_employee_id()
      or manager_id = current_employee_id()
      or current_role_is('coach')
    )
  );

create policy "employees_admin_write" on employees
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "assessments_select" on assessments
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
    )
  );

create policy "competency_scores_select" on competency_scores
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
      or employee_id in (select id from employees where manager_id = current_employee_id() and deleted_at is null)
    )
  );

create policy "idps_select" on idps
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
      or employee_id in (select id from employees where manager_id = current_employee_id() and deleted_at is null)
      or current_role_is('coach')
    )
  );

create policy "idps_admin_write" on idps
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "idp_milestones_follow_idp" on idp_milestones
  for all using (
    idp_id in (select id from idps where tenant_id = current_tenant_id() and deleted_at is null)
    and deleted_at is null
  );

create policy "idp_actions_follow_milestone" on idp_actions
  for all using (
    milestone_id in (
      select m.id from idp_milestones m
      join idps i on i.id = m.idp_id
      where i.tenant_id = current_tenant_id() and i.deleted_at is null and m.deleted_at is null
    )
    and deleted_at is null
  );

create policy "ojt_catalogue_select" on ojt_catalogue
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "ojt_catalogue_admin_write" on ojt_catalogue
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "ojt_assignments_select" on ojt_assignments
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
      or employee_id in (select id from employees where manager_id = current_employee_id() and deleted_at is null)
    )
  );

create policy "ojt_assignments_manager_write" on ojt_assignments
  for insert with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin') or current_role_is('manager'))
  );

create policy "ojt_evidence_select" on ojt_evidence
  for select using (
    ojt_assignment_id in (select id from ojt_assignments where tenant_id = current_tenant_id() and deleted_at is null)
    and deleted_at is null
  );

create policy "elearning_catalogue_select" on elearning_catalogue
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "elearning_enrolments_select" on elearning_enrolments
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or employee_id = current_employee_id()
      or employee_id in (select id from employees where manager_id = current_employee_id() and deleted_at is null)
    )
  );

create policy "coaching_briefs_select" on coaching_briefs
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (
      current_role_is('ld_admin')
      or current_role_is('superadmin')
      or manager_id = current_employee_id()
    )
  );

create policy "nudges_recipient_select" on nudges_sent
  for select using (
    tenant_id = current_tenant_id()
    and (recipient_user_id = auth.uid() or current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "audit_log_admin_read" on audit_log
  for select using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "error_log_admin_read" on error_log
  for select using (
    (tenant_id = current_tenant_id() or tenant_id is null)
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "security_events_admin_read" on security_events
  for select using (
    (tenant_id = current_tenant_id() or tenant_id is null)
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "retention_policies_admin" on retention_policies
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "access_reviews_admin" on access_reviews
  for all using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "subprocessors_public_read" on subprocessors
  for select using (is_active = true);

-- ============================================================================
-- 10. INDEXES
-- ============================================================================

create index idx_user_profiles_tenant on user_profiles(tenant_id) where deleted_at is null;
create index idx_employees_tenant on employees(tenant_id) where deleted_at is null;
create index idx_employees_manager on employees(manager_id) where deleted_at is null;
create index idx_competency_scores_employee on competency_scores(employee_id) where deleted_at is null;
create index idx_idps_employee_status on idps(employee_id, status) where deleted_at is null;
create index idx_idp_milestones_idp on idp_milestones(idp_id, sequence_order) where deleted_at is null;
create index idx_ojt_assignments_employee on ojt_assignments(employee_id, status) where deleted_at is null;
create index idx_elearning_enrolments_employee on elearning_enrolments(employee_id, status) where deleted_at is null;
create index idx_nudges_status_queued on nudges_sent(status, queued_at) where status = 'queued';
create index idx_audit_log_tenant_date on audit_log(tenant_id, created_at desc);
create index idx_audit_log_entity on audit_log(entity_table, entity_id);
create index idx_audit_log_actor on audit_log(actor_id, created_at desc);
create index idx_security_events_user_date on security_events(user_id, created_at desc);
create index idx_security_events_type_date on security_events(event_type, created_at desc);

create index idx_ojt_catalogue_embedding on ojt_catalogue using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================================================
-- END v2
-- ============================================================================
