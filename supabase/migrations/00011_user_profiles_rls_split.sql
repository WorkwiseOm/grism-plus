-- Authorization-boundary fix on public.user_profiles.
--
-- Why this matters: user_profiles holds role (employee / manager /
-- ld_admin / coach / superadmin) and tenant_id. RLS-allowed UPDATEs of
-- this table directly govern who is a tenant administrator and which
-- tenant they belong to. Mistakes here cascade into every other RLS
-- predicate that depends on current_role_is() / current_tenant_id().
--
-- The original policy from 00001 (tenant_isolation_user_profiles) was
--
--   FOR ALL
--   USING       (tenant_id = current_tenant_id() AND deleted_at IS NULL)
--   WITH CHECK  (tenant_id = current_tenant_id())
--
-- Both predicates are satisfied for any authenticated user updating
-- their own row, including a malicious UPDATE that flips role from
-- 'employee' to 'ld_admin' or 'superadmin'. The WITH CHECK only
-- constrained tenant_id, not role. After the flip, current_role_is()
-- returns true for the elevated role, granting full tenant-wide read
-- and write access to every other RLS-governed table.
--
-- This migration drops that single FOR ALL policy and replaces it with
-- per-command policies:
--
--   SELECT — own profile          → any authenticated user can read
--                                    their own row
--   SELECT — tenant admin         → ld_admin / superadmin can read
--                                    every profile in their tenant
--   INSERT — tenant admin only    → no client-side user creation;
--                                    admin-mediated or service role
--   UPDATE — tenant admin only    → role / tenant_id / email are no
--                                    longer self-writable
--   DELETE — tenant admin only    → soft-delete via deleted_at /
--                                    is_active is the preferred path
--
-- Service role bypasses RLS at the connection level (separate from
-- these policies), so seed scripts, the admin client used by middleware
-- for security_events writes, and Supabase Auth's own writes to
-- user_profiles all continue to work without changes.
--
-- Helper-function impact: current_tenant_id() and current_role_is()
-- query user_profiles internally and are SECURITY DEFINER, so they
-- bypass these new policies. No RLS recursion during evaluation.
--
-- Side effect for ordinary users: routine writes ordinary users may
-- want to make to their own profile (e.g., updating their own
-- full_name, language preference) are now blocked. For MVP this is
-- fine — those flows go through an admin or a server-side API route
-- with the service role. If self-service profile editing is added in
-- Phase 1+, a narrower fourth UPDATE policy can grant write access on
-- a whitelist of non-privileged columns to id = auth.uid().

drop policy if exists tenant_isolation_user_profiles on public.user_profiles;

-- SELECT: own profile.
create policy user_profiles_select_own on public.user_profiles
  for select
  using (id = auth.uid() and deleted_at is null);

-- SELECT: tenant administrators see all profiles in their tenant.
create policy user_profiles_select_tenant_admin on public.user_profiles
  for select
  using (
    tenant_id = current_tenant_id()
    and deleted_at is null
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

-- INSERT: tenant administrators only. New row must land in the
-- admin's tenant (WITH CHECK constrains the post-insert tenant_id).
create policy user_profiles_insert_tenant_admin on public.user_profiles
  for insert
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

-- UPDATE: tenant administrators only. WITH CHECK matches USING so the
-- admin cannot move a profile to a different tenant via UPDATE.
create policy user_profiles_update_tenant_admin on public.user_profiles
  for update
  using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  )
  with check (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );

-- DELETE: tenant administrators only. Hard-delete is permitted for
-- admins; ordinary users cannot delete profiles. Soft-delete via
-- deleted_at remains the preferred path and goes through the admin
-- client today.
create policy user_profiles_delete_tenant_admin on public.user_profiles
  for delete
  using (
    tenant_id = current_tenant_id()
    and (current_role_is('ld_admin') or current_role_is('superadmin'))
  );
