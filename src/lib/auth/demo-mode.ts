/**
 * Demo-mode gate. Both the persona switcher UI and the middleware MFA
 * bypass live behind this single helper so the security posture is
 * explicit in one file. The gate has TWO mutually exclusive open paths:
 *
 *   Path 1 — Local development.
 *     Requires all three:
 *       a. NODE_ENV != "production"
 *       b. DEMO_AUTH_RELAXED == "true"
 *       c. Host is a loopback address (localhost / 127.0.0.1 / ::1)
 *     The host check cannot be spoofed by a client header on a deployed
 *     server: the production server's actual hostname is *.vercel.app or
 *     a custom domain, never localhost.
 *
 *   Path 2 — Deployed behind operator-verified Deployment Protection.
 *     Requires all three:
 *       a. DEMO_AUTH_RELAXED == "true"
 *       b. DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION == "true"  (NEW)
 *       c. Host is NOT a loopback address (rules out test/local fixtures
 *          accidentally opening the deployed path).
 *     The second flag is a deliberate two-key acknowledgment: a single
 *     DEMO_AUTH_RELAXED leak cannot expose one-click admin sign-in in a
 *     deployed environment. Setting both flags is the operator's signed
 *     statement that they have verified Vercel Deployment Protection
 *     (or an equivalent network-layer auth gate) is enabled for ALL
 *     deployment URLs of this project, including the bare project alias.
 *     For Vercel projects this means
 *     `ssoProtection.deploymentType === "all"` — the default
 *     `"all_except_custom_domains"` is NOT enough because the bare alias
 *     is publicly reachable under that setting.
 *
 * All conditions are evaluated server-side. The pure helper accepts
 * context-as-arguments so it can be unit-tested without spinning up Next.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

export type DemoModeContext = {
  /** Raw Host header value, including any port. */
  host: string | null
  /** process.env.NODE_ENV. Pass-in instead of read so the helper stays pure. */
  nodeEnv: string | undefined
  /** process.env.DEMO_AUTH_RELAXED. Pass-in for purity. */
  relaxedFlag: string | undefined
  /**
   * process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION. Optional second
   * acknowledgment that opens the deployed path when the host is non-loopback.
   * Pass-in for purity.
   */
  deployedBehindProtectionFlag?: string | undefined
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
  // Primary toggle. Off by default in every environment.
  if (ctx.relaxedFlag !== "true") return false
  if (!ctx.host) return false

  const isLoopback = LOOPBACK_HOSTS.has(normalizeHostname(ctx.host))

  // Path 1 — local development.
  if (ctx.nodeEnv !== "production" && isLoopback) return true

  // Path 2 — deployed behind operator-verified Deployment Protection.
  // The non-loopback constraint keeps this path mutually exclusive with
  // path 1, so a misconfigured local fixture can never open the deployed
  // gate inside test runs.
  if (ctx.deployedBehindProtectionFlag === "true" && !isLoopback) return true

  return false
}

/**
 * Convenience wrapper that reads NODE_ENV, DEMO_AUTH_RELAXED, and
 * DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION from process.env. Use from server
 * components / server actions / middleware. Tests should prefer the pure
 * isDemoAuthRelaxed() with explicit context.
 */
export function isDemoAuthRelaxedFromEnv(host: string | null): boolean {
  return isDemoAuthRelaxed({
    host,
    nodeEnv: process.env.NODE_ENV,
    relaxedFlag: process.env.DEMO_AUTH_RELAXED,
    deployedBehindProtectionFlag:
      process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION,
  })
}
