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

export type PseudonymisedEmployee = {
  pseudonym: `Employee_${string}`
  role_title: string
  target_role_title: string | null
  department: string | null
  org_unit: string | null
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

  const pseudonym = `Employee_${hmac.slice(0, 8).toUpperCase()}` as const

  // Explicit allow-list construction keeps direct identifiers out of
  // AI prompt inputs. Do not add fields here unless they are safe to
  // send to Anthropic under docs/security.md.
  return {
    role_title: employee.role_title,
    target_role_title: employee.target_role_title,
    department: employee.department,
    org_unit: employee.org_unit,
    pseudonym,
  } as PseudonymisedEmployee
}
