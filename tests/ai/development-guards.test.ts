import { describe, expect, it } from 'vitest'

import {
  calculateDevelopmentBlend,
  classifyModalityForBlend,
  DEFAULT_DEVELOPMENT_BLEND_POLICY,
  DEFAULT_PROGRESSION_RULE,
  evaluateProgressionConvergence,
  validateDevelopmentBlend,
  validateGeneratedDevelopmentPlan,
  type ProgressionRule,
} from '@/lib/ai/development-guards'

describe('classifyModalityForBlend', () => {
  it('maps Phase 0 modalities into 70/20/10 blend categories', () => {
    expect(classifyModalityForBlend('ojt')).toBe('experience')
    expect(classifyModalityForBlend('coaching')).toBe('relationship')
    expect(classifyModalityForBlend('elearning')).toBe('formal')
    expect(classifyModalityForBlend('ilt')).toBe('formal')
    expect(classifyModalityForBlend('workshop')).toBe('formal')
    expect(classifyModalityForBlend('unknown')).toBeNull()
  })
})

describe('calculateDevelopmentBlend', () => {
  it('calculates an exact weighted blend summary from generated actions', () => {
    const result = calculateDevelopmentBlend([
      ...Array.from({ length: 7 }, () => ({ modality: 'ojt' })),
      ...Array.from({ length: 2 }, () => ({ modality: 'coaching' })),
      { modality: 'elearning' },
    ])

    expect(result).toMatchObject({
      percentages: { experience: 70, relationship: 20, formal: 10 },
      weights: { experience: 7, relationship: 2, formal: 1 },
      totalWeight: 10,
      unclassifiedActionCount: 0,
    })
  })

  it('uses explicit blend categories and effort weights when supplied', () => {
    const result = calculateDevelopmentBlend([
      { modality: 'elearning', blendCategory: 'experience', effortWeight: 3 },
      { modality: 'coaching', effortWeight: 1 },
      { modality: 'workshop', effortWeight: 1 },
    ])

    expect(result.percentages).toEqual({
      experience: 60,
      relationship: 20,
      formal: 20,
    })
  })

  it('tracks unclassified actions as guardrail failures', () => {
    const result = validateGeneratedDevelopmentPlan([
      { modality: 'ojt' },
      { modality: 'custom_lab' },
    ])

    expect(result.ok).toBe(false)
    expect(result.unclassifiedActionCount).toBe(1)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'unclassified_actions',
    )
  })
})

describe('validateDevelopmentBlend', () => {
  it('passes the canonical 70/20/10 default', () => {
    expect(validateDevelopmentBlend({ experience: 70, relationship: 20, formal: 10 })).toEqual({
      ok: true,
      issues: [],
    })
  })

  it('rejects formal-learning-heavy drafts without rationale', () => {
    const result = validateDevelopmentBlend({
      experience: 20,
      relationship: 20,
      formal: 60,
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'formal_over_guardrail',
        'experience_under_guardrail',
        'formal_heavy_plan',
      ]),
    )
  })

  it('downgrades guardrail deviations to warnings when an override rationale is explicit', () => {
    const result = validateDevelopmentBlend(
      { experience: 35, relationship: 25, formal: 40 },
      DEFAULT_DEVELOPMENT_BLEND_POLICY,
      {
        overrideRationale:
          'Regulatory certification requires a formal-heavy plan for this skill.',
      },
    )

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'formal_over_guardrail',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'experience_under_guardrail',
          severity: 'warning',
        }),
      ]),
    )
  })

  it('rejects blend summaries that do not total 100 percent', () => {
    const result = validateDevelopmentBlend({
      experience: 60,
      relationship: 20,
      formal: 10,
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'blend_total_invalid',
    )
  })
})

describe('evaluateProgressionConvergence', () => {
  it('prevents eLearning alone from satisfying convergence', () => {
    const result = evaluateProgressionConvergence([
      { signalSource: 'elearning_completion', score0To100: 100 },
    ])

    expect(result).toMatchObject({
      status: 'emerging',
      satisfiesConvergence: false,
      distinctSignalSources: 1,
      contributingSources: ['elearning_completion'],
    })
    expect(result.issues.map((issue) => issue.code)).toContain(
      'insufficient_distinct_sources',
    )
  })

  it('marks two strong signal sources ready for review', () => {
    const result = evaluateProgressionConvergence([
      { signalSource: 'ojt_manager_feedback', score0To100: 82 },
      { signalSource: 'elearning_completion', score0To100: 100 },
    ])

    expect(result).toMatchObject({
      status: 'ready_for_review',
      satisfiesConvergence: true,
      weightedScore0To100: 88,
      distinctSignalSources: 2,
      contributingSources: ['ojt_manager_feedback', 'elearning_completion'],
      issues: [],
    })
  })

  it('keeps low-quality multi-source signals in emerging state', () => {
    const result = evaluateProgressionConvergence([
      { signalSource: 'assessment', score0To100: 55 },
      { signalSource: 'coaching_feedback', score0To100: 60 },
    ])

    expect(result.status).toBe('emerging')
    expect(result.satisfiesConvergence).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'score_below_review_threshold',
    )
  })

  it('blocks custom rules where one source dominates the model', () => {
    const dominantAssessmentRule: ProgressionRule = {
      ...DEFAULT_PROGRESSION_RULE,
      weights: {
        assessment: 0.8,
        ojt_manager_feedback: 0.1,
        coaching_feedback: 0.05,
        elearning_completion: 0.05,
      },
    }

    const result = evaluateProgressionConvergence(
      [
        { signalSource: 'assessment', score0To100: 90 },
        { signalSource: 'ojt_manager_feedback', score0To100: 90 },
      ],
      dominantAssessmentRule,
    )

    expect(result.satisfiesConvergence).toBe(false)
    expect(result.dominantSourceContribution).toBe(0.8)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'dominant_source_exceeds_cap',
    )
  })
})
