-- Rate limit infrastructure for login attempts (Step 4 middleware target).
--
-- Three coupled changes; bundled because each is meaningless alone:
--   1. New security_event_type enum value: 'login_rate_limited'
--      Distinct from 'login_failure' — rate-limited attempts never reach
--      credential checking, so aggregation queries must be able to separate them.
--   2. Partial index on security_events (ip_address, event_type, created_at desc)
--      WHERE ip_address IS NOT NULL — supports the rate-limit count query
--      without scanning the whole table.
--   3. Function check_login_rate_limit(inet) returns boolean — predicate
--      callable from Next.js edge middleware via supabase.rpc(). Encodes the
--      "5 failures per 15 min per IP" policy in SQL (single source of truth,
--      audit-trackable via git history of this file).
--
-- Policy source of truth: docs/security.md → "Rate limiting on sign-in/sign-up".
--
-- PG 17 note: ALTER TYPE ADD VALUE is safe inside a transaction on PG 12+.
-- The new value 'login_rate_limited' is not referenced in this migration
-- (only 'login_failure' is used in the function body), so the "can't use
-- new enum value in same transaction" restriction does not apply. If a
-- future PG version tightens this, split this file into two migrations:
-- 00003_add_login_rate_limited_enum.sql and 00004_rate_limit_index_and_function.sql.

-- 1. Enum addition. Idempotent re-apply via IF NOT EXISTS.
alter type security_event_type add value if not exists 'login_rate_limited';

-- 2. Partial index supporting the rate-limit count query.
--    ip_address leads because the middleware filters by it first (narrows to
--    typically <10 rows per 15-min window per IP). Partial predicate keeps
--    the index scoped to auth events with IPs.
create index if not exists idx_security_events_ip_type_date
  on public.security_events (ip_address, event_type, created_at desc)
  where ip_address is not null;

-- 3. Rate-limit predicate. Called from Next.js edge middleware via
--    supabase.rpc('check_login_rate_limit', { p_ip: request.ip }).
--    Returns true if the caller is allowed to attempt a sign-in; false
--    if they have ≥5 failed sign-ins from this IP in the last 15 minutes.
--
--    SECURITY DEFINER so the anon role (middleware pre-auth) can call it
--    without needing SELECT on security_events.
--    SET search_path = public hardens against search-path injection
--    against the SECURITY DEFINER function.
--
--    Only 'login_failure' events count against the threshold, not
--    'login_rate_limited' events. Rate-limit rejections must not compound
--    — otherwise a single bot burst would lock an IP out indefinitely.
--    Rate-limited attempts ARE still logged (for audit and for detecting
--    persistent abuse patterns) but do not feed back into the rate limit
--    decision.
create or replace function public.check_login_rate_limit(p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < 5
  from public.security_events
  where ip_address = p_ip
    and event_type = 'login_failure'
    and created_at > now() - interval '15 minutes';
$$;

grant execute on function public.check_login_rate_limit(inet) to anon, authenticated;
