-- Dedicated event type for the "authenticated user with an unrecognised
-- role" fallback in src/app/page.tsx. Slice 1 used 'rls_denial' with
-- metadata as a closest-fit workaround while the enum lacked a precise
-- value; this migration adds the proper one.
--
-- Semantic distinction:
--   rls_denial             — Postgres RLS rejected a query (database layer).
--   auth_unknown_role_fallback — application-layer role routing could not
--                                map a user_profiles.role value to a
--                                landing page (code path, not RLS).
--
-- No backfill needed: the only rows written with the workaround happened
-- in dev testing of slice 1 and carry no business meaning.
--
-- PG 17 note: ALTER TYPE ADD VALUE is transaction-safe on PG 12+. The new
-- value is not referenced in this migration (only added to the type), so
-- the "cannot use new enum value in same transaction" restriction does
-- not apply.

alter type security_event_type add value if not exists 'auth_unknown_role_fallback';
