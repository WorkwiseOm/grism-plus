import { describe, expect, it } from "vitest"

import { buildOjtAssignmentDetails } from "@/lib/data/ojt"

describe("buildOjtAssignmentDetails", () => {
  it("normalises catalogue relation shape and attaches latest evidence", () => {
    const result = buildOjtAssignmentDetails(
      [
        {
          id: "assignment-1",
          employee_id: "employee-1",
          milestone_id: "milestone-1",
          status: "evidence_submitted",
          due_date: "2026-05-01",
          assigned_at: "2026-04-01T00:00:00Z",
          ai_recommendation_reasoning: "Good fit.",
          ojt_catalogue: [
            {
              title: "Run a handover review",
              description: "Lead a supervised handover.",
              deliverable_type: "handover_note",
              effort_hours: 6,
            },
          ],
        },
      ],
      [
        {
          id: "evidence-new",
          ojt_assignment_id: "assignment-1",
          self_reflection: "Latest reflection.",
          submitted_at: "2026-04-03T00:00:00Z",
          validation_status: null,
          validated_at: null,
          validation_notes: null,
        },
        {
          id: "evidence-old",
          ojt_assignment_id: "assignment-1",
          self_reflection: "Older reflection.",
          submitted_at: "2026-04-02T00:00:00Z",
          validation_status: null,
          validated_at: null,
          validation_notes: null,
        },
      ],
    )

    expect(result).toEqual([
      {
        assignment: {
          id: "assignment-1",
          employee_id: "employee-1",
          milestone_id: "milestone-1",
          status: "evidence_submitted",
          due_date: "2026-05-01",
          assigned_at: "2026-04-01T00:00:00Z",
          ai_recommendation_reasoning: "Good fit.",
        },
        catalogue: {
          title: "Run a handover review",
          description: "Lead a supervised handover.",
          deliverable_type: "handover_note",
          effort_hours: 6,
        },
        latestEvidence: {
          id: "evidence-new",
          self_reflection: "Latest reflection.",
          submitted_at: "2026-04-03T00:00:00Z",
          validation_status: null,
          validated_at: null,
          validation_notes: null,
        },
      },
    ])
  })

  it("handles missing catalogue and evidence rows", () => {
    const result = buildOjtAssignmentDetails(
      [
        {
          id: "assignment-1",
          employee_id: "employee-1",
          milestone_id: null,
          status: "assigned",
          due_date: "2026-05-01",
          assigned_at: "2026-04-01T00:00:00Z",
          ai_recommendation_reasoning: null,
          ojt_catalogue: null,
        },
      ],
      [],
    )

    expect(result[0].catalogue).toBeNull()
    expect(result[0].latestEvidence).toBeNull()
  })
})
