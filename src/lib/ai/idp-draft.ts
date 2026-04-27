import {
  assertNoForbiddenPromptKeys,
  type JsonValue,
} from '@/lib/ai/anthropic'
import {
  DEFAULT_DEVELOPMENT_BLEND_POLICY,
  validateDevelopmentBlend,
  validateGeneratedDevelopmentPlan,
  type BlendActionInput,
  type DevelopmentBlendCategory,
  type DevelopmentBlendPercentages,
  type DevelopmentBlendPolicy,
} from '@/lib/ai/development-guards'
import type { PseudonymisedEmployee } from '@/lib/security/pseudonymise'
import type { Database } from '@/lib/types/database'

type ModalityType = Database['public']['Enums']['modality_type']

export type CompetencyGapPromptInput = {
  competencyCode: string
  competencyName: string
  category: string
  currentProficiency: string
  targetProficiency: string
  gapScore0To100: number
}

export type IdpGenerationPromptInput = {
  employee: PseudonymisedEmployee
  targetRoleTitle: string | null
  competencyGaps: CompetencyGapPromptInput[]
  constraints?: {
    maxMilestones?: number
    preferredTargetDays?: number
  }
}

export type GeneratedIdpDraftAction = {
  title: string
  modality: ModalityType
  blendCategory?: DevelopmentBlendCategory
  effortWeight?: number
  rationale?: string | null
}

export type GeneratedIdpDraftMilestone = {
  title: string
  competencyCode?: string
  actions: GeneratedIdpDraftAction[]
}

export type GeneratedIdpDraft = {
  narrative?: string | null
  blendSummary: DevelopmentBlendPercentages
  milestones: GeneratedIdpDraftMilestone[]
}

export type IdpDraftValidationIssueCode =
  | 'invalid_shape'
  | 'missing_blend_summary'
  | 'invalid_blend_summary'
  | 'empty_milestones'
  | 'empty_actions'
  | 'invalid_action_title'
  | 'invalid_action_modality'
  | 'invalid_blend_category'
  | 'invalid_effort_weight'
  | 'blend_guard_failed'
  | 'blend_summary_mismatch'

export type IdpDraftValidationIssue = {
  code: IdpDraftValidationIssueCode
  path: string
  message: string
}

export type IdpDraftValidationResult = {
  ok: boolean
  issues: IdpDraftValidationIssue[]
  actionCount: number
  computedBlend: DevelopmentBlendPercentages
}

const VALID_MODALITIES: ModalityType[] = [
  'elearning',
  'ojt',
  'coaching',
  'ilt',
  'workshop',
]

const VALID_BLEND_CATEGORIES: DevelopmentBlendCategory[] = [
  'experience',
  'relationship',
  'formal',
]

const BLEND_MISMATCH_TOLERANCE_PCT = 5

export function buildIdpGenerationPromptPayload(
  input: IdpGenerationPromptInput,
): JsonValue {
  const payload = {
    employee: {
      pseudonym: input.employee.pseudonym,
      role_title: input.employee.role_title,
      target_role_title:
        input.targetRoleTitle ?? input.employee.target_role_title,
      department: input.employee.department,
      org_unit: input.employee.org_unit,
    },
    competency_gaps: input.competencyGaps.map((gap) => ({
      competency_code: gap.competencyCode,
      competency_name: gap.competencyName,
      category: gap.category,
      current_proficiency: gap.currentProficiency,
      target_proficiency: gap.targetProficiency,
      gap_score_0_100: gap.gapScore0To100,
    })),
    constraints: {
      max_milestones: input.constraints?.maxMilestones ?? 4,
      preferred_target_days: input.constraints?.preferredTargetDays ?? 90,
      default_blend: DEFAULT_DEVELOPMENT_BLEND_POLICY,
    },
  } satisfies JsonValue

  assertNoForbiddenPromptKeys(payload)
  return payload
}

