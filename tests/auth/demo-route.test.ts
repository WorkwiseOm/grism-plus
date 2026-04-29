/**
 * Tests for the local-only demo sign-in route's security gate.
 *
 * The route must reject before touching Supabase whenever the demo gate
 * is closed. Positive sign-in is intentionally left to local/manual smoke
 * because it needs real auth.users rows and cookie round-trips.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { POST } from "@/app/api/auth/demo-sign-in/route"

const SAVED_NODE_ENV = process.env.NODE_ENV
const SAVED_FLAG = process.env.DEMO_AUTH_RELAXED
const SAVED_AISHA = process.env.DEMO_PERSONA_AISHA_PASSWORD

function request(
  body: unknown,
  host = "localhost:3000",
  rawBody?: string,
): NextRequest {
  return new NextRequest(`http://${host}/api/auth/demo-sign-in`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host,
    },
    body: rawBody ?? JSON.stringify(body),
  })
}

beforeEach(() => {
  ;(process.env as Record<string, string>).NODE_ENV = "development"
  process.env.DEMO_AUTH_RELAXED = "true"
  delete process.env.DEMO_PERSONA_AISHA_PASSWORD
})

afterEach(() => {
  const envMut = process.env as Record<string, string | undefined>
  if (SAVED_NODE_ENV === undefined) delete envMut.NODE_ENV
  else envMut.NODE_ENV = SAVED_NODE_ENV
  if (SAVED_FLAG === undefined) delete process.env.DEMO_AUTH_RELAXED
  else process.env.DEMO_AUTH_RELAXED = SAVED_FLAG
  if (SAVED_AISHA === undefined) delete process.env.DEMO_PERSONA_AISHA_PASSWORD
  else process.env.DEMO_PERSONA_AISHA_PASSWORD = SAVED_AISHA
})

describe("POST /api/auth/demo-sign-in", () => {
  it("rejects when host is not loopback", async () => {
    const response = await POST(
      request({ personaId: "aisha" }, "grism-plus-app.vercel.app"),
    )
    expect(response.status).toBe(403)
  })

  it("rejects when NODE_ENV is production", async () => {
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    const response = await POST(request({ personaId: "aisha" }))
    expect(response.status).toBe(403)
  })

  it("rejects when DEMO_AUTH_RELAXED is unset", async () => {
    delete process.env.DEMO_AUTH_RELAXED
    const response = await POST(request({ personaId: "aisha" }))
    expect(response.status).toBe(403)
  })

  it("rejects invalid JSON", async () => {
    const response = await POST(request(null, "localhost:3000", "{"))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body.",
    })
  })

  it("rejects a missing persona id", async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Choose a demo persona first.",
    })
  })

  it("rejects an unknown persona id", async () => {
    const response = await POST(request({ personaId: "nobody" }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "That demo persona is not configured locally.",
    })
  })

  it("rejects a known persona when its local password is unset", async () => {
    const response = await POST(request({ personaId: "aisha" }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "That demo persona is not configured locally.",
    })
  })
})
