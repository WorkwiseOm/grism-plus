import {
  assertNoForbiddenPromptKeys,
  type JsonValue,
} from '@/lib/ai/anthropic'
import type { CompetencyGapPromptInput } from '@/lib/ai/idp-draft'
import type { PseudonymisedEmployee } from '@/lib/security/pseudonymise'
import type { Database } from '@/lib/types/database'

type OjtCatalogueRow = Database['public']['Tables']['ojt_catalogue']['Row']
type IdpStatus = Database['public']['Enums']['idp_status']

export type OjtCandidateSummary = {
  title: string
  description: string
  competencyTags: string[]
  roleLevels: string[]
  deliverableType: string | null
  effortHours: number
}

export type OjtRecommendationPromptInput = {
  employee: PseudonymisedEmployee
  competencyGap: CompetencyGapPromptInput
  candidates: OjtCandidateSummary[]
  maxRecommendations?: number
}

export type CoachingBriefPromptInput = {
  employee: PseudonymisedEmployee
  idp: {
    status: IdpStatus
    milestoneProgressPct: number
    activeMilestones: number
    blockedMilestones: number
    overdueActions: number
    recentActivity: string[]
  }
  focusQuestions: string[]
}

export type CoachingBriefSafetyIssue = {
  code: 'email_detected' | 'uuid_detected' | 'forbidden_identifier_label'
  message: string
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const FORBIDDEN_IDENTIFIER_LABEL_PATTERN =
  /\b(employee_id|tenant_id|user_profile_id|manager_id|employee_number)\b/i

export function summarizeOjtCandidate(
  row: OjtCatalogueRow,
): OjtCandidateSummary {
  return {
    title: row.title,
    description: row.description,
    competencyTags: row.competency_tags,
    roleLevels: row.role_levels,
    deliverableType: row.deliverable_type,
    effortHours: row.effort_hours,
  }
}

export function buildOjtRecommendationPromptPayload(
  input: OjtRecommendationPromptInput,
): JsonValue {
  const payload = {
    employee: safeEmployeeContext(input.employee),
    competency_gap: {
      competency_code: input.competencyGap.competencyCode,
      competency_name: input.competencyGap.competencyName,
      category: input.competencyGap.category,
      current_proficiency: input.competencyGap.currentProficiency,
      target_proficiency: input.competencyGap.targetProficiency,
      gap_score_0_100: input.competencyGap.gapScore0To100,
    },
    candidates: input.candidates.map((candidate, index) => ({
      candidate_number: index + 1,
      title: candidate.title,
      description: candidate.description,
      competency_tags: candidate.competencyTags,
      role_levels: candidate.roleLevels,
      deliverable_type: candidate.deliverableType,
      effort_hours: candidate.effortHours,
    })),
    constraints: {
      max_recommendations: input.maxRecommendations ?? 3,
      recommendation_layer: 'experience',
    },
  } satisfies JsonValue

  assertNoForbiddenPromptKeys(payload)
  return payload
}

export function buildCoachingBriefPromptPayload(
  input: CoachingBriefPromptInput,
): JsonValue {
  const payload = {
    employee: safeEmployeeContext(input.employee),
    idp_status: {
      status: input.idp.status,
      milestone_progress_pct: input.idp.milestoneProgressPct,
      active_milestones: input.idp.activeMilestones,
      blocked_milestones: input.idp.blockedMilestones,
      overdue_actions: input.idp.overdueActions,
      recent_activity: input.idp.recentActivity,
    },
    focus_questions: input.focusQuestions,
    output_rules: {
      no_direct_identifiers: true,
      use_employee_pseudonym_only: true,
      tone: 'manager_coaching_brief',
    },
  } satisfies JsonValue

  assertNoForbiddenPromptKeys(payload)
  return payload
}

export function validateCoachingBriefText(text: string): {
  ok: boolean
  issues: CoachingBriefSafetyIssue[]
} {
  const issues: CoachingBriefSafetyIssue[] = []

  if (EMAIL_PATTERN.test(text)) {
    issues.push({
      code: 'email_detected',
      message: 'Coaching brief output must not contain email addresses.',
    })
  }

  if (UUID_PATTERN.test(text)) {
    issues.push({
      code: 'uuid_detected',
      message: 'Coaching brief output must not contain raw UUIDs.',
    })
  }

  if (FORBIDDEN_IDENTIFIER_LABEL_PATTERN.test(text)) {
    issues.push({
      code: 'forbidden_identifier_label',
      message: 'Coaching brief output must not expose internal identifier labels.',
    })
  }

  return { ok: issues.length === 0, issues }
}

function safeEmployeeContext(employee: PseudonymisedEmployee): JsonValue {
  return {
    pseudonym: employee.pseudonym,
    role_title: employee.role_title,
    target_role_title: employee.target_role_title,
    department: employee.department,
    org_unit: employee.org_unit,
  }
}
