/**
 * Tests for the pure mapping/grouping/tree helpers exported by
 * src/lib/data. These are pure functions — no supabase mocks required.
 *
 * The loader functions themselves (which talk to supabase) are tested
 * separately in tests/data/<loader>.test.ts; doing the structural stuff
 * here keeps that surface small and focused on the auth/error paths.
 */
import { describe, expect, it } from "vitest"

import {
  groupIdpSummariesByStatus,
  groupActionsByMilestone,
  type IdpSummaryRow,
  type IdpDetailAction,
} from "@/lib/data/idps"
import {
  groupIdpsByEmployee,
  buildTeamMemberRollup,
} from "@/lib/data/manager-team"
import { buildCompetencyTree, type CompetencyNode } from "@/lib/data/framework"

function summary(overrides: Partial<IdpSummaryRow>): IdpSummaryRow {
  return {
    id: "idp-x",
    employee_id: "emp-x",
    employee_full_name: null,
    status: "draft",
    version: 1,
    target_completion_date: null,
    approved_at: null,
    last_activity_at: null,
    generated_by_ai: false,
    ...overrides,
  }
}

describe("groupIdpSummariesByStatus", () => {
  it("buckets each row by status, including zero-fill for empty buckets", () => {
    const rows: IdpSummaryRow[] = [
      summary({ id: "a", status: "active" }),
      summary({ id: "b", status: "active" }),
      summary({ id: "c", status: "pending_approval" }),
    ]
    const buckets = groupIdpSummariesByStatus(rows)
    expect(buckets.active.map((r) => r.id)).toEqual(["a", "b"])
    expect(buckets.pending_approval.map((r) => r.id)).toEqual(["c"])
    // every status key is present, even the empty ones
    for (const key of [
      "draft",
      "completed",
      "archived",
      "stalled",
    ] as const) {
      expect(buckets[key]).toEqual([])
    }
  })

  it("returns all-empty buckets for an empty input", () => {
    const buckets = groupIdpSummariesByStatus([])
    expect(Object.values(buckets).every((arr) => arr.length === 0)).toBe(true)
  })
})

