import type { Database } from "@/lib/types/database"
import type { TeamMemberRollup } from "@/lib/data/manager-team"

type IdpStatus = Database["public"]["Enums"]["idp_status"]

export type ManagerCockpitStats = {
  reports: number
  activeIdps: number
  pendingApproval: number
  stalledIdps: number
  reportsWithoutIdps: number
}

export function buildManagerCockpitStats(
  rows: ReadonlyArray<TeamMemberRollup>,
): ManagerCockpitStats {
  return {
    reports: rows.length,
    activeIdps: rows.reduce((sum, row) => sum + row.idp_counts.active, 0),
    pendingApproval: rows.reduce(
      (sum, row) => sum + row.idp_counts.pending_approval,
      0,
    ),
    stalledIdps: rows.reduce((sum, row) => sum + row.idp_counts.stalled, 0),
    reportsWithoutIdps: rows.filter((row) => row.total_idps === 0).length,
  }
}

export function selectTeamMember(
  rows: ReadonlyArray<TeamMemberRollup>,
  requestedEmployeeId?: string | null,
): TeamMemberRollup | null {
  if (rows.length === 0) return null

  if (requestedEmployeeId) {
    const requested = rows.find(
      (row) => row.employee.id === requestedEmployeeId,
    )
    if (requested) return requested
  }

  return (
    rows.find((row) => row.idp_counts.stalled > 0) ??
    rows.find((row) => row.idp_counts.pending_approval > 0) ??
    rows.find((row) => row.idp_counts.active > 0) ??
    rows[0]
  )
}

export function deriveMemberStatus(row: TeamMemberRollup): {
  label: string
  tone: "red" | "amber" | "green" | "slate"
} {
  if (row.idp_counts.stalled > 0) return { label: "Stalled", tone: "red" }
  if (row.idp_counts.pending_approval > 0) {
    return { label: "Needs review", tone: "amber" }
  }
  if (row.idp_counts.active > 0) return { label: "On track", tone: "green" }
  return { label: "No active plan", tone: "slate" }
}

export function statusLabel(status: IdpStatus): string {
  switch (status) {
    case "pending_approval":
      return "Pending approval"
    default:
      return sentenceCase(status)
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
