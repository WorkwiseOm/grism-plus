/**
 * Tests for the demo persona registry. Focuses on env-driven filtering:
 * personas without a password env var must not appear in the switcher,
 * and resolveDemoPersona must reject unknown ids and missing-password
 * descriptors.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DEMO_PERSONAS,
  availableDemoPersonas,
  publicPersonaList,
  resolveDemoPersona,
} from "@/lib/auth/demo-personas"

const ENV_KEYS = DEMO_PERSONAS.map((p) => p.envKey)

function clearPersonaEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k]
}

const SAVED: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) SAVED[k] = process.env[k]
  clearPersonaEnv()
})

afterEach(() => {
  for (const [k, v] of Object.entries(SAVED)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe("publicPersonaList", () => {
  it("returns all five personas without secrets", () => {
    const list = publicPersonaList()
    expect(list).toHaveLength(5)
    for (const p of list) {
      expect(p).toHaveProperty("id")
      expect(p).toHaveProperty("label")
      expect(p).not.toHaveProperty("email")
      expect(p).not.toHaveProperty("password")
      expect(p).not.toHaveProperty("envKey")
    }
  })
})

describe("availableDemoPersonas (env-filtered)", () => {
  it("returns empty when no persona passwords are set", () => {
    expect(availableDemoPersonas()).toEqual([])
  })

  it("returns only personas whose env password is set", () => {
    process.env.DEMO_PERSONA_AISHA_PASSWORD = "fake-test-pw"
    process.env.DEMO_PERSONA_KHALID_PASSWORD = "fake-test-pw"
    const ids = availableDemoPersonas().map((p) => p.id)
    expect(new Set(ids)).toEqual(new Set(["aisha", "khalid"]))
  })

  it("treats empty-string password as unset", () => {
    process.env.DEMO_PERSONA_YUSUF_PASSWORD = ""
    expect(availableDemoPersonas().map((p) => p.id)).not.toContain("yusuf")
  })
})

describe("resolveDemoPersona", () => {
  it("returns null for unknown persona id", () => {
    process.env.DEMO_PERSONA_AISHA_PASSWORD = "fake"
    expect(resolveDemoPersona("nobody")).toBeNull()
  })

  it("returns null when env password is unset", () => {
    expect(resolveDemoPersona("aisha")).toBeNull()
  })

  it("returns email + password from env when both are present", () => {
    process.env.DEMO_PERSONA_AISHA_PASSWORD = "fake-test-pw"
    const result = resolveDemoPersona("aisha")
    expect(result).toEqual({
      email: "aisha.albalushi@grism-demo.local",
      password: "fake-test-pw",
    })
  })
})
