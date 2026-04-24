-- Idle timeout support: per-user server-side activity timestamp.
--
-- Middleware updates this column on every authenticated request, throttled
-- to roughly once per minute per user to avoid write amplification. The
-- idle-timeout check compares (now() - last_activity_at) against the user's
-- tenants.idle_timeout_minutes setting; if exceeded, middleware forces
-- re-authentication.
--
-- Distinct from user_profiles.last_login_at (set once per successful
-- sign-in) — last_activity_at tracks in-session activity specifically.
--
-- Nullable with no default: a row whose owner has never been active
-- appears as NULL, which middleware treats as "no prior activity observed"
-- (allows the first authenticated request to proceed and then sets the
-- value).

alter table public.user_profiles
  add column if not exists last_activity_at timestamptz;

comment on column public.user_profiles.last_activity_at is
  'Server-side last-activity timestamp updated by middleware on authenticated requests (throttled to ~1 update/min/user). Used for idle timeout enforcement per tenants.idle_timeout_minutes. Distinct from last_login_at (set once per login).';
