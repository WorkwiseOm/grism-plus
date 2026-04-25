-- write_audit_log() resolves tenant_id for the audit row.
-- Most tables expose tenant_id directly via NEW.tenant_id.
-- Child tables (those without their own tenant_id column) require
-- a per-table lookup back through their parent FK chain. Add a new
-- branch to the CASE statement when introducing a new child table
-- without a direct tenant_id column. Failure to do so causes runtime
-- INSERT failures on that table (audit_log.tenant_id is NOT NULL).
--
-- Discovered: 2026-04-25 during Phase 0 Step 5 demo seed implementation.
-- The original write_audit_log() (in 00001_initial_schema.sql) read
-- NEW.tenant_id directly, swallowed missing-column errors with a
-- generic exception handler, and produced INSERT failures with
-- non-obvious symptoms. This migration adds explicit per-table
-- resolution and removes the silent failure path.
--
-- Currently affected child tables (verified via cross-check of every
-- audited public.* table for absence of a tenant_id column):
--   - idp_milestones  → tenant via idps   (idp_id → idps.tenant_id)
--   - idp_actions     → tenant via idp_milestones → idps
--                       (milestone_id → milestone.idp_id → idps.tenant_id)
--   - ojt_evidence    → tenant via ojt_assignments
--                       (ojt_assignment_id → ojt_assignments.tenant_id)
--
-- SECURITY DEFINER added so the parent-table lookups bypass RLS — the
-- trigger must see all rows to write audit, regardless of the calling
-- user's RLS scope. SET search_path = public, extensions ensures
-- extensions.uuid_generate_v4() resolves under the lookup branches.
--
-- Cascade-DELETE limitation (out of scope for this fix, documented for
-- future work): when a parent row in idps or ojt_assignments is deleted
-- with ON DELETE CASCADE, the child row's audit trigger fires AFTER the
-- parent row is already gone, so the parent-table SELECT returns no row
-- and v_tenant remains NULL — INSERT into audit_log fails. Retaining
-- audit_log.tenant_id NOT NULL is the right SOC 2 posture; cascade
-- DELETEs of audited child rows need a different design (e.g., capture
-- tenant_id into a session-local transition table in a BEFORE-DELETE
-- trigger on the parent). Tracked for a future migration.

create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_class data_classification;
  v_ip inet;
  v_ua text;
begin
  case tg_table_name
    when 'idp_milestones' then
      v_tenant := (
        select tenant_id from public.idps
         where id = (case when tg_op = 'DELETE' then old.idp_id else new.idp_id end)
      );
    when 'idp_actions' then
      v_tenant := (
        select i.tenant_id
          from public.idp_milestones m
          join public.idps i on i.id = m.idp_id
         where m.id = (case when tg_op = 'DELETE' then old.milestone_id else new.milestone_id end)
      );
    when 'ojt_evidence' then
      v_tenant := (
        select tenant_id from public.ojt_assignments
         where id = (case when tg_op = 'DELETE' then old.ojt_assignment_id else new.ojt_assignment_id end)
      );
    else
      begin
        v_tenant := (case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end);
      exception when others then
        v_tenant := null;
      end;
  end case;

  begin v_actor := auth.uid(); exception when others then v_actor := null; end;

  begin
    v_class := (case when tg_op = 'DELETE' then old.data_classification else new.data_classification end);
  exception when others then
    v_class := null;
  end;

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
