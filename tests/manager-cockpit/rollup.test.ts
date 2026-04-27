import { describe, expect, it } from "vitest"

import type { TeamMemberRollup } from "@/lib/data/manager-team"
import {
  buildManagerCockpitStats,
  deriveMemberStatus,
  formatDate,
  selectTeamMember,
  statusLabel,
} from "@/lib/manager-cockpit/rollup"

type TeamMemberRollupOverride = Omit<
  Partial<TeamMemberRollup>,
  "employee" | "idp_counts"
> & {
  employee?: Partial<TeamMemberRollup["employee"]>
  idp_counts?: Partial<TeamMemberRollup["idp_counts"]>
}

const base: TeamMemberRollup = {
  employee: {
    id: "emp-1",
    full_name: "Sarah Chen",
    role_title: "Engineer",
    target_role_title: null,
    department: "Engineering",
  },
  idp_counts: {
    draft: 0,
    pending_approval: 0,
    active: 0,
    completed: 0,
    archived: 0,
    stalled: 0,
  },
  most_recent_idp: null,
  total_idps: 0,
}

function member(overrides: TeamMemberRollupOverride): TeamMemberRollup {
  return {
    ...base,
    ...overrides,
    employee: { ...base.employee, ...overrides.employee },
    idp_counts: { ...base.idp_counts, ...overrides.idp_counts },
  }
}

describe("buildManagerCockpitStats", () => {
  it("aggregates direct-report IDP counters", () => {
    const stats = buildManagerCockpitStats([
      member({ idp_counts: { active: 1, pending_approval: 1 }, total_idps: 2 }),
      member({
        employee: { id: "emp-2" },
        idp_counts: { stalled: 1 },
        total_idps: 1,
      }),
      member({ employee: { id: "emp-3" }, total_idps: 0 }),
    ])

    expect(stats).toEqual({
      reports: 3,
      activeIdps: 1,
      pendingApproval: 1,
      stalledIdps: 1,
      reportsWithoutIdps: 1,
    })
  })
})

describe("selectTeamMember", () => {
  it("returns null for an empty team", () => {
    expect(selectTeamMember([], undefined)).toBeNull()
  })

  it("uses the requested visible team member when present", () => {
    const rows = [
      member({ employee: { id: "a" } }),
      member({ employee: { id: "b" } }),
    ]
    expect(selectTeamMember(rows, "b")?.employee.id).toBe("b")
  })

  it("falls back to stalled, then pending, then active, then first", () => {
    expect(
      selectTeamMember(
        [
          member({ employee: { id: "active" }, idp_counts: { active: 1 } }),
          member({ employee: { id: "stalled" }, idp_counts: { stalled: 1 } }),
        ],
        "missing",
      )?.employee.id,
    ).toBe("stalled")

    expect(
      selectTeamMember(
        [
          member({ employee: { id: "empty" } }),
          member({
            employee: { id: "pending" },
            idp_counts: { pending_approval: 1 },
          }),
        ],
        undefined,
      )?.employee.id,
    ).toBe("pending")
  })
})

describe("deriveMemberStatus", () => {
  it("prioritises stalled, pending, active, then no active plan", () => {
    expect(
      deriveMemberStatus(member({ idp_counts: { stalled: 1, active: 1 } })),
    ).toEqual({ label: "Stalled", tone: "red" })
    expect(
      deriveMemberStatus(member({ idp_counts: { pending_approval: 1 } })),
    ).toEqual({ label: "Needs review", tone: "amber" })
    expect(deriveMemberStatus(member({ idp_counts: { active: 1 } }))).toEqual({
      label: "On track",
      tone: "green",
    })
    expect(deriveMemberStatus(member({}))).toEqual({
      label: "No active plan",
      tone: "slate",
    })
  })
})

describe("display helpers", () => {
  it("formats labels and dates", () => {
    expect(statusLabel("pending_approval")).toBe("Pending approval")
    expect(statusLabel("stalled")).toBe("Stalled")
    expect(formatDate(null)).toBe("Not set")
    expect(formatDate("not-a-date")).toBe("Invalid date")
    expect(formatDate("2026-04-27T10:00:00Z")).toContain("2026")
  })
})
