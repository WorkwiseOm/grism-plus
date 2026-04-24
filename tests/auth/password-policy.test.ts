import { describe, expect, it } from "vitest"
import { validatePassword } from "@/lib/auth/password-policy"

describe("validatePassword", () => {
  describe("valid passwords", () => {
    it("accepts a strong password with all character classes", () => {
      const result = validatePassword("StrongP@ssword123")
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it("accepts exactly 12 characters with all classes", () => {
      const result = validatePassword("Aa1!bcdefghi")
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it("accepts varied symbols across the non-alphanumeric range", () => {
      const examples = [
        "Passw0rd!@#$",
        "Myp@ssword-12",
        "Secure#Pass11",
        "Hello.World1Z",
      ]
      for (const pw of examples) {
        const result = validatePassword(pw)
        expect(result.valid, `expected "${pw}" to be valid`).toBe(true)
      }
    })
  })

  describe("individual failure modes", () => {
    it("rejects passwords shorter than 12 characters", () => {
      const result = validatePassword("Short1!")
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Password must be at least 12 characters long.",
      )
      expect(result.errors).toHaveLength(1)
    })

    it("rejects passwords with no lowercase letter", () => {
      const result = validatePassword("ALLUPPER123!@")
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Password must include at least one lowercase letter.",
      )
      expect(result.errors).toHaveLength(1)
    })

    it("rejects passwords with no uppercase letter", () => {
      const result = validatePassword("alllower123!@")
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Password must include at least one uppercase letter.",
      )
      expect(result.errors).toHaveLength(1)
    })

    it("rejects passwords with no digit", () => {
      const result = validatePassword("NoDigitsHere!@#")
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Password must include at least one digit.",
      )
      expect(result.errors).toHaveLength(1)
    })

    it("rejects passwords with no symbol", () => {
      const result = validatePassword("NoSymbols12345")
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(
        "Password must include at least one symbol.",
      )
      expect(result.errors).toHaveLength(1)
    })
  })

  describe("combined failures", () => {
    it("accumulates multiple errors when several rules fail at once", () => {
      const result = validatePassword("abc")
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "Password must be at least 12 characters long.",
          "Password must include at least one uppercase letter.",
          "Password must include at least one digit.",
          "Password must include at least one symbol.",
        ]),
      )
      expect(result.errors).toHaveLength(4)
    })

    it("empty string fails every rule", () => {
      const result = validatePassword("")
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(5)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "Password must be at least 12 characters long.",
          "Password must include at least one lowercase letter.",
          "Password must include at least one uppercase letter.",
          "Password must include at least one digit.",
          "Password must include at least one symbol.",
        ]),
      )
    })
  })
})
