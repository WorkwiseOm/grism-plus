"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { isDemoAuthRelaxedFromEnv } from "@/lib/auth/demo-mode"
import { resolveDemoPersona } from "@/lib/auth/demo-personas"

/**
 * Server action invoked by the local-only demo persona switcher.
 *
 * Triple-gate: re-checks isDemoAuthRelaxedFromEnv() at action time, not
 * at form-render time. A page that was rendered while the gate was open
 * cannot be replayed against a server with the gate closed.
 *
 * Flow:
 *   1. Re-evaluate the demo gate using the action's own request headers.
 *   2. Resolve the persona's email + password from env (never logged).
 *   3. Sign out the existing session (if any) and sign in with the
 *      persona's credentials. Supabase's SSR cookie writer puts the new
 *      session cookies on the response automatically.
 *   4. Redirect to /, which re-runs role-based routing.
 *
 * Errors are thrown rather than returned because the form's submit path
 * doesn't have a useFormState handler. Throwing surfaces the failure as
 * a Next error page in the local-dev session — fine for a dev-only path.
 */
export async function signInAsDemoPersona(formData: FormData): Promise<void> {
  const h = await headers()
  if (!isDemoAuthRelaxedFromEnv(h.get("host"))) {
    throw new Error("Demo persona sign-in is not available in this environment")
  }

  const id = formData.get("personaId")
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing personaId on demo sign-in")
  }

  const persona = resolveDemoPersona(id)
  if (!persona) {
    throw new Error(
      `Demo persona "${id}" is unknown or its password env var is unset`,
    )
  }

  const supabase = await createClient()
  // Sign out any existing session first so the persona switch is clean.
  // signOut returns an error only if the call itself fails; an
  // already-signed-out caller is fine.
  await supabase.auth.signOut()

  const { error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password: persona.password,
  })
  if (error) {
    // Surface a generic message; do not echo persona email back into the
    // error path even though it is technically public.
    throw new Error(`Demo sign-in failed: ${error.message}`)
  }

  redirect("/")
}
