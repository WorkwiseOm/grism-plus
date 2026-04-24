/**
 * End-to-end sign-in flow test (Step 4 slice 1).
 *
 * Opt-in via env var — does NOT run by default with `npm test` because it
 * requires a live Next.js dev server on localhost:3000 plus a seeded user.
 *
 *   Unauthenticated cases: require RUN_E2E_TESTS=1
 *   Authenticated cases:   require RUN_E2E_TESTS=1 AND TEST_USER_PASSWORD=<seed-pwd>
 *
 * Example:
 *   # Terminal 1:
 *   npm run dev
 *   # Terminal 2:
 *   npx tsx scripts/seed_test_user.ts   # capture the printed password
 *   RUN_E2E_TESTS=1 TEST_USER_PASSWORD=<pwd> npx vitest run tests/auth/sign-in-flow.test.ts
 *
 * Mock-free by design: exercises the real middleware against the real
 * cloud Supabase project. Mocked unit tests for the middleware arrive in
 * slice 2 alongside the rate-limit / MFA / idle-timeout code.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServerClient } from '@supabase/ssr'
import pg from 'pg'

const env = readFileSync('.env.local', 'utf8')
const readEnv = (key: string): string => {
  const m = env.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, 'm'))
  if (!m) throw new Error(`Missing ${key} in .env.local`)
  return m[1]
}

const BASE = 'http://localhost:3000'
const TEST_EMAIL = 'test@grism.plus'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD
const RUN_E2E = process.env.RUN_E2E_TESTS === '1'

/**
 * Sign in against cloud Supabase and return a cookie header that encodes
 * the resulting session. Uses @supabase/ssr's createServerClient with an
 * in-memory cookie store so the cookies we produce match what the real
 * Next.js middleware expects to read back.
 */
async function buildAuthedCookieHeader(email: string, password: string): Promise<string> {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const cookieStore: Array<{ name: string; value: string }> = []

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const c of toSet) {
          const existing = cookieStore.findIndex((x) => x.name === c.name)
          if (existing >= 0) cookieStore[existing] = { name: c.name, value: c.value }
          else cookieStore.push({ name: c.name, value: c.value })
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  return cookieStore
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ')
}

// Reset the test user's last_activity_at to now() at the start of this
// file so earlier vitest runs (which may have mutated last_activity_at
// via the idle-timeout tests) don't bleed over and cause the middleware
// to redirect /admin on idle expiry.
let adminPg: pg.Client | null = null
beforeAll(async () => {
  if (!RUN_E2E) return
  const projectRef = new URL(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
  ).hostname.split('.')[0]
  adminPg = new pg.Client({
    host: 'aws-1-ap-southeast-2.pooler.supabase.com',
    port: 5432,
    user: `postgres.${projectRef}`,
    password: readEnv('SUPABASE_DB_PASSWORD'),
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  await adminPg.connect()
  await adminPg.query(
    `UPDATE public.user_profiles SET last_activity_at = now() WHERE email = $1`,
    [TEST_EMAIL],
  )
})

afterAll(async () => {
  if (adminPg) await adminPg.end()
})

describe.skipIf(!RUN_E2E)('sign-in flow (slice 1)', () => {
  it('redirects unauthenticated / to /auth/sign-in', async () => {
    const r = await fetch(BASE, { redirect: 'manual' })
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toContain('/auth/sign-in')
  })

  it('serves /auth/sign-in with 200 and renders the Shadcn form', async () => {
    const r = await fetch(`${BASE}/auth/sign-in`)
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('Sign in to Grism Plus')
    expect(html).toContain('id="email"')
    expect(html).toContain('id="password"')
  })

  it('redirects unauthenticated /admin to /auth/sign-in', async () => {
    const r = await fetch(`${BASE}/admin`, { redirect: 'manual' })
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toContain('/auth/sign-in')
  })

  it.skipIf(!TEST_USER_PASSWORD)(
    'authenticated ld_admin: / redirects to /admin',
    async () => {
      const cookieHeader = await buildAuthedCookieHeader(TEST_EMAIL, TEST_USER_PASSWORD!)
      expect(cookieHeader.length).toBeGreaterThan(0)

      const r = await fetch(BASE, {
        headers: { cookie: cookieHeader },
        redirect: 'manual',
      })
      expect(r.status).toBe(307)
      expect(r.headers.get('location')).toContain('/admin')
    },
  )

  it.skipIf(!TEST_USER_PASSWORD)(
    'authenticated ld_admin: /admin returns 200 with placeholder text',
    async () => {
      const cookieHeader = await buildAuthedCookieHeader(TEST_EMAIL, TEST_USER_PASSWORD!)

      const r = await fetch(`${BASE}/admin`, {
        headers: { cookie: cookieHeader },
      })
      expect(r.status).toBe(200)
      const html = await r.text()
      expect(html).toContain('L&amp;D Admin home placeholder')
      expect(html).toContain(TEST_EMAIL)
    },
  )

  it.skipIf(!TEST_USER_PASSWORD)(
    'authenticated ld_admin: /auth/sign-in redirects to /',
    async () => {
      const cookieHeader = await buildAuthedCookieHeader(TEST_EMAIL, TEST_USER_PASSWORD!)

      const r = await fetch(`${BASE}/auth/sign-in`, {
        headers: { cookie: cookieHeader },
        redirect: 'manual',
      })
      expect(r.status).toBe(307)
      expect(r.headers.get('location')).toMatch(/\/$|\/admin/)
    },
  )
})
