-- MFA enforcement helpers for Step 4 middleware.
--
-- Two changes bundled, each required before middleware can honour the
-- per-role MFA policy in tenants.mfa_required_roles:
--
--   1. New security_event_type enum value: 'mfa_factor_reset_by_admin'.
--      Fires when an admin removes another user's MFA factor via
--      supabase.auth.admin.mfa.deleteFactor(). Distinct from user-initiated
--      unenrolment: this is a privileged destructive action against another
--      user's security posture, with different audit semantics (separate
--      aggregation, separate alert thresholds). Recovery-code path (Phase 4
--      backlog) will be a third distinct event when it ships.
--
--   2. Function user_mfa_required_but_missing() returns boolean — the
--      predicate called from Next.js middleware on every authenticated
--      request. Encapsulates the join (user_profiles ⋈ tenants) and the
--      AAL comparison in one round trip, SECURITY DEFINER to allow the
--      anon/authenticated roles to evaluate without needing direct SELECT
--      on tenants.
--
-- Middleware contract (codified in the function comment block below):
--   null  → no auth context (anonymous request). Middleware passes through.
--   false → MFA not required OR session already elevated to aal2. Proceed.
--   true  → MFA required and session at aal1. Middleware then:
--             * listFactors() has verified TOTP → redirect /auth/mfa/challenge
--             * no verified factor             → redirect /auth/mfa/enrol (forced)
--
-- Defence-in-depth posture: this migration enables middleware-level MFA
-- enforcement (the primary enforcer in our design). Database-level RLS
-- aal2 guards on ld_admin-accessed sensitive tables (coaching_briefs,
-- competency_scores, ojt_evidence, audit_log) are tracked in
-- docs/PROGRESS.md as a Phase 4 backlog item; they will supplement (not
-- replace) middleware enforcement.
--
-- PG 17 note: ALTER TYPE ADD VALUE is safe inside a transaction on PG 12+.
-- The new value 'mfa_factor_reset_by_admin' is not referenced in this
-- migration (only added to the type), so the "can't use new enum value in
-- same transaction" restriction does not apply.
--
-- Policy source of truth: docs/security.md and tenants.mfa_required_roles.

-- 1. Enum addition. Idempotent re-apply via IF NOT EXISTS.
alter type security_event_type add value if not exists 'mfa_factor_reset_by_admin';

-- 2. Middleware predicate. See block comment at top for the full contract.
--    SECURITY DEFINER + set search_path = public hardens the function
--    against search-path injection. The function only ever reads the
--    calling user's own row (scoped via auth.uid()) so no cross-user
--    data exposure.
create or replace function public.user_mfa_required_but_missing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_aal as (
    select coalesce(auth.jwt() ->> 'aal', 'aal1') as aal
  ),
  user_context as (
    -- up.role and elements of t.mfa_required_roles are both user_role enum.
    -- Do NOT cast to text here: comparing text to user_role[] fails with
    -- "operator does not exist: text = user_role" (learned the hard way
    -- on the first db push attempt).
    select up.role, t.mfa_required_roles
    from public.user_profiles up
    join public.tenants t on t.id = up.tenant_id
    where up.id = auth.uid()
  )
  select
    case
      when auth.uid() is null then null
      when (select aal from current_aal) = 'aal2' then false
      when not exists (select 1 from user_context) then null
      else (select role = any(mfa_required_roles) from user_context)
    end;
$$;

grant execute on function public.user_mfa_required_but_missing() to authenticated;
