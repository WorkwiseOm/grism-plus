-- Activate Vercel in the subprocessor register after the first real Vercel
-- deployment is live and serving Grism Plus.
--
-- Do not apply this migration before:
-- 1. the Vercel project exists,
-- 2. production-safe environment variables are configured,
-- 3. the deployed app passes the Step 9 smoke checks, and
-- 4. the deployed Vercel region has been verified as Frankfurt, Germany.

do $$
declare
  updated_count integer;
begin
  update public.subprocessors
     set is_active = true,
         location = 'Frankfurt, Germany (production Vercel deployment).',
         reviewed_at = now()
   where name = 'Vercel'
     and is_active = false;

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'Expected to activate exactly one inactive Vercel subprocessor row, updated % rows', updated_count;
  end if;
end $$;
