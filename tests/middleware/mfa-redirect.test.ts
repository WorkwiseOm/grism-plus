/**
 * MFA enforcement middleware E2E tests (Step 4 slice 2).
 *
 * Opt-in via RUN_E2E_TESTS=1 + TEST_USER_PASSWORD=<seed-pwd>.
 * Requires the Next.js dev server on localhost:3000 and the seeded test
 * user (scripts/seed_test_user.ts), who has role='ld_admin' — in the
 * default tenants.mfa_required_roles list.
 *
 * The beforeAll hook deletes all MFA factors for the test user so the
 * "no factor → enrol" redirect is deterministic. If we want to exercise
 * the "has verified factor → challenge" branch later we'll need a
 * separate fixture that can plant a verified factor without a real
 * phone scan — out of scope for slice 2.
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

  // Reset fixtures for determinism:
  //   - last_activity_at fresh so idle-timeout doesn't interfere
  //   - no MFA factors so the redirect lands on /auth/mfa/enrol
  await adminPg.query(
    `UPDATE public.user_profiles SET last_activity_at = now() WHERE email = $1`,
    [TEST_EMAIL],
  )
  const { rows } = await adminPg.query<{ id: string }>(
    `SELECT id FROM public.user_profiles WHERE email = $1`,
    [TEST_EMAIL],
  )
  if (rows.length !== 1) throw new Error(`seed user not found: ${TEST_EMAIL}`)
  await adminPg.query(`DELETE FROM auth.mfa_factors WHERE user_id = $1`, [
    rows[0].id,
  ])
})

afterAll(async () => {
  if (adminPg) await adminPg.end()
})

describe.skipIf(!RUN_E2E || !TEST_USER_PASSWORD)(
  "MFA enforcement (slice 2)",
  () => {
    it("authed aal1 ld_admin (no factor) hitting /admin redirects to /auth/mfa/enrol", async () => {
      const cookieHeader = await buildAuthedCookieHeader(
        TEST_EMAIL,
        TEST_USER_PASSWORD!,
      )
      const r = await fetch(`${BASE}/admin`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      })
      expect(r.status).toBe(307)
      expect(r.headers.get("location")).toContain("/auth/mfa/enrol")
    })

    it("authed aal1 ld_admin (no factor) hitting /employee redirects to /auth/mfa/enrol", async () => {
      // MFA enforcement catches any non-auth, non-api protected route
      // — not just the user's own role landing.
      const cookieHeader = await buildAuthedCookieHeader(
        TEST_EMAIL,
        TEST_USER_PASSWORD!,
      )
      const r = await fetch(`${BASE}/employee`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      })
      expect(r.status).toBe(307)
      expect(r.headers.get("location")).toContain("/auth/mfa/enrol")
    })

    it("authed aal1 on /auth/mfa/enrol is allowed through (MFA rule 5 exempts auth routes)", async () => {
      const cookieHeader = await buildAuthedCookieHeader(
        TEST_EMAIL,
        TEST_USER_PASSWORD!,
      )
      const r = await fetch(`${BASE}/auth/mfa/enrol`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      })
      expect(r.status).toBe(200)
      const html = await r.text()
      expect(html).toContain("Enable two-factor authentication")
    })

    it("authed aal1 on /auth/mfa/challenge is allowed through (no factor → page self-redirects via router)", async () => {
      const cookieHeader = await buildAuthedCookieHeader(
        TEST_EMAIL,
        TEST_USER_PASSWORD!,
      )
      const r = await fetch(`${BASE}/auth/mfa/challenge`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      })
      // Middleware allows the page through; the page itself handles the
      // "no verified factor" case on the client (router.push('/')).
      expect(r.status).toBe(200)
      const html = await r.text()
      expect(html).toContain("Two-factor verification")
    })
  },
)
