/**
 * Phase 1 schema verification — 00013_phase1_development_model.sql
 *
 * Read-only at the boundary: every check that mutates state runs inside a
 * BEGIN/ROLLBACK transaction with a SAVEPOINT for each negative test, so
 * nothing persists. The migration must already be applied to the target.
 *
 * Targets DATABASE_URL. The script does not auto-run against cloud — the
 * caller chooses the target explicitly via env.
 *
 * Typical usage:
 *
 *   # Local Supabase (run after `supabase start` and applying 00013 locally):
 *   DATABASE_URL=<local Supabase DB URL> \
 *     npx tsx scripts/verify_phase1_schema.ts
 *
 *   # Any other target (only after 00013 is applied AND operator approval):
 *   DATABASE_URL=<full session-pooler URL with creds> \
 *     npx tsx scripts/verify_phase1_schema.ts
 *
 * Exit 0 if all checks pass; 1 if any check fails; 2 on missing env.
 */
import pg from "pg"

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []

function record(name: string, pass: boolean, detail?: string): void {
  checks.push({ name, pass, detail })
}

const NEW_TABLES = [
  "development_blend_policies",
  "idp_blend_snapshots",
  "idp_action_blend_allocations",
  "skill_progression_rules",
  "skill_progression_events",
  "skill_progression_rollups",
] as const

const NEW_ENUMS: Record<string, string[]> = {
  development_blend_category: ["experience", "relationship", "formal"],
  progression_signal_source: [
    "assessment",
    "ojt_manager_feedback",
    "coaching_feedback",
    "elearning_completion",
  ],
  progression_convergence_status: [
    "insufficient",
    "emerging",
    "ready_for_review",
    "advanced",
  ],
}

