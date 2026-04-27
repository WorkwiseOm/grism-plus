/**
 * Shared result shape for the Phase 1 server-side data loaders.
 *
 * Every loader in src/lib/data/* uses the authenticated Supabase server
 * client (no service role) so RLS remains the boundary. Loaders never
 * throw on normal empty/authz states; they return a discriminated
 * { ok: false, reason } so callers can branch deterministically.
 *
 * For unexpected failures (network blow-up, supabase JSON parse error,
 * etc.) loaders return { ok: false, reason: "query_error", detail }
 * with the underlying message — callers can log it but don't have to
 * try/catch to render an error state.
 */

export type LoaderResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: LoaderFailureReason; detail?: string }

export type LoaderFailureReason =
  /** No Supabase auth session. Page should redirect to sign-in. */
  | "not_authenticated"
  /** Authenticated, but no user_profiles row for the user (or soft-deleted). */
  | "profile_not_found"
  /** Authenticated and profiled, but no employees row links to this user_profile. */
  | "employee_not_found"
  /** Requested entity does not exist or RLS hides it from the caller. */
  | "not_found"
  /** Unexpected supabase/postgres error. detail carries the underlying message. */
  | "query_error"

export const ok = <T>(data: T): LoaderResult<T> => ({ ok: true, data })

export const fail = (
  reason: LoaderFailureReason,
  detail?: string,
): { ok: false; reason: LoaderFailureReason; detail?: string } =>
  detail === undefined ? { ok: false, reason } : { ok: false, reason, detail }
