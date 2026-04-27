import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/lib/types/database"
import { fail, ok, type LoaderResult } from "./types"

type GapCategory = Database["public"]["Enums"]["gap_category"]

export type CompetencyNode = {
  id: string
  parent_id: string | null
  code: string
  name: string
  description: string | null
  category: GapCategory
  proficiency_levels: Json
  children: CompetencyNode[]
}

export type FrameworkTree = {
  framework: {
    id: string
    name: string
    version: number
    is_active: boolean
  }
  /**
   * Top-level competency nodes (parent_id is null). Each node embeds its
   * descendants in the children array. Order is by code ascending at every
   * level so the tree renders deterministically.
   */
  roots: CompetencyNode[]
}

/**
 * Loads a framework + its full competency tree.
 *
 * If frameworkId is omitted, picks the most recent active framework for
 * the caller's tenant. RLS ensures only same-tenant frameworks are
 * visible; calling this from a tenant with no framework returns
 * { ok: false, reason: "not_found" }.
 *
 * Read-only — no edit, no publish, no draft-version logic. The framework
 * editor (Phase 1 slice 5) will layer those on top.
 *
 * Server-only.
 */
export async function getFrameworkTree(
  frameworkId?: string,
): Promise<LoaderResult<FrameworkTree>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")

  // Resolve framework — by id when provided, otherwise the most recent
  // active one in the caller's tenant. RLS handles tenant scope.
  const frameworkQuery = supabase
    .from("competency_frameworks")
    .select("id, name, version, is_active")
    .is("deleted_at", null)
  const frameworkResp = frameworkId
    ? await frameworkQuery.eq("id", frameworkId).maybeSingle()
    : await frameworkQuery
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()

  if (frameworkResp.error) {
    return fail("query_error", frameworkResp.error.message)
  }
  const framework = frameworkResp.data
  if (!framework) return fail("not_found")

  const { data: competencies, error: compErr } = await supabase
    .from("competencies")
    .select("id, parent_id, code, name, description, category, proficiency_levels")
    .eq("framework_id", framework.id)
    .is("deleted_at", null)
    .order("code", { ascending: true })
  if (compErr) return fail("query_error", compErr.message)

  return ok({
    framework: {
      id: framework.id,
      name: framework.name,
      version: framework.version,
      is_active: framework.is_active,
    },
    roots: buildCompetencyTree(competencies ?? []),
  })
}

type FlatCompetency = {
  id: string
  parent_id: string | null
  code: string
  name: string
  description: string | null
  category: GapCategory
  proficiency_levels: Json
}

/**
 * Pure helper. Turns a flat list of competency rows into a nested tree.
 * Children are sorted by code asc to match the loader's flat-list order
 * (and to render deterministically in any UI consumer).
 *
 * Robustness:
 *   - Unknown parent_id (parent not in the input) is treated as a root
 *     so a partial dataset still renders. Logged via the orphan_root_ids
 *     return field would be ideal but the caller can derive it from
 *     parent_id !== null AND no matching node — left to consumers.
 *   - Cycles are not detected; the schema's parent_id self-reference
 *     constraint is "ON DELETE RESTRICT" but does not prevent cycles.
 *     This helper assumes the input is acyclic, matching schema intent.
 */
export function buildCompetencyTree(
  rows: ReadonlyArray<FlatCompetency>,
): CompetencyNode[] {
  const byId = new Map<string, CompetencyNode>()
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      parent_id: r.parent_id,
      code: r.code,
      name: r.name,
      description: r.description,
      category: r.category,
      proficiency_levels: r.proficiency_levels,
      children: [],
    })
  }

  const roots: CompetencyNode[] = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortByCode = (a: CompetencyNode, b: CompetencyNode): number =>
    a.code.localeCompare(b.code)
  roots.sort(sortByCode)
  for (const node of byId.values()) node.children.sort(sortByCode)
  return roots
}
