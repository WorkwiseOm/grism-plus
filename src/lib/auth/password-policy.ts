/**
 * Password policy validator (Step 4 slice 2).
 *
 * Single source of truth for application-layer password requirements.
 * Mirrors the policy set in the Supabase Auth dashboard (minimum length
 * 12 + lowercase + uppercase + digit + symbol), adding granular per-rule
 * error messages that Supabase's generic "password is too weak" error
 * cannot supply.
 *
 * Use on signup and password-reset flows only. Login accepts whatever
 * the user typed because their historical password may predate any
 * future policy change.
 *
 * Policy source of truth: docs/security.md → "Password policy".
 */

export type PasswordPolicyResult = {
  valid: boolean
  errors: string[]
}

const MIN_LENGTH = 12

const MESSAGES = {
  tooShort: `Password must be at least ${MIN_LENGTH} characters long.`,
  missingLower: "Password must include at least one lowercase letter.",
  missingUpper: "Password must include at least one uppercase letter.",
  missingDigit: "Password must include at least one digit.",
  missingSymbol: "Password must include at least one symbol.",
} as const

export function validatePassword(password: string): PasswordPolicyResult {
  const errors: string[] = []

  if (password.length < MIN_LENGTH) errors.push(MESSAGES.tooShort)
  if (!/[a-z]/.test(password)) errors.push(MESSAGES.missingLower)
  if (!/[A-Z]/.test(password)) errors.push(MESSAGES.missingUpper)
  if (!/[0-9]/.test(password)) errors.push(MESSAGES.missingDigit)
  if (!/[^A-Za-z0-9]/.test(password)) errors.push(MESSAGES.missingSymbol)

  return { valid: errors.length === 0, errors }
}
