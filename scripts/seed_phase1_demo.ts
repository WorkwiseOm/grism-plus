/**
 * Phase 1 demo seed — Arwa Energy fixture.
 *
 *   1 tenant · 21 user_profiles · 20 employees · 1 framework · 5 categories
 *   · 20 competencies · ~150–200 competency_scores · 12 IDPs (8 pending,
 *   2 active, 1 draft, 1 completed) with milestones, actions, assessments
 *   · 10 OJT activities · 10 eLearning courses · downstream enrolments
 *   and OJT assignments tied to active/completed IDPs.
 *
 * Idempotent. Re-runs upsert by natural keys; deterministic via the seed
 * variant (default 'arwa-energy-demo-v1', overridable via DEMO_SEED_VARIANT).
 *
 * Usage:
 *   npx tsx scripts/seed_phase1_demo.ts
 *
 * Persona credentials are printed once at the end. The 5 listed
 * personas (superadmin, ld_admin, 3 managers) get fresh passwords each
 * run; the other 16 users get cryptographically random passwords that
 * are generated and immediately discarded — reset from the Supabase
 * dashboard if a particular employee login is needed for a demo.
 */

import { readEnv, makePgClient, makeAdminClient, generatePassword, makeRng } from "./demo/pg"
import { TENANT, USERS, PRINTED_PERSONA_EMAILS, type DemoUser } from "./demo/personas"
import { seedFramework } from "./demo/framework"
import { seedScores, type EmployeeForScoring } from "./demo/scores"
import { seedCatalogues } from "./demo/catalogues"
import { seedAssessmentsAndIdps } from "./demo/idps"

type PersonaCredential = { full_name: string; email: string; role: DemoUser["role"]; password: string }

