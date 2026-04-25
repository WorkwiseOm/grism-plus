import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

type UserRole = Database["public"]["Enums"]["user_role"]

export type RequireRoleResult = {
  user: { id: string; email: string | null }
  profile: { role: UserRole; tenant_id: string }
}

/**
 * Server-side role gate for protected route segments.
 *
 * Defence-in-depth on top of root role-routing in src/app/page.tsx.
 * Direct navigation to /admin /manager /employee bypasses root routing,
 * so each role landing must independently verify the caller's role
 * before rendering. Without this, an authenticated employee hitting
 * /admin would see admin-shaped UI even though no admin API would
 * actually return data for them.
 *
 * Flow:
 *   - No session                   → /auth/sign-in
 *   - Session, no profile          → /auth/sign-in?error=profile_missing
 *   - Session, role NOT in allowed → /  (root re-routes to actual home)
 *   - Session, role IN allowed     → returns { user, profile }
 *
 * Why redirect to "/" (and not /auth/sign-in?error=unauthorized_role)
 * for the unauthorized case: root is already the role router. It reads
 * the same role column the guard rejected and dispatches to a path the
 * user IS allowed on. That gives a graceful "wrong page" recovery
 * instead of bouncing the user out of their session. Loop-safe because
 * root never redirects to a path the user's role is barred from — it
 * dispatches by role.
 *
 * MFA interaction: middleware MFA enforcement runs before any page
 * server component, so a user whose role is in tenants.mfa_required_roles
 * never reaches this helper at aal1. By the time requireRole runs,
 * MFA (where required) has been satisfied.
 */
export async function requireRole(
  allowed: ReadonlyArray<UserRole>,
): Promise<RequireRoleResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/sign-in")

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single()

  if (error || !profile) redirect("/auth/sign-in?error=profile_missing")

  const role = profile.role as UserRole
  if (!allowed.includes(role)) redirect("/")

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: { role, tenant_id: profile.tenant_id },
  }
}
