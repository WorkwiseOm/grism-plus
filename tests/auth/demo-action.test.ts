/**
 * Tests for the signInAsDemoPersona server action's security gate.
 *
 * The action re-evaluates the demo gate at request time, not at form
 * render time. These tests prove the action throws (refuses to proceed)
 * for every gate-closed condition: NODE_ENV=production, non-loopback
 * host, DEMO_AUTH_RELAXED unset. The action throws BEFORE touching
 * supabase, so we don't have to mock the Supabase client for the
 * negative cases.
 *
 * Positive happy-path sign-in is intentionally not tested here — the
 * full sign-in flow needs a real auth.users row plus session-cookie
 * round-trips, which belongs in tests/middleware/* E2E coverage. The
 * security boundary tested here is "does the gate hold?", which is the
 * only thing this action contributes that isn't already covered by
 * tests/auth/demo-mode.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: headersMock,
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // Mirror next/navigation: redirect throws to abort.
    throw new Error(`__REDIRECT__:${url}`)
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

import { signInAsDemoPersona } from "@/app/auth/sign-in/actions"

const SAVED_NODE_ENV = process.env.NODE_ENV
const SAVED_FLAG = process.env.DEMO_AUTH_RELAXED

function setHost(host: string | null): void {
  headersMock.mockReturnValue({
    get: (name: string) => (name.toLowerCase() === "host" ? host : null),
  })
}

function fd(personaId?: string): FormData {
  const f = new FormData()
  if (personaId !== undefined) f.append("personaId", personaId)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  const envMut = process.env as Record<string, string | undefined>
  if (SAVED_NODE_ENV === undefined) delete envMut.NODE_ENV
  else envMut.NODE_ENV = SAVED_NODE_ENV
  if (SAVED_FLAG === undefined) delete process.env.DEMO_AUTH_RELAXED
  else process.env.DEMO_AUTH_RELAXED = SAVED_FLAG
})

describe("signInAsDemoPersona — gate rejections (security boundary)", () => {
  it("throws when host is not loopback (Vercel-style)", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    process.env.DEMO_AUTH_RELAXED = "true"
    setHost("grism-plus-app.vercel.app")
    await expect(signInAsDemoPersona(fd("aisha"))).rejects.toThrow(
      /Demo persona sign-in is not available/,
    )
  })

  it("throws when NODE_ENV is production (even if host is loopback)", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.DEMO_AUTH_RELAXED = "true"
    setHost("localhost:3000")
    await expect(signInAsDemoPersona(fd("aisha"))).rejects.toThrow(
      /Demo persona sign-in is not available/,
    )
  })

  it("throws when DEMO_AUTH_RELAXED flag is not exactly 'true'", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    delete process.env.DEMO_AUTH_RELAXED
    setHost("localhost:3000")
    await expect(signInAsDemoPersona(fd("aisha"))).rejects.toThrow(
      /Demo persona sign-in is not available/,
    )
  })

  it("throws when host header is missing", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    process.env.DEMO_AUTH_RELAXED = "true"
    setHost(null)
    await expect(signInAsDemoPersona(fd("aisha"))).rejects.toThrow(
      /Demo persona sign-in is not available/,
    )
  })
})

describe("signInAsDemoPersona — input validation past the gate", () => {
  beforeEach(() => {
    ;(process.env as Record<string, string>).NODE_ENV = "development"
    process.env.DEMO_AUTH_RELAXED = "true"
    setHost("localhost:3000")
  })

  it("throws when personaId is missing", async () => {
    await expect(signInAsDemoPersona(fd())).rejects.toThrow(/Missing personaId/)
  })

  it("throws when persona id is unknown", async () => {
    await expect(signInAsDemoPersona(fd("nobody"))).rejects.toThrow(
      /unknown or its password env var is unset/,
    )
  })

  it("throws when persona id is known but env password is unset", async () => {
    delete process.env.DEMO_PERSONA_AISHA_PASSWORD
    await expect(signInAsDemoPersona(fd("aisha"))).rejects.toThrow(
      /unknown or its password env var is unset/,
    )
  })
})
