/**
 * Idle timeout middleware E2E tests (Step 4 slice 2).
 *
 * Opt-in via RUN_E2E_TESTS=1 + TEST_USER_PASSWORD=<seed-pwd>.
 * Requires the Next.js dev server on localhost:3000 and the seeded test
 * user (scripts/seed_test_user.ts).
 *
 * Exercises the real RPC and middleware against the real cloud DB; no
 * mocks. Manipulates user_profiles.last_activity_at directly via pg so
 * the tests don't have to wait real wall-clock time.
 */
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createServerClient } from "@supabase/ssr"
import pg from "pg"

const env = readFileSync(".env.local", "utf8")
const readEnv = (key: string): string => {
  const m = env.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, "m"))
  if (!m) throw new Error(`Missing ${key} in .env.local`)
  return m[1]
}

const BASE = "http://localhost:3000"
const TEST_EMAIL = "test@grism.plus"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD
const RUN_E2E = process.env.RUN_E2E_TESTS === "1"

let adminPg: pg.Client | null = null
let testUserId: string | null = null

async function buildAuthedCookieHeader(
  email: string,
  password: string,
): Promise<string> {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const cookieStore: Array<{ name: string; value: string }> = []
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const c of toSet) {
          const idx = cookieStore.findIndex((x) => x.name === c.name)
          if (idx >= 0) cookieStore[idx] = { name: c.name, value: c.value }
          else cookieStore.push({ name: c.name, value: c.value })
        }
      },
    },
  })
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return cookieStore
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ")
}

beforeAll(async () => {
  if (!RUN_E2E || !TEST_USER_PASSWORD) return
  const projectRef = new URL(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  ).hostname.split(".")[0]
  adminPg = new pg.Client({
    host: "aws-1-ap-southeast-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${projectRef}`,
    password: readEnv("SUPABASE_DB_PASSWORD"),
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  })
  await adminPg.connect()
  const { rows } = await adminPg.query<{ id: string }>(
    `SELECT id FROM public.user_profiles WHERE email = $1`,
    [TEST_EMAIL],
  )
  if (rows.length !== 1) throw new Error(`seed user not found: ${TEST_EMAIL}`)
  testUserId = rows[0].id
})

afterAll(async () => {
  if (adminPg) await adminPg.end()
})

describe.skipIf(!RUN_E2E || !TEST_USER_PASSWORD)("idle timeout (slice 2)", () => {
  it("idle-expired user is redirected to /auth/sign-in?reason=idle_timeout AND a session_expired event is written", async () => {
    const cookieHeader = await buildAuthedCookieHeader(
      TEST_EMAIL,
      TEST_USER_PASSWORD!,
    )

    // Force idle expiry: set last_activity_at to 31 minutes ago (beyond
    // the 30-minute tenant default).
    const thirtyOneMinAgo = new Date(Date.now() - 31 * 60 * 1000)
    await adminPg!.query(
      `UPDATE public.user_profiles SET last_activity_at = $1 WHERE id = $2`,
      [thirtyOneMinAgo.toISOString(), testUserId],
    )

    const preTestTime = new Date().toISOString()

    const r = await fetch(`${BASE}/admin`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    })
    expect(r.status).toBe(307)
    const location = r.headers.get("location") ?? ""
    expect(location).toContain("/auth/sign-in")
    expect(location).toContain("reason=idle_timeout")

    // Verify security_events has the session_expired row for this user.
    const { rows } = await adminPg!.query<{
      event_type: string
      metadata: { reason?: string } | null
    }>(
      `SELECT event_type, metadata FROM public.security_events
         WHERE user_id = $1
           AND event_type = 'session_expired'
           AND created_at > $2
         ORDER BY created_at DESC
         LIMIT 1`,
      [testUserId, preTestTime],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].event_type).toBe("session_expired")
    expect(rows[0].metadata).toMatchObject({ reason: "idle_timeout" })
  })

  it("last_activity_at update is throttled to at most once per minute under burst load", { timeout: 30000 }, async () => {
    const cookieHeader = await buildAuthedCookieHeader(
      TEST_EMAIL,
      TEST_USER_PASSWORD!,
    )

    // Start with a 5-minute-old activity stamp so the first request
    // triggers an update (older than the 1-minute throttle) but the
    // session is NOT idle-expired (under the 30-min threshold).
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    await adminPg!.query(
      `UPDATE public.user_profiles SET last_activity_at = $1 WHERE id = $2`,
      [fiveMinAgo.toISOString(), testUserId],
    )

    // First request — expected to update last_activity_at.
    await fetch(`${BASE}/admin`, { headers: { cookie: cookieHeader } })
    const { rows: afterFirst } = await adminPg!.query<{
      last_activity_at: Date
    }>(
      `SELECT last_activity_at FROM public.user_profiles WHERE id = $1`,
      [testUserId],
    )
    const t1 = afterFirst[0].last_activity_at.toISOString()
    // Sanity: first request did actually refresh the stamp.
    expect(t1).not.toBe(fiveMinAgo.toISOString())

    // Nine more requests in quick succession (total 10). Under the
    // throttle, none should update last_activity_at because all happen
    // within 1 minute of t1.
    for (let i = 0; i < 9; i++) {
      await fetch(`${BASE}/admin`, { headers: { cookie: cookieHeader } })
    }

    const { rows: afterAll } = await adminPg!.query<{
      last_activity_at: Date
    }>(
      `SELECT last_activity_at FROM public.user_profiles WHERE id = $1`,
      [testUserId],
    )
    const tFinal = afterAll[0].last_activity_at.toISOString()
    expect(tFinal).toBe(t1)
  })
})
