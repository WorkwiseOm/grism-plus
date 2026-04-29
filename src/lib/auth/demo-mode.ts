/**
 * Local-only demo mode gate.
 *
 * The demo persona switcher and the middleware MFA bypass are both
 * gated behind this single helper so the security posture is explicit
 * in one file. Three conditions must all hold:
 *
 *   1. NODE_ENV is not "production".
 *      Vercel sets NODE_ENV=production on every build/deploy, so this
 *      eliminates every Vercel preview and production deployment.
 *   2. DEMO_AUTH_RELAXED env is exactly the string "true".
 *      Off by default. Must be opted into per-environment.
 *   3. The request's Host header resolves to a loopback address
 *      (localhost / 127.0.0.1 / ::1).
 *      Cannot be spoofed by a client header on a deployed server: the
 *      production server's actual hostname is *.vercel.app or a custom
 *      domain, never localhost. This is the strongest layer of the
 *      three — even if NODE_ENV/env flag misset, real production traffic
 *      doesn't carry localhost in its Host header.
 *
 * All three are evaluated server-side. The helper is pure so it can be
 * unit-tested with synthetic Host values without spinning up Next.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

export type DemoModeContext = {
  /** Raw Host header value, including any port. */
  host: string | null
  /** process.env.NODE_ENV. Pass-in instead of read so the helper stays pure. */
  nodeEnv: string | undefined
  /** process.env.DEMO_AUTH_RELAXED. Pass-in for purity. */
  relaxedFlag: string | undefined
}

/**
 * Strip the port from a Host header, leaving the bare hostname. Handles
 * three shapes:
 *   - "example.com" or "example.com:3000" (IPv4 / DNS hostname)
 *   - "[::1]" or "[::1]:3000"             (IPv6 in brackets, with/without port)
 *   - "::1"                                (bare IPv6 — Node's address form)
 */
function normalizeHostname(host: string): string {
  const trimmed = host.trim().toLowerCase()
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]")
    return end === -1 ? trimmed : trimmed.slice(1, end)
  }
  // IPv6 without brackets contains 2+ colons and has no port form here.
  if ((trimmed.match(/:/g) ?? []).length >= 2) return trimmed
  return trimmed.split(":")[0] ?? ""
}

export function isDemoAuthRelaxed(ctx: DemoModeContext): boolean {
  if (ctx.nodeEnv === "production") return false
  if (ctx.relaxedFlag !== "true") return false
  if (!ctx.host) return false
  return LOOPBACK_HOSTS.has(normalizeHostname(ctx.host))
}

/**
 * Convenience wrapper that reads NODE_ENV and DEMO_AUTH_RELAXED from
 * process.env. Use from server components / server actions / middleware.
 * Tests should prefer the pure isDemoAuthRelaxed() with explicit context.
 */
export function isDemoAuthRelaxedFromEnv(host: string | null): boolean {
  return isDemoAuthRelaxed({
    host,
    nodeEnv: process.env.NODE_ENV,
    relaxedFlag: process.env.DEMO_AUTH_RELAXED,
  })
}
