import type { Database } from '@/lib/types/database'

type ModalityType = Database['public']['Enums']['modality_type']

export type DevelopmentBlendCategory = 'experience' | 'relationship' | 'formal'

export type DevelopmentBlendPercentages = Record<DevelopmentBlendCategory, number>

export type DevelopmentBlendPolicy = DevelopmentBlendPercentages & {
  allowedVariancePct?: number
  rationale?: string | null
}

export type BlendActionInput = {
  modality?: ModalityType | string | null
  blendCategory?: DevelopmentBlendCategory | null
  effortWeight?: number | null
}

export type DevelopmentBlendCalculation = {
  percentages: DevelopmentBlendPercentages
  weights: DevelopmentBlendPercentages
  totalWeight: number
  unclassifiedActionCount: number
}

export type BlendGuardIssueCode =
  | 'empty_plan'
  | 'invalid_percentage'
  | 'blend_total_invalid'
  | 'unclassified_actions'
  | 'formal_over_guardrail'
  | 'experience_under_guardrail'
  | 'formal_heavy_plan'

export type BlendGuardIssue = {
  code: BlendGuardIssueCode
  severity: 'error' | 'warning'
  message: string
}

export type DevelopmentBlendGuardResult = {
  ok: boolean
  issues: BlendGuardIssue[]
}

export type ProgressionSignalSource =
  | 'assessment'
  | 'ojt_manager_feedback'
  | 'coaching_feedback'
  | 'elearning_completion'

export type ProgressionConvergenceStatus =
  | 'insufficient'
  | 'emerging'
  | 'ready_for_review'

export type ProgressionSignalInput = {
  signalSource: ProgressionSignalSource
  score0To100?: number | null
  confidence0To100?: number | null
}

export type ProgressionRule = {
  weights: Record<ProgressionSignalSource, number>
  minDistinctSources: number
  maxSingleSourceContribution: number
  readyForReviewScore: number
}

export type ProgressionGuardIssueCode =
  | 'no_signals'
  | 'invalid_rule'
  | 'invalid_signal_score'
  | 'insufficient_distinct_sources'
  | 'dominant_source_exceeds_cap'
  | 'score_below_review_threshold'

export type ProgressionGuardIssue = {
  code: ProgressionGuardIssueCode
  message: string
}

export type ProgressionConvergenceResult = {
  status: ProgressionConvergenceStatus
  satisfiesConvergence: boolean
  weightedScore0To100: number
  distinctSignalSources: number
  contributingSources: ProgressionSignalSource[]
  dominantSourceContribution: number
  issues: ProgressionGuardIssue[]
}

const BLEND_CATEGORIES: DevelopmentBlendCategory[] = [
  'experience',
  'relationship',
  'formal',
]

const SIGNAL_SOURCES: ProgressionSignalSource[] = [
  'assessment',
  'ojt_manager_feedback',
  'coaching_feedback',
  'elearning_completion',
]

const DEFAULT_ALLOWED_VARIANCE_PCT = 10
const MIN_RATIONALE_LENGTH = 12

export const DEFAULT_DEVELOPMENT_BLEND_POLICY: DevelopmentBlendPolicy = {
  experience: 70,
  relationship: 20,
  formal: 10,
  allowedVariancePct: DEFAULT_ALLOWED_VARIANCE_PCT,
  rationale: 'Tenant default 70/20/10 development blend.',
}

export const DEFAULT_PROGRESSION_RULE: ProgressionRule = {
  weights: {
    assessment: 0.35,
    ojt_manager_feedback: 0.3,
    coaching_feedback: 0.2,
    elearning_completion: 0.15,
  },
  minDistinctSources: 2,
  maxSingleSourceContribution: 0.5,
  readyForReviewScore: 70,
}

export function classifyModalityForBlend(
  modality: ModalityType | string | null | undefined,
): DevelopmentBlendCategory | null {
  switch (modality) {
    case 'ojt':
      return 'experience'
    case 'coaching':
      return 'relationship'
    case 'elearning':
    case 'ilt':
    case 'workshop':
      return 'formal'
    default:
      return null
  }
}

export function calculateDevelopmentBlend(
  actions: ReadonlyArray<BlendActionInput>,
): DevelopmentBlendCalculation {
  const weights = zeroBlend()
  let totalWeight = 0
  let unclassifiedActionCount = 0

  for (const action of actions) {
    const category =
      action.blendCategory ?? classifyModalityForBlend(action.modality)

    if (!category) {
      unclassifiedActionCount += 1
      continue
    }

    const weight = sanitizeEffortWeight(action.effortWeight)
    weights[category] += weight
    totalWeight += weight
  }

  return {
    percentages: roundBlendToHundred(weights, totalWeight),
    weights,
    totalWeight,
    unclassifiedActionCount,
  }
}

