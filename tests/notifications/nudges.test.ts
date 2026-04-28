import { describe, expect, it } from "vitest"

import {
  buildNudgeDedupeKey,
  buildNudgeInsert,
  filterNewNudges,
  planApprovalRequiredNudge,
  planMilestoneDueNudge,
  planOjtOverdueNudge,
} from "@/lib/notifications/nudges"

const approval = planApprovalRequiredNudge({
  tenantId: "tenant-1",
  recipientUserId: "admin-1",
  idpId: "idp-1",
  employeeLabel: "Employee A",
  dateKey: "2026-04-28",
})

describe("nudge planning", () => {
  it("builds deterministic dedupe keys from trigger and recipient scope", () => {
    expect(buildNudgeDedupeKey(approval)).toBe(
      "approval_required:idp:idp-1:admin-1:daily:2026-04-28",
    )
  })

  it("maps a candidate into a queued nudges_sent insert row", () => {
    expect(buildNudgeInsert(approval)).toMatchObject({
      tenant_id: "tenant-1",
      recipient_user_id: "admin-1",
      nudge_type: "approval_required",
      subject: "IDP waiting for approval",
      body: "Employee A's IDP is ready for L&D review.",
      status: "queued",
      trigger_reference: {
        entity: "idp",
        id: "idp-1",
        dedupe_window: "daily",
        date_key: "2026-04-28",
        dedupe_key: "approval_required:idp:idp-1:admin-1:daily:2026-04-28",
        metadata: { employee_label: "Employee A" },
      },
    })
  })

  it("filters out candidates already represented by existing nudges", () => {
    const fresh = planOjtOverdueNudge({
      tenantId: "tenant-1",
      recipientUserId: "manager-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Run shift handover",
      dueDate: "2026-04-27",
      dateKey: "2026-04-28",
    })

    expect(
      filterNewNudges([approval, fresh], [
        {
          trigger_reference: {
            dedupe_key: buildNudgeDedupeKey(approval),
          },
        },
      ]),
    ).toEqual([fresh])
  })

  it("deduplicates repeated candidates inside the same planning run", () => {
    expect(filterNewNudges([approval, approval], [])).toEqual([approval])
  })

  it("supports milestone-due candidate text", () => {
    const candidate = planMilestoneDueNudge({
      tenantId: "tenant-1",
      recipientUserId: "employee-1",
      milestoneId: "milestone-1",
      milestoneTitle: "Complete operating rhythm milestone",
      dueDate: "2026-05-01",
      dateKey: "2026-04-28",
    })

    expect(candidate).toMatchObject({
      type: "milestone_due",
      subject: "IDP milestone is due soon",
      body: "Complete operating rhythm milestone is due on 2026-05-01.",
    })
  })
})
