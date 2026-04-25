/**
 * PII pseudonymisation for AI prompts (SOC 2 control).
 *
 * Functions in src/lib/ai/** MUST accept PseudonymisedEmployee, never Employee.
 * This is enforced at compile time: PseudonymisedEmployee has no `full_name`
 * or `email` fields, so code that tried to read them would not type-check.
 * The nominal brand additionally prevents construction of a PseudonymisedEmployee
 * outside of this module — callers must route through pseudonymiseEmployee().
 *
 * See docs/security.md → "AI and third-party data handling" for the policy.
 */
import crypto from 'node:crypto'
import type { Database } from '@/lib/types/database'

type Employee = Database['public']['Tables']['employees']['Row']

declare const pseudonymisedBrand: unique symbol

export type PseudonymisedEmployee =
  & Omit<Employee, 'full_name' | 'email'>
  & {
    pseudonym: `Employee_${string}`
    readonly [pseudonymisedBrand]: true
  }

export function pseudonymiseEmployee(
  employee: Employee,
  sessionId: string,
): PseudonymisedEmployee {
  const key = process.env.HMAC_SESSION_KEY
  if (!key) {
    throw new Error(
      "HMAC_SESSION_KEY is not set. Pseudonymisation cannot proceed. " +
      "See docs/security.md → 'AI and third-party data handling'."
    )
  }

  const hmac = crypto
    .createHmac('sha256', key)
    .update(`grism-plus:pseudonym:v1:${employee.id}:${sessionId}`)
    .digest('hex')

  const pseudonym = `Employee_${hmac.slice(0, 4).toUpperCase()}` as const
  // Explicit construction (no destructure) so lint cannot flag unused
  // full_name / email bindings. Keeps both guarantees:
  //   - Runtime: full_name and email are simply not copied, so they
  //     cannot leak through this function regardless of what the
  //     caller does with the returned object.
  //   - Compile-time: PseudonymisedEmployee (Omit<Employee, 'full_name'
  //     | 'email'> & …) has no full_name / email fields, so any code
  //     that tries to read them does not type-check.
  return {
    id: employee.id,
    tenant_id: employee.tenant_id,
    user_profile_id: employee.user_profile_id,
    employee_number: employee.employee_number,
    role_title: employee.role_title,
    target_role_title: employee.target_role_title,
    department: employee.department,
    org_unit: employee.org_unit,
    manager_id: employee.manager_id,
    hire_date: employee.hire_date,
    data_classification: employee.data_classification,
    is_active: employee.is_active,
    created_at: employee.created_at,
    updated_at: employee.updated_at,
    deleted_at: employee.deleted_at,
    pseudonym,
  } as PseudonymisedEmployee
}
