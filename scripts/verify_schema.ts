import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env.local', 'utf8')
const read = (key: string): string => {
  const match = env.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, 'm'))
  if (!match) throw new Error(`Missing ${key} in .env.local`)
  return match[1]
}

const password = read('SUPABASE_DB_PASSWORD')
const projectUrl = read('NEXT_PUBLIC_SUPABASE_URL')
const projectRef = new URL(projectUrl).hostname.split('.')[0]

// Session pooler host — grism-plus-dev is provisioned in ap-southeast-2 (Sydney).
const POOLER_HOST = 'aws-1-ap-southeast-2.pooler.supabase.com'

async function main() {
  const client = new pg.Client({
    host: POOLER_HOST,
    port: 5432,
    user: `postgres.${projectRef}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    )
    console.log(`count: ${rows.length}`)
    for (const row of rows) console.log(row.table_name)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('verify_schema failed:', err)
  process.exit(1)
})
