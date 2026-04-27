import type { Database } from "@/lib/types/database"

export const FRAMEWORK_CATEGORIES = [
  "technical",
  "behavioural",
  "knowledge",
] as const satisfies readonly Database["public"]["Enums"]["gap_category"][]

export type FrameworkCategory = (typeof FRAMEWORK_CATEGORIES)[number]

export type CompetencyEditInput = {
  name: string
  description: string
  category: string
  proficiencyLevelsText: string
}

export type CompetencyEditValue = {
  name: string
  description: string | null
  category: FrameworkCategory
  proficiencyLevels: string[]
}

export type CompetencyEditIssue = {
  field: keyof CompetencyEditInput
  code:
    | "name_required"
    | "name_too_long"
    | "invalid_category"
    | "description_too_long"
    | "too_many_levels"
    | "level_too_long"
}

export type CompetencyEditValidation =
  | { ok: true; value: CompetencyEditValue }
  | { ok: false; issues: CompetencyEditIssue[] }

export function parseProficiencyLevels(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function validateCompetencyEdit(
  input: CompetencyEditInput,
): CompetencyEditValidation {
  const name = input.name.trim()
  const description = input.description.trim()
  const levels = parseProficiencyLevels(input.proficiencyLevelsText)
  const issues: CompetencyEditIssue[] = []

  if (name.length < 3) issues.push({ field: "name", code: "name_required" })
  if (name.length > 120) issues.push({ field: "name", code: "name_too_long" })
  if (!isFrameworkCategory(input.category)) {
    issues.push({ field: "category", code: "invalid_category" })
  }
  if (description.length > 1000) {
    issues.push({ field: "description", code: "description_too_long" })
  }
  if (levels.length > 8) {
    issues.push({ field: "proficiencyLevelsText", code: "too_many_levels" })
  }
  if (levels.some((level) => level.length > 80)) {
    issues.push({ field: "proficiencyLevelsText", code: "level_too_long" })
  }

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    value: {
      name,
      description: description.length > 0 ? description : null,
      category: input.category as FrameworkCategory,
      proficiencyLevels: levels,
    },
  }
}

export function competencyEditErrorMessage(code: string): string {
  switch (code) {
    case "missing_competency":
      return "Select a competency before saving."
    case "name_required":
      return "Use a competency name with at least 3 characters."
    case "name_too_long":
      return "Use a shorter competency name."
    case "invalid_category":
      return "Choose a valid competency category."
    case "description_too_long":
      return "Keep the definition under 1,000 characters."
    case "too_many_levels":
      return "Use no more than 8 proficiency levels."
    case "level_too_long":
      return "Keep every proficiency level under 80 characters."
    case "competency_update_failed":
      return "The competency could not be saved."
    default:
      return "The framework editor could not save this change."
  }
}

function isFrameworkCategory(value: string): value is FrameworkCategory {
  return FRAMEWORK_CATEGORIES.includes(value as FrameworkCategory)
}
