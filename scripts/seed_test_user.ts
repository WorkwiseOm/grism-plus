/**
 * Seed one tenant + one ld_admin user for Step 4 login flow verification.
 *
 * Idempotent: safe to re-run. Each run regenerates the user's password
 * (by design — re-running is how you rotate credentials during dev).
 *
 * Usage:
 *   npx tsx scripts/seed_test_user.ts
 *
 * The script prints the generated password to stdout exactly once at the
 * end. Nothing is written to any file on disk. Capture it from your
 * terminal; re-run the script if you lose it.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * SUPABASE_DB_PASSWORD from .env.local.
 */

import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
const readEnv = (key: string): string => {
  const match = env.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, 'm'))
  if (!match) throw new Error(`Missing ${key} in .env.local`)
  return match[1]
}

/**
 * 20-char password with guaranteed mix of upper/lower/digit/symbol to
 * satisfy the Supabase Auth password policy (min 12, requires all four
 * character classes). Avoids visually-ambiguous glyphs (I, l, 1, O, 0).
 */
function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digit = '23456789'
  const symbol = '!@#$%^&*-_='
  const all = upper + lower + digit + symbol
  const pick = (chars: string): string => chars[crypto.randomInt(chars.length)]

  const out: string[] = [
    pick(upper),
    pick(lower),
    pick(digit),
    pick(symbol),
    ...Array.from({ length: 16 }, () => pick(all)),
  ]
  // Fisher-Yates shuffle so guaranteed chars are not always at the front.
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

async function main(): Promise<void> {
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  const dbPassword = readEnv('SUPABASE_DB_PASSWORD')
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

  const pgClient = new pg.Client({
    host: 'aws-1-ap-southeast-2.pooler.supabase.com',
    port: 5432,
    user: `postgres.${projectRef}`,
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await pgClient.connect()

  // 1. Upsert tenant by slug (slug has UNIQUE constraint; name does not).
  const tenantSlug = 'grism-plus-test'
  const tenantName = 'Grism Plus Test Tenant'
  const tenantRes = await pgClient.query<{ id: string }>(
    `INSERT INTO public.tenants (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [tenantName, tenantSlug],
  )
  const tenantId = tenantRes.rows[0].id

  // 2. Find or create the auth user. Password is always regenerated on
  //    each run so operators who lose the password can re-run this script
  //    to rotate rather than having to reset via the dashboard.
  const email = 'test@grism.plus'
  const password = generatePassword()

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) throw listErr
  const existing = listData.users.find((u) => u.email === email)

  let userId: string
  if (existing) {
    userId = existing.id
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    })
    if (updErr) throw updErr
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) throw createErr
    if (!created.user) throw new Error('createUser returned no user')
    userId = created.user.id
  }

  // 3. Upsert user_profiles row. user_profiles.id references auth.users.id
  //    with ON DELETE CASCADE, so the id is stable across re-runs.
  await pgClient.query(
    `INSERT INTO public.user_profiles (id, tenant_id, role, full_name, email)
     VALUES ($1, $2, 'ld_admin', $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET tenant_id = EXCLUDED.tenant_id,
           role      = EXCLUDED.role,
           full_name = EXCLUDED.full_name,
           email     = EXCLUDED.email,
           updated_at = now()`,
    [userId, tenantId, 'Test LD-Admin', email],
  )

  await pgClient.end()

  // 4. Print result once. Nothing persisted to disk.
  console.log('')
  console.log('========================================')
  console.log('  SEED COMPLETE — Grism Plus test user')
  console.log('========================================')
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log(`  Role:     ld_admin`)
  console.log(`  Tenant:   ${tenantName} (slug=${tenantSlug})`)
  console.log(`  User ID:  ${userId}`)
  console.log(`  Tenant ID:${tenantId}`)
  console.log('========================================')
  console.log('  Store this password NOW — it is not saved anywhere.')
  console.log('  Re-running this script regenerates the password.')
  console.log('========================================')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
