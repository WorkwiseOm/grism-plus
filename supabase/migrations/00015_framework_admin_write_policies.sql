-- 00015_framework_admin_write_policies.sql
--
-- Tighten framework taxonomy writes before enabling the Phase 1 framework
-- editor. Tenant users still need read access to frameworks and competencies,
-- but write access belongs to L&D admins and superadmins only.

drop policy if exists "tenant_isolation_frameworks" on competency_frameworks;
drop policy if exists "tenant_isolation_competencies" on competencies;

create policy "competency_frameworks_select" on competency_frameworks
  for select using (
    tenant_id = current_tenant_id()
    and deleted_at is null
  );

create policy "competency_frameworks_admin_write" on competency_frameworks
  for all using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

create policy "competencies_select" on competencies
  for select using (
    framework_id in (
      select id
        from competency_frameworks
       where tenant_id = current_tenant_id()
         and deleted_at is null
    )
    and deleted_at is null
  );

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
    and (
      parent_id is null
      or parent_id in (
        select id
          from competencies parent
         where parent.framework_id = competencies.framework_id
           and parent.deleted_at is null
      )
    )
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );
