-- Activate Vercel in the subprocessor register after the first real Vercel
-- deployment is live and serving Grism Plus.
--
-- Do not apply this migration before:
-- 1. the Vercel project exists,
-- 2. production-safe environment variables are configured,
-- 3. the deployed app passes the Step 9 smoke checks, and
-- 4. the deployed Vercel region is recorded accurately on the row.
--
-- Activation date 2026-05-01: Vercel deployment is at grism-plus-app.vercel.app
-- in the iad1 region (Washington, D.C., USA), running as a demo deployment
-- behind an app-level passcode gate (see src/lib/auth/demo-gate.ts) against
-- the development Supabase project. The original Frankfurt intent in the
-- 00002 seed described a future production-pilot decision, not the current
-- demo region; that decision will be re-evaluated against the first customer
-- contract's data-residency requirements.

do $$
declare
  updated_count integer;
begin
  update public.subprocessors
     set is_active = true,
         location = 'Washington, D.C., USA (Vercel iad1 region). Demo deployment at grism-plus-app.vercel.app behind an app-level passcode gate against the development Supabase project. Production-pilot region to be re-evaluated against first customer contract data-residency requirements.',
         reviewed_at = now()
   where name = 'Vercel'
     and is_active = false;

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'Expected to activate exactly one inactive Vercel subprocessor row, updated % rows', updated_count;
  end if;
end $$;
