/**
 * Tests for the demo-mode gate. The gate is the trust boundary for both
 * the persona switcher UI and the middleware MFA bypass; if it ever
 * accidentally returns true on an unprotected non-loopback host, both
 * surfaces become exploitable. Hence the heavy table-driven coverage.
 *
 * The gate has two mutually exclusive open paths:
 *   Path 1 — local: non-prod NODE_ENV + DEMO_AUTH_RELAXED + loopback host.
 *   Path 2 — deployed: DEMO_AUTH_RELAXED + DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION
 *            + non-loopback host. Path 2 is independent of NODE_ENV because
 *            Vercel always sets it to "production".
 */
import { describe, expect, it } from "vitest"
import { isDemoAuthRelaxed } from "@/lib/auth/demo-mode"

describe("isDemoAuthRelaxed — local-development path", () => {
  it.each([
    {
      name: "all three local conditions met → true (localhost)",
      host: "localhost:3000",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "all three local conditions met → true (127.0.0.1)",
      host: "127.0.0.1:3000",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "all three local conditions met → true (::1)",
      host: "::1",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "test NODE_ENV is allowed on local path",
      host: "localhost",
      nodeEnv: "test",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "host with mixed case is normalised before compare",
      host: "LocalHost:3000",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    // Negative cases — every single layer is sufficient on its own to deny
    // the local path. Without the deployed-protection flag, a non-loopback
    // host or NODE_ENV=production also closes the gate entirely.
    {
      name: "NODE_ENV=production blocks local path even with localhost + flag",
      host: "localhost:3000",
      nodeEnv: "production",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "DEMO_AUTH_RELAXED unset blocks even with localhost + dev",
      host: "localhost:3000",
      nodeEnv: "development",
      relaxedFlag: undefined,
      expected: false,
    },
    {
      name: "DEMO_AUTH_RELAXED='1' is NOT 'true' → blocked",
      host: "localhost:3000",
      nodeEnv: "development",
      relaxedFlag: "1",
      expected: false,
    },
    {
      name: "DEMO_AUTH_RELAXED='TRUE' (uppercase) is NOT 'true' → blocked",
      host: "localhost:3000",
      nodeEnv: "development",
      relaxedFlag: "TRUE",
      expected: false,
    },
    {
      name: "Vercel-style host blocks local path even with dev + flag",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "team-scoped Vercel hash host blocks local path",
      host: "grism-plus-app-abc123-tilqai-grism.vercel.app",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "production Vercel host with prod NODE_ENV and stray flag → blocked",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "production",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "missing host → blocked",
      host: null,
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "empty-string host → blocked",
      host: "",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "host containing 'localhost' as substring is not loopback",
      host: "localhost.evil.com",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: false,
    },
  ])("$name", ({ host, nodeEnv, relaxedFlag, expected }) => {
    expect(isDemoAuthRelaxed({ host, nodeEnv, relaxedFlag })).toBe(expected)
  })
})

describe("isDemoAuthRelaxed — deployed-protection path", () => {
  it.each([
    {
      name: "both flags + Vercel host → true",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "true",
      expected: true,
    },
    {
      name: "both flags + team-scoped Vercel hash host → true",
      host: "grism-plus-app-abc123-tilqai-grism.vercel.app",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "true",
      expected: true,
    },
    {
      name: "both flags + custom domain → true",
      host: "demo.tilqai.com",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "true",
      expected: true,
    },
    {
      name: "DEMO_AUTH_RELAXED missing → blocked even with deployed flag",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "production",
      relaxedFlag: undefined,
      deployedBehindProtectionFlag: "true",
      expected: false,
    },
    {
      name: "DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION missing → blocked",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: undefined,
      expected: false,
    },
    {
      name: "DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION='1' is NOT 'true' → blocked",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "1",
      expected: false,
    },
    {
      name: "DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION='TRUE' (uppercase) is NOT 'true' → blocked",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "TRUE",
      expected: false,
    },
    {
      name: "deployed flag set but host is loopback → blocked (paths are mutually exclusive)",
      host: "localhost:3000",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "true",
      expected: false,
    },
    {
      name: "deployed flag set but host is 127.0.0.1 → blocked",
      host: "127.0.0.1",
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "true",
      expected: false,
    },
    {
      name: "deployed flag set but host is null → blocked",
      host: null,
      nodeEnv: "production",
      relaxedFlag: "true",
      deployedBehindProtectionFlag: "true",
      expected: false,
    },
  ])(
    "$name",
    ({ host, nodeEnv, relaxedFlag, deployedBehindProtectionFlag, expected }) => {
      expect(
        isDemoAuthRelaxed({
          host,
          nodeEnv,
          relaxedFlag,
          deployedBehindProtectionFlag,
        }),
      ).toBe(expected)
    },
  )
})
