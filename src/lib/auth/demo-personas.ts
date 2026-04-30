/**
 * Server-only demo persona registry for the local-mode persona switcher.
 *
 * Persona LABELS and EMAILS are committed (they're public — they appear
 * in the seed script and the demo data). PASSWORDS are loaded only from
 * environment variables that are gitignored (.env.local). The registry
 * is server-side and is filtered by isDemoAuthRelaxed() before it is
 * exposed to any caller.
 *
 * Threat model: even if this module is imported into a client bundle by
 * accident, only the email/label/envKey strings would leak — passwords
 * never enter the bundle because they're read from process.env at
 * request time on the server.
 */

// No "server-only" dependency added (avoids new package). The module is
// effectively server-side because resolveDemoPersona() reads process.env at
// runtime; client bundles wouldn't have those env values, and the file is
// only imported from server components / server actions / middleware.

export type DemoPersonaDescriptor = {
  /** Stable id used as form value. Lowercase ascii, hyphenated. */
  id: string
  /** Human-facing label shown on the switcher button. */
  label: string
  /** Seeded auth.users email. Public — appears in scripts/demo/personas.ts. */
  email: string
  /**
   * Name of the env var that holds this persona's password. The password
   * itself never appears in committed code. Operator must set these in
   * .env.local after running the demo seed (see .env.local.example).
   */
  envKey: string
}

/**
 * The five "printed" personas that the demo seed rotates passwords for
 * on every run. Mirrors PRINTED_PERSONA_EMAILS in
 * scripts/demo/personas.ts; if that list changes, change this in lockstep.
 */
export const DEMO_PERSONAS: ReadonlyArray<DemoPersonaDescriptor> = [
  {
    id: "yusuf",
    label: "Yusuf Al-Saadi (superadmin)",
    email: "yusuf.alsaadi@grism-demo.local",
    envKey: "DEMO_PERSONA_YUSUF_PASSWORD",
  },
  {
    id: "aisha",
    label: "Aisha Al-Balushi (L&D admin)",
    email: "aisha.albalushi@grism-demo.local",
    envKey: "DEMO_PERSONA_AISHA_PASSWORD",
  },
  {
    id: "khalid",
    label: "Khalid Al-Harthy (manager)",
    email: "khalid.alharthy@grism-demo.local",
    envKey: "DEMO_PERSONA_KHALID_PASSWORD",
  },
  {
    id: "fatima",
    label: "Fatima Al-Lawati (manager)",
    email: "fatima.allawati@grism-demo.local",
    envKey: "DEMO_PERSONA_FATIMA_PASSWORD",
  },
  {
    id: "omar",
    label: "Omar Al-Mahrouqi (manager)",
    email: "omar.almahrouqi@grism-demo.local",
    envKey: "DEMO_PERSONA_OMAR_PASSWORD",
  },
  {
    id: "saif",
    label: "Saif Al-Habsi (employee)",
    email: "saif.alhabsi@grism-demo.local",
    envKey: "DEMO_PERSONA_SAIF_PASSWORD",
  },
] as const

/** Public-safe view of a persona for client rendering: id + label only. */
export type DemoPersonaPublic = { id: string; label: string }

export function publicPersonaList(): DemoPersonaPublic[] {
  return DEMO_PERSONAS.map(({ id, label }) => ({ id, label }))
}

/**
 * Returns persona personas that have a password set in env. Personas
 * without an env-set password are excluded (so the switcher never offers
 * a click that would 401). Server-only; never call from client code.
 */
export function availableDemoPersonas(): DemoPersonaPublic[] {
  return DEMO_PERSONAS.filter((p) => Boolean(process.env[p.envKey])).map(
    ({ id, label }) => ({ id, label }),
  )
}

/**
 * Resolves a persona descriptor + password by id. Returns null if the
 * id is unknown or the password env is unset. Server-only.
 */
export function resolveDemoPersona(
  id: string,
): { email: string; password: string } | null {
  const descriptor = DEMO_PERSONAS.find((p) => p.id === id)
  if (!descriptor) return null
  const password = process.env[descriptor.envKey]
  if (!password) return null
  return { email: descriptor.email, password }
}
