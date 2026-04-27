import { describe, expect, it } from "vitest"

import { buildFrameworkImpactSummary } from "@/lib/framework-editor/impact"

describe("buildFrameworkImpactSummary", () => {
  it("deduplicates IDPs and employees while preserving milestone count", () => {
    const summary = buildFrameworkImpactSummary({
      competencyCount: 3,
      ojtCatalogueCount: 2,
      elearningCatalogueCount: 1,
      milestoneRows: [
        {
          id: "m1",
          idp_id: "idp-1",
          idps: { employee_id: "emp-1" },
        },
        {
          id: "m2",
          idp_id: "idp-1",
          idps: { employee_id: "emp-1" },
        },
        {
          id: "m3",
          idp_id: "idp-2",
          idps: [{ employee_id: "emp-2" }],
        },
      ],
    })

    expect(summary).toEqual({
      competencyCount: 3,
      milestoneCount: 3,
      idpCount: 2,
      employeeCount: 2,
      ojtCatalogueCount: 2,
      elearningCatalogueCount: 1,
    })
  })

  it("handles missing joined IDP rows defensively", () => {
    const summary = buildFrameworkImpactSummary({
      competencyCount: 1,
      ojtCatalogueCount: 0,
      elearningCatalogueCount: 0,
      milestoneRows: [
        {
          id: "m1",
          idp_id: "idp-1",
          idps: null,
        },
      ],
    })

    expect(summary.employeeCount).toBe(0)
    expect(summary.idpCount).toBe(1)
  })
})
