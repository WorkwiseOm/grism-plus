/**
 * Unit tests for the requireRole helper used on /admin /manager /employee.
 *
 * Mock-based — no cloud, no dev server, no MFA dependency. The cloud E2E
 * suite (tests/middleware/mfa-redirect.test.ts) already proves middleware
 * MFA enforcement runs ahead of the role guard; the positive-path E2E
 * "ld_admin reaches /admin" requires either a non-MFA test admin or a
 * verified-TOTP fixture, which is test-infra work outside this slice.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

// Hoisted mocks — declared before the import of the module under test so
// the vi.mock factories run ahead of import resolution.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // Real next/navigation throws to abort the caller; the helper relies
    // on that control-flow contract. Without throwing here, code after
    // the redirect would continue running.
    throw new Error(`__REDIRECT__:${url}`)
  }),
}))

const getUserMock = vi.fn()
const profileSingleMock = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ single: profileSingleMock }),
        }),
      }),
    }),
  }),
}))

import { requireRole } from "@/lib/auth/require-role"

afterEach(() => {
  vi.clearAllMocks()
})

async function expectRedirect(p: Promise<unknown>, target: string): Promise<void> {
  await expect(p).rejects.toThrow(`__REDIRECT__:${target}`)
}

describe("requireRole", () => {
  it("redirects to /auth/sign-in when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    await expectRedirect(requireRole(["ld_admin"]), "/auth/sign-in")
  })

  it("redirects to /auth/sign-in?error=profile_missing when profile lookup errors", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "x@y.z" } },
    })
    profileSingleMock.mockResolvedValue({
      data: null,
      error: { message: "no rows" },
    })
    await expectRedirect(
      requireRole(["ld_admin"]),
      "/auth/sign-in?error=profile_missing",
    )
  })

  it("redirects authenticated employee hitting an admin allow-list to /", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "emp@example.com" } },
    })
    profileSingleMock.mockResolvedValue({
      data: { role: "employee", tenant_id: "t-1" },
      error: null,
    })
    await expectRedirect(requireRole(["ld_admin", "superadmin"]), "/")
  })

  it("redirects authenticated manager hitting an admin allow-list to /", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "mgr@example.com" } },
    })
    profileSingleMock.mockResolvedValue({
      data: { role: "manager", tenant_id: "t-1" },
      error: null,
    })
    await expectRedirect(requireRole(["ld_admin", "superadmin"]), "/")
  })

  it("returns user + profile when role IS in the allowed list", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "admin@example.com" } },
    })
    profileSingleMock.mockResolvedValue({
      data: { role: "ld_admin", tenant_id: "t-1" },
      error: null,
    })
    const result = await requireRole(["ld_admin", "superadmin"])
    expect(result).toEqual({
      user: { id: "u1", email: "admin@example.com" },
      profile: { role: "ld_admin", tenant_id: "t-1" },
    })
  })

  it("/manager allow list ['manager'] rejects a coach", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u2", email: "coach@example.com" } },
    })
    profileSingleMock.mockResolvedValue({
      data: { role: "coach", tenant_id: "t-1" },
      error: null,
    })
    await expectRedirect(requireRole(["manager"]), "/")
  })

  it("/coach allow list ['coach'] accepts a coach", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u2", email: "coach@example.com" } },
    })
    profileSingleMock.mockResolvedValue({
      data: { role: "coach", tenant_id: "t-1" },
      error: null,
    })
    const result = await requireRole(["coach"])
    expect(result.profile.role).toBe("coach")
  })

  it("/employee allow list ['employee'] rejects a manager", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u3", email: "mgr@example.com" } },
    })
    profileSingleMock.mockResolvedValue({
      data: { role: "manager", tenant_id: "t-1" },
      error: null,
    })
    await expectRedirect(requireRole(["employee"]), "/")
  })
})
