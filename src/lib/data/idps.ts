import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/lib/types/database"
import { fail, ok, type LoaderResult } from "./types"

type IdpStatus = Database["public"]["Enums"]["idp_status"]
type ModalityType = Database["public"]["Enums"]["modality_type"]
type MilestoneStatus = Database["public"]["Enums"]["milestone_status"]
type GapCategory = Database["public"]["Enums"]["gap_category"]

export type IdpSummaryRow = {
  id: string
  employee_id: string
  employee_full_name: string | null
  status: IdpStatus
  version: number
  target_completion_date: string | null
  approved_at: string | null
  last_activity_at: string | null
  generated_by_ai: boolean
}

export type IdpSummaryFilter = {
  /** If non-empty, only IDPs with one of these statuses are returned. */
  statuses?: ReadonlyArray<IdpStatus>
  /** If non-empty, only IDPs whose employee_id is in the list are returned. */
  employeeIds?: ReadonlyArray<string>
}

/**
 * Lists IDPs visible to the caller. RLS enforces the per-role scope:
 *   employee → own IDPs
 *   manager  → own + direct reports
 *   ld_admin / superadmin → tenant-wide
 *
 * The loader does not pre-filter by role; it just queries idps. If a
 * caller wants something narrower they pass a filter. Empty array is a
 * valid result (e.g., a fresh tenant with no IDPs yet).
 *
 * Server-only.
 */
export async function getIdpSummaryList(
  filter: IdpSummaryFilter = {},
): Promise<LoaderResult<IdpSummaryRow[]>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")

  let query = supabase
    .from("idps")
    .select(
      "id, employee_id, status, version, target_completion_date, approved_at, last_activity_at, generated_by_ai, employees!inner(full_name)",
    )
    .is("deleted_at", null)
    .order("last_activity_at", { ascending: false, nullsFirst: false })

  if (filter.statuses && filter.statuses.length > 0) {
    query = query.in("status", filter.statuses)
  }
  if (filter.employeeIds && filter.employeeIds.length > 0) {
    query = query.in("employee_id", filter.employeeIds)
  }

  const { data, error } = await query
  if (error) return fail("query_error", error.message)

  const rows: IdpSummaryRow[] = (data ?? []).map((row) => {
    // Supabase types the embedded relation as either an object or array
    // depending on cardinality inference; we asked for a single FK so it
    // is the singular form here. Coerce defensively.
    const employee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees
    return {
      id: row.id,
      employee_id: row.employee_id,
      employee_full_name: employee?.full_name ?? null,
      status: row.status,
      version: row.version,
      target_completion_date: row.target_completion_date,
      approved_at: row.approved_at,
      last_activity_at: row.last_activity_at,
      generated_by_ai: row.generated_by_ai,
    }
  })

  return ok(rows)
}

const ALL_STATUSES: ReadonlyArray<IdpStatus> = [
  "draft",
  "pending_approval",
  "active",
  "completed",
  "archived",
  "stalled",
]

/**
 * Pure helper. Buckets an IDP summary list by status. Always includes
 * every status key (with [] for empty buckets) so UI code never has to
 * check for missing keys.
 */
export function groupIdpSummariesByStatus(
  rows: ReadonlyArray<IdpSummaryRow>,
): Record<IdpStatus, IdpSummaryRow[]> {
  const buckets = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, [] as IdpSummaryRow[]]),
  ) as Record<IdpStatus, IdpSummaryRow[]>
  for (const row of rows) buckets[row.status].push(row)
  return buckets
}

// ============================================================================
// IDP detail
// ============================================================================

export type IdpDetailEmployee = {
  id: string
  full_name: string
  role_title: string
  target_role_title: string | null
  department: string | null
}

export type IdpDetailAction = {
  id: string
  milestone_id: string
  modality: ModalityType
  title: string
  external_ref_id: string | null
  external_ref_table: string | null
  is_recommended_by_ai: boolean
  created_at: string
  updated_at: string
}

export type IdpDetailMilestone = {
  milestone: {
    id: string
    sequence_order: number
    title: string
    description: string | null
    gap_score_at_creation: number
    status: MilestoneStatus
    target_date: string
    completed_at: string | null
  }
  competency: {
    id: string
    code: string
    name: string
    category: GapCategory
  } | null
  actions: IdpDetailAction[]
}

export type IdpDetail = {
  idp: {
    id: string
    tenant_id: string
    employee_id: string
    status: IdpStatus
    version: number
    narrative: string | null
    narrative_source: string | null
    ai_generation_metadata: Json | null
    generated_by_ai: boolean
    target_completion_date: string | null
    approved_at: string | null
    approved_by: string | null
    published_at: string | null
    last_activity_at: string | null
    created_at: string
    updated_at: string
  }
  employee: IdpDetailEmployee | null
  milestones: IdpDetailMilestone[]
}

