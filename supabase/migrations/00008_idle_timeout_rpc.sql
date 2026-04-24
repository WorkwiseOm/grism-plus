-- Idle timeout check + throttled activity refresh in a single RPC.
--
-- Called from Next.js middleware on every authenticated request. One
-- round trip replaces a read + conditional write sequence that would
-- otherwise require two HTTP hops to Supabase. The RPC handles:
--
--   1. Look up the caller's last_activity_at and their tenant's
--      idle_timeout_minutes (falls back to p_idle_minutes_default if the
--      join somehow returns no tenant row — defensive, not expected).
--
--   2. Compute idle_expired = (now() - last_activity_at) > idle_minutes.
--      A null last_activity_at counts as "never active" — not expired.
--
--   3. If NOT idle_expired AND (last_activity_at is null or older than
--      one minute), refresh last_activity_at to now(). This is the
--      write-amplification throttle — at most ~1 update per minute per
--      user, regardless of request rate.
--
--   4. Return a JSON object the middleware can act on:
--      { idle_expired: bool, last_activity_updated: bool }.
--
-- SECURITY DEFINER + set search_path = public, extensions — hardened
-- against search-path injection while still allowing audit triggers on
-- user_profiles (which call extensions.uuid_generate_v4() without a
-- schema qualifier) to resolve correctly during the UPDATE in step 3.
-- The earlier read-only RPCs (check_login_rate_limit, check_mfa_rate_limit,
-- user_mfa_required_but_missing) use public only because they do not
-- trigger write-time audit logic. The function only ever reads/writes
-- the caller's own row (scoped via auth.uid()), so no cross-user
-- exposure even with definer privilege.
--
-- Designed to return a jsonb rather than a composite row type because
-- supabase-js.rpc() deserialises jsonb directly into a typed object on
-- the client. Avoids an extra RETURNS TABLE / SELECT gymnastic.

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

  -- No matching profile row → fail-safe: not idle, nothing to refresh.
  if not found then
    return jsonb_build_object('idle_expired', false, 'last_activity_updated', false);
  end if;

  -- Idle only if we have a prior timestamp and it's past the threshold.
  if v_last_activity is not null
     and (now() - v_last_activity) > (v_idle_minutes * interval '1 minute')
  then
    v_idle_expired := true;
  end if;

  -- Throttled refresh: skip if expired (preserve the stale timestamp for
  -- audit context) and skip if we updated within the last minute.
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
