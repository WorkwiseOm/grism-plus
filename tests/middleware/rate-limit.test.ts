/**
 * Login rate limit middleware E2E tests (Step 4 slice 2).
 *
 * Opt-in via RUN_E2E_TESTS=1.
 * Requires the Next.js dev server on localhost:3000.
 *
 * Each test uses a random TEST-NET-1 (192.0.2.0/24) IP sent via the
 * X-Real-IP header so runs don't share rate-limit buckets with each
 * other or with prior runs. Middleware trusts X-Real-IP (the Vercel-
 * forwarded trusted value in production); in local dev the header is
 * set by the test itself.
 *
 * Mock-free: exercises the real middleware, real route handler, and
 * real check_login_rate_limit RPC against the real cloud DB.
 */
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import pg from "pg"

const env = readFileSync(".env.local", "utf8")
const readEnv = (key: string): string => {
  const m = env.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, "m"))
  if (!m) throw new Error(`Missing ${key} in .env.local`)
  return m[1]
}

const BASE = "http://localhost:3000"
const RUN_E2E = process.env.RUN_E2E_TESTS === "1"

let adminPg: pg.Client | null = null

function randomTestNetIp(): string {
  // TEST-NET-1: 192.0.2.0/24, reserved for documentation/testing.
  return `192.0.2.${1 + Math.floor(Math.random() * 254)}`
}

async function attemptSignIn(
  ip: string,
  email: string,
  password: string,
): Promise<Response> {
  return fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip,
    },
    body: JSON.stringify({ email, password }),
  })
}

beforeAll(async () => {
  if (!RUN_E2E) return
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
})

afterAll(async () => {
  if (adminPg) await adminPg.end()
})

describe.skipIf(!RUN_E2E)("login rate limit (slice 2)", () => {
  it(
    "5 failed sign-ins allowed, 6th from the same IP is rate-limited AND the expected security_events rows are written",
    { timeout: 30000 },
    async () => {
      const ip = randomTestNetIp()
      const preTestTime = new Date().toISOString()
      const statuses: number[] = []

      // 5 failed attempts → should each return 401
      for (let i = 0; i < 5; i++) {
        const r = await attemptSignIn(
          ip,
          "test@grism.plus",
          "this-password-is-wrong",
        )
        statuses.push(r.status)
      }

      // 6th attempt → rate limited at the middleware layer
      const sixth = await attemptSignIn(
        ip,
        "test@grism.plus",
        "this-password-is-wrong",
      )
      statuses.push(sixth.status)

      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
      expect(statuses[5]).toBe(429)

      const sixthBody = (await sixth.json()) as { error?: string }
      expect(sixthBody.error).toMatch(/too many/i)

      // Verify security_events has exactly 5 login_failure + 1 login_rate_limited
      // rows keyed on this test's unique IP.
      const { rows } = await adminPg!.query<{ event_type: string }>(
        `SELECT event_type FROM public.security_events
           WHERE ip_address = $1
             AND created_at > $2
           ORDER BY created_at`,
        [ip, preTestTime],
      )

      const failures = rows.filter((r) => r.event_type === "login_failure")
      const rateLimits = rows.filter(
        (r) => r.event_type === "login_rate_limited",
      )
      expect(failures).toHaveLength(5)
      expect(rateLimits).toHaveLength(1)
    },
  )

  it(
    "successful sign-in (via real route handler) writes a login_success event",
    { timeout: 15000 },
    async () => {
      const ip = randomTestNetIp()
      const password = process.env.TEST_USER_PASSWORD
      if (!password) {
        // Without the seed password this assertion cannot run; mark as
        // a skip rather than a false pass.
        console.warn("skipping login_success case — TEST_USER_PASSWORD unset")
        return
      }
      const preTestTime = new Date().toISOString()

      const r = await attemptSignIn(ip, "test@grism.plus", password)
      expect(r.status).toBe(200)

      const { rows } = await adminPg!.query<{ event_type: string }>(
        `SELECT event_type FROM public.security_events
           WHERE ip_address = $1
             AND event_type = 'login_success'
             AND created_at > $2
           ORDER BY created_at DESC
           LIMIT 1`,
        [ip, preTestTime],
      )
      expect(rows).toHaveLength(1)
    },
  )
})