function action(overrides: Partial<IdpDetailAction>): IdpDetailAction {
  return {
    id: "act-x",
    milestone_id: "ms-x",
    modality: "ojt",
    title: "do a thing",
    external_ref_id: null,
    external_ref_table: null,
    is_recommended_by_ai: false,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

describe("groupActionsByMilestone", () => {
  it("groups by milestone_id and preserves insertion order within a group", () => {
    const actions: IdpDetailAction[] = [
      action({ id: "a1", milestone_id: "m1" }),
      action({ id: "a2", milestone_id: "m2" }),
      action({ id: "a3", milestone_id: "m1" }),
    ]
    const map = groupActionsByMilestone(actions)
    expect(map.get("m1")?.map((a) => a.id)).toEqual(["a1", "a3"])
    expect(map.get("m2")?.map((a) => a.id)).toEqual(["a2"])
  })

  it("empty input → empty map", () => {
    expect(groupActionsByMilestone([]).size).toBe(0)
  })
})

describe("groupIdpsByEmployee", () => {
  it("groups by employee_id, preserves order, no key for absent employees", () => {
    const rows = [
      {
        id: "i1",
        employee_id: "e1",
        status: "active" as const,
        target_completion_date: null,
        last_activity_at: null,
        approved_at: null,
        created_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "i2",
        employee_id: "e2",
        status: "draft" as const,
        target_completion_date: null,
        last_activity_at: null,
        approved_at: null,
        created_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "i3",
        employee_id: "e1",
        status: "completed" as const,
        target_completion_date: null,
        last_activity_at: null,
        approved_at: null,
        created_at: "2026-04-02T00:00:00Z",
      },
    ]
    const map = groupIdpsByEmployee(rows)
    expect(map.get("e1")?.map((r) => r.id)).toEqual(["i1", "i3"])
    expect(map.get("e2")?.map((r) => r.id)).toEqual(["i2"])
    expect(map.has("e3")).toBe(false)
  })
})

describe("buildTeamMemberRollup", () => {
  const employee = {
    id: "e1",
    full_name: "Aisha Al-Balushi",
    role_title: "L&D Manager",
    target_role_title: "Head of L&D",
    department: "HR",
  }

  it("zero IDPs → counts zero, most_recent_idp null, total 0", () => {
    const rollup = buildTeamMemberRollup(employee, [])
    expect(rollup.total_idps).toBe(0)
    expect(rollup.most_recent_idp).toBeNull()
    expect(Object.values(rollup.idp_counts).every((c) => c === 0)).toBe(true)
  })

  it("counts by status and picks most recent by last_activity_at desc", () => {
    const idps = [
      {
        id: "old",
        employee_id: "e1",
        status: "completed" as const,
        target_completion_date: null,
        last_activity_at: "2026-01-01T00:00:00Z",
        approved_at: null,
        created_at: "2025-12-01T00:00:00Z",
      },
      {
        id: "newer",
        employee_id: "e1",
        status: "active" as const,
        target_completion_date: null,
        last_activity_at: "2026-04-15T00:00:00Z",
        approved_at: null,
        created_at: "2026-03-01T00:00:00Z",
      },
      {
        id: "in-between",
        employee_id: "e1",
        status: "active" as const,
        target_completion_date: null,
        last_activity_at: "2026-03-01T00:00:00Z",
        approved_at: null,
        created_at: "2026-02-01T00:00:00Z",
      },
    ]
    const rollup = buildTeamMemberRollup(employee, idps)
    expect(rollup.total_idps).toBe(3)
    expect(rollup.idp_counts.active).toBe(2)
    expect(rollup.idp_counts.completed).toBe(1)
    expect(rollup.idp_counts.draft).toBe(0)
    expect(rollup.most_recent_idp?.id).toBe("newer")
  })

  it("falls back to created_at desc when last_activity_at is equal/null", () => {
    const idps = [
      {
        id: "older-created",
        employee_id: "e1",
        status: "draft" as const,
        target_completion_date: null,
        last_activity_at: null,
        approved_at: null,
        created_at: "2026-02-01T00:00:00Z",
      },
      {
        id: "newer-created",
        employee_id: "e1",
        status: "draft" as const,
        target_completion_date: null,
        last_activity_at: null,
        approved_at: null,
        created_at: "2026-04-01T00:00:00Z",
      },
    ]
    const rollup = buildTeamMemberRollup(employee, idps)
    expect(rollup.most_recent_idp?.id).toBe("newer-created")
  })
})

describe("buildCompetencyTree", () => {
  it("nests competencies by parent_id and sorts each level by code", () => {
    const flat = [
      {
        id: "lead",
        parent_id: null,
        code: "LEAD",
        name: "Leadership",
        description: null,
        category: "behavioural" as const,
        proficiency_levels: [],
      },
      {
        id: "lead-motv",
        parent_id: "lead",
        code: "LEAD-MOTV",
        name: "Motivation",
        description: null,
        category: "behavioural" as const,
        proficiency_levels: [],
      },
      {
        id: "lead-conf",
        parent_id: "lead",
        code: "LEAD-CONF",
        name: "Conflict",
        description: null,
        category: "behavioural" as const,
        proficiency_levels: [],
      },
      {
        id: "tech",
        parent_id: null,
        code: "TECH",
        name: "Technical",
        description: null,
        category: "technical" as const,
        proficiency_levels: [],
      },
    ]
    const tree = buildCompetencyTree(flat)
    expect(tree.map((n) => n.code)).toEqual(["LEAD", "TECH"])
    const leadNode = tree.find((n) => n.code === "LEAD") as CompetencyNode
    // Children sorted by code ascending: LEAD-CONF before LEAD-MOTV.
    expect(leadNode.children.map((c) => c.code)).toEqual([
      "LEAD-CONF",
      "LEAD-MOTV",
    ])
    const techNode = tree.find((n) => n.code === "TECH") as CompetencyNode
    expect(techNode.children).toEqual([])
  })

  it("treats nodes whose parent_id is unknown as roots (partial dataset)", () => {
    const flat = [
      {
        id: "orphan",
        parent_id: "missing-parent",
        code: "X",
        name: "X",
        description: null,
        category: "knowledge" as const,
        proficiency_levels: [],
      },
    ]
    const tree = buildCompetencyTree(flat)
    expect(tree.map((n) => n.id)).toEqual(["orphan"])
    expect(tree[0].parent_id).toBe("missing-parent")
  })

  it("empty input → empty tree", () => {
    expect(buildCompetencyTree([])).toEqual([])
  })
})
