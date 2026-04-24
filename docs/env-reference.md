# Dev environment reference — Grism Plus

Last reviewed: 2026-04-24 by Tariq Al-Maskari.

This document describes how a developer stands up a local working environment for Grism Plus and how that environment differs from production in security posture.

## Canonical env var list

See [.env.local.example](../.env.local.example). That file is the source of truth for required env vars; this doc does not duplicate it.

## Local → cloud topology

- The project targets a single cloud Supabase project (`grism-plus-dev`, Sydney region, Free tier). Local Supabase via `supabase start` is supported but optional. Grism Plus treats the cloud project as the canonical dev target; local Docker-based stacks are a developer preference, not a requirement. Rationale: consistent dev environment across team members who may or may not have Docker working on their OS.
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