async function structuralChecks(client: pg.Client): Promise<void> {
  // Tables
  for (const t of NEW_TABLES) {
    const { rows } = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = $1
       ) as exists`,
      [t],
    )
    record(`table public.${t} exists`, rows[0].exists === true)
  }

  // Enums and their values
  for (const [enumName, expected] of Object.entries(NEW_ENUMS)) {
    const { rows } = await client.query<{ enumlabel: string }>(
      `select e.enumlabel
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
         where t.typname = $1
         order by e.enumsortorder`,
      [enumName],
    )
    const got = rows.map((r) => r.enumlabel)
    const match =
      got.length === expected.length &&
      expected.every((v, i) => got[i] === v)
    record(
      `enum ${enumName} has values [${expected.join(", ")}]`,
      match,
      match ? undefined : `got [${got.join(", ")}]`,
    )
  }

  // RLS enabled on every new table
  for (const t of NEW_TABLES) {
    const { rows } = await client.query<{ relrowsecurity: boolean }>(
      `select c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = $1`,
      [t],
    )
    record(`RLS enabled on ${t}`, rows[0]?.relrowsecurity === true)
  }

  // At least 2 policies per table (one select + one admin write)
  for (const t of NEW_TABLES) {
    const { rows } = await client.query<{ count: string }>(
      `select count(*)::text as count
         from pg_policies
         where schemaname = 'public' and tablename = $1`,
      [t],
    )
    const count = parseInt(rows[0].count, 10)
    record(
      `policy count for ${t} >= 2`,
      count >= 2,
      `found ${count}`,
    )
  }

  // Critical unique-partial indexes (idempotency / one-active-per-scope)
  const expectedIndexes = [
    "uq_blend_policy_active_tenant_default",
    "uq_blend_policy_active_gap_category",
    "uq_blend_policy_active_competency",
    "uq_action_blend_allocation_active",
    "uq_progression_rule_active_tenant_default",
    "uq_progression_rule_active_gap_category",
    "uq_progression_rule_active_competency",
    "uq_progression_event_source",
    "uq_progression_rollup_per_employee_competency",
  ]
  for (const idx of expectedIndexes) {
    const { rows } = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from pg_indexes
         where schemaname = 'public' and indexname = $1
       ) as exists`,
      [idx],
    )
    record(`index ${idx} exists`, rows[0].exists === true)
  }

  // Audit triggers wired (one per new table)
  for (const t of NEW_TABLES) {
    const { rows } = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from pg_trigger
         where tgname = $1 and not tgisinternal
       ) as exists`,
      [`${t}_audit`],
    )
    record(`audit trigger ${t}_audit wired`, rows[0].exists === true)
  }
}

/**
 * Each negative test runs under a SAVEPOINT and we expect the INSERT to
 * raise. The rollback to savepoint cleans up the failed statement so the
 * outer transaction stays usable. The outer transaction itself is rolled
 * back at the end so nothing persists.
 *
 * Pre-requisite: at least one row in public.tenants. Without it we cannot
 * exercise FK-bound INSERTs. We don't seed a tenant here — keeping this
 * script free of any cleanup it might miss on crash.
 */
async function constraintChecks(client: pg.Client): Promise<void> {
  const { rows: tenantRows } = await client.query<{ id: string }>(
    `select t.id
       from public.tenants t
       where t.deleted_at is null
       order by exists (
         select 1
           from public.employees e
           join public.competency_frameworks f on f.tenant_id = e.tenant_id
           join public.competencies c on c.framework_id = f.id
          where e.tenant_id = t.id
            and e.deleted_at is null
            and f.deleted_at is null
            and c.deleted_at is null
       ) desc,
       t.id
       limit 1`,
  )
  if (tenantRows.length === 0) {
    record(
      "constraint checks",
      false,
      "no tenants exist; seed at least one before running constraint checks",
    )
    return
  }
  const tenantId = tenantRows[0].id

  await client.query("begin")
  try {
    await expectInsertFails(
      client,
      "blend pct sum != 100 rejected",
      `insert into development_blend_policies
         (tenant_id, scope, experience_pct, relationship_pct, formal_pct)
         values ($1, 'tenant_default', 50, 30, 30)`,
      [tenantId],
    )

    await expectInsertFails(
      client,
      "tenant_default scope with gap_category rejected",
      `insert into development_blend_policies
         (tenant_id, scope, gap_category, experience_pct, relationship_pct, formal_pct)
         values ($1, 'tenant_default', 'technical', 70, 20, 10)`,
      [tenantId],
    )

    await expectInsertFails(
      client,
      "competency scope without competency_id rejected",
      `insert into development_blend_policies
         (tenant_id, scope, experience_pct, relationship_pct, formal_pct)
         values ($1, 'competency', 70, 20, 10)`,
      [tenantId],
    )

    await expectInsertFails(
      client,
      "min_distinct_sources < 2 rejected",
      `insert into skill_progression_rules
         (tenant_id, scope, assessment_weight, ojt_weight, coaching_weight,
          elearning_weight, min_distinct_sources, max_single_source_contribution)
         values ($1, 'tenant_default', 0.4, 0.3, 0.2, 0.1, 1, 0.5)`,
      [tenantId],
    )

    await expectInsertFails(
      client,
      "max_single_source_contribution > 1 rejected",
      `insert into skill_progression_rules
         (tenant_id, scope, assessment_weight, ojt_weight, coaching_weight,
          elearning_weight, min_distinct_sources, max_single_source_contribution)
         values ($1, 'tenant_default', 0.4, 0.3, 0.2, 0.1, 2, 1.5)`,
      [tenantId],
    )

    // Pull a real (employee, competency) pair to satisfy progression-event FKs.
    const { rows: ec } = await client.query<{
      employee_id: string
      competency_id: string
    }>(
      `select e.id as employee_id, c.id as competency_id
         from public.employees e
         join public.competency_frameworks f on f.tenant_id = e.tenant_id
         join public.competencies c on c.framework_id = f.id
         where e.tenant_id = $1
           and e.deleted_at is null and c.deleted_at is null
         limit 1`,
      [tenantId],
    )
    if (ec.length > 0) {
      const { employee_id, competency_id } = ec[0]
      await expectInsertFails(
        client,
        "progression event with mismatched signal_source/source_table rejected",
        `insert into skill_progression_events
           (tenant_id, employee_id, competency_id,
            signal_source, source_table, source_id, signal_date)
           values ($1, $2, $3,
                   'assessment', 'ojt_evidence',
                   '00000000-0000-0000-0000-000000000001'::uuid, current_date)`,
        [tenantId, employee_id, competency_id],
      )
    } else {
      record(
        "progression event signal/source mismatch test",
        false,
        "no employees+competencies under this tenant; skip or seed first",
      )
    }
  } finally {
    await client.query("rollback")
  }
}

async function expectInsertFails(
  client: pg.Client,
  name: string,
  sql: string,
  params: unknown[],
): Promise<void> {
  await client.query("savepoint sp")
  try {
    await client.query(sql, params)
    // If we got here, the INSERT did NOT raise. That's a fail.
    await client.query("rollback to savepoint sp")
    record(name, false, "INSERT unexpectedly succeeded")
  } catch (err) {
    await client.query("rollback to savepoint sp")
    const code = (err as { code?: string }).code
    // 23514 = check_violation, 23505 = unique_violation, 23502 = not_null
    record(name, ["23514", "23505", "23502"].includes(code ?? ""), `code=${code}`)
  } finally {
    await client.query("release savepoint sp").catch(() => {
      /* savepoint already released by rollback-to */
    })
  }
}

/**
 * RLS shape checks: confirm the policies are present and that they
 * compile. Full subject/manager/admin behavior tests belong in vitest
 * E2E (tests/middleware/...) once fixtures and an applied migration
 * are available; running them inside this script would require seed
 * coupling we explicitly avoided above.
 */
async function rlsShapeChecks(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{
    tablename: string
    cmd: string | null
    qual: string | null
    with_check: string | null
  }>(
    `select tablename, cmd, qual, with_check
       from pg_policies
       where schemaname = 'public'
         and tablename = any($1)
       order by tablename, cmd`,
    [NEW_TABLES as readonly string[]],
  )

  for (const t of NEW_TABLES) {
    const policies = rows.filter((r) => r.tablename === t)
    const hasSelect = policies.some((r) => r.cmd === "SELECT" || r.cmd === "ALL")
    const hasWrite =
      policies.some((r) => r.cmd === "ALL") ||
      policies.some((r) => r.cmd === "INSERT")
    record(`${t} has at least one SELECT-capable policy`, hasSelect)
    record(`${t} has at least one write-capable policy`, hasWrite)

    // Sanity: every USING/WITH CHECK references current_tenant_id() (the
    // tenant-isolation contract). If a policy somehow omits it, that's a
    // tenant-scoping bug.
    for (const p of policies) {
      const usingHasTenant =
        p.qual?.includes("current_tenant_id()") ?? true /* SELECT-only policies always have a USING */
      const checkHasTenant =
        p.with_check === null
          ? true /* no WITH CHECK on a select-only policy is fine */
          : p.with_check.includes("current_tenant_id()")
      record(
        `policy on ${t} (${p.cmd}) references current_tenant_id()`,
        usingHasTenant && checkHasTenant,
      )
    }
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      "DATABASE_URL is required. See script header for usage. " +
        "This script does not read .env.local — pick a target explicitly.",
    )
    process.exit(2)
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    await structuralChecks(client)
    await constraintChecks(client)
    await rlsShapeChecks(client)
  } finally {
    await client.end()
  }

  let failures = 0
  for (const c of checks) {
    const tag = c.pass ? "PASS" : "FAIL"
    const detail = c.detail ? ` — ${c.detail}` : ""
    console.log(`${tag}  ${c.name}${detail}`)
    if (!c.pass) failures++
  }
  console.log()
  console.log(`${checks.length - failures}/${checks.length} passed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("verify_phase1_schema crashed:", e)
  process.exit(1)
})
