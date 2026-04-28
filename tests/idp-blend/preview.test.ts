import { describe, expect, it } from 'vitest'

import type { IdpDetail } from '@/lib/data/idps'
import {
  blendGuardLabel,
  blendGuardTone,
  blendIssueSummary,
  buildIdpBlendPreview,
} from '@/lib/idp-blend/preview'

const baseDetail: IdpDetail = {
  idp: {
    id: 'idp-1',
    tenant_id: 'tenant-1',
    employee_id: 'emp-1',
    status: 'pending_approval',
    version: 1,
    narrative: null,
    narrative_source: null,
    ai_generation_metadata: null,
    generated_by_ai: true,
    target_completion_date: null,
    approved_at: null,
    approved_by: null,
    published_at: null,
    last_activity_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
  employee: null,
  milestones: [],
}

describe('buildIdpBlendPreview', () => {
  it('computes the 70/20/10 preview from IDP action modalities', () => {
    const preview = buildIdpBlendPreview(
      detailWithActions([
        ...Array.from({ length: 7 }, () => 'ojt' as const),
        ...Array.from({ length: 2 }, () => 'coaching' as const),
        'elearning',
      ]),
    )

    expect(preview.percentages).toEqual({
      experience: 70,
      relationship: 20,
      formal: 10,
    })
    expect(preview.items.map((item) => item.label)).toEqual([
      'Experience',
      'Relationships',
      'Formal',
    ])
    expect(preview.guard.ok).toBe(true)
    expect(blendGuardLabel(preview.guard)).toBe('On guardrail')
    expect(blendGuardTone(preview.guard)).toBe('green')
  })

  it('flags formal-heavy plans for review', () => {
    const preview = buildIdpBlendPreview(
      detailWithActions(['elearning', 'elearning', 'workshop', 'ilt', 'ojt']),
    )

    expect(preview.guard.ok).toBe(false)
    expect(blendGuardLabel(preview.guard)).toBe('Needs review')
    expect(blendGuardTone(preview.guard)).toBe('red')
    expect(blendIssueSummary(preview.guard)).toMatch(/Formal learning/)
  })

  it('flags empty plans before approval', () => {
    const preview = buildIdpBlendPreview(baseDetail)

    expect(preview.totalWeight).toBe(0)
    expect(preview.guard.ok).toBe(false)
    expect(preview.guard.issues.map((issue) => issue.code)).toContain(
      'empty_plan',
    )
  })
})

function detailWithActions(
  modalities: Array<'ojt' | 'coaching' | 'elearning' | 'ilt' | 'workshop'>,
): IdpDetail {
  return {
    ...baseDetail,
    milestones: [
      {
        milestone: {
          id: 'm1',
          sequence_order: 1,
          title: 'Milestone 1',
          description: null,
          gap_score_at_creation: 40,
          status: 'not_started',
          target_date: '2026-05-01',
          completed_at: null,
        },
        competency: null,
        actions: modalities.map((modality, index) => ({
          id: `a${index}`,
          milestone_id: 'm1',
          modality,
          title: `${modality} action`,
          external_ref_id: null,
          external_ref_table: null,
          is_recommended_by_ai: false,
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
        })),
      },
    ],
  }
}
