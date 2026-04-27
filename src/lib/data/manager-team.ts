import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"
import { fail, ok, type LoaderResult } from "./types"

type IdpStatus = Database["public"]["Enums"]["idp_status"]

type IdpRowForRollup = {
  id: string
  employee_id: string
  status: IdpStatus
  target_completion_date: string | null
  last_activity_at: string | null
  approved_at: string | null
  created_at: string
}

export type TeamMemberRollup = {
  employee: {
    id: string
    full_name: string
    role_title: string
    target_role_title: string | null
    department: string | null
  }
  /**
   * Status counts across all non-deleted IDPs visible to the caller for
   * this direct report. Always present, zero-filled per status.
   */
  idp_counts: Record<IdpStatus, number>
  /**
   * Most-recent IDP for the report by last_activity_at desc, then
   * created_at desc. Null when the report has no IDPs visible.
   */
  most_recent_idp: {
    id: string
    status: IdpStatus
    target_completion_date: string | null
    last_activity_at: string | null
    approved_at: string | null
  } | null
  total_idps: number
}

/**
 * Returns rollups for the caller's direct reports only. Coach-style
 * tenant-wide rollups are intentionally NOT supported here; any future
 * coach surface needs assignment-scoped RLS first (PROGRESS.md backlog).
 *
 * The loader trusts RLS for visibility:
 *   manager  → sees direct reports' IDPs
 *   ld_admin / superadmin → sees tenant rows; calling this loader as
 *                            admin returns reports of the admin's own
 *                            employees row (often empty), which is fine
 *                            — admins should use getIdpSummaryList
 *                            instead.
 *
 * Server-only.
 */
export async function getManagerTeamRollup(): Promise<
  LoaderResult<TeamMemberRollup[]>
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")

  // Resolve the caller's employees row so we can scope direct reports.
  // user_profiles → employees via user_profile_id.
  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("id, tenant_id")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (profileErr) return fail("query_error", profileErr.message)
  if (!profile) return fail("profile_not_found")

  const { data: callerEmployee, error: callerErr } = await supabase
    .from("employees")
    .select("id")
    .eq("user_profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (callerErr) return fail("query_error", callerErr.message)
  if (!callerEmployee) return fail("employee_not_found")

  const { data: reports, error: reportsErr } = await supabase
    .from("employees")
    .select("id, full_name, role_title, target_role_title, department")
    .eq("manager_id", callerEmployee.id)
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
  if (reportsErr) return fail("query_error", reportsErr.message)

  if (!reports || reports.length === 0) return ok([])

  const reportIds = reports.map((r) => r.id)
  const { data: idps, error: idpsErr } = await supabase
    .from("idps")
    .select(
      "id, employee_id, status, target_completion_date, last_activity_at, approved_at, created_at",
    )
    .in("employee_id", reportIds)
    .is("deleted_at", null)
  if (idpsErr) return fail("query_error", idpsErr.message)

  const idpsByEmployee = groupIdpsByEmployee(idps ?? [])

  const rollups: TeamMemberRollup[] = reports.map((r) =>
    buildTeamMemberRollup(
      {
        id: r.id,
        full_name: r.full_name,
        role_title: r.role_title,
        target_role_title: r.target_role_title,
        department: r.department,
      },
      idpsByEmployee.get(r.id) ?? [],
    ),
  )

  return ok(rollups)
}

const ALL_STATUSES: ReadonlyArray<IdpStatus> = [
  "draft",
  "pending_approval",
  "active",
  "completed",
  "archived",
  "stalled",
]

/** Pure helper. Buckets IDPs by employee_id, preserving order. */
export function groupIdpsByEmployee(
  idps: ReadonlyArray<IdpRowForRollup>,
): Map<string, IdpRowForRollup[]> {
  const map = new Map<string, IdpRowForRollup[]>()
  for (const idp of idps) {
    const existing = map.get(idp.employee_id)
    if (existing) existing.push(idp)
    else map.set(idp.employee_id, [idp])
  }
  return map
}

/** Pure helper. Builds a single rollup from an employee + their IDPs. */
export function buildTeamMemberRollup(
  employee: TeamMemberRollup["employee"],
  idps: ReadonlyArray<IdpRowForRollup>,
): TeamMemberRollup {
  const counts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0]),
  ) as Record<IdpStatus, number>
  for (const idp of idps) counts[idp.status]++

  const sorted = [...idps].sort((a, b) => {
    const la = a.last_activity_at ?? ""
    const lb = b.last_activity_at ?? ""
    if (la !== lb) return lb.localeCompare(la)
    return b.created_at.localeCompare(a.created_at)
  })
  const top = sorted[0] ?? null

  return {
    employee,
    idp_counts: counts,
    most_recent_idp: top
      ? {
          id: top.id,
          status: top.status,
          target_completion_date: top.target_completion_date,
          last_activity_at: top.last_activity_at,
          approved_at: top.approved_at,
        }
      : null,
    total_idps: idps.length,
  }
}
