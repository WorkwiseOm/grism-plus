"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { createClient } from "@/lib/supabase/server"

export async function submitOjtEvidenceAction(
  formData: FormData,
): Promise<void> {
  await requireRole(["employee"])

  const assignmentId = String(formData.get("assignmentId") ?? "").trim()
  const selfReflection = String(formData.get("selfReflection") ?? "").trim()

  if (!assignmentId) redirect("/employee/idp?error=missing_assignment")
  if (selfReflection.length < 20) {
    redirect("/employee/idp?error=evidence_too_short")
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("submit_ojt_evidence", {
    p_assignment_id: assignmentId,
    p_self_reflection: selfReflection,
    p_artifact_urls: [],
  })

  if (error) redirect("/employee/idp?error=evidence_submit_failed")

  revalidatePath("/employee/idp")
  redirect("/employee/idp?updated=evidence_submitted")
}
