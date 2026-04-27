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

import { getFrameworkTree } from "@/lib/data/framework"

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

describe("getFrameworkTree", () => {
  it("returns not_authenticated when there is no session", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null } })
    const r = await getFrameworkTree()
    expect(r).toEqual({ ok: false, reason: "not_authenticated" })
  })

  it("returns not_found when no active framework exists for the tenant", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock.mockImplementationOnce(() => chain({ data: null, error: null }))
    const r = await getFrameworkTree()
    expect(r).toEqual({ ok: false, reason: "not_found" })
  })

  it("surfaces a competencies query error as query_error", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({
          data: { id: "fw-1", name: "Core", version: 1, is_active: true },
          error: null,
        }),
      )
      .mockImplementationOnce(() =>
        chain({ data: null, error: { message: "thud" } }),
      )
    const r = await getFrameworkTree()
    expect(r).toEqual({ ok: false, reason: "query_error", detail: "thud" })
  })

  it("happy path: framework + nested competencies", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: null } } })
    fromMock
      .mockImplementationOnce(() =>
        chain({
          data: { id: "fw-1", name: "Core", version: 2, is_active: true },
          error: null,
        }),
      )
      .mockImplementationOnce(() =>
        chain({
          data: [
            {
              id: "lead",
              parent_id: null,
              code: "LEAD",
              name: "Leadership",
              description: null,
              category: "behavioural",
              proficiency_levels: [],
            },
            {
              id: "lead-motv",
              parent_id: "lead",
              code: "LEAD-MOTV",
              name: "Motivation",
              description: null,
              category: "behavioural",
              proficiency_levels: [],
            },
          ],
          error: null,
        }),
      )
    const r = await getFrameworkTree()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.framework.name).toBe("Core")
      expect(r.data.roots).toHaveLength(1)
      expect(r.data.roots[0].children.map((c) => c.code)).toEqual([
        "LEAD-MOTV",
      ])
    }
  })
})
