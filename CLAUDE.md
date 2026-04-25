# CLAUDE.md

## Hard stops

- Never run `supabase config push` against the cloud project. The cloud dashboard is the source of truth for Auth settings. `config.toml` is local-dev only + versioned documentation of intent. `config push` would overwrite dashboard values with local-dev settings. If a setting needs to change in cloud, change it in the dashboard and reflect the intent in `config.toml` as comments.

## Review protocol

- **Show, don't reference.** When proposing content for user review (file diffs, new file contents, SQL, proposed edits), paste the content verbatim in the assistant response body. Do not direct the reviewer to tool output with phrases like "shown above" or "see the diff in the cat output" — tool results are easy to skip or scroll past and are not a durable review surface. Tool output proves execution. The message body presents content for review. Never conflate the two. If content is too long to paste, split the review into smaller reviewable chunks rather than offloading to tool logs.

## UI design protocol

- **Phase 0 placeholder screens may be built directly in Shadcn without Stitch wireframes.** Auth screens, role-based landing pages, and similar infrastructure UIs are throwaway placeholders that will be replaced or significantly evolved in Phase 1. Designing them in Stitch would be wireframing for the bin.

- **From Phase 1 onwards, every real product screen MUST have a Stitch design before code is written.** "Real product screen" means: a screen the user will actually use to do work (IDP approval, IDP view, manager coachee view, framework editor), or a screen that will be shown to a client or used in a demo. Workflow:
  1. Write the brief in claude.ai (data shape, user goal, edge cases, error states)
  2. Generate Stitch wireframe via MCP
  3. Save .pen files to /design directory in this repo
  4. Review wireframe with Tariq (and Grism where their eLearning UX expertise applies)
  5. Claude Code reads .pen via MCP and generates production components

- **Stitch is NOT required for:**
  - Modal confirmations, toast notifications, standard form validation states
  - Simple CRUD lists where Shadcn templates suffice
  - Settings/profile pages with no novel interaction model
  - Any frontend work where the implementation is <200 lines and follows established patterns

- **Hard stop:** No real product screen ships to pilot clients without a Stitch design file in /design at the corresponding commit.

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
