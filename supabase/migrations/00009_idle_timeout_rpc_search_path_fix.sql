-- Corrective migration. 00008 was applied to cloud before the search_path
-- interaction with the audit trigger on user_profiles was discovered (audit
-- trigger calls extensions.uuid_generate_v4(), which fails under
-- search_path = public only). Rather than edit 00008 in place (which would
-- rewrite audit history), this migration uses CREATE OR REPLACE to propagate
-- the widened search_path to the cloud project. Fresh resets apply 00008
-- then 00009 in sequence.

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
