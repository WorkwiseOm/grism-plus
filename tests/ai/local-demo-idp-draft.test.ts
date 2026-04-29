import { describe, expect, it } from "vitest"

import { generateLocalDemoIdpDraft } from "@/lib/ai/local-demo-idp-draft"
import type { PseudonymisedEmployee } from "@/lib/security/pseudonymise"

const employee = {
  pseudonym: "Employee_DEMO1234",
  role_title: "Operations Analyst",
  target_role_title: "Operations Lead",
  department: "Operations",
  org_unit: "Field Ops",
} as unknown as PseudonymisedEmployee

describe("generateLocalDemoIdpDraft", () => {
  it("returns a guardrail-compliant local fallback draft", () => {
    const result = generateLocalDemoIdpDraft(
      {
        employee,
        targetRoleTitle: "Operations Lead",
        competencyGaps: [
          {
            competencyCode: "OPS-PLAN",
            competencyName: "Operational planning",
            category: "technical",
            currentProficiency: "Gap score at creation: 40/100",
            targetProficiency: "Target proficiency for this role",
            gapScore0To100: 40,
          },
        ],
        constraints: {
          maxMilestones: 1,
          preferredTargetDays: 90,
        },
      },
      "invalid x-api-key",
    )

    expect(result.ok).toBe(true)
    expect(result.completion.model).toBe("local-demo-fallback")
    expect(result.validation.computedBlend).toEqual({
      experience: 70,
      relationship: 20,
      formal: 10,
    })
    expect(result.draft.blendSummary).toEqual({
      experience: 70,
      relationship: 20,
      formal: 10,
    })
    expect(result.draft.milestones).toHaveLength(1)
    expect(result.draft.milestones[0]?.actions).toHaveLength(10)
  })

  it("respects the max milestone constraint", () => {
    const result = generateLocalDemoIdpDraft(
      {
        employee,
        targetRoleTitle: "Operations Lead",
        competencyGaps: [
          {
            competencyCode: "OPS-1",
            competencyName: "First competency",
            category: "technical",
            currentProficiency: "Gap score at creation: 45/100",
            targetProficiency: "Target proficiency for this role",
            gapScore0To100: 45,
          },
          {
            competencyCode: "OPS-2",
            competencyName: "Second competency",
            category: "technical",
            currentProficiency: "Gap score at creation: 55/100",
            targetProficiency: "Target proficiency for this role",
            gapScore0To100: 55,
          },
        ],
        constraints: {
          maxMilestones: 1,
        },
      },
      "provider unavailable",
    )

    expect(result.draft.milestones).toHaveLength(1)
    expect(result.draft.milestones[0]?.competencyCode).toBe("OPS-1")
  })
})
