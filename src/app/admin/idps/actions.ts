"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { generateIdpDraft } from "@/lib/ai/idp-generation"
import { generateLocalDemoIdpDraft } from "@/lib/ai/local-demo-idp-draft"
import { classifyModalityForBlend } from "@/lib/ai/development-guards"
import { getIdpDetail } from "@/lib/data"
import { isDemoAuthRelaxedFromEnv } from "@/lib/auth/demo-mode"
import { canApproveIdpStatus } from "@/lib/idp-approval/queue"
import {
  buildIdpReviewUpdate,
  validateIdpReviewComment,
  type IdpReviewDisposition,
} from "@/lib/idp-approval/review"
import { buildIdpBlendPreview } from "@/lib/idp-blend/preview"
import { pseudonymiseEmployee } from "@/lib/security/pseudonymise"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

type IdpStatus = Database["public"]["Enums"]["idp_status"]
type Employee = Database["public"]["Tables"]["employees"]["Row"]
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function generateAiIdpDraftAction(
  formData: FormData,
): Promise<void> {
  const idpId = String(formData.get("idpId") ?? "").trim()
  if (!idpId) redirect("/admin/idps?error=missing_idp")

  await requireRole(["ld_admin", "superadmin"])
  const supabase = await createClient()

  const detail = await getIdpDetail(idpId)
  if (!detail.ok) {
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=not_found`)
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", detail.data.idp.employee_id)
    .is("deleted_at", null)
    .single()

  if (employeeError || !employee) {
    await logAiGenerationError({
      tenantId: detail.data.idp.tenant_id,
      idpId,
      reason: "employee_not_found",
      message: employeeError?.message ?? "Employee row not found.",
    })
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=ai_employee_missing`)
  }

  const competencyGaps = detail.data.milestones
    .filter((milestone) => milestone.competency !== null)
    .map((milestone) => ({
      competencyCode: milestone.competency?.code ?? "",
      competencyName: milestone.competency?.name ?? "",
      category: milestone.competency?.category ?? "technical",
      currentProficiency: `Gap score at creation: ${milestone.milestone.gap_score_at_creation}/100`,
      targetProficiency: "Target proficiency for this role",
      gapScore0To100: milestone.milestone.gap_score_at_creation,
    }))

  if (competencyGaps.length === 0) {
    await logAiGenerationError({
      tenantId: detail.data.idp.tenant_id,
      idpId,
      reason: "no_competency_gaps",
      message: "IDP has no competency-linked milestones.",
    })
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=ai_no_gaps`)
  }

  const promptInput = {
    employee: pseudonymiseEmployee(employee as Employee, idpId),
    targetRoleTitle: employee.target_role_title,
    competencyGaps,
    constraints: {
      maxMilestones: Math.max(1, detail.data.milestones.length),
      preferredTargetDays: 90,
    },
  }

  const h = await headers()
  const generated = isDemoAuthRelaxedFromEnv(h.get("host"))
    ? generateLocalDemoIdpDraft(
        promptInput,
        "Local demo mode used deterministic AI fallback.",
      )
    : await generateIdpDraft(promptInput)

  if (!generated.ok) {
    await logAiGenerationError({
      tenantId: detail.data.idp.tenant_id,
      idpId,
      reason: generated.reason,
      message: generated.message,
      validationIssues: generated.validation?.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    })
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=ai_generation_failed`)
  }

  const now = new Date().toISOString()
  const metadata = {
    node: "idp_generation",
    generated_at: now,
    model: generated.completion.model,
    stop_reason: generated.completion.stopReason,
    usage: generated.completion.usage,
    validation: {
      action_count: generated.validation.actionCount,
      computed_blend: generated.validation.computedBlend,
    },
    draft: generated.draft,
  } as unknown as Database["public"]["Tables"]["idps"]["Update"]["ai_generation_metadata"]

  const { data: updated, error: updateError } = await supabase
    .from("idps")
    .update({
      narrative: generated.draft.narrative ?? null,
      narrative_source: "ai",
      generated_by_ai: true,
      ai_generation_metadata: metadata,
      last_activity_at: now,
    })
    .eq("id", idpId)
    .is("deleted_at", null)
    .select("id")
    .single()

  if (updateError || !updated) {
    await logAiGenerationError({
      tenantId: detail.data.idp.tenant_id,
      idpId,
      reason: "idp_update_failed",
      message: updateError?.message ?? "IDP update failed.",
    })
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=ai_update_failed`)
  }

  revalidatePath("/admin/idps")
  redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&updated=ai_draft_generated`)
}

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

export async function requestIdpChangesAction(
  formData: FormData,
): Promise<void> {
  await reviewIdpAction(formData, "changes_requested")
}

export async function rejectIdpAction(formData: FormData): Promise<void> {
  await reviewIdpAction(formData, "rejected")
}

async function reviewIdpAction(
  formData: FormData,
  disposition: IdpReviewDisposition,
): Promise<void> {
  const idpId = String(formData.get("idpId") ?? "").trim()
  if (!idpId) redirect("/admin/idps?error=missing_idp")

  const comment = validateIdpReviewComment(
    String(formData.get("reviewComment") ?? ""),
  )
  if (!comment.ok) {
    redirect(
      `/admin/idps?idp=${encodeURIComponent(idpId)}&error=${comment.code}`,
    )
  }

  const { user } = await requireRole(["ld_admin", "superadmin"])
  const supabase = await createClient()

  const { data: current, error: loadError } = await supabase
    .from("idps")
    .select("status, version, ai_generation_metadata")
    .eq("id", idpId)
    .is("deleted_at", null)
    .single()

  if (loadError || !current) {
    redirect(`/admin/idps?idp=${encodeURIComponent(idpId)}&error=not_found`)
  }

  if (current.status !== "pending_approval") {
    redirect(
      `/admin/idps?idp=${encodeURIComponent(idpId)}&error=not_reviewable`,
    )
  }

  const now = new Date().toISOString()
  const reviewUpdate = buildIdpReviewUpdate({
    disposition,
    currentVersion: current.version,
    existingMetadata: current.ai_generation_metadata,
    entry: {
      disposition,
      comment: comment.comment,
      reviewed_by: user.id,
      reviewed_at: now,
    },
    now,
  })

  const { data: updated, error: updateError } = await supabase
    .from("idps")
    .update(reviewUpdate)
    .eq("id", idpId)
    .is("deleted_at", null)
    .select("id")
    .single()

  if (updateError || !updated) {
    redirect(
      `/admin/idps?idp=${encodeURIComponent(idpId)}&error=review_update_failed`,
    )
  }

  revalidatePath("/admin/idps")
  revalidatePath("/employee/idp")
  redirect(
    `/admin/idps?idp=${encodeURIComponent(idpId)}&updated=${disposition}`,
  )
}

async function logAiGenerationError({
  tenantId,
  idpId,
  reason,
  message,
  validationIssues,
}: {
  tenantId: string | null
  idpId: string
  reason: string
  message: string
  validationIssues?: Array<{ code: string; path: string; message: string }>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from("error_log").insert({
      tenant_id: tenantId,
      ai_node: "idp_generation",
      error_message: message,
      context: {
        idp_id: idpId,
        reason,
        validation_issues: validationIssues ?? [],
      },
    })
  } catch {
    // Do not block the user-facing redirect if error logging itself fails.
  }
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
