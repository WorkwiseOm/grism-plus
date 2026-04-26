# Dev environment reference — Grism Plus

Last reviewed: 2026-04-25 by Tariq Al-Maskari.

This document describes how a developer stands up a local working environment for Grism Plus and how that environment differs from production in security posture.

## Canonical env var list

See [.env.local.example](../.env.local.example). That file is the source of truth for required env vars; this doc does not duplicate it.

`.env.local` is gitignored and must never be committed. Secret-handling rules (rotation cadence, who can access service-role keys, what is treated as a secret) live in [`security.md`](security.md) § "Encryption" and § "AI and third-party data handling".

AI-node local development uses `ANTHROPIC_API_KEY` plus optional `ANTHROPIC_MODEL`. Tests mock the Anthropic SDK and must not require either variable unless an explicit live-call test is added later.

## Local → cloud topology

- **Default dev topology:** `npm run dev` runs Next.js locally and points at the shared cloud Supabase project (`grism-plus-dev`, Sydney, Free tier). This is the canonical dev target — no Docker required, identical schema/RLS/Auth posture across the team. Rationale: consistent dev environment regardless of whether a team member has Docker working on their OS.
- **Optional local-Supabase topology:** `supabase start` brings up a Docker-based local stack. Supported for offline iteration but not required; the cloud project remains the source of truth for migrations, types generation, and seed data. Switching topologies means re-pointing `NEXT_PUBLIC_SUPABASE_URL` / keys in `.env.local`.
- **Production topology:** not yet provisioned. Hosting region and Vercel project are activated in Phase 0 Step 9 — see [`PROGRESS.md`](PROGRESS.md) and [`subprocessors.md`](subprocessors.md) for the deployment-gate plan.
- Database connection is via the Session pooler (`aws-1-ap-southeast-2.pooler.supabase.com:5432`) using the password in `SUPABASE_DB_PASSWORD`. Direct connection is IPv6-only and unusable on most home/office networks.
- Migrations are applied with `npx supabase db push --db-url …`. Type generation uses `npm run types:generate` (requires a short-lived Supabase Personal Access Token).

## Security posture differences vs production

Development environments use:

- The same v2 schema and RLS policies as production (no relaxation).
- Supabase Free tier, which lacks `inactivity_timeout`, time-boxed sessions, and point-in-time recovery. Those controls are Pro-tier features listed in `docs/PROGRESS.md` backlog.
- No real customer data. Seed data is limited to the subprocessor register (added Step 3C) and Phase 1 demo tenants (added Step 5).
- Session auth via the same Supabase Auth policies as production (12-char password minimum, complexity requirements). Local dev does not relax these.

## Hard stops for developers

See [`CLAUDE.md`](../CLAUDE.md) for session-wide hard stops (notably: never run `supabase config push` against the cloud project).
