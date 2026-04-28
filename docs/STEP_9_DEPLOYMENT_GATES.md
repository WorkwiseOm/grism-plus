# Step 9 Deployment Gates

Status: not executed

Last updated: 2026-04-26

## Purpose

Step 9 proves the first Vercel deployment path and updates the subprocessor register only after Vercel is actually active for Grism Plus.

This document separates safe local preparation from actions that require explicit operator confirmation.

## Already Ready Locally

- CI workflow exists for `master` and pull requests.
- CodeQL is configured to run on `master`.
- `npm run build` succeeds locally.
- `.env.local.example` includes Supabase, Resend, Anthropic, and model configuration placeholders.
- `docs/security.md` and `docs/subprocessors.md` document the intended hosting and subprocessor posture.
- `supabase/migrations/00012_activate_vercel_subprocessor.sql` is prepared locally but remains unapplied.

## Operator Actions Required

These actions affect external systems and should not be performed unattended:

- Create or connect the Vercel project.
- Add Vercel environment variables.
- Trigger the first real Vercel deployment.
- Configure GitHub branch protection to require `CI / lint / typecheck / test / build`.
- Verify Vercel's trusted client-IP header behavior in the deployed runtime.
- Apply the Vercel subprocessor activation migration to cloud Supabase.
- Create or rotate provider API keys.

## Pre-Deploy Checks

Run before the first deployment:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Current status: the local Next.js security-upgrade spike moved the app to Next `15.5.15` and `npm audit` reports zero known vulnerabilities. `next lint` still works on Next 15 but emits a deprecation warning; migrate to the ESLint CLI before any future Next 16 upgrade.

## Environment Variables

Vercel must have production-safe values for:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HMAC_SESSION_KEY`
- `RESEND_API_KEY` when email is enabled
- `ANTHROPIC_API_KEY` when live AI nodes are enabled
- `ANTHROPIC_MODEL`

Do not store database passwords, test passwords, or demo credentials in Vercel unless a specific workflow requires them.

## Vercel deploy command behaviour

The first deployment to a fresh Vercel project is **auto-promoted to production**, even when invoked without `--prod`. Observed 2026-04-27 against `tas770-9352s-projects/grism-plus`: `vercel deploy` (no flags) returned `"target": "production"` in the CLI JSON output and immediately claimed the `grism-plus.vercel.app` alias.

This means a deploy intended as a throwaway smoke test will, by default, become the project's production deployment and claim the bare `<project>.vercel.app` alias.

Confirmed follow-up: `vercel deploy --target preview` did **not** avoid this on a second fresh team-scope project. Observed 2026-04-27 against `tilqai-grism/grism-plus-app`: the CLI still returned `"target": "production"` and claimed the `grism-plus-app.vercel.app` alias.

Current working rule: assume the first deploy of any fresh Vercel project will become production regardless of `--target preview`. If a true preview-only smoke is required, create the project under a throwaway name/scope, accept the first auto-production deploy as isolated, then tear it down or recreate the intended production project after the smoke check. For projects that already have a production deployment, plain `vercel deploy` produces a preview as expected; only the first deploy is special.

Default deployment protection is also a surprise to be aware of: new projects under a Vercel team scope (including auto-named personal `*-projects` scopes) ship with **Vercel SSO** required on every deployment. External smoke checks via `curl` will receive 401 + `Set-Cookie: _vercel_sso_nonce=…` and never reach application code. This is correct behaviour for non-public deployments; opening the URL in a Vercel-authenticated browser bypasses it. For automated smoke checks, the supported path is a per-project Protection Bypass for Automation token rather than disabling SSO globally.

## Branch protection (manual GitHub steps)

The `CI / lint / typecheck / test / build` check is produced by `.github/workflows/ci.yml` and runs on every pull request and on every push to `master`. To require it as a merge gate on `master`:

1. GitHub → repo → **Settings → Branches**
2. Add a **branch protection rule** for `master`
3. Tick **Require status checks to pass before merging**
4. Select the check **`CI / lint / typecheck / test / build`**
5. Tick **Require branches to be up to date before merging** if the option is available
6. **Save changes**

The required-check identifier is `<workflow-name> / <job-display-name>`; if either changes the rule must be re-pointed. The check only appears in the picker after the workflow has run at least once, so push first if the picker is empty. This is a repo-settings change, not a code change, and cannot be done via commit; the `gh` CLI is not installed on this machine, so the steps above are written as a clickable-UI runbook.

## Subprocessor Activation

Do not mark Vercel active in the database before the Vercel project exists and is serving Grism Plus.

Prepared migration file: `supabase/migrations/00012_activate_vercel_subprocessor.sql`.

Expected migration shape:

```sql
update public.subprocessors
   set is_active = true,
       reviewed_at = now()
 where name = 'Vercel';
```

The prepared file also updates the registered location to Frankfurt and fails unless exactly one inactive Vercel row is activated. Do not apply this migration until Vercel is serving Grism Plus and the deployment region has been verified. Do not edit `00002_seed_subprocessors.sql`.

## Deployment Smoke Checks

After deployment:

- `/auth/sign-in` renders.
- unauthenticated `/admin`, `/manager`, `/employee` redirect to sign-in.
- sign-in works with a known non-production test user.
- required-MFA admin users are redirected to enrol/challenge.
- build output and runtime logs do not expose secrets.
- response headers/client IP behavior matches the documented rate-limit assumption.

## Stop Conditions

Stop and do not activate the subprocessor if:

- Vercel project is not actually serving Grism Plus.
- environment variables are incomplete or copied from the wrong Supabase project.
- branch protection is not configured and the deploy is intended for shared review.
- client-IP source cannot be verified.
- audit vulnerabilities are not accepted for the intended exposure level.
