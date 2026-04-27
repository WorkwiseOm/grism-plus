-- 00014_ojt_evidence_write_flows.sql
--
-- Phase 1 OJT write flows. Keep writes behind narrow SECURITY DEFINER
-- functions instead of broad client-facing RLS updates on ojt_evidence.
-- The functions enforce tenant, employee, and direct-manager boundaries and
-- let the existing audit triggers capture every INSERT/UPDATE.

create or replace function submit_ojt_evidence(
  p_assignment_id uuid,
  p_self_reflection text,
  p_artifact_urls text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment record;
  v_evidence_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_assignment_id is null then
    raise exception 'assignment is required' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_self_reflection, ''))) < 20 then
    raise exception 'self reflection must be at least 20 characters' using errcode = '22023';
  end if;

  select oa.id, oa.tenant_id, oa.employee_id, oa.status
    into v_assignment
    from ojt_assignments oa
   where oa.id = p_assignment_id
     and oa.deleted_at is null
   for update;

  if not found then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  if v_assignment.tenant_id is distinct from current_tenant_id() then
    raise exception 'assignment not in current tenant' using errcode = '42501';
  end if;

  if v_assignment.employee_id is distinct from current_employee_id() then
    raise exception 'only the assigned employee can submit evidence' using errcode = '42501';
  end if;

  if v_assignment.status not in ('assigned', 'in_progress', 'rejected') then
    raise exception 'assignment is not open for evidence submission' using errcode = '23514';
  end if;

  insert into ojt_evidence (
    ojt_assignment_id,
    submitted_by,
    self_reflection,
    artifact_urls
  )
  values (
    p_assignment_id,
    auth.uid(),
    trim(p_self_reflection),
    coalesce(p_artifact_urls, array[]::text[])
  )
  returning id into v_evidence_id;

  update ojt_assignments
     set status = 'evidence_submitted',
         updated_at = now()
   where id = p_assignment_id;

  return v_evidence_id;
end;
$$;

create or replace function validate_ojt_evidence(
  p_evidence_id uuid,
  p_status text,
  p_notes text default null,
  p_checklist jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evidence record;
  v_assignment_status ojt_status;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_evidence_id is null then
    raise exception 'evidence is required' using errcode = '22023';
  end if;

  if p_status not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'invalid validation status' using errcode = '23514';
  end if;

  select
      oe.id,
      oe.ojt_assignment_id,
      oe.validated_at,
      oa.tenant_id,
      oa.employee_id,
      e.manager_id,
      im.competency_id
    into v_evidence
    from ojt_evidence oe
    join ojt_assignments oa on oa.id = oe.ojt_assignment_id
    join employees e on e.id = oa.employee_id
    left join idp_milestones im on im.id = oa.milestone_id
   where oe.id = p_evidence_id
     and oe.deleted_at is null
     and oa.deleted_at is null
     and e.deleted_at is null
   for update of oe, oa;

  if not found then
    raise exception 'evidence not found' using errcode = 'P0002';
  end if;

  if v_evidence.tenant_id is distinct from current_tenant_id() then
    raise exception 'evidence not in current tenant' using errcode = '42501';
  end if;

  if not (
    current_role_is('ld_admin')
    or current_role_is('superadmin')
    or (
      current_role_is('manager')
      and v_evidence.manager_id is not distinct from current_employee_id()
    )
  ) then
    raise exception 'only the direct manager or L&D admin can validate evidence' using errcode = '42501';
  end if;

  if v_evidence.validated_at is not null then
    raise exception 'evidence has already been validated' using errcode = '23514';
  end if;

  update ojt_evidence
     set validated_by = auth.uid(),
         validated_at = now(),
         observation_checklist_responses = p_checklist,
         validation_status = p_status,
         validation_notes = nullif(trim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_evidence_id;

  v_assignment_status := case p_status
    when 'approved' then 'validated'::ojt_status
    when 'rejected' then 'rejected'::ojt_status
    else 'in_progress'::ojt_status
  end;

  update ojt_assignments
     set status = v_assignment_status,
         updated_at = now()
   where id = v_evidence.ojt_assignment_id;

  if p_status = 'approved' and v_evidence.competency_id is not null then
    insert into skill_progression_events (
      tenant_id,
      employee_id,
      competency_id,
      signal_source,
      source_table,
      source_id,
      signal_date,
      confidence_0_100,
      summary,
      created_by
    )
    values (
      v_evidence.tenant_id,
      v_evidence.employee_id,
      v_evidence.competency_id,
      'ojt_manager_feedback',
      'ojt_evidence',
      p_evidence_id,
      current_date,
      80,
      nullif(trim(coalesce(p_notes, '')), ''),
      auth.uid()
    )
    on conflict (
      tenant_id,
      signal_source,
      source_table,
      source_id,
      competency_id
    )
    where deleted_at is null
    do nothing;
  end if;

  return p_evidence_id;
end;
$$;

revoke all on function submit_ojt_evidence(uuid, text, text[]) from public;
revoke all on function validate_ojt_evidence(uuid, text, text, jsonb) from public;

grant execute on function submit_ojt_evidence(uuid, text, text[]) to authenticated;
grant execute on function validate_ojt_evidence(uuid, text, text, jsonb) to authenticated;
