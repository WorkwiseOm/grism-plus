import { describe, expect, it } from "vitest"

import {
  getNavItemsForRole,
  isNavItemActive,
} from "@/components/app-shell/nav-config"

describe("getNavItemsForRole", () => {
  it("ld_admin sees the L&D section with approval queue + framework editor", () => {
    const sections = getNavItemsForRole("ld_admin")
    expect(sections).toHaveLength(1)
    expect(sections[0].heading).toBe("L&D")
    expect(sections[0].items.map((i) => i.label)).toEqual([
      "Approval Queue",
      "Framework Editor",
    ])
    expect(sections[0].items.map((i) => i.href)).toEqual([
      "/admin/idps",
      "/admin/frameworks",
    ])
  })

  it("superadmin sees the same L&D section as ld_admin", () => {
    const ldAdmin = getNavItemsForRole("ld_admin")
    const superadmin = getNavItemsForRole("superadmin")
    expect(superadmin).toEqual(ldAdmin)
  })

  it("manager sees the manager team cockpit", () => {
    const sections = getNavItemsForRole("manager")
    expect(sections).toHaveLength(1)
    expect(sections[0].heading).toBe("Manager")
    expect(sections[0].items).toEqual([
      { label: "Team Cockpit", href: "/manager/team" },
    ])
  })

  it("coach sees the same manager nav as manager (Phase 1 mapping)", () => {
    const manager = getNavItemsForRole("manager")
    const coach = getNavItemsForRole("coach")
    expect(coach).toEqual(manager)
  })

  it("employee sees the IDP workspace", () => {
    const sections = getNavItemsForRole("employee")
    expect(sections).toHaveLength(1)
    expect(sections[0].heading).toBe("Employee")
    expect(sections[0].items).toEqual([
      { label: "IDP Workspace", href: "/employee/idp" },
    ])
  })

  it("returns an empty array for an unknown role string (defence-in-depth)", () => {
    const sections = getNavItemsForRole(
      "definitely_not_a_role" as unknown as Parameters<
        typeof getNavItemsForRole
      >[0],
    )
    expect(sections).toEqual([])
  })

  it("admin nav does not leak manager or employee links", () => {
    const sections = getNavItemsForRole("ld_admin")
    const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href))
    expect(allHrefs.some((h) => h.startsWith("/manager"))).toBe(false)
    expect(allHrefs.some((h) => h.startsWith("/employee"))).toBe(false)
  })

  it("manager nav does not leak admin links", () => {
    const sections = getNavItemsForRole("manager")
    const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href))
    expect(allHrefs.some((h) => h.startsWith("/admin"))).toBe(false)
  })

  it("employee nav does not leak admin or manager links", () => {
    const sections = getNavItemsForRole("employee")
    const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href))
    expect(allHrefs.some((h) => h.startsWith("/admin"))).toBe(false)
    expect(allHrefs.some((h) => h.startsWith("/manager"))).toBe(false)
  })
})

describe("isNavItemActive", () => {
  it("matches when pathname equals href", () => {
    expect(isNavItemActive("/admin/idps", "/admin/idps")).toBe(true)
  })

  it("matches when pathname is a sub-route of href", () => {
    expect(isNavItemActive("/admin/idps/abc-123", "/admin/idps")).toBe(true)
  })

  it("does not match when href is a prefix but not a path segment boundary", () => {
    // /admin/idps_archive should not match the /admin/idps nav item
    expect(isNavItemActive("/admin/idps_archive", "/admin/idps")).toBe(false)
  })

  it("does not match unrelated paths", () => {
    expect(isNavItemActive("/manager/team", "/admin/idps")).toBe(false)
  })

  it("treats root href correctly (no false positive on every path)", () => {
    expect(isNavItemActive("/admin", "/manager")).toBe(false)
  })
})
