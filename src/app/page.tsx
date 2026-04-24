import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/types/database"

type UserRole = Database["public"]["Enums"]["user_role"]

/**
 * Root entry — role-based redirect.
 *
 * - No session → /auth/sign-in (middleware usually catches this first, but
 *   the check is duplicated here as a defence-in-depth guard).
 * - Session but no matching user_profiles row → /auth/sign-in?error=profile_missing.
 * - Session + known role → the role's landing page.
 * - Session + unknown role → /auth/sign-in?error=unknown_role, plus a
 *   security_events row (closest-fit enum: 'rls_denial' with metadata
 *   describing the actual reason). A dedicated 'unknown_role_fallback'
 *   enum value is tracked in docs/PROGRESS.md for slice 2.
 */
export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/sign-in")
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single()

  if (profileError || !profile) {
    redirect("/auth/sign-in?error=profile_missing")
  }

  const role = profile.role as UserRole
  switch (role) {
    case "employee":
      redirect("/employee")
    case "manager":
    case "coach":
      // Coach uses the manager landing for slice 1; splitting into a
      // dedicated /coach route tracked as a Phase 1 scope decision.
      redirect("/manager")
    case "ld_admin":
    case "superadmin":
      redirect("/admin")
    default: {
      const admin = createAdminClient()
      await admin.from("security_events").insert({
        user_id: user.id,
        event_type: "rls_denial",
        metadata: { reason: "unknown_role_fallback", role },
      })
      redirect("/auth/sign-in?error=unknown_role")
    }
  }
}
