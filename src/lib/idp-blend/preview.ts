import type { IdpDetail } from '@/lib/data/idps'
import {
  calculateDevelopmentBlend,
  DEFAULT_DEVELOPMENT_BLEND_POLICY,
  validateGeneratedDevelopmentPlan,
  type DevelopmentBlendCategory,
  type DevelopmentBlendGuardResult,
  type DevelopmentBlendPercentages,
} from '@/lib/ai/development-guards'

export const BLEND_PREVIEW_ORDER: DevelopmentBlendCategory[] = [
  'experience',
  'relationship',
  'formal',
]

export type IdpBlendPreviewItem = {
  category: DevelopmentBlendCategory
  label: string
  targetPct: number
  actualPct: number
  weight: number
}

export type IdpBlendPreview = {
  items: IdpBlendPreviewItem[]
  percentages: DevelopmentBlendPercentages
  totalWeight: number
  unclassifiedActionCount: number
  guard: DevelopmentBlendGuardResult
}

export function buildIdpBlendPreview(detail: IdpDetail): IdpBlendPreview {
  const actions = detail.milestones.flatMap((milestone) =>
    milestone.actions.map((action) => ({ modality: action.modality })),
  )
  const calculation = calculateDevelopmentBlend(actions)
  const guard = validateGeneratedDevelopmentPlan(actions)

  return {
    items: BLEND_PREVIEW_ORDER.map((category) => ({
      category,
      label: blendCategoryLabel(category),
      targetPct: DEFAULT_DEVELOPMENT_BLEND_POLICY[category],
      actualPct: calculation.percentages[category],
      weight: calculation.weights[category],
    })),
    percentages: calculation.percentages,
    totalWeight: calculation.totalWeight,
    unclassifiedActionCount: calculation.unclassifiedActionCount,
    guard: {
      ok: guard.ok,
      issues: guard.issues,
    },
  }
}

export function blendCategoryLabel(category: DevelopmentBlendCategory): string {
  switch (category) {
    case 'experience':
      return 'Experience'
    case 'relationship':
      return 'Relationships'
    case 'formal':
      return 'Formal'
  }
}

export function blendCategoryDescription(
  category: DevelopmentBlendCategory,
): string {
  switch (category) {
    case 'experience':
      return 'OJT, stretch work, projects'
    case 'relationship':
      return 'Coaching, mentoring, peer learning'
    case 'formal':
      return 'Courses, workshops, certifications'
  }
}

export function blendGuardLabel(guard: DevelopmentBlendGuardResult): string {
  if (guard.ok && guard.issues.length === 0) return 'On guardrail'
  if (guard.ok) return 'Rationale required'
  return 'Needs review'
}

export function blendGuardTone(
  guard: DevelopmentBlendGuardResult,
): 'green' | 'amber' | 'red' {
  if (guard.ok && guard.issues.length === 0) return 'green'
  if (guard.ok) return 'amber'
  return 'red'
}

export function blendIssueSummary(
  guard: DevelopmentBlendGuardResult,
): string | null {
  const firstIssue = guard.issues[0]
  if (!firstIssue) return null
  return firstIssue.message
}