async function main(): Promise<void> {
  const env = readEnv()
  const pg = makePgClient(env)
  const admin = makeAdminClient(env)
  const rng = makeRng(env.seedVariant)

  await pg.connect()

  // ---------- 1. Tenant ----------
  const tenantRes = await pg.query<{ id: string }>(
    `INSERT INTO public.tenants (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [TENANT.name, TENANT.slug],
  )
  const tenantId = tenantRes.rows[0].id

  // ---------- 2. Auth users + user_profiles ----------
  const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr

  const personaCredentials: PersonaCredential[] = []
  const userProfileIdByEmail = new Map<string, string>()

  for (const u of USERS) {
    const password = generatePassword()
    const existing = existingUsers.users.find((eu) => eu.email === u.email)
    let userId: string
    if (existing) {
      userId = existing.id
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      })
      if (updErr) throw updErr
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
      })
      if (error) throw error
      if (!data.user) throw new Error(`createUser returned no user for ${u.email}`)
      userId = data.user.id
    }

    await pg.query(
      `INSERT INTO public.user_profiles (id, tenant_id, role, full_name, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET tenant_id = EXCLUDED.tenant_id,
             role = EXCLUDED.role,
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             updated_at = now()`,
      [userId, tenantId, u.role, u.full_name, u.email],
    )

    userProfileIdByEmail.set(u.email, userId)
    if (PRINTED_PERSONA_EMAILS.has(u.email)) {
      personaCredentials.push({ full_name: u.full_name, email: u.email, role: u.role, password })
    }
  }

  // ---------- 3. Employees ----------
  // Two passes: first pass creates all rows without manager_id, second pass
  // sets manager_id once everyone has an id.
  const employeeIdByEmail = new Map<string, string>()
  for (const u of USERS) {
    if (!u.has_employee_record) continue
    const userProfileId = userProfileIdByEmail.get(u.email)
    if (!userProfileId) throw new Error(`missing user_profile for ${u.email}`)

    const upsert = await pg.query<{ id: string }>(
      `INSERT INTO public.employees
         (tenant_id, user_profile_id, employee_number, full_name, email, role_title, target_role_title,
          department, org_unit, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, employee_number) DO UPDATE
         SET user_profile_id = EXCLUDED.user_profile_id,
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             role_title = EXCLUDED.role_title,
             target_role_title = EXCLUDED.target_role_title,
             department = EXCLUDED.department,
             org_unit = EXCLUDED.org_unit,
             hire_date = EXCLUDED.hire_date,
             updated_at = now()
       RETURNING id`,
      [
        tenantId,
        userProfileId,
        u.employee_number,
        u.full_name,
        u.email,
        u.role_title,
        u.target_role_title,
        u.department,
        u.org_unit,
        u.hire_date,
      ],
    )
    employeeIdByEmail.set(u.email, upsert.rows[0].id)
  }

  for (const u of USERS) {
    if (!u.has_employee_record || !u.manager_email) continue
    const employeeId = employeeIdByEmail.get(u.email)
    const managerId = employeeIdByEmail.get(u.manager_email)
    if (!employeeId || !managerId) continue
    await pg.query(`UPDATE public.employees SET manager_id = $1 WHERE id = $2`, [managerId, employeeId])
  }

  // ---------- 4. Framework + categories + competencies ----------
  const { competencyIds } = await seedFramework(pg, tenantId)

  // ---------- 5. OJT + eLearning catalogues ----------
  const catalogues = await seedCatalogues(pg, tenantId, competencyIds)

  // ---------- 6. Competency scores ----------
  const employeesForScoring: EmployeeForScoring[] = USERS
    .filter((u) => u.has_employee_record)
    .map((u) => ({
      id: employeeIdByEmail.get(u.email)!,
      role_title: u.role_title,
      email: u.email,
    }))
  const scoresTouched = await seedScores(pg, tenantId, employeesForScoring, competencyIds, rng)

  // ---------- 7. Assessments + IDPs + milestones + actions + downstream ----------
  const ldAdminUserProfileId = userProfileIdByEmail.get("aisha.albalushi@grism-demo.local")
  if (!ldAdminUserProfileId) throw new Error("ld_admin Aisha not found among user_profiles")

  const idpResult = await seedAssessmentsAndIdps({
    client: pg,
    tenantId,
    competencyIds,
    catalogues,
    employeeIdByEmail,
    ldAdminUserProfileId,
  })

  // ---------- 8. Final counts (read back for the summary) ----------
  const counts = await pg.query<{ table_name: string; count: string }>(
    `SELECT 'user_profiles'::text AS table_name, count(*)::text FROM public.user_profiles WHERE tenant_id = $1
       UNION ALL SELECT 'employees', count(*)::text FROM public.employees WHERE tenant_id = $1
       UNION ALL SELECT 'competencies', count(*)::text FROM public.competencies
                  WHERE framework_id IN (SELECT id FROM public.competency_frameworks WHERE tenant_id = $1)
       UNION ALL SELECT 'competency_scores', count(*)::text FROM public.competency_scores WHERE tenant_id = $1
       UNION ALL SELECT 'assessments', count(*)::text FROM public.assessments WHERE tenant_id = $1
       UNION ALL SELECT 'idps', count(*)::text FROM public.idps WHERE tenant_id = $1
       UNION ALL SELECT 'idp_milestones', count(*)::text FROM public.idp_milestones
                  WHERE idp_id IN (SELECT id FROM public.idps WHERE tenant_id = $1)
       UNION ALL SELECT 'idp_actions', count(*)::text FROM public.idp_actions
                  WHERE milestone_id IN (SELECT m.id FROM public.idp_milestones m
                                           JOIN public.idps i ON i.id = m.idp_id WHERE i.tenant_id = $1)
       UNION ALL SELECT 'ojt_catalogue', count(*)::text FROM public.ojt_catalogue WHERE tenant_id = $1
       UNION ALL SELECT 'elearning_catalogue', count(*)::text FROM public.elearning_catalogue WHERE tenant_id = $1
       UNION ALL SELECT 'elearning_enrolments', count(*)::text FROM public.elearning_enrolments WHERE tenant_id = $1
       UNION ALL SELECT 'ojt_assignments', count(*)::text FROM public.ojt_assignments WHERE tenant_id = $1`,
    [tenantId],
  )

  await pg.end()

  // ---------- 9. Print summary + persona credentials ----------
  const idpStatusCounts = await (async () => {
    const c = makePgClient(env)
    await c.connect()
    const r = await c.query<{ status: string; n: string }>(
      `SELECT status::text, count(*)::text AS n FROM public.idps WHERE tenant_id = $1 GROUP BY status ORDER BY status`,
      [tenantId],
    )
    await c.end()
    return r.rows
  })()

  console.log("")
  console.log("============================================================")
  console.log("  ARWA ENERGY DEMO SEED — complete")
  console.log("============================================================")
  console.log(`  Tenant: ${TENANT.name} (slug=${TENANT.slug})`)
  console.log(`  Seed variant: ${env.seedVariant}`)
  console.log("")
  console.log("  Row counts:")
  for (const row of counts.rows) {
    console.log(`    ${row.table_name.padEnd(22)} ${row.count}`)
  }
  console.log(`    competency_scores written/updated this run: ${scoresTouched}`)
  console.log("")
  console.log("  IDP status distribution:")
  for (const row of idpStatusCounts) {
    console.log(`    ${row.status.padEnd(18)} ${row.n}`)
  }
  console.log("")
  console.log("============================================================")
  console.log("  PERSONA CREDENTIALS (5 of 21 users — others discarded)")
  console.log("============================================================")
  for (const c of personaCredentials) {
    console.log(`  ${c.full_name} <${c.email}>`)
    console.log(`    role:     ${c.role}`)
    console.log(`    password: ${c.password}`)
    console.log("")
  }
  console.log("  The other 16 users (coach + 15 team employees) have")
  console.log("  random passwords that were generated and discarded;")
  console.log("  reset from Supabase dashboard if needed for a specific demo.")
  console.log("")
  console.log("  ⚠️  Demo personas with MFA-required roles (Aisha = ld_admin,")
  console.log("     Yusuf = superadmin) must enrol a TOTP authenticator at")
  console.log("     /auth/mfa/enrol on first sign-in. Plan ~5 minutes for this")
  console.log("     before any pilot demo. Khalid, Fatima, Omar (managers)")
  console.log("     sign in directly to their landing without MFA.")
  console.log("============================================================")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
