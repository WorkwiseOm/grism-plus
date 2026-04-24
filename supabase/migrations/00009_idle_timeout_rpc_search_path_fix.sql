-- Propagate the search_path widening from 00008 to the cloud project.
--
-- 00008 originally set `search_path = public` only. That narrow path
-- caused the audit triggers on user_profiles (which call
-- extensions.uuid_generate_v4() without a schema qualifier) to fail with
-- "function uuid_generate_v4() does not exist" whenever the RPC performed
-- its throttled UPDATE. Discovered during the idle-timeout E2E tests.
--
-- The fix is to include `extensions` in the function's search_path. This
-- migration re-declares the function with the corrected setting. On a
-- fresh environment, 00008 already carries the correct path (the file
-- was amended to match this migration), so 00009 applies as a no-op
-- CREATE OR REPLACE — the function body is byte-identical to what 00008
-- would produce. On the existing cloud project, which was provisioned
-- with the buggy version, this migration supplies the functional fix.
--
-- Kept as a separate migration file rather than silently amending 00008
-- because 00008 was already applied and Supabase tracks migrations by
-- version number; a retroactive edit would not re-run against cloud.

create or replace function public.check_and_refresh_idle_timeout(
  p_idle_minutes_default int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_activity timestamptz;
  v_idle_minutes int;
  v_idle_expired boolean := false;
  v_activity_updated boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('idle_expired', false, 'last_activity_updated', false);
  end if;

  select up.last_activity_at,
         coalesce(t.idle_timeout_minutes, p_idle_minutes_default)
    into v_last_activity, v_idle_minutes
    from public.user_profiles up
    left join public.tenants t on t.id = up.tenant_id
    where up.id = v_user_id;

  if not found then
    return jsonb_build_object('idle_expired', false, 'last_activity_updated', false);
  end if;

  if v_last_activity is not null
     and (now() - v_last_activity) > (v_idle_minutes * interval '1 minute')
  then
    v_idle_expired := true;
  end if;

  if not v_idle_expired
     and (v_last_activity is null or (now() - v_last_activity) > interval '1 minute')
  then
    update public.user_profiles
       set last_activity_at = now()
     where id = v_user_id;
    v_activity_updated := true;
  end if;

  return jsonb_build_object(
    'idle_expired', v_idle_expired,
    'last_activity_updated', v_activity_updated
  );
end;
$$;

grant execute on function public.check_and_refresh_idle_timeout(int) to authenticated;