/**
 * Returns full IDP detail (idp row + employee snapshot + milestones with
 * per-milestone competency metadata + actions). RLS may hide the IDP
 * entirely; that returns { ok: false, reason: "not_found" }.
 *
 * Reads only — no writes, no soft-delete touch, no last_activity_at refresh.
 *
 * Server-only.
 */
export async function getIdpDetail(
  idpId: string,
): Promise<LoaderResult<IdpDetail>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")

  const { data: idp, error: idpErr } = await supabase
    .from("idps")
    .select(
      "id, tenant_id, employee_id, status, version, narrative, narrative_source, ai_generation_metadata, generated_by_ai, target_completion_date, approved_at, approved_by, published_at, last_activity_at, created_at, updated_at",
    )
    .eq("id", idpId)
    .is("deleted_at", null)
    .maybeSingle()

  if (idpErr) return fail("query_error", idpErr.message)
  if (!idp) return fail("not_found")

  const { data: employee, error: employeeErr } = await supabase
    .from("employees")
    .select("id, full_name, role_title, target_role_title, department")
    .eq("id", idp.employee_id)
    .is("deleted_at", null)
    .maybeSingle()
  if (employeeErr) return fail("query_error", employeeErr.message)

  const { data: milestones, error: milestonesErr } = await supabase
    .from("idp_milestones")
    .select(
      "id, sequence_order, title, description, gap_score_at_creation, status, target_date, completed_at, competency_id, competencies(id, code, name, category)",
    )
    .eq("idp_id", idpId)
    .is("deleted_at", null)
    .order("sequence_order", { ascending: true })
  if (milestonesErr) return fail("query_error", milestonesErr.message)

  const milestoneIds = (milestones ?? []).map((m) => m.id)
  let actionsByMilestone = new Map<string, IdpDetailAction[]>()
  if (milestoneIds.length > 0) {
    const { data: actions, error: actionsErr } = await supabase
      .from("idp_actions")
      .select(
        "id, milestone_id, modality, title, external_ref_id, external_ref_table, is_recommended_by_ai, created_at, updated_at",
      )
      .in("milestone_id", milestoneIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
    if (actionsErr) return fail("query_error", actionsErr.message)
    actionsByMilestone = groupActionsByMilestone(actions ?? [])
  }

  const detailMilestones: IdpDetailMilestone[] = (milestones ?? []).map((m) => {
    const competency = Array.isArray(m.competencies)
      ? m.competencies[0]
      : m.competencies
    return {
      milestone: {
        id: m.id,
        sequence_order: m.sequence_order,
        title: m.title,
        description: m.description,
        gap_score_at_creation: m.gap_score_at_creation,
        status: m.status,
        target_date: m.target_date,
        completed_at: m.completed_at,
      },
      competency: competency
        ? {
            id: competency.id,
            code: competency.code,
            name: competency.name,
            category: competency.category,
          }
        : null,
      actions: actionsByMilestone.get(m.id) ?? [],
    }
  })

  return ok({
    idp: {
      id: idp.id,
      tenant_id: idp.tenant_id,
      employee_id: idp.employee_id,
      status: idp.status,
      version: idp.version,
      narrative: idp.narrative,
      narrative_source: idp.narrative_source,
      ai_generation_metadata: idp.ai_generation_metadata,
      generated_by_ai: idp.generated_by_ai,
      target_completion_date: idp.target_completion_date,
      approved_at: idp.approved_at,
      approved_by: idp.approved_by,
      published_at: idp.published_at,
      last_activity_at: idp.last_activity_at,
      created_at: idp.created_at,
      updated_at: idp.updated_at,
    },
    employee: employee
      ? {
          id: employee.id,
          full_name: employee.full_name,
          role_title: employee.role_title,
          target_role_title: employee.target_role_title,
          department: employee.department,
        }
      : null,
    milestones: detailMilestones,
  })
}

/**
 * Pure helper. Buckets actions by milestone_id. Stable insertion order.
 */
export function groupActionsByMilestone(
  actions: ReadonlyArray<IdpDetailAction>,
): Map<string, IdpDetailAction[]> {
  const map = new Map<string, IdpDetailAction[]>()
  for (const a of actions) {
    const existing = map.get(a.milestone_id)
    if (existing) existing.push(a)
    else map.set(a.milestone_id, [a])
  }
  return map
}
