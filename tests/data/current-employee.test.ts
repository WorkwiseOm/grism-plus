import { afterEach, describe, expect, it, vi } from "vitest"

const { authGetUser, fromMock } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: authGetUser },
    from: fromMock,
  }),
}))

import { getCurrentEmployeeContext } from "@/lib/data/current-employee"

/**
 * Returns a chainable, then-able proxy that resolves to {data, error}.
 * Any method call on it returns the same proxy, so all of supabase-js's
 * chain methods (.select / .eq / .is / .order / .maybeSingle / etc.)
 * resolve to the same final response.
 */
function chain(response: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(response)
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return (
            promise[prop as keyof Promise<unknown>] as unknown as (
              ...a: unknown[]
            ) => unknown
          ).bind(promise)
        }
        return () => proxy
      },
    },
  )
  return proxy
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("getCurrentEmployeeContext", () => {
  it("returns not_authenticated when there is no session", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await getCurrentEmployeeContext()
    expect(r).toEqual({ ok: false, reason: "not_authenticated" })
  })

  it("surfaces a profile query error as query_error with the message", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b" } } })
    fromMock.mockImplementationOnce((table: string) => {
      expect(table).toBe("user_profiles")
      return chain({ data: null, error: { message: "boom" } })
    })
    const r = await getCurrentEmployeeContext()
    expect(r).toEqual({ ok: false, reason: "query_error", detail: "boom" })
  })

  it("returns profile_not_found when no user_profile row exists", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b" } } })
    fromMock.mockImplementationOnce(() => chain({ data: null, error: null }))
    const r = await getCurrentEmployeeContext()
    expect(r).toEqual({ ok: false, reason: "profile_not_found" })
  })

  it("returns ok with employee:null when profile exists but no employees row links to it", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b" } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({
          data: {
            id: "u1",
            tenant_id: "t1",
            role: "superadmin",
            full_name: "Yusuf",
            email: "y@example.com",
          },
          error: null,
        }),
      )
      .mockImplementationOnce(() => chain({ data: null, error: null }))

    const r = await getCurrentEmployeeContext()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.profile.id).toBe("u1")
      expect(r.data.profile.role).toBe("superadmin")
      expect(r.data.employee).toBeNull()
    }
  })

  it("returns ok with both profile and employee when both exist", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b" } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({
          data: {
            id: "u1",
            tenant_id: "t1",
            role: "ld_admin",
            full_name: "Aisha",
            email: "aisha@example.com",
          },
          error: null,
        }),
      )
      .mockImplementationOnce(() =>
        chain({
          data: {
            id: "emp-1",
            tenant_id: "t1",
            user_profile_id: "u1",
            full_name: "Aisha Al-Balushi",
            email: "aisha@example.com",
            employee_number: "ARW-001",
            role_title: "L&D Manager",
            target_role_title: "Head of L&D",
            department: "Human Resources",
            org_unit: "L&D",
            manager_id: null,
            hire_date: "2022-03-01",
            data_classification: "confidential",
            is_active: true,
            created_at: "2022-03-01T00:00:00Z",
            updated_at: "2022-03-01T00:00:00Z",
            deleted_at: null,
          },
          error: null,
        }),
      )

    const r = await getCurrentEmployeeContext()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.employee?.id).toBe("emp-1")
      expect(r.data.employee?.role_title).toBe("L&D Manager")
    }
  })
})