export function validateGeneratedIdpDraft(
  draft: unknown,
  policy: DevelopmentBlendPolicy = DEFAULT_DEVELOPMENT_BLEND_POLICY,
): IdpDraftValidationResult {
  const issues: IdpDraftValidationIssue[] = []

  if (!isRecord(draft)) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid_shape',
          path: '$',
          message: 'Generated IDP draft must be a JSON object.',
        },
      ],
      actionCount: 0,
      computedBlend: { experience: 0, relationship: 0, formal: 0 },
    }
  }

  const blendSummary = parseBlendSummary(draft.blendSummary, issues)
  const actions = parseDraftActions(draft.milestones, issues)
  const guard = validateGeneratedDevelopmentPlan(actions, policy)

  for (const issue of guard.issues) {
    issues.push({
      code: 'blend_guard_failed',
      path: 'milestones',
      message: issue.message,
    })
  }

  if (blendSummary) {
    const blendGuard = validateDevelopmentBlend(blendSummary, policy)
    for (const issue of blendGuard.issues) {
      issues.push({
        code: 'blend_guard_failed',
        path: 'blendSummary',
        message: issue.message,
      })
    }

    for (const category of VALID_BLEND_CATEGORIES) {
      const delta = Math.abs(guard.percentages[category] - blendSummary[category])
      if (delta > BLEND_MISMATCH_TOLERANCE_PCT) {
        issues.push({
          code: 'blend_summary_mismatch',
          path: `blendSummary.${category}`,
          message:
            'Machine-readable blend summary does not match the generated actions.',
        })
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    actionCount: actions.length,
    computedBlend: guard.percentages,
  }
}

function parseBlendSummary(
  value: unknown,
  issues: IdpDraftValidationIssue[],
): DevelopmentBlendPercentages | null {
  if (!isRecord(value)) {
    issues.push({
      code: 'missing_blend_summary',
      path: 'blendSummary',
      message: 'Generated IDP draft must include a machine-readable blend summary.',
    })
    return null
  }

  const blend = {
    experience: Number(value.experience),
    relationship: Number(value.relationship),
    formal: Number(value.formal),
  }

  if (
    !Number.isFinite(blend.experience) ||
    !Number.isFinite(blend.relationship) ||
    !Number.isFinite(blend.formal)
  ) {
    issues.push({
      code: 'invalid_blend_summary',
      path: 'blendSummary',
      message: 'Blend summary values must be numeric percentages.',
    })
    return null
  }

  return blend
}

function parseDraftActions(
  milestones: unknown,
  issues: IdpDraftValidationIssue[],
): BlendActionInput[] {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    issues.push({
      code: 'empty_milestones',
      path: 'milestones',
      message: 'Generated IDP draft must include at least one milestone.',
    })
    return []
  }

  const actions: BlendActionInput[] = []

  milestones.forEach((milestone, milestoneIndex) => {
    if (!isRecord(milestone)) {
      issues.push({
        code: 'invalid_shape',
        path: `milestones.${milestoneIndex}`,
        message: 'Each milestone must be a JSON object.',
      })
      return
    }

    if (!Array.isArray(milestone.actions) || milestone.actions.length === 0) {
      issues.push({
        code: 'empty_actions',
        path: `milestones.${milestoneIndex}.actions`,
        message: 'Each generated milestone must include at least one action.',
      })
      return
    }

    milestone.actions.forEach((action, actionIndex) => {
      const path = `milestones.${milestoneIndex}.actions.${actionIndex}`
      if (!isRecord(action)) {
        issues.push({
          code: 'invalid_shape',
          path,
          message: 'Each generated action must be a JSON object.',
        })
        return
      }

      if (typeof action.title !== 'string' || action.title.trim().length === 0) {
        issues.push({
          code: 'invalid_action_title',
          path: `${path}.title`,
          message: 'Each generated action must include a title.',
        })
      }

      if (!isValidModality(action.modality)) {
        issues.push({
          code: 'invalid_action_modality',
          path: `${path}.modality`,
          message: 'Generated action modality is not supported.',
        })
        return
      }

      if (
        action.blendCategory !== undefined &&
        action.blendCategory !== null &&
        !isValidBlendCategory(action.blendCategory)
      ) {
        issues.push({
          code: 'invalid_blend_category',
          path: `${path}.blendCategory`,
          message: 'Generated action blend category is not supported.',
        })
        return
      }

      const effortWeight =
        action.effortWeight === undefined || action.effortWeight === null
          ? undefined
          : Number(action.effortWeight)

      if (
        effortWeight !== undefined &&
        (!Number.isFinite(effortWeight) || effortWeight <= 0)
      ) {
        issues.push({
          code: 'invalid_effort_weight',
          path: `${path}.effortWeight`,
          message: 'Generated action effort weight must be a positive number.',
        })
        return
      }

      actions.push({
        modality: action.modality,
        blendCategory: isValidBlendCategory(action.blendCategory)
          ? action.blendCategory
          : undefined,
        effortWeight,
      })
    })
  })

  return actions
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidModality(value: unknown): value is ModalityType {
  return (
    typeof value === 'string' && VALID_MODALITIES.includes(value as ModalityType)
  )
}

function isValidBlendCategory(
  value: unknown,
): value is DevelopmentBlendCategory {
  return (
    typeof value === 'string' &&
    VALID_BLEND_CATEGORIES.includes(value as DevelopmentBlendCategory)
  )
}
