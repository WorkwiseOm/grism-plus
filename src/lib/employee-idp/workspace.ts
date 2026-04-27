import type { Database } from "@/lib/types/database"
import type { IdpDetail, IdpDetailMilestone, IdpSummaryRow } from "@/lib/data/idps"

type IdpStatus = Database["public"]["Enums"]["idp_status"]
type MilestoneStatus = Database["public"]["Enums"]["milestone_status"]
type ModalityType = Database["public"]["Enums"]["modality_type"]

export type EmployeeIdpStats = {
  milestoneCount: number
  actionCount: number
  completedMilestones: number
  inProgressMilestones: number
  blockedMilestones: number
}

export function selectEmployeeWorkspaceIdp(
  rows: ReadonlyArray<IdpSummaryRow>,
  requestedId?: string | null,
): IdpSummaryRow | null {
  if (rows.length === 0) return null

  if (requestedId) {
    const requested = rows.find((row) => row.id === requestedId)
    if (requested) return requested
  }

  return (
    rows.find((row) => row.status === "active") ??
    rows.find((row) => row.status === "pending_approval") ??
    rows.find((row) => row.status === "draft") ??
    rows[0]
  )
}

export function buildEmployeeIdpStats(detail: IdpDetail): EmployeeIdpStats {
  let actionCount = 0
  let completedMilestones = 0
  let inProgressMilestones = 0
  let blockedMilestones = 0

  for (const item of detail.milestones) {
    actionCount += item.actions.length
    if (item.milestone.status === "completed") completedMilestones += 1
    if (item.milestone.status === "in_progress") inProgressMilestones += 1
    if (item.milestone.status === "blocked") blockedMilestones += 1
  }

  return {
    milestoneCount: detail.milestones.length,
    actionCount,
    completedMilestones,
    inProgressMilestones,
    blockedMilestones,
  }
}

export function calculateMilestoneCompletionPercent(detail: IdpDetail): number {
  if (detail.milestones.length === 0) return 0
  const completed = detail.milestones.filter(
    (item) => item.milestone.status === "completed",
  ).length
  return Math.round((completed / detail.milestones.length) * 100)
}

export function getNextMilestone(
  detail: IdpDetail,
): IdpDetailMilestone | null {
  return (
    detail.milestones.find(
      (item) =>
        item.milestone.status !== "completed" &&
        item.milestone.status !== "skipped",
    ) ?? null
  )
}

export function statusLabel(status: IdpStatus | MilestoneStatus): string {
  switch (status) {
    case "pending_approval":
      return "Pending approval"
    default:
      return sentenceCase(status)
  }
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
      return sentenceCase(modality)
  }
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

function sentenceCase(value: string): string {
  return value
    .split("_")
    .map((part, index) =>
      index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join(" ")
}
