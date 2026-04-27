import { createClient } from "@/lib/supabase/server"
import {
  buildFrameworkImpactSummary,
  type FrameworkImpactMilestoneRow,
  type FrameworkImpactSummary,
} from "@/lib/framework-editor/impact"
import { fail, ok, type LoaderResult } from "@/lib/data/types"

export type FrameworkImpactInput = {
  competencyIds: string[]
  competencyCodes: string[]
}

export async function getFrameworkImpactSummary({
  competencyIds,
  competencyCodes,
}: FrameworkImpactInput): Promise<LoaderResult<FrameworkImpactSummary>> {
  if (competencyIds.length === 0) {
    return ok(
      buildFrameworkImpactSummary({
        competencyCount: 0,
        milestoneRows: [],
        ojtCatalogueCount: 0,
        elearningCatalogueCount: 0,
      }),
    )
  }

  const supabase = await createClient()

  const { data: milestoneRows, error: milestoneError } = await supabase
    .from("idp_milestones")
    .select("id, idp_id, idps!inner(employee_id)")
    .in("competency_id", competencyIds)
    .is("deleted_at", null)

  if (milestoneError) return fail("query_error", milestoneError.message)

  const [ojtCatalogueCount, elearningCatalogueCount] =
    competencyCodes.length > 0
      ? await Promise.all([
          countCatalogueRows("ojt_catalogue", competencyCodes),
          countCatalogueRows("elearning_catalogue", competencyCodes),
        ])
      : [ok(0), ok(0)]

  if (!ojtCatalogueCount.ok) return ojtCatalogueCount
  if (!elearningCatalogueCount.ok) return elearningCatalogueCount

  return ok(
    buildFrameworkImpactSummary({
      competencyCount: competencyIds.length,
      milestoneRows: (milestoneRows ?? []) as FrameworkImpactMilestoneRow[],
      ojtCatalogueCount: ojtCatalogueCount.data,
      elearningCatalogueCount: elearningCatalogueCount.data,
    }),
  )
}

async function countCatalogueRows(
  table: "ojt_catalogue" | "elearning_catalogue",
  competencyCodes: string[],
): Promise<LoaderResult<number>> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .overlaps("competency_tags", competencyCodes)
    .eq("is_active", true)
    .is("deleted_at", null)

  if (error) return fail("query_error", error.message)
  return ok(count ?? 0)
}
