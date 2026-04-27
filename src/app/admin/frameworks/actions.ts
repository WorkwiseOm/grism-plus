"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import {
  validateCompetencyEdit,
  type CompetencyEditIssue,
} from "@/lib/framework-editor/edit"
import { createClient } from "@/lib/supabase/server"

export async function updateCompetencyAction(
  formData: FormData,
): Promise<void> {
  await requireRole(["ld_admin", "superadmin"])

  const competencyId = String(formData.get("competencyId") ?? "").trim()
  if (!competencyId) redirect("/admin/frameworks?error=missing_competency")

  const parsed = validateCompetencyEdit({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    proficiencyLevelsText: String(formData.get("proficiencyLevels") ?? ""),
  })

  if (!parsed.ok) {
    redirect(
      `/admin/frameworks?competency=${encodeURIComponent(competencyId)}&error=${firstIssue(parsed.issues)}`,
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("competencies")
    .update({
      name: parsed.value.name,
      description: parsed.value.description,
      category: parsed.value.category,
      proficiency_levels: parsed.value.proficiencyLevels,
      updated_at: new Date().toISOString(),
    })
    .eq("id", competencyId)
    .is("deleted_at", null)
    .select("id")
    .single()

  if (error || !data) {
    redirect(
      `/admin/frameworks?competency=${encodeURIComponent(competencyId)}&error=competency_update_failed`,
    )
  }

  revalidatePath("/admin/frameworks")
  redirect(
    `/admin/frameworks?competency=${encodeURIComponent(competencyId)}&updated=competency_saved`,
  )
}

function firstIssue(issues: CompetencyEditIssue[]): string {
  return issues[0]?.code ?? "competency_update_failed"
}
