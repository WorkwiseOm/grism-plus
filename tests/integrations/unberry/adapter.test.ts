import { describe, expect, it } from "vitest"

import {
  buildUnberryImportPlan,
  validateUnberryImportInput,
  type UnberryAssessmentImportInput,
} from "@/lib/integrations/unberry/adapter"

const baseInput: UnberryAssessmentImportInput = {
  tenantId: "tenant-1",
  employeeId: "employee-1",
  externalAssessmentId: "unberry-assessment-1",
  assessmentDate: "2026-04-28",
  providerPayload: { source: "fixture" },
  competencyResults: [
    {
      competencyId: "competency-1",
      competencyCode: "OPS-1",
      score0To100: 64,
      targetScore0To100: 85,
      confidence0To100: 90,
      summary: "Strong operational baseline with planning gaps.",
    },
    {
      competencyId: "competency-2",
      competencyCode: "OPS-2",
      score0To100: 58,
    },
  ],
}

describe("validateUnberryImportInput", () => {
  it("accepts a complete manual or fixture import payload", () => {
    expect(validateUnberryImportInput(baseInput)).toEqual({
      ok: true,
      input: baseInput,
    })
  })

  it("rejects empty identifiers, bad dates, duplicate competencies, and bad scores", () => {
    const result = validateUnberryImportInput({
      tenantId: "",
      employeeId: "",
      externalAssessmentId: "",
      assessmentDate: "28/04/2026",
      competencyResults: [
        {
          competencyId: "competency-1",
          competencyCode: "OPS-1",
          score0To100: 101,
          targetScore0To100: -1,
          confidence0To100: 120,
        },
        {
          competencyId: "competency-1",
          competencyCode: "OPS-1",
          score0To100: 55,
        },
      ],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual([
        "missing_tenant",
        "missing_employee",
        "missing_external_assessment",
        "invalid_assessment_date",
        "invalid_score",
        "invalid_target_score",
        "invalid_confidence",
        "duplicate_competency",
      ])
    }
  })
})

describe("buildUnberryImportPlan", () => {
  it("maps one provider assessment into assessment, score, and progression rows", () => {
    const plan = buildUnberryImportPlan({
      input: baseInput,
      assessmentId: "assessment-1",
      createdBy: "admin-user-1",
    })

    expect(plan.assessment).toMatchObject({
      id: "assessment-1",
      tenant_id: "tenant-1",
      employee_id: "employee-1",
      source_platform: "unberry",
      assessment_date: "2026-04-28",
    })
    expect(plan.assessment.raw_data).toMatchObject({
      provider: "unberry",
      import_mode: "manual_or_fixture",
      external_assessment_id: "unberry-assessment-1",
      result_count: 2,
    })
    expect(plan.competencyScores).toHaveLength(2)
    expect(plan.competencyScores[0]).toMatchObject({
      assessment_id: "assessment-1",
      competency_id: "competency-1",
      score_0_100: 64,
      source: "unberry",
    })
    expect(plan.progressionEvents[0]).toMatchObject({
      tenant_id: "tenant-1",
      employee_id: "employee-1",
      competency_id: "competency-1",
      signal_source: "assessment",
      source_table: "assessments",
      source_id: "assessment-1",
      score_0_100: 64,
      confidence_0_100: 90,
      created_by: "admin-user-1",
    })
  })

  it("throws when asked to build from invalid input", () => {
    expect(() =>
      buildUnberryImportPlan({
        input: { ...baseInput, competencyResults: [] },
        assessmentId: "assessment-1",
      }),
    ).toThrow("Invalid Unberry import input: empty_results")
  })
})
