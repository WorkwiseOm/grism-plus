import { beforeAll, describe, expect, it } from 'vitest'

import {
  buildCoachingBriefPromptPayload,
  buildOjtRecommendationPromptPayload,
  summarizeOjtCandidate,
  validateCoachingBriefText,
} from '@/lib/ai/recommendations'
import { pseudonymiseEmployee } from '@/lib/security/pseudonymise'
import type { Database } from '@/lib/types/database'

type Employee = Database['public']['Tables']['employees']['Row']
type OjtCatalogueRow = Database['public']['Tables']['ojt_catalogue']['Row']

beforeAll(() => {
  process.env.HMAC_SESSION_KEY = 'test-hmac-key-' + 'x'.repeat(48)
})

describe('summarizeOjtCandidate', () => {
  it('strips database identifiers and embedding fields from catalogue rows', () => {
    const summary = summarizeOjtCandidate(makeOjtRow())
    const json = JSON.stringify(summary)

    expect(summary).toEqual({
      title: 'Run shift handover review',
      description: 'Lead a supervised handover review with a manager.',
      competencyTags: ['OPS-1'],
      roleLevels: ['analyst', 'lead'],
      deliverableType: 'handover_note',
      effortHours: 6,
    })
    expect(json).not.toContain('tenant-1')
    expect(json).not.toContain('ojt-1')
    expect(json).not.toContain('embedding-vector')
  })
})

describe('buildOjtRecommendationPromptPayload', () => {
  it('builds a filtered candidate payload with no raw IDs', () => {
    const payload = buildOjtRecommendationPromptPayload({
      employee: pseudonymiseEmployee(makeEmployee(), 'session-ojt'),
      competencyGap: {
        competencyCode: 'OPS-1',
        competencyName: 'Operational planning',
        category: 'technical',
        currentProficiency: 'Foundation',
        targetProficiency: 'Advanced',
        gapScore0To100: 40,
      },
      candidates: [summarizeOjtCandidate(makeOjtRow())],
      maxRecommendations: 2,
    })
    const json = JSON.stringify(payload)

    expect(json).toContain('candidate_number')
    expect(json).toContain('Employee_')
    expect(json).not.toContain('saif@example.com')
    expect(json).not.toContain('tenant-1')
    expect(json).not.toContain('ojt-1')
    expect(json).not.toContain('embedding-vector')
  })
})

describe('buildCoachingBriefPromptPayload', () => {
  it('builds a pseudonymised manager coaching brief payload', () => {
    const payload = buildCoachingBriefPromptPayload({
      employee: pseudonymiseEmployee(makeEmployee(), 'session-brief'),
      idp: {
        status: 'active',
        milestoneProgressPct: 45,
        activeMilestones: 2,
        blockedMilestones: 1,
        overdueActions: 0,
        recentActivity: ['Submitted reflection on shift handover.'],
      },
      focusQuestions: ['What support would remove the blocker?'],
    })
    const json = JSON.stringify(payload)

    expect(json).toContain('use_employee_pseudonym_only')
    expect(json).toContain('Employee_')
    expect(json).not.toContain('Saif Al-Habsi')
    expect(json).not.toContain('saif@example.com')
    expect(json).not.toContain('00000000-0000-0000-0000-000000000001')
  })
})

describe('validateCoachingBriefText', () => {
  it('allows clean pseudonymised coaching text', () => {
    expect(
      validateCoachingBriefText(
        'Employee_1234ABCD is progressing well. Ask about blockers on milestone 2.',
      ),
    ).toEqual({ ok: true, issues: [] })
  })

  it('rejects direct identifiers in generated coaching text', () => {
    const result = validateCoachingBriefText(
      'Contact saif@example.com. employee_id: 00000000-0000-4000-8000-000000000001',
    )

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'email_detected',
      'uuid_detected',
      'forbidden_identifier_label',
    ])
  })
})

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: 'tenant-1',
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

function makeOjtRow(overrides: Partial<OjtCatalogueRow> = {}): OjtCatalogueRow {
  return {
    id: 'ojt-1',
    tenant_id: 'tenant-1',
    title: 'Run shift handover review',
    description: 'Lead a supervised handover review with a manager.',
    competency_tags: ['OPS-1'],
    role_levels: ['analyst', 'lead'],
    deliverable_type: 'handover_note',
    effort_hours: 6,
    embedding: 'embedding-vector',
    observation_checklist: [],
    is_active: true,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}
