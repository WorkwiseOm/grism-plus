import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const env = readFileSync('.env.local', 'utf8')
const read = (k) => {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, 'm'))
  if (!m) throw new Error(`Missing ${k} in .env.local`)
  return m[1]
}

const password = read('SUPABASE_DB_PASSWORD')
const projectUrl = read('NEXT_PUBLIC_SUPABASE_URL')
const ref = new URL(projectUrl).hostname.split('.')[0]

// Session pooler host from Supabase dashboard → Connect → Session pooler.
// Region is tied to where the project was provisioned (ap-southeast-2 / Sydney for grism-plus-dev).
const POOLER_HOST = 'aws-1-ap-southeast-2.pooler.supabase.com'

const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${POOLER_HOST}:5432/postgres`
const outPath = 'src/lib/types/database.ts'
mkdirSync(dirname(outPath), { recursive: true })

const r = spawnSync('npx', ['supabase', 'gen', 'types', 'typescript', '--db-url', dbUrl], {
  encoding: 'utf8',
  shell: true,
  stdio: ['ignore', 'pipe', 'inherit'],
})
if (r.status !== 0) process.exit(r.status ?? 1)

writeFileSync(outPath, r.stdout)
console.log(`wrote ${outPath} (${r.stdout.length} bytes)`)
