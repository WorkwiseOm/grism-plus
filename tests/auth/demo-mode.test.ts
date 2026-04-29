/**
 * Tests for the local-demo-mode gate. The gate is the trust boundary for
 * both the persona switcher UI and the middleware MFA bypass; if it ever
 * accidentally returns true on a non-loopback host, both surfaces become
 * exploitable. Hence the heavy table-driven coverage of every (host x
 * NODE_ENV x flag) combination that matters.
 */
import { describe, expect, it } from "vitest"
import { isDemoAuthRelaxed } from "@/lib/auth/demo-mode"

describe("isDemoAuthRelaxed", () => {
  it.each([
    {
      name: "all three conditions met → true (localhost)",
      host: "localhost:3000",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "all three conditions met → true (127.0.0.1)",
      host: "127.0.0.1:3000",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "all three conditions met → true (::1)",
      host: "::1",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
    {
      name: "test NODE_ENV is allowed",
      host: "localhost",
      nodeEnv: "test",
      relaxedFlag: "true",
      expected: true,
    },
    // Negative cases — every single layer is sufficient on its own to deny.
    {
      name: "NODE_ENV=production blocks even with localhost + flag",
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
      name: "Vercel-style host blocks even with dev + flag",
      host: "grism-plus-app.vercel.app",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: false,
    },
    {
      name: "team-scoped Vercel hash host blocks",
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
    {
      name: "host with mixed case is normalised before compare",
      host: "LocalHost:3000",
      nodeEnv: "development",
      relaxedFlag: "true",
      expected: true,
    },
  ])("$name", ({ host, nodeEnv, relaxedFlag, expected }) => {
    expect(isDemoAuthRelaxed({ host, nodeEnv, relaxedFlag })).toBe(expected)
  })
})