export function validateDevelopmentBlend(
  blend: DevelopmentBlendPercentages,
  policy: DevelopmentBlendPolicy = DEFAULT_DEVELOPMENT_BLEND_POLICY,
  options: { overrideRationale?: string | null } = {},
): DevelopmentBlendGuardResult {
  const issues: BlendGuardIssue[] = []
  const allowedVariancePct =
    policy.allowedVariancePct ?? DEFAULT_ALLOWED_VARIANCE_PCT
  const overrideRationale = options.overrideRationale
  const hasOverrideRationale =
    typeof overrideRationale === 'string' &&
    overrideRationale.trim().length >= MIN_RATIONALE_LENGTH

  for (const category of BLEND_CATEGORIES) {
    const value = blend[category]
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      issues.push({
        code: 'invalid_percentage',
        severity: 'error',
        message: `${category} percentage must be between 0 and 100.`,
      })
    }
  }

  const total = sumBlend(blend)
  if (Math.abs(total - 100) > 0.5) {
    issues.push({
      code: 'blend_total_invalid',
      severity: 'error',
      message: `Development blend must total 100%; received ${total}%.`,
    })
  }

  if (blend.formal > policy.formal + allowedVariancePct) {
    issues.push({
      code: 'formal_over_guardrail',
      severity: hasOverrideRationale ? 'warning' : 'error',
      message:
        'Formal learning exceeds the configured guardrail for this plan.',
    })
  }

  if (blend.experience < policy.experience - allowedVariancePct) {
    issues.push({
      code: 'experience_under_guardrail',
      severity: hasOverrideRationale ? 'warning' : 'error',
      message:
        'Experience-led development is below the configured guardrail.',
    })
  }

  if (blend.formal > blend.experience) {
    issues.push({
      code: 'formal_heavy_plan',
      severity: hasOverrideRationale ? 'warning' : 'error',
      message:
        'Formal learning cannot dominate the generated plan without an explicit rationale.',
    })
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  }
}

export function validateGeneratedDevelopmentPlan(
  actions: ReadonlyArray<BlendActionInput>,
  policy: DevelopmentBlendPolicy = DEFAULT_DEVELOPMENT_BLEND_POLICY,
  options: { overrideRationale?: string | null } = {},
): DevelopmentBlendCalculation & DevelopmentBlendGuardResult {
  const calculation = calculateDevelopmentBlend(actions)
  const guard = validateDevelopmentBlend(
    calculation.percentages,
    policy,
    options,
  )
  const issues = [...guard.issues]

  if (actions.length === 0) {
    issues.push({
      code: 'empty_plan',
      severity: 'error',
      message: 'Generated IDP draft must contain at least one action.',
    })
  }

  if (calculation.unclassifiedActionCount > 0) {
    issues.push({
      code: 'unclassified_actions',
      severity: 'error',
      message:
        'Every generated IDP action must map to experience, relationship, or formal learning.',
    })
  }

  return {
    ...calculation,
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  }
}

