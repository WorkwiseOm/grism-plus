import { beforeAll, describe, expect, it } from 'vitest'

import {
  buildIdpGenerationPromptPayload,
  validateGeneratedIdpDraft,
} from '@/lib/ai/idp-draft'
import { pseudonymiseEmployee } from '@/lib/security/pseudonymise'
import type { Database } from '@/lib/types/database'

type Employee = Database['public']['Tables']['employees']['Row']

beforeAll(() => {
  process.env.HMAC_SESSION_KEY = 'test-hmac-key-' + 'x'.repeat(48)
})

describe('buildIdpGenerationPromptPayload', () => {
  it('builds an identifier-safe prompt payload from pseudonymised employee context', () => {
    const payload = buildIdpGenerationPromptPayload({
      employee: pseudonymiseEmployee(makeEmployee(), 'session-1'),
      targetRoleTitle: 'Operations Lead',
      competencyGaps: [
        {
          competencyCode: 'OPS-1',
          competencyName: 'Operational planning',
          category: 'technical',
          currentProficiency: 'Foundation',
          targetProficiency: 'Advanced',
          gapScore0To100: 35,
        },
      ],
      constraints: { maxMilestones: 3, preferredTargetDays: 120 },
    })

    expect(JSON.stringify(payload)).toContain('Employee_')
    expect(JSON.stringify(payload)).not.toContain('saif@example.com')
    expect(JSON.stringify(payload)).not.toContain(
      '00000000-0000-0000-0000-000000000001',
    )
  })
})

describe('validateGeneratedIdpDraft', () => {
  it('accepts a well-formed experience-led IDP draft', () => {
    const result = validateGeneratedIdpDraft({
      narrative: 'Draft development plan.',
      blendSummary: { experience: 70, relationship: 20, formal: 10 },
      milestones: [
        {
          title: 'Build operational depth',
          actions: [
            ...Array.from({ length: 7 }, (_, index) => ({
              title: `OJT action ${index + 1}`,
              modality: 'ojt',
            })),
            ...Array.from({ length: 2 }, (_, index) => ({
              title: `Coaching action ${index + 1}`,
              modality: 'coaching',
            })),
            { title: 'Complete formal module', modality: 'elearning' },
          ],
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      issues: [],
      actionCount: 10,
      computedBlend: { experience: 70, relationship: 20, formal: 10 },
    })
  })

  it('requires a machine-readable blend summary', () => {
    const result = validateGeneratedIdpDraft({
      milestones: [
        {
          title: 'Milestone',
          actions: [{ title: 'OJT action', modality: 'ojt' }],
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'missing_blend_summary',
    )
  })

  it('rejects formal-heavy generated plans', () => {
    const result = validateGeneratedIdpDraft({
      blendSummary: { experience: 20, relationship: 20, formal: 60 },
      milestones: [
        {
          title: 'Formal-heavy milestone',
          actions: [
            { title: 'Course 1', modality: 'elearning' },
            { title: 'Course 2', modality: 'ilt' },
            { title: 'Workshop', modality: 'workshop' },
            { title: 'Single OJT task', modality: 'ojt' },
          ],
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain(
      'blend_guard_failed',
    )
  })

  it('rejects a blend summary that does not match its generated actions', () => {
    const result = validateGeneratedIdpDraft({
      blendSummary: { experience: 70, relationship: 20, formal: 10 },
      milestones: [
        {
          title: 'Mismatched milestone',
          actions: [
            { title: 'Course 1', modality: 'elearning' },
            { title: 'Course 2', modality: 'elearning' },
            { title: 'Course 3', modality: 'elearning' },
          ],
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.computedBlend).toEqual({
      experience: 0,
      relationship: 0,
      formal: 100,
    })
    expect(result.issues.map((issue) => issue.code)).toContain(
      'blend_summary_mismatch',
    )
  })

  it('rejects unsupported action modalities and empty milestones', () => {
    const result = validateGeneratedIdpDraft({
      blendSummary: { experience: 70, relationship: 20, formal: 10 },
      milestones: [
        { title: 'No actions', actions: [] },
        {
          title: 'Bad action',
          actions: [{ title: '', modality: 'podcast' }],
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'empty_actions',
        'invalid_action_title',
        'invalid_action_modality',
      ]),
    )
  })
})

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-0000000000aa',
    full_name: 'Saif Al-Habsi',
    email: 'saif@example.com',
    employee_number: 'E-0001',
    role_title: 'Operations Analyst',
    target_role_title: 'Operations Lead',
    department: 'Operations',
    org_unit: 'Field Ops',
    manager_id: null,
    user_profile_id: null,
    hire_date: '2024-01-15',
    is_active: true,
    data_classification: 'confidential',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}
