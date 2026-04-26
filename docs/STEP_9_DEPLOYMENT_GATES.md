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

## Operator Actions Required

These actions affect external systems and should not be performed unattended:

- Create or connect the Vercel project.
- Add Vercel environment variables.
- Trigger the first real Vercel deployment.
- Configure GitHub branch protection to require `CI / lint · typecheck · test · build`.
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

Current known issue: `npm audit` reports Next.js vulnerabilities that require a major-version path to resolve cleanly. Decide whether to upgrade before first external exposure or record a risk acceptance for a private smoke deploy only.

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

## Subprocessor Activation

Do not mark Vercel active in the database before the Vercel project exists and is serving Grism Plus.

Expected migration shape after deployment is confirmed:

```sql
update public.subprocessors
   set is_active = true,
       updated_at = now()
 where name = 'Vercel';
```

Use a new migration file. Do not edit `00002_seed_subprocessors.sql`.

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
