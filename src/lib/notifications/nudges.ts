import type { Database, Json } from "@/lib/types/database"

type NudgeInsert = Database["public"]["Tables"]["nudges_sent"]["Insert"]
type NudgeType = Database["public"]["Enums"]["nudge_type"]

export type NudgeCandidate = {
  tenantId: string
  recipientUserId: string
  type: NudgeType
  subject: string
  body: string
  trigger: {
    entity: "idp" | "ojt_assignment" | "milestone" | "digest"
    id: string
    dedupeWindow: "daily" | "weekly" | "once"
    dateKey: string
    metadata?: Json
  }
}

export type ExistingNudgeReference = {
  trigger_reference: Json | null
}

export function buildNudgeDedupeKey(candidate: NudgeCandidate): string {
  return [
    candidate.type,
    candidate.trigger.entity,
    candidate.trigger.id,
    candidate.recipientUserId,
    candidate.trigger.dedupeWindow,
    candidate.trigger.dateKey,
  ].join(":")
}

export function buildNudgeInsert(candidate: NudgeCandidate): NudgeInsert {
  return {
    tenant_id: candidate.tenantId,
    recipient_user_id: candidate.recipientUserId,
    nudge_type: candidate.type,
    subject: candidate.subject,
    body: candidate.body,
    status: "queued",
    trigger_reference: {
      entity: candidate.trigger.entity,
      id: candidate.trigger.id,
      dedupe_window: candidate.trigger.dedupeWindow,
      date_key: candidate.trigger.dateKey,
      dedupe_key: buildNudgeDedupeKey(candidate),
      metadata: candidate.trigger.metadata ?? null,
    },
  }
}

export function filterNewNudges(
  candidates: NudgeCandidate[],
  existingReferences: ExistingNudgeReference[],
): NudgeCandidate[] {
  const existingKeys = new Set(
    existingReferences
      .map((reference) => extractDedupeKey(reference.trigger_reference))
      .filter((key): key is string => key !== null),
  )

  const emitted = new Set<string>()
  return candidates.filter((candidate) => {
    const key = buildNudgeDedupeKey(candidate)
    if (existingKeys.has(key) || emitted.has(key)) return false
    emitted.add(key)
    return true
  })
}

export function planApprovalRequiredNudge({
  tenantId,
  recipientUserId,
  idpId,
  employeeLabel,
  dateKey,
}: {
  tenantId: string
  recipientUserId: string
  idpId: string
  employeeLabel: string
  dateKey: string
}): NudgeCandidate {
  return {
    tenantId,
    recipientUserId,
    type: "approval_required",
    subject: "IDP waiting for approval",
    body: `${employeeLabel}'s IDP is ready for L&D review.`,
    trigger: {
      entity: "idp",
      id: idpId,
      dedupeWindow: "daily",
      dateKey,
      metadata: { employee_label: employeeLabel },
    },
  }
}

export function planOjtOverdueNudge({
  tenantId,
  recipientUserId,
  assignmentId,
  assignmentTitle,
  dueDate,
  dateKey,
}: {
  tenantId: string
  recipientUserId: string
  assignmentId: string
  assignmentTitle: string
  dueDate: string
  dateKey: string
}): NudgeCandidate {
  return {
    tenantId,
    recipientUserId,
    type: "ojt_overdue",
    subject: "OJT evidence is overdue",
    body: `${assignmentTitle} was due on ${dueDate}.`,
    trigger: {
      entity: "ojt_assignment",
      id: assignmentId,
      dedupeWindow: "daily",
      dateKey,
      metadata: { due_date: dueDate, assignment_title: assignmentTitle },
    },
  }
}

export function planMilestoneDueNudge({
  tenantId,
  recipientUserId,
  milestoneId,
  milestoneTitle,
  dueDate,
  dateKey,
}: {
  tenantId: string
  recipientUserId: string
  milestoneId: string
  milestoneTitle: string
  dueDate: string
  dateKey: string
}): NudgeCandidate {
  return {
    tenantId,
    recipientUserId,
    type: "milestone_due",
    subject: "IDP milestone is due soon",
    body: `${milestoneTitle} is due on ${dueDate}.`,
    trigger: {
      entity: "milestone",
      id: milestoneId,
      dedupeWindow: "daily",
      dateKey,
      metadata: { due_date: dueDate, milestone_title: milestoneTitle },
    },
  }
}

function extractDedupeKey(reference: Json | null): string | null {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    return null
  }

  const key = reference.dedupe_key
  return typeof key === "string" ? key : null
}
