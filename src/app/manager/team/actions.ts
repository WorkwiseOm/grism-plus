"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { createClient } from "@/lib/supabase/server"

const VALIDATION_STATUSES = new Set([
  "approved",
  "changes_requested",
  "rejected",
])

export async function validateOjtEvidenceAction(
  formData: FormData,
): Promise<void> {
  await requireRole(["manager"])

  const evidenceId = String(formData.get("evidenceId") ?? "").trim()
  const status = String(formData.get("status") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()

  if (!evidenceId) redirect("/manager/team?error=missing_evidence")
  if (!VALIDATION_STATUSES.has(status)) {
    redirect("/manager/team?error=invalid_validation_status")
  }
  if (notes.length < 5) redirect("/manager/team?error=validation_notes_required")

  const supabase = await createClient()
  const { error } = await supabase.rpc("validate_ojt_evidence", {
    p_evidence_id: evidenceId,
    p_status: status,
    p_notes: notes,
    p_checklist: null,
  })

  if (error) redirect("/manager/team?error=evidence_validation_failed")

  revalidatePath("/manager/team")
  redirect(
    status === "approved"
      ? "/manager/team?updated=evidence_approved"
      : "/manager/team?updated=evidence_reviewed",
  )
}
