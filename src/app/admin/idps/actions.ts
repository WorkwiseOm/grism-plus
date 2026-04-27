"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { classifyModalityForBlend } from "@/lib/ai/development-guards"
import { getIdpDetail } from "@/lib/data"
import { canApproveIdpStatus } from "@/lib/idp-approval/queue"
import { buildIdpBlendPreview } from "@/lib/idp-blend/preview"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

type IdpStatus = Database["public"]["Enums"]["idp_status"]
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function approveIdpAction(formData: FormData): Promise<void> {
  const idpId = String(formData.get("idpId") ?? "").trim()
  if (!idpId) redirect("/admin/idps?error=missing_idp")

  const { user } = await requireRole(["ld_admin", "superadmin"])
  const supabase = await createClient()

  const { data: current, error: loadError } = await supabase
    .from("idps")
    .select("status")
    .eq("id", idpId)
    .is("deleted_at", null)
    .single()

  if (loadError || !current) {
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=not_found`)
  }

  if (!canApproveIdpStatus(current.status as IdpStatus)) {
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=not_approvable`)
  }

  const blendPersisted = await persistIdpBlendArtifacts(supabase, idpId, user.id)
  if (!blendPersisted) {
    redirect(
      `/admin/idps?idp=${encodeURIComponent(idpId)}&error=blend_snapshot_failed`,
    )
  }

  const now = new Date().toISOString()
  const { data: approved, error: updateError } = await supabase
    .from("idps")
    .update({
      status: "active",
      approved_at: now,
      approved_by: user.id,
      published_at: now,
      last_activity_at: now,
    })
    .eq("id", idpId)
    .is("deleted_at", null)
    .select("id")
    .single()

  if (updateError || !approved) {
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=approve_failed`)
  }

  revalidatePath("/admin/idps")
  redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&updated=approved`)
}

async function persistIdpBlendArtifacts(
  supabase: ServerSupabaseClient,
  idpId: string,
  userId: string,
): Promise<boolean> {
  const detail = await getIdpDetail(idpId)
  if (!detail.ok) return false

  const preview = buildIdpBlendPreview(detail.data)
  if (!preview.guard.ok) return false

  const { data: policy, error: policyError } = await supabase
    .from("development_blend_policies")
    .select("id")
    .eq("tenant_id", detail.data.idp.tenant_id)
    .eq("scope", "tenant_default")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (policyError) return false

  const { error: snapshotError } = await supabase
    .from("idp_blend_snapshots")
    .insert({
      tenant_id: detail.data.idp.tenant_id,
      idp_id: idpId,
      policy_id: policy?.id ?? null,
      experience_pct: preview.percentages.experience,
      relationship_pct: preview.percentages.relationship,
      formal_pct: preview.percentages.formal,
      calculation_method: "generated",
      within_guardrail: preview.guard.ok,
      guardrail_notes:
        preview.guard.issues.map((issue) => issue.message).join(" ") || null,
      created_by: userId,
    })

  if (snapshotError) return false

  const actionRows = detail.data.milestones.flatMap((milestone) =>
    milestone.actions.map((action) => ({
      id: action.id,
      category: classifyModalityForBlend(action.modality),
    })),
  )
  const classifiedRows = actionRows.filter(
    (row): row is { id: string; category: NonNullable<typeof row.category> } =>
      row.category !== null,
  )
  if (classifiedRows.length === 0) return true

  const now = new Date().toISOString()
  const actionIds = classifiedRows.map((row) => row.id)
  const { error: softDeleteError } = await supabase
    .from("idp_action_blend_allocations")
    .update({ deleted_at: now })
    .in("idp_action_id", actionIds)
    .is("deleted_at", null)

  if (softDeleteError) return false

  const { error: allocationError } = await supabase
    .from("idp_action_blend_allocations")
    .insert(
      classifiedRows.map((row) => ({
        tenant_id: detail.data.idp.tenant_id,
        idp_action_id: row.id,
        blend_category: row.category,
        effort_weight: 1,
        classification_source: "default_mapping",
      })),
    )

  return !allocationError
}
