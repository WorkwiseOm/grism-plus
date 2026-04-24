# CLAUDE.md

## Hard stops

- Never run `supabase config push` against the cloud project. The cloud dashboard is the source of truth for Auth settings. `config.toml` is local-dev only + versioned documentation of intent. `config push` would overwrite dashboard values with local-dev settings. If a setting needs to change in cloud, change it in the dashboard and reflect the intent in `config.toml` as comments.

## Review protocol

- **Show, don't reference.** When proposing content for user review (file diffs, new file contents, SQL, proposed edits), paste the content verbatim in the assistant response body. Do not direct the reviewer to tool output with phrases like "shown above" or "see the diff in the cat output" — tool results are easy to skip or scroll past and are not a durable review surface. Tool output proves execution. The message body presents content for review. Never conflate the two. If content is too long to paste, split the review into smaller reviewable chunks rather than offloading to tool logs.

## Current phase

**Phase 0 — Foundation** (~85% complete as of 2026-04-24).

Completed:

- Step 1 — Next.js 14 + Shadcn baseline
- Step 2 — Cloud Supabase provisioning (`grism-plus-dev`, Sydney, Free tier)
- Step 3A — v2 schema applied to cloud (23 tables, RLS, audit triggers)
- Step 3B — CI scaffolding (Dependabot, CodeQL, CODEOWNERS, PR template), SOC 2 security posture docs, PII pseudonymisation utility, auth hardening docs reconciled with Free-tier constraints
- Step 3C — SOC 2 subprocessor register seeded (5 vendors)
- Step 4 — Auth + middleware + MFA + idle timeout + login rate limit + password policy validator. Slices 1 (sign-in + role-routing baseline) and 2 (MFA, idle, rate limit) both closed. Manual end-to-end MFA verification confirmed 2026-04-24.

Next: Step 5 (demo seed data for Phase 1 preparation). See `docs/PROGRESS.md` for the detailed progress log and open backlog (including coach-role landing scope and multi-test-user seeding for parallel test restoration).

## Design decisions log

- 2026-04 — Cloud Supabase project provisioned in Sydney region. Accepted for MVP dev despite Muscat-to-Sydney latency (~150ms+). Region will be reconsidered when production deployment is scoped.
