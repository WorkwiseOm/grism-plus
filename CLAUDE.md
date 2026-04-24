# CLAUDE.md

## Hard stops

- Never run `supabase config push` against the cloud project. The cloud dashboard is the source of truth for Auth settings. `config.toml` is local-dev only + versioned documentation of intent. `config push` would overwrite dashboard values with local-dev settings. If a setting needs to change in cloud, change it in the dashboard and reflect the intent in `config.toml` as comments.

## Review protocol

- **Show, don't reference.** When proposing content for user review (file diffs, new file contents, SQL, proposed edits), paste the content verbatim in the assistant response body. Do not direct the reviewer to tool output with phrases like "shown above" or "see the diff in the cat output" — tool results are easy to skip or scroll past and are not a durable review surface. Tool output proves execution. The message body presents content for review. Never conflate the two. If content is too long to paste, split the review into smaller reviewable chunks rather than offloading to tool logs.

## Design decisions log

- 2026-04 — Cloud Supabase project provisioned in Sydney region. Accepted for MVP dev despite Muscat-to-Sydney latency (~150ms+). Region will be reconsidered when production deployment is scoped.
