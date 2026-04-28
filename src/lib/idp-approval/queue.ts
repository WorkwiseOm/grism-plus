import type { Database } from "@/lib/types/database"
import type { IdpDetail, IdpSummaryRow } from "@/lib/data/idps"

type IdpStatus = Database["public"]["Enums"]["idp_status"]
type ModalityType = Database["public"]["Enums"]["modality_type"]
type MilestoneStatus = Database["public"]["Enums"]["milestone_status"]

export const APPROVAL_QUEUE_STATUS_ORDER: ReadonlyArray<IdpStatus> = [
  "pending_approval",
  "draft",
  "active",
  "stalled",
  "completed",
  "archived",
]

export const APPROVABLE_IDP_STATUSES: ReadonlyArray<IdpStatus> = [
  "pending_approval",
  "draft",
]

export type ApprovalQueueStats = {
  total: number
  pending: number
  aiGenerated: number
  stalled: number
}

export type ApprovalQueueStatusFilter = IdpStatus | "all"

export function buildApprovalQueueStats(
  rows: ReadonlyArray<IdpSummaryRow>,
): ApprovalQueueStats {
  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending_approval").length,
    aiGenerated: rows.filter((row) => row.generated_by_ai).length,
    stalled: rows.filter((row) => row.status === "stalled").length,
  }
}

export function selectApprovalQueueRow(
  rows: ReadonlyArray<IdpSummaryRow>,
  requestedId?: string | null,
): IdpSummaryRow | null {
  if (rows.length === 0) return null

  if (requestedId) {
    const requested = rows.find((row) => row.id === requestedId)
    if (requested) return requested
  }

  return (
    rows.find((row) => row.status === "pending_approval") ??
    rows.find((row) => row.status === "draft") ??
    rows[0]
  )
}

export function parseApprovalQueueStatusFilter(
  value?: string | null,
): ApprovalQueueStatusFilter {
  if (!value || value === "all") return "all"
  return isIdpStatus(value) ? value : "all"
}

export function filterApprovalQueueRows(
  rows: ReadonlyArray<IdpSummaryRow>,
  status: ApprovalQueueStatusFilter,
): IdpSummaryRow[] {
  if (status === "all") return [...rows]
  return rows.filter((row) => row.status === status)
}

export function statusLabel(status: IdpStatus): string {
  switch (status) {
    case "pending_approval":
      return "Pending approval"
    default:
      return titleCase(status)
  }
}

export function canApproveIdpStatus(status: IdpStatus): boolean {
  return APPROVABLE_IDP_STATUSES.includes(status)
}

export function milestoneStatusLabel(status: MilestoneStatus): string {
  return titleCase(status)
}

export function modalityLabel(modality: ModalityType): string {
  switch (modality) {
    case "elearning":
      return "eLearning"
    case "ojt":
      return "OJT"
    case "ilt":
      return "ILT"
    default:
      return titleCase(modality)
  }
}

export type ActionMixItem = {
  modality: ModalityType
  label: string
  count: number
  percentage: number
}

export function buildActionMix(detail: IdpDetail): ActionMixItem[] {
  const counts = new Map<ModalityType, number>()
  let total = 0

  for (const milestone of detail.milestones) {
    for (const action of milestone.actions) {
      counts.set(action.modality, (counts.get(action.modality) ?? 0) + 1)
      total += 1
    }
  }

  if (total === 0) return []

  return Array.from(counts.entries())
    .map(([modality, count]) => ({
      modality,
      label: modalityLabel(modality),
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function countActions(detail: IdpDetail): number {
  return detail.milestones.reduce(
    (sum, milestone) => sum + milestone.actions.length,
    0,
  )
}

export function countMilestonesByStatus(
  detail: IdpDetail,
): Record<MilestoneStatus, number> {
  const counts: Record<MilestoneStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
    skipped: 0,
  }

  for (const milestone of detail.milestones) {
    counts[milestone.milestone.status] += 1
  }

  return counts
}

export function formatDate(value: string | null): string {
  if (!value) return "Not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Invalid date"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part, index) =>
      index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join(" ")
}

function isIdpStatus(value: string): value is IdpStatus {
  return APPROVAL_QUEUE_STATUS_ORDER.includes(value as IdpStatus)
}
