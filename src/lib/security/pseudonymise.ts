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
  const { full_name: _fn, email: _em, ...rest } = employee
  return { ...rest, pseudonym } as PseudonymisedEmployee
}
