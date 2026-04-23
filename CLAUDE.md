# CLAUDE.md

## Hard stops

- Never run `supabase config push` against the cloud project. The cloud dashboard is the source of truth for Auth settings. `config.toml` is local-dev only + versioned documentation of intent. `config push` would overwrite dashboard values with local-dev settings. If a setting needs to change in cloud, change it in the dashboard and reflect the intent in `config.toml` as comments.

## Design decisions log

- 2026-04 — Cloud Supabase project provisioned in Sydney region. Accepted for MVP dev despite Muscat-to-Sydney latency (~150ms+). Region will be reconsidered when production deployment is scoped.
