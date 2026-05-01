/**
 * Tests for the deployed demo passcode gate.
 *
 * The cookie is the trust boundary that holds back the public internet
 * once DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION is on, so the table-driven
 * coverage exercises every spoof attempt that matters: tampered sigs,
 * stale issued-at, future issued-at, wrong version, missing pieces,
 * and a valid roundtrip.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  isDeployedDemoGateEnabledFromEnv,
  passcodeMatches,
  sanitizeNextPath,
  signDemoGateCookie,
  verifyDemoGateCookie,
} from "@/lib/auth/demo-gate"

const DEFAULT_HMAC = "test-hmac-key-for-demo-gate-suite-do-not-reuse"

describe("demo-gate cookie sign/verify", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, HMAC_SESSION_KEY: DEFAULT_HMAC }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("signs and verifies a fresh cookie", async () => {
    const value = await signDemoGateCookie()
    expect(await verifyDemoGateCookie(value)).toBe(true)
  })

  it("rejects undefined", async () => {
    expect(await verifyDemoGateCookie(undefined)).toBe(false)
  })

  it("rejects empty string", async () => {
    expect(await verifyDemoGateCookie("")).toBe(false)
  })

  it("rejects malformed (no dot)", async () => {
    expect(await verifyDemoGateCookie("nodothere")).toBe(false)
  })

  it("rejects malformed (only dot)", async () => {
    expect(await verifyDemoGateCookie(".")).toBe(false)
  })

  it("rejects tampered signature", async () => {
    const value = await signDemoGateCookie()
    const lastDot = value.lastIndexOf(".")
    const tampered = value.slice(0, lastDot + 1) + "deadbeef"
    expect(await verifyDemoGateCookie(tampered)).toBe(false)
  })

  it("rejects tampered payload (re-uses original signature)", async () => {
    const value = await signDemoGateCookie()
    const lastDot = value.lastIndexOf(".")
    const sig = value.slice(lastDot)
    const tampered = `v1:${Date.now() + 1000}${sig}`
    expect(await verifyDemoGateCookie(tampered)).toBe(false)
  })

  it("rejects unknown version", async () => {
    // Sign with a real cookie then swap the version prefix to
    // simulate a forged-with-real-key-but-wrong-version replay.
    process.env.HMAC_SESSION_KEY = DEFAULT_HMAC
    const ts = Date.now()
    const value = await signDemoGateCookie(ts)
    const sig = value.slice(value.lastIndexOf(".") + 1)
    const forged = `v2:${ts}.${sig}`
    expect(await verifyDemoGateCookie(forged)).toBe(false)
  })

  it("rejects expired cookie (older than 7 days)", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    const value = await signDemoGateCookie(eightDaysAgo)
    expect(await verifyDemoGateCookie(value)).toBe(false)
  })

  it("accepts cookie just inside the 7-day window", async () => {
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
    const value = await signDemoGateCookie(sixDaysAgo)
    expect(await verifyDemoGateCookie(value)).toBe(true)
  })

  it("rejects future-issued cookie (clock skew defence)", async () => {
    const oneHourFromNow = Date.now() + 60 * 60 * 1000
    const value = await signDemoGateCookie(oneHourFromNow)
    expect(await verifyDemoGateCookie(value)).toBe(false)
  })

  it("rejects cookie when HMAC_SESSION_KEY is unset at verify time", async () => {
    const value = await signDemoGateCookie()
    delete (process.env as Record<string, string | undefined>)
      .HMAC_SESSION_KEY
    expect(await verifyDemoGateCookie(value)).toBe(false)
  })

  it("rejects cookie signed with a different key", async () => {
    const value = await signDemoGateCookie()
    process.env.HMAC_SESSION_KEY = "completely-different-key-for-this-test"
    expect(await verifyDemoGateCookie(value)).toBe(false)
  })
})

describe("passcodeMatches", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns true on exact match", () => {
    process.env.DEMO_GATE_PASSCODE = "correct horse battery staple"
    expect(passcodeMatches("correct horse battery staple")).toBe(true)
  })

  it("returns false on length mismatch", () => {
    process.env.DEMO_GATE_PASSCODE = "shortpass"
    expect(passcodeMatches("shortpasses")).toBe(false)
  })

  it("returns false on content mismatch (same length)", () => {
    process.env.DEMO_GATE_PASSCODE = "abcdefghij"
    expect(passcodeMatches("abcdefghik")).toBe(false)
  })

  it("returns false when env unset", () => {
    delete (process.env as Record<string, string | undefined>)
      .DEMO_GATE_PASSCODE
    expect(passcodeMatches("anything")).toBe(false)
  })

  it("returns false when env is empty string", () => {
    process.env.DEMO_GATE_PASSCODE = ""
    expect(passcodeMatches("")).toBe(false)
  })

  it("returns false on non-string input", () => {
    process.env.DEMO_GATE_PASSCODE = "abc"
    expect(passcodeMatches(undefined)).toBe(false)
    expect(passcodeMatches(null)).toBe(false)
    expect(passcodeMatches(123 as unknown)).toBe(false)
  })
})

describe("isDeployedDemoGateEnabledFromEnv", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete (process.env as Record<string, string | undefined>)
      .DEMO_AUTH_RELAXED
    delete (process.env as Record<string, string | undefined>)
      .DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("true only when both flags are exactly 'true'", () => {
    process.env.DEMO_AUTH_RELAXED = "true"
    process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION = "true"
    expect(isDeployedDemoGateEnabledFromEnv()).toBe(true)
  })

  it("false when only DEMO_AUTH_RELAXED is set", () => {
    process.env.DEMO_AUTH_RELAXED = "true"
    expect(isDeployedDemoGateEnabledFromEnv()).toBe(false)
  })

  it("false when only DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION is set", () => {
    process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION = "true"
    expect(isDeployedDemoGateEnabledFromEnv()).toBe(false)
  })

  it("false when DEMO_AUTH_RELAXED is 'TRUE' (case sensitive)", () => {
    process.env.DEMO_AUTH_RELAXED = "TRUE"
    process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION = "true"
    expect(isDeployedDemoGateEnabledFromEnv()).toBe(false)
  })

  it("false when DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION is '1'", () => {
    process.env.DEMO_AUTH_RELAXED = "true"
    process.env.DEMO_AUTH_DEPLOYED_BEHIND_PROTECTION = "1"
    expect(isDeployedDemoGateEnabledFromEnv()).toBe(false)
  })

  it("false when both flags are unset", () => {
    expect(isDeployedDemoGateEnabledFromEnv()).toBe(false)
  })
})

describe("sanitizeNextPath", () => {
  it.each([
    { input: "/", expected: "/" },
    { input: "/admin", expected: "/admin" },
    { input: "/employee/idp", expected: "/employee/idp" },
    { input: "/auth/sign-in?reason=idle_timeout", expected: "/auth/sign-in?reason=idle_timeout" },
    // Off-origin / open-redirect attempts
    { input: "//evil.com", expected: "/" },
    { input: "/\\evil.com", expected: "/" },
    { input: "https://evil.com", expected: "/" },
    { input: "javascript:alert(1)", expected: "/" },
    { input: "mailto:test@example.com", expected: "/" },
    // Loop protection — sending the user back to /demo-gate would trap them
    { input: "/demo-gate", expected: "/" },
    { input: "/demo-gate?next=/admin", expected: "/" },
    // Garbage / wrong type
    { input: "", expected: "/" },
    { input: undefined, expected: "/" },
    { input: null, expected: "/" },
    { input: 123, expected: "/" },
    { input: "no-leading-slash", expected: "/" },
    // Length cap — reject obviously absurd inputs
    { input: "/" + "x".repeat(600), expected: "/" },
  ])("$input → $expected", ({ input, expected }) => {
    expect(sanitizeNextPath(input as unknown)).toBe(expected)
  })
})
