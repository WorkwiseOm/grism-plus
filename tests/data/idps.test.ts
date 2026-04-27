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

import { getIdpSummaryList, getIdpDetail } from "@/lib/data/idps"

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

describe("getIdpSummaryList", () => {
  it("returns not_authenticated when there is no session", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await getIdpSummaryList()
    expect(r).toEqual({ ok: false, reason: "not_authenticated" })
  })

  it("surfaces a query error as query_error", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() =>
      chain({ data: null, error: { message: "rls denied" } }),
    )
    const r = await getIdpSummaryList()
    expect(r).toEqual({ ok: false, reason: "query_error", detail: "rls denied" })
  })

  it("returns ok([]) on empty result", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() => chain({ data: [], error: null }))
    const r = await getIdpSummaryList()
    expect(r).toEqual({ ok: true, data: [] })
  })

  it("normalises the embedded employee shape (object form)", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() =>
      chain({
        data: [
          {
            id: "idp-1",
            employee_id: "emp-1",
            status: "active",
            version: 1,
            target_completion_date: null,
            approved_at: null,
            last_activity_at: "2026-04-01T00:00:00Z",
            generated_by_ai: false,
            employees: { full_name: "Aisha Al-Balushi" },
          },
        ],
        error: null,
      }),
    )
    const r = await getIdpSummaryList()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data[0].employee_full_name).toBe("Aisha Al-Balushi")
    }
  })

  it("normalises the embedded employee shape (array form, picks first)", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() =>
      chain({
        data: [
          {
            id: "idp-1",
            employee_id: "emp-1",
            status: "active",
            version: 1,
            target_completion_date: null,
            approved_at: null,
            last_activity_at: null,
            generated_by_ai: false,
            employees: [{ full_name: "Khalid" }],
          },
        ],
        error: null,
      }),
    )
    const r = await getIdpSummaryList()
    if (r.ok) expect(r.data[0].employee_full_name).toBe("Khalid")
  })
})

describe("getIdpDetail", () => {
  it("returns not_authenticated when there is no session", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await getIdpDetail("idp-x")
    expect(r).toEqual({ ok: false, reason: "not_authenticated" })
  })

  it("returns not_found when RLS hides the IDP (maybeSingle → null)", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() => chain({ data: null, error: null }))
    const r = await getIdpDetail("idp-x")
    expect(r).toEqual({ ok: false, reason: "not_found" })
  })

  it("surfaces an idp query error as query_error", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() =>
      chain({ data: null, error: { message: "kaboom" } }),
    )
    const r = await getIdpDetail("idp-x")
    expect(r).toEqual({ ok: false, reason: "query_error", detail: "kaboom" })
  })
})
