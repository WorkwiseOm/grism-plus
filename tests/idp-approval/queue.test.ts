import { describe, expect, it } from "vitest"

import type { IdpDetail, IdpSummaryRow } from "@/lib/data/idps"
import {
  buildActionMix,
  buildApprovalQueueStats,
  countActions,
  countMilestonesByStatus,
  formatDate,
  milestoneStatusLabel,
  modalityLabel,
  selectApprovalQueueRow,
  statusLabel,
} from "@/lib/idp-approval/queue"

const baseSummary: IdpSummaryRow = {
  id: "idp-1",
  employee_id: "emp-1",
  employee_full_name: "Aisha",
  status: "draft",
  version: 1,
  target_completion_date: null,
  approved_at: null,
  last_activity_at: null,
  generated_by_ai: false,
}

function summary(overrides: Partial<IdpSummaryRow>): IdpSummaryRow {
  return { ...baseSummary, ...overrides }
}

const baseDetail: IdpDetail = {
  idp: {
    id: "idp-1",
    tenant_id: "tenant-1",
    employee_id: "emp-1",
    status: "pending_approval",
    version: 1,
    narrative: null,
    narrative_source: null,
    generated_by_ai: true,
    target_completion_date: null,
    approved_at: null,
    approved_by: null,
    published_at: null,
    last_activity_at: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  },
  employee: null,
  milestones: [],
}

describe("selectApprovalQueueRow", () => {
  it("returns null for an empty queue", () => {
    expect(selectApprovalQueueRow([], undefined)).toBeNull()
  })

  it("returns the requested visible row when present", () => {
    const rows = [
      summary({ id: "a", status: "pending_approval" }),
      summary({ id: "b", status: "draft" }),
    ]
    expect(selectApprovalQueueRow(rows, "b")?.id).toBe("b")
  })

  it("falls back to pending approval, then draft, then first row", () => {
    expect(
      selectApprovalQueueRow(
        [
          summary({ id: "active", status: "active" }),
          summary({ id: "pending", status: "pending_approval" }),
        ],
        "missing",
      )?.id,
    ).toBe("pending")

    expect(
      selectApprovalQueueRow(
        [
          summary({ id: "active", status: "active" }),
          summary({ id: "draft", status: "draft" }),
        ],
        undefined,
      )?.id,
    ).toBe("draft")

    expect(
      selectApprovalQueueRow(
        [summary({ id: "complete", status: "completed" })],
        undefined,
      )?.id,
    ).toBe("complete")
  })
})

describe("buildApprovalQueueStats", () => {
  it("counts visible, pending, AI-generated, and stalled IDPs", () => {
    const stats = buildApprovalQueueStats([
      summary({ id: "a", status: "pending_approval", generated_by_ai: true }),
      summary({ id: "b", status: "stalled", generated_by_ai: true }),
      summary({ id: "c", status: "active", generated_by_ai: false }),
    ])
    expect(stats).toEqual({
      total: 3,
      pending: 1,
      aiGenerated: 2,
      stalled: 1,
    })
  })
})

describe("action and milestone summaries", () => {
  it("counts all actions across milestones", () => {
    const detail = detailWithActions(["ojt", "coaching"], ["elearning"])
    expect(countActions(detail)).toBe(3)
  })

  it("builds a sorted action mix with rounded percentages", () => {
    const detail = detailWithActions(["ojt", "ojt", "coaching"], ["elearning"])
    expect(buildActionMix(detail)).toEqual([
      { modality: "ojt", label: "OJT", count: 2, percentage: 50 },
      { modality: "coaching", label: "Coaching", count: 1, percentage: 25 },
      { modality: "elearning", label: "eLearning", count: 1, percentage: 25 },
    ])
  })

  it("zero-fills milestone status counts", () => {
    const detail = {
      ...baseDetail,
      milestones: [
        milestone("m1", "not_started", []),
        milestone("m2", "completed", []),
        milestone("m3", "completed", []),
      ],
    }
    expect(countMilestonesByStatus(detail)).toEqual({
      not_started: 1,
      in_progress: 0,
      completed: 2,
      blocked: 0,
      skipped: 0,
    })
  })
})

describe("display helpers", () => {
  it("formats status, milestone status, and modality labels", () => {
    expect(statusLabel("pending_approval")).toBe("Pending approval")
    expect(milestoneStatusLabel("not_started")).toBe("Not started")
    expect(modalityLabel("elearning")).toBe("eLearning")
    expect(modalityLabel("workshop")).toBe("Workshop")
  })

  it("formats empty, invalid, and ISO dates", () => {
    expect(formatDate(null)).toBe("Not set")
    expect(formatDate("not-a-date")).toBe("Invalid date")
    expect(formatDate("2026-04-27T10:00:00Z")).toContain("2026")
  })
})

function detailWithActions(
  first: Array<"ojt" | "coaching" | "elearning">,
  second: Array<"ojt" | "coaching" | "elearning">,
): IdpDetail {
  return {
    ...baseDetail,
    milestones: [
      milestone("m1", "in_progress", first),
      milestone("m2", "not_started", second),
    ],
  }
}

function milestone(
  id: string,
  status: "not_started" | "in_progress" | "completed" | "blocked" | "skipped",
  modalities: Array<"ojt" | "coaching" | "elearning">,
): IdpDetail["milestones"][number] {
  return {
    milestone: {
      id,
      sequence_order: id === "m1" ? 1 : 2,
      title: `Milestone ${id}`,
      description: null,
      gap_score_at_creation: 40,
      status,
      target_date: "2026-05-01",
      completed_at: null,
    },
    competency: null,
    actions: modalities.map((modality, index) => ({
      id: `${id}-a${index}`,
      milestone_id: id,
      modality,
      title: `${modality} action`,
      external_ref_id: null,
      external_ref_table: null,
      is_recommended_by_ai: false,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    })),
  }
}
