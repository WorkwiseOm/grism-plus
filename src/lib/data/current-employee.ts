import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"
import { fail, ok, type LoaderResult } from "./types"

type UserRole = Database["public"]["Enums"]["user_role"]
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"]

export type CurrentEmployeeContext = {
  user: { id: string; email: string | null }
  profile: {
    id: string
    tenant_id: string
    role: UserRole
    full_name: string | null
    email: string | null
  }
  /**
   * The employees row keyed off user_profile_id. May be null for users
   * who have a profile but no employee record — for example,
   * superadmin / Tilqai-Grism support users without a presence in the
   * tenant's employee roster.
   */
  employee: EmployeeRow | null
}

/**
 * Resolves the current authenticated user's profile and (where present)
 * their employees row. Server-only — relies on cookies() via the supabase
 * server client.
 */
export async function getCurrentEmployeeContext(): Promise<
  LoaderResult<CurrentEmployeeContext>
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")

  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("id, tenant_id, role, full_name, email")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileErr) return fail("query_error", profileErr.message)
  if (!profile) return fail("profile_not_found")

  const { data: employee, error: employeeErr } = await supabase
    .from("employees")
    .select("*")
    .eq("user_profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (employeeErr) return fail("query_error", employeeErr.message)

  return ok({
    user: { id: user.id, email: user.email ?? null },
    profile: {
      id: profile.id,
      tenant_id: profile.tenant_id,
      role: profile.role as UserRole,
      full_name: profile.full_name,
      email: profile.email,
    },
    employee: employee ?? null,
  })
}
