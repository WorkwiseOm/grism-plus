"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/require-role"
import { canApproveIdpStatus } from "@/lib/idp-approval/queue"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

type IdpStatus = Database["public"]["Enums"]["idp_status"]

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
