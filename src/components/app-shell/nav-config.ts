import type { Database } from "@/lib/types/database"

type UserRole = Database["public"]["Enums"]["user_role"]

export type NavItem = {
  label: string
  href: string
  /**
   * Active when the current pathname is exactly this href OR starts with
   * `${href}/`. Stored on the item for the client component to use; keeps
   * the routing convention testable without coupling to next/navigation.
   */
}

export type NavSection = {
  /**
   * "L&D" / "Manager" / "Employee" — used as a subtle section label in
   * the sidebar; pure presentational text. Empty string means "no
   * section heading."
   */
  heading: string
  items: ReadonlyArray<NavItem>
}

/**
 * Pure mapping from role to nav structure. Labels match the Stitch
 * snapshot vocabulary so screen contracts and shell stay aligned.
 *
 * Coach intentionally has no product navigation until assigned-coachee
 * RLS exists. This prevents coach users from inheriting manager tenant
 * visibility through Phase 0 policies.
 *
 * Superadmin sees the L&D admin nav because /admin allows both roles
 * (require-role.ts allow-list). When a real cross-tenant superadmin
 * surface lands, this is the right place to add it.
 *
 * Returns an empty array for an unknown role rather than throwing — the
 * shell uses that to render an empty nav surface, not a crash.
 */
export function getNavItemsForRole(role: UserRole): NavSection[] {
  switch (role) {
    case "ld_admin":
    case "superadmin":
      return [
        {
          heading: "L&D",
          items: [
            { label: "Approval Queue", href: "/admin/idps" },
            { label: "Framework Editor", href: "/admin/frameworks" },
          ],
        },
      ]
    case "manager":
      return [
        {
          heading: "Manager",
          items: [{ label: "Team Cockpit", href: "/manager/team" }],
        },
      ]
    case "coach":
      return []
    case "employee":
      return [
        {
          heading: "Employee",
          items: [{ label: "IDP Workspace", href: "/employee/idp" }],
        },
      ]
    default:
      return []
  }
}

/**
 * Pure helper: is `href` "active" given the current pathname?
 * Active when pathname === href or pathname starts with `${href}/`.
 * Exported so the client sidebar can apply the same rule we test here.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}
