import { describe, expect, it } from "vitest"

import type { IdpDetail, IdpSummaryRow } from "@/lib/data/idps"
import {
  buildEmployeeIdpStats,
  calculateMilestoneCompletionPercent,
  formatDate,
  getNextMilestone,
  modalityLabel,
  selectEmployeeWorkspaceIdp,
  statusLabel,
} from "@/lib/employee-idp/workspace"

const baseSummary: IdpSummaryRow = {
  id: "idp-1",
  employee_id: "emp-1",
  employee_full_name: "Salma",
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
    status: "active",
    version: 1,
    narrative: null,
    narrative_source: null,
    ai_generation_metadata: null,
    generated_by_ai: false,
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

describe("selectEmployeeWorkspaceIdp", () => {
  it("returns null for an empty list", () => {
    expect(selectEmployeeWorkspaceIdp([], undefined)).toBeNull()
  })

  it("uses the requested visible IDP when present", () => {
    const rows = [
      summary({ id: "a", status: "active" }),
      summary({ id: "b", status: "draft" }),
    ]
    expect(selectEmployeeWorkspaceIdp(rows, "b")?.id).toBe("b")
  })

  it("falls back to active, then pending approval, then draft, then first", () => {
    expect(
      selectEmployeeWorkspaceIdp(
        [
          summary({ id: "draft", status: "draft" }),
          summary({ id: "active", status: "active" }),
        ],
        "missing",
      )?.id,
    ).toBe("active")

    expect(
      selectEmployeeWorkspaceIdp(
        [
          summary({ id: "completed", status: "completed" }),
          summary({ id: "pending", status: "pending_approval" }),
        ],
        undefined,
      )?.id,
    ).toBe("pending")

    expect(
      selectEmployeeWorkspaceIdp(
        [summary({ id: "only", status: "completed" })],
        undefined,
      )?.id,
    ).toBe("only")
  })
})

describe("employee IDP detail helpers", () => {
  it("counts milestones and actions by status", () => {
    const detail = {
      ...baseDetail,
      milestones: [
        milestone("m1", "completed", ["ojt"]),
        milestone("m2", "in_progress", ["coaching", "elearning"]),
        milestone("m3", "blocked", []),
      ],
    }

    expect(buildEmployeeIdpStats(detail)).toEqual({
      milestoneCount: 3,
      actionCount: 3,
      completedMilestones: 1,
      inProgressMilestones: 1,
      blockedMilestones: 1,
    })
  })

  it("calculates milestone completion percent", () => {
    expect(calculateMilestoneCompletionPercent(baseDetail)).toBe(0)
    expect(
      calculateMilestoneCompletionPercent({
        ...baseDetail,
        milestones: [
          milestone("m1", "completed", []),
          milestone("m2", "completed", []),
          milestone("m3", "in_progress", []),
        ],
      }),
    ).toBe(67)
  })

  it("returns the first milestone that is not completed or skipped", () => {
    const detail = {
      ...baseDetail,
      milestones: [
        milestone("done", "completed", []),
        milestone("skipped", "skipped", []),
        milestone("next", "in_progress", []),
      ],
    }
    expect(getNextMilestone(detail)?.milestone.id).toBe("next")
  })
})

describe("employee IDP display helpers", () => {
  it("formats status and modality labels", () => {
    expect(statusLabel("pending_approval")).toBe("Pending approval")
    expect(statusLabel("in_progress")).toBe("In progress")
    expect(modalityLabel("elearning")).toBe("eLearning")
    expect(modalityLabel("ilt")).toBe("ILT")
    expect(modalityLabel("workshop")).toBe("Workshop")
  })

  it("formats empty, invalid, and ISO dates", () => {
    expect(formatDate(null)).toBe("Not set")
    expect(formatDate("not-a-date")).toBe("Invalid date")
    expect(formatDate("2026-04-27T10:00:00Z")).toContain("2026")
  })
})

function milestone(
  id: string,
  status: "not_started" | "in_progress" | "completed" | "blocked" | "skipped",
  modalities: Array<"ojt" | "coaching" | "elearning">,
): IdpDetail["milestones"][number] {
  return {
    milestone: {
      id,
      sequence_order: 1,
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
