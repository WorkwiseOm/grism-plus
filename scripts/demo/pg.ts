/**
 * Shared helpers for the Phase 1 demo seed.
 *
 * Reads connection details from .env.local, builds the Session-pooler
 * pg.Client + Supabase admin client, exposes a deterministic RNG seeded
 * from DEMO_SEED_VARIANT, and a fresh password generator for the
 * persona logins. Re-used across every script in scripts/demo/.
 */

import { readFileSync } from "node:fs"
import crypto from "node:crypto"
import pg from "pg"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type DemoEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  serviceRoleKey: string
  dbPassword: string
  projectRef: string
  seedVariant: string
}

export function readEnv(): DemoEnv {
  const env = readFileSync(".env.local", "utf8")
  const get = (k: string): string => {
    const m = env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, "m"))
    if (!m) throw new Error(`Missing ${k} in .env.local`)
    return m[1]
  }
  const supabaseUrl = get("NEXT_PUBLIC_SUPABASE_URL")
  return {
    supabaseUrl,
    supabaseAnonKey: get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY"),
    dbPassword: get("SUPABASE_DB_PASSWORD"),
    projectRef: new URL(supabaseUrl).hostname.split(".")[0],
    seedVariant: process.env.DEMO_SEED_VARIANT ?? "arwa-energy-demo-v1",
  }
}

export function makePgClient(env: DemoEnv): pg.Client {
  return new pg.Client({
    host: "aws-1-ap-southeast-2.pooler.supabase.com",
    port: 5432,
    user: `postgres.${env.projectRef}`,
    password: env.dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  })
}

export function makeAdminClient(env: DemoEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Cryptographically random 20-character password for the printed
 * personas. Same character classes as scripts/seed_test_user.ts so the
 * Supabase Auth password policy (min 12 + lower + upper + digit +
 * symbol) is always satisfied.
 */
export function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghjkmnpqrstuvwxyz"
  const digit = "23456789"
  const symbol = "!@#$%^&*-_="
  const all = upper + lower + digit + symbol
  const pick = (chars: string): string => chars[crypto.randomInt(chars.length)]
  const out = [
    pick(upper),
    pick(lower),
    pick(digit),
    pick(symbol),
    ...Array.from({ length: 16 }, () => pick(all)),
  ]
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join("")
}

/**
 * Mulberry32 PRNG. Seeded from a 32-bit hash of the variant string so
 * re-runs with the same DEMO_SEED_VARIANT produce identical scores,
 * IDP shapes, and modality mixes. Cryptographic strength is irrelevant
 * here; reproducibility is the point.
 */
export function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pickFrom<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

/**
 * Find by composite WHERE clause; insert if missing. Returns the row's id.
 * Used for tables without a unique constraint that maps to our natural key.
 */
export async function findOrCreateId(
  client: pg.Client,
  table: string,
  whereSql: string,
  whereParams: unknown[],
  insertColumns: string[],
  insertValues: unknown[],
): Promise<string> {
  const found = await client.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE ${whereSql} LIMIT 1`,
    whereParams,
  )
  if (found.rows.length > 0) return found.rows[0].id

  const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(", ")
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${table} (${insertColumns.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    insertValues,
  )
  return inserted.rows[0].id
}
