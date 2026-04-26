import { beforeAll, describe, expect, it } from 'vitest'

import {
  pseudonymiseEmployee,
  type PseudonymisedEmployee,
} from '@/lib/security/pseudonymise'
import type { Database } from '@/lib/types/database'

type Employee = Database['public']['Tables']['employees']['Row']

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-0000000000aa',
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    employee_number: 'E-0001',
    role_title: 'Software Engineer',
    target_role_title: 'Senior Software Engineer',
    department: 'Engineering',
    org_unit: 'Platform',
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

beforeAll(() => {
  process.env.HMAC_SESSION_KEY = 'test-hmac-key-' + 'x'.repeat(48)
})

describe('pseudonymiseEmployee — runtime behaviour', () => {
  it('produces the same pseudonym for the same (employee.id, sessionId)', () => {
    const emp = makeEmployee()
    const a = pseudonymiseEmployee(emp, 'session-abc')
    const b = pseudonymiseEmployee(emp, 'session-abc')

    expect(a.pseudonym).toBe(b.pseudonym)
    expect(a.pseudonym).toMatch(/^Employee_[0-9A-F]{8}$/)
  })

  it('produces different pseudonyms when employee.id differs (same sessionId)', () => {
    const sessionId = 'session-abc'
    const a = pseudonymiseEmployee(
      makeEmployee({ id: '00000000-0000-0000-0000-000000000001' }),
      sessionId,
    )
    const b = pseudonymiseEmployee(
      makeEmployee({ id: '00000000-0000-0000-0000-000000000002' }),
      sessionId,
    )

    expect(a.pseudonym).not.toBe(b.pseudonym)
  })

  it('produces different pseudonyms when sessionId differs (same employee.id)', () => {
    const emp = makeEmployee()
    const a = pseudonymiseEmployee(emp, 'session-one')
    const b = pseudonymiseEmployee(emp, 'session-two')

    expect(a.pseudonym).not.toBe(b.pseudonym)
  })

  it('strips direct identifiers at runtime', () => {
    const emp = makeEmployee()
    const pe = pseudonymiseEmployee(emp, 'session-xyz')

    expect(pe).not.toHaveProperty('full_name')
    expect(pe).not.toHaveProperty('email')
    expect(pe).not.toHaveProperty('id')
    expect(pe).not.toHaveProperty('tenant_id')
    expect(pe).not.toHaveProperty('employee_number')
    expect(pe).not.toHaveProperty('user_profile_id')
    expect(pe).not.toHaveProperty('manager_id')
  })

  it('throws with a loud, specific message when HMAC_SESSION_KEY is missing', () => {
    const saved = process.env.HMAC_SESSION_KEY
    delete process.env.HMAC_SESSION_KEY
    try {
      expect(() =>
        pseudonymiseEmployee(makeEmployee(), 'session-abc'),
      ).toThrowError(
        /HMAC_SESSION_KEY is not set.*Pseudonymisation cannot proceed.*docs\/security\.md/,
      )
    } finally {
      process.env.HMAC_SESSION_KEY = saved
    }
  })
})

describe('PseudonymisedEmployee — compile-time assertions', () => {
  it('type has no direct identifier fields', () => {
    const pe = pseudonymiseEmployee(makeEmployee(), 'session-abc')

    // @ts-expect-error — full_name must not exist on PseudonymisedEmployee
    void pe.full_name
    // @ts-expect-error — email must not exist on PseudonymisedEmployee
    void pe.email
    // @ts-expect-error — id must not exist on PseudonymisedEmployee
    void pe.id
    // @ts-expect-error — tenant_id must not exist on PseudonymisedEmployee
    void pe.tenant_id
    // @ts-expect-error — employee_number must not exist on PseudonymisedEmployee
    void pe.employee_number

    expect(pe.pseudonym).toMatch(/^Employee_[0-9A-F]{8}$/)
  })

  it('cannot be fabricated by a caller via a plain object literal (brand enforced)', () => {
    // @ts-expect-error — brand is private; plain object literals cannot satisfy PseudonymisedEmployee
    const fake: PseudonymisedEmployee = {
      pseudonym: 'Employee_FAKE0000',
      role_title: 'Software Engineer',
      target_role_title: 'Senior Software Engineer',
      department: 'Engineering',
      org_unit: 'Platform',
    }

    // runtime assertion so the test is not dead code
    expect(fake.pseudonym).toBe('Employee_FAKE0000')
  })
})
