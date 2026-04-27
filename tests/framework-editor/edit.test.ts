import { describe, expect, it } from "vitest"

import {
  competencyEditErrorMessage,
  parseProficiencyLevels,
  validateCompetencyEdit,
} from "@/lib/framework-editor/edit"

describe("parseProficiencyLevels", () => {
  it("normalises one level per non-empty line", () => {
    expect(parseProficiencyLevels(" Awareness \n\n Working knowledge\r\nExpert ")).toEqual([
      "Awareness",
      "Working knowledge",
      "Expert",
    ])
  })
})

describe("validateCompetencyEdit", () => {
  it("accepts a trimmed competency edit payload", () => {
    const result = validateCompetencyEdit({
      name: " Operational Planning ",
      description: " Builds operating rhythm. ",
      category: "technical",
      proficiencyLevelsText: "Awareness\nWorking\nExpert",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Operational Planning",
        description: "Builds operating rhythm.",
        category: "technical",
        proficiencyLevels: ["Awareness", "Working", "Expert"],
      },
    })
  })

  it("stores an empty definition as null", () => {
    const result = validateCompetencyEdit({
      name: "Coaching Practice",
      description: "   ",
      category: "behavioural",
      proficiencyLevelsText: "",
    })

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Coaching Practice",
        description: null,
        category: "behavioural",
        proficiencyLevels: [],
      },
    })
  })

  it("rejects invalid category and short names", () => {
    const result = validateCompetencyEdit({
      name: "A",
      description: "",
      category: "finance",
      proficiencyLevelsText: "",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual([
        "name_required",
        "invalid_category",
      ])
    }
  })

  it("rejects too many or too-long levels", () => {
    const result = validateCompetencyEdit({
      name: "Data Practice",
      description: "",
      category: "knowledge",
      proficiencyLevelsText: [
        "L1",
        "L2",
        "L3",
        "L4",
        "L5",
        "L6",
        "L7",
        "L8",
        "x".repeat(81),
      ].join("\n"),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual([
        "too_many_levels",
        "level_too_long",
      ])
    }
  })
})

describe("competencyEditErrorMessage", () => {
  it("returns a friendly fallback for unknown errors", () => {
    expect(competencyEditErrorMessage("unexpected")).toBe(
      "The framework editor could not save this change.",
    )
  })
})
