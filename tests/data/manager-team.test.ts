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

import { getManagerTeamRollup } from "@/lib/data/manager-team"

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

describe("getManagerTeamRollup", () => {
  it("returns not_authenticated when there is no session", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await getManagerTeamRollup()
    expect(r).toEqual({ ok: false, reason: "not_authenticated" })
  })

  it("returns profile_not_found when no user_profile row exists", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce((table: string) => {
      expect(table).toBe("user_profiles")
      return chain({ data: null, error: null })
    })
    const r = await getManagerTeamRollup()
    expect(r).toEqual({ ok: false, reason: "profile_not_found" })
  })

  it("returns employee_not_found when caller has no employees row", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({ data: { id: "u1", tenant_id: "t1" }, error: null }),
      )
      .mockImplementationOnce(() => chain({ data: null, error: null }))
    const r = await getManagerTeamRollup()
    expect(r).toEqual({ ok: false, reason: "employee_not_found" })
  })

  it("returns ok([]) when caller has zero direct reports", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({ data: { id: "u1", tenant_id: "t1" }, error: null }),
      )
      .mockImplementationOnce(() => chain({ data: { id: "emp-1" }, error: null }))
      .mockImplementationOnce(() => chain({ data: [], error: null }))
    const r = await getManagerTeamRollup()
    expect(r).toEqual({ ok: true, data: [] })
  })

  it("builds rollups for direct reports including IDPs", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({ data: { id: "u1", tenant_id: "t1" }, error: null }),
      )
      .mockImplementationOnce(() => chain({ data: { id: "mgr-1" }, error: null }))
      .mockImplementationOnce(() =>
        chain({
          data: [
            {
              id: "rep-1",
              full_name: "Direct Report A",
              role_title: "Engineer",
              target_role_title: null,
              department: "Eng",
            },
          ],
          error: null,
        }),
      )
      .mockImplementationOnce(() =>
        chain({
          data: [
            {
              id: "idp-1",
              employee_id: "rep-1",
              status: "active",
              target_completion_date: null,
              last_activity_at: "2026-04-01T00:00:00Z",
              approved_at: null,
              created_at: "2026-03-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      )
    const r = await getManagerTeamRollup()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toHaveLength(1)
      expect(r.data[0].employee.id).toBe("rep-1")
      expect(r.data[0].idp_counts.active).toBe(1)
      expect(r.data[0].most_recent_idp?.id).toBe("idp-1")
    }
  })
})
