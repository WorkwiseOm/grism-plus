-- 00016_framework_policy_recursion_fix.sql
--
-- Fix the Phase 1 framework-editor write policy so competency updates can
-- validate parent-child consistency without recursively reading competencies
-- through the same RLS policy.

create or replace function competency_parent_in_same_framework(
  parent_competency_id uuid,
  target_framework_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    parent_competency_id is null
    or exists (
      select 1
        from competencies parent
       where parent.id = parent_competency_id
         and parent.framework_id = target_framework_id
         and parent.deleted_at is null
    );
$$;

comment on function competency_parent_in_same_framework(uuid, uuid)
  is 'Security-definer helper used by competency admin-write RLS to avoid recursive policy evaluation when validating parent_id.';

grant execute on function competency_parent_in_same_framework(uuid, uuid) to authenticated;

drop policy if exists "competencies_admin_write" on competencies;

create policy "competencies_admin_write" on competencies
  for all using (
    framework_id in (
      select id
        from competency_frameworks
       where tenant_id = current_tenant_id()
         and deleted_at is null
    )
    and deleted_at is null
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    framework_id in (
      select id
        from competency_frameworks
       where tenant_id = current_tenant_id()
         and deleted_at is null
    )
    and competency_parent_in_same_framework(parent_id, framework_id)
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );
