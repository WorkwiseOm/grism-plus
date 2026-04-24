-- MFA rate limit infrastructure for login MFA challenges.
--
-- Mirror of Gate 2's check_login_rate_limit but scoped per-user instead of
-- per-IP. Rationale: MFA challenges happen post-authentication, so we have
-- user_id. A single-user attacker trying codes should be rate-limited
-- regardless of which IP they use, and corporate NAT shouldn't cause cross-
-- user interference. Industry norm for MFA lockout (Auth0, Okta, Google
-- Workspace) is per-user.
--
-- Function signature: zero-argument. Uses auth.uid() internally rather than
-- accepting a p_user_id parameter. Rationale:
--   * Simpler call site: supabase.rpc('check_mfa_rate_limit') with no args.
--   * Safer: a caller cannot probe another user's MFA failure history.
--   * Symmetric with user_mfa_required_but_missing() (00004) which also
--     uses auth.uid() for the same reasons.
-- Admin-debugging use case (the one argument in favour of an explicit
-- p_user_id parameter) is served better by direct Postgres access with the
-- service role, not via this RPC.
--
-- Index coverage: the existing idx_security_events_user_date
-- (on user_id, created_at desc) from 00001 covers the query pattern.
-- For a user's last 15 min of events the index seek narrows to typically
-- <100 rows, and the event_type filter is a cheap post-filter.
-- No new index warranted (not creating speculatively).
--
-- Policy source of truth: docs/security.md and Gate 3 decisions.

create or replace function public.check_mfa_rate_limit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < 5
  from public.security_events
  where user_id = auth.uid()
    and event_type = 'mfa_challenge_failure'
    and created_at > now() - interval '15 minutes';
$$;

grant execute on function public.check_mfa_rate_limit() to authenticated;