export function evaluateProgressionConvergence(
  signals: ReadonlyArray<ProgressionSignalInput>,
  rule: ProgressionRule = DEFAULT_PROGRESSION_RULE,
): ProgressionConvergenceResult {
  const issues: ProgressionGuardIssue[] = []

  if (!isValidProgressionRule(rule)) {
    issues.push({
      code: 'invalid_rule',
      message:
        'Progression rule must have positive weights, at least two sources, and a valid single-source cap.',
    })
  }

  if (signals.length === 0) {
    issues.push({
      code: 'no_signals',
      message: 'At least one progression signal is required.',
    })
  }

  const bestScoreBySource = new Map<ProgressionSignalSource, number>()

  for (const signal of signals) {
    const score = scoreForSignal(signal)
    if (score === null) {
      issues.push({
        code: 'invalid_signal_score',
        message: `${signal.signalSource} score must be between 0 and 100.`,
      })
      continue
    }

    bestScoreBySource.set(
      signal.signalSource,
      Math.max(bestScoreBySource.get(signal.signalSource) ?? 0, score),
    )
  }

  const contributingSources = SIGNAL_SOURCES.filter((source) =>
    bestScoreBySource.has(source),
  )
  const distinctSignalSources = contributingSources.length

  if (distinctSignalSources < rule.minDistinctSources) {
    issues.push({
      code: 'insufficient_distinct_sources',
      message: `Progression requires at least ${rule.minDistinctSources} distinct signal sources.`,
    })
  }

  const totalRuleWeight = SIGNAL_SOURCES.reduce(
    (sum, source) => sum + Math.max(0, rule.weights[source] ?? 0),
    0,
  )
  const dominantSourceContribution =
    totalRuleWeight === 0
      ? 0
      : Math.max(
          ...contributingSources.map(
            (source) => Math.max(0, rule.weights[source] ?? 0) / totalRuleWeight,
          ),
          0,
        )

  if (dominantSourceContribution > rule.maxSingleSourceContribution) {
    issues.push({
      code: 'dominant_source_exceeds_cap',
      message:
        'One progression signal source contributes more than the configured cap.',
    })
  }

  const weightedScore0To100 = calculateWeightedScore(
    bestScoreBySource,
    rule,
  )

  if (
    distinctSignalSources >= rule.minDistinctSources &&
    weightedScore0To100 < rule.readyForReviewScore
  ) {
    issues.push({
      code: 'score_below_review_threshold',
      message: 'Progression signals have not reached the review threshold.',
    })
  }

  const blockingIssueCodes: ProgressionGuardIssueCode[] = [
    'no_signals',
    'invalid_rule',
    'invalid_signal_score',
    'insufficient_distinct_sources',
    'dominant_source_exceeds_cap',
    'score_below_review_threshold',
  ]
  const satisfiesConvergence = !issues.some((issue) =>
    blockingIssueCodes.includes(issue.code),
  )

  return {
    status: satisfiesConvergence
      ? 'ready_for_review'
      : distinctSignalSources > 0
        ? 'emerging'
        : 'insufficient',
    satisfiesConvergence,
    weightedScore0To100,
    distinctSignalSources,
    contributingSources,
    dominantSourceContribution: roundToTwo(dominantSourceContribution),
    issues,
  }
}

function zeroBlend(): DevelopmentBlendPercentages {
  return { experience: 0, relationship: 0, formal: 0 }
}

function sanitizeEffortWeight(value: number | null | undefined): number {
  if (value === null || value === undefined) return 1
  if (!Number.isFinite(value) || value <= 0) return 1
  return value
}

function roundBlendToHundred(
  weights: DevelopmentBlendPercentages,
  totalWeight: number,
): DevelopmentBlendPercentages {
  if (totalWeight <= 0) return zeroBlend()

  const raw = BLEND_CATEGORIES.map((category) => ({
    category,
    value: (weights[category] / totalWeight) * 100,
  }))
  const rounded = Object.fromEntries(
    raw.map(({ category, value }) => [category, Math.floor(value)]),
  ) as DevelopmentBlendPercentages
  let remainder = 100 - sumBlend(rounded)

  for (const item of [...raw].sort((a, b) => fractional(b.value) - fractional(a.value))) {
    if (remainder <= 0) break
    rounded[item.category] += 1
    remainder -= 1
  }

  return rounded
}

function fractional(value: number): number {
  return value - Math.floor(value)
}

function sumBlend(blend: DevelopmentBlendPercentages): number {
  return BLEND_CATEGORIES.reduce((sum, category) => sum + blend[category], 0)
}

function scoreForSignal(signal: ProgressionSignalInput): number | null {
  const score = signal.score0To100 ?? signal.confidence0To100 ?? 100
  if (!Number.isFinite(score) || score < 0 || score > 100) return null
  return score
}

function isValidProgressionRule(rule: ProgressionRule): boolean {
  const totalWeight = SIGNAL_SOURCES.reduce(
    (sum, source) => sum + Math.max(0, rule.weights[source] ?? 0),
    0,
  )
  return (
    totalWeight > 0 &&
    rule.minDistinctSources >= 2 &&
    rule.maxSingleSourceContribution > 0 &&
    rule.maxSingleSourceContribution <= 1 &&
    rule.readyForReviewScore >= 0 &&
    rule.readyForReviewScore <= 100
  )
}

function calculateWeightedScore(
  bestScoreBySource: ReadonlyMap<ProgressionSignalSource, number>,
  rule: ProgressionRule,
): number {
  let weightedTotal = 0
  let activeWeight = 0

  for (const source of SIGNAL_SOURCES) {
    const score = bestScoreBySource.get(source)
    if (score === undefined) continue
    const weight = Math.max(0, rule.weights[source] ?? 0)
    weightedTotal += score * weight
    activeWeight += weight
  }

  if (activeWeight === 0) return 0
  return Math.round(weightedTotal / activeWeight)
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}
