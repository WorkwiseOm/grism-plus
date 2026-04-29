/**
 * The 12 IDPs for the Phase 1 demo, hand-designed to hit the variety
 * matrix from the approved spec across category coverage, gap
 * magnitude, originator, milestone count, and modality mix.
 *
 * Schema adaptations:
 *   - `narrative_source` is the originator proxy: 'manual' = self-
 *     initiated, 'template' = L&D-initiated. Aligned with the enum's
 *     existing values.
 *   - `ai_generation_metadata` (the only jsonb column on idps) carries
 *     `lifecycle_state` for the two `active` IDPs.
 *   - Every IDP gets a backing `assessments` row representing the data
 *     source that surfaced its gaps.
 */

import type pg from "pg"
import type { CompetencyMap } from "./framework"
import type { CatalogueIds } from "./catalogues"

export type IdpStatus = "draft" | "pending_approval" | "active" | "completed"
export type IdpModality = "elearning" | "ojt" | "coaching"
export type LifecycleState = "approved_recent" | "in_progress"

type ActionDef = {
  modality: IdpModality
  // For elearning/ojt actions, lookup_title resolves to a catalogue id
  // and external_ref. For coaching (no catalogue), provide title only.
  title: string
  catalogue: "elearning" | "ojt" | null
}

type MilestoneDef = {
  competency_code: string
  title: string
  description: string
  gap_score: number // 0-100; gap delta at creation
  actions: ReadonlyArray<ActionDef>
}

type IdpDef = {
  employee_email: string
  status: IdpStatus
  narrative: string
  narrative_source: "manual" | "template"
  target_days_out: number
  approved_days_ago: number | null
  lifecycle_state: LifecycleState | null
  /** For active in_progress: how many of the IDP's actions are marked completed. */
  completed_action_count: number
  milestones: ReadonlyArray<MilestoneDef>
}

const elearning = (title: string): ActionDef => ({ modality: "elearning", title, catalogue: "elearning" })
const ojt = (title: string): ActionDef => ({ modality: "ojt", title, catalogue: "ojt" })
const coaching = (title: string): ActionDef => ({ modality: "coaching", title, catalogue: null })

export const IDP_DEFINITIONS: ReadonlyArray<IdpDef> = [
  // ============ pending_approval × 8 ============
  {
    // 1: Layla — Ops Trainee — TECH-IND, gap-2, L&D template, 4ms, eLearning-heavy
    employee_email: "layla.albusaidi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "template",
    narrative: "Onboarding pathway from Operations Trainee to Junior Operations Analyst. Foundation in industry context plus introductory analytical and presentation skills.",
    target_days_out: 120,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "TECH-IND", title: "Build core energy industry knowledge", description: "Develop a working mental model of the GCC energy value chain.", gap_score: 50,
        actions: [elearning("Energy industry primer (GCC context)"), elearning("SAP for operations analysts")] },
      { competency_code: "TECH-DATA", title: "Develop basic data analysis", description: "Pull, transform, and visualise simple operational datasets.", gap_score: 40,
        actions: [elearning("Data analysis with Power BI"), ojt("Build and present a data-driven status report")] },
      { competency_code: "COMM-PRES", title: "Establish presentation foundations", description: "Practise delivering structured short-form updates.", gap_score: 30,
        actions: [coaching("Bi-weekly presentation feedback with Maryam (coach)")] },
      { competency_code: "TECH-IND", title: "Field exposure", description: "Translate classroom learning into observed operational reality.", gap_score: 50,
        actions: [ojt("Shadow a senior engineer for one operational shift")] },
    ],
  },
  {
    // 2: Saif — Jr Ops Analyst — TECH-DATA, gap-1, Self, 2ms, eLearning-heavy
    employee_email: "saif.alhabsi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "manual",
    narrative: "I want to deepen my data tooling so I can take on more complex reporting work for the Operations team.",
    target_days_out: 90,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "TECH-DATA", title: "Advanced data analysis", description: "Move from basic queries to multi-source dashboards.", gap_score: 25,
        actions: [elearning("Data analysis with Power BI"), elearning("SAP for operations analysts")] },
      { competency_code: "TECH-TOOL", title: "Tool proficiency depth", description: "Operate ops-specific tooling without supervision.", gap_score: 25,
        actions: [elearning("SAP for operations analysts"), ojt("Build and present a data-driven status report")] },
    ],
  },
  {
    // 3: Hamed — Ops Coordinator — COMM-XFN, gap-2, Self, 4ms, OJT-heavy
    employee_email: "hamed.alkindi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "manual",
    narrative: "I'm coordinating across teams more often and I want to do it well, with broader stakeholder reach and stronger conflict-handling.",
    target_days_out: 150,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "COMM-XFN", title: "Lead cross-functional alignments", description: "Convene and decide across function boundaries.", gap_score: 40,
        actions: [ojt("Facilitate a cross-functional alignment meeting"), ojt("Run a stakeholder mapping exercise for an upcoming initiative")] },
      { competency_code: "COMM-PRES", title: "Strengthen presentation impact", description: "Move from informational to persuasive presentations.", gap_score: 30,
        actions: [ojt("Present a quarterly results summary to a leadership audience"), elearning("Effective stakeholder communication")] },
      { competency_code: "LEAD-CONF", title: "Address conflict directly", description: "Surface disagreements early; broker durable resolutions.", gap_score: 40,
        actions: [ojt("Facilitate a cross-functional alignment meeting")] },
      { competency_code: "COMM-EXT", title: "External counterparty engagement", description: "Practise structured external relationship management.", gap_score: 35,
        actions: [coaching("Monthly external engagement coaching with Maryam")] },
    ],
  },
  {
    // 4: Sultan — Process Engineer — ANLY-RCA, gap-2, Self, 4ms, Balanced
    employee_email: "sultan.albattashi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "manual",
    narrative: "I want to lead RCAs and process improvement work end-to-end, including the writing-up that turns analysis into action.",
    target_days_out: 120,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "ANLY-RCA", title: "Root cause analysis fluency", description: "Apply structured RCA methods to real incidents.", gap_score: 40,
        actions: [elearning("Root cause analysis fundamentals"), ojt("Lead a root-cause investigation of a recent incident")] },
      { competency_code: "ANLY-CRIT", title: "Sharpen critical evaluation", description: "Distinguish evidence from assumption in analytical work.", gap_score: 30,
        actions: [elearning("Decision-making under uncertainty")] },
      { competency_code: "ANLY-PROC", title: "Drive process change to completion", description: "Turn analytical insight into a delivered process change.", gap_score: 35,
        actions: [ojt("Write up a process improvement proposal")] },
      { competency_code: "TECH-WRIT", title: "Improve technical writing", description: "Produce clearer, more actionable technical documents.", gap_score: 25,
        actions: [coaching("Bi-weekly technical writing review with Maryam")] },
    ],
  },
  {
    // 5: Najla — Mech Engineer — BIZ-PM, gap-1, L&D template, 2ms, OJT-heavy
    employee_email: "najla.alfarsi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "template",
    narrative: "Project leadership track. Builds the planning + risk-handling foundation expected of a Senior Mechanical Engineer.",
    target_days_out: 90,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "BIZ-PM", title: "Plan and lead a 4-week deliverable", description: "Own a real upcoming deliverable end-to-end.", gap_score: 25,
        actions: [ojt("Draft a project plan for a 4-week deliverable"), ojt("Lead a weekly team standup for four consecutive weeks")] },
      { competency_code: "BIZ-RISK", title: "Build risk awareness", description: "Surface, track, and mitigate project risk explicitly.", gap_score: 25,
        actions: [ojt("Draft a project plan for a 4-week deliverable"), elearning("Project management essentials")] },
    ],
  },
  {
    // 6: Maha — Eng Trainee — TECH-WRIT, gap-2, Self, 2ms, eLearning-heavy
    employee_email: "maha.alhashmi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "manual",
    narrative: "I want to be writing engineering documents at the level my team expects from non-trainees within six months.",
    target_days_out: 100,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "TECH-WRIT", title: "Foundation in technical writing", description: "Produce clear, well-structured engineering documents.", gap_score: 50,
        actions: [elearning("Technical writing for engineers"), elearning("Effective stakeholder communication")] },
      { competency_code: "COMM-WRIT", title: "Generalise writing across audiences", description: "Adapt tone and structure for non-engineering readers.", gap_score: 40,
        actions: [elearning("Effective stakeholder communication"), ojt("Write up a process improvement proposal")] },
    ],
  },
  {
    // 7: Khadija — Commercial Analyst — LEAD-PERF, gap-1, L&D template, 4ms, Balanced
    employee_email: "khadija.alzadjali@grism-demo.local",
    status: "pending_approval",
    narrative_source: "template",
    narrative: "Step-up to Senior Commercial Analyst with people-leadership readiness. Combines individual development with light leadership exposure.",
    target_days_out: 150,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "LEAD-PERF", title: "Establish performance management foundations", description: "Set expectations and provide direct feedback.", gap_score: 25,
        actions: [ojt("Mentor a trainee through their first independent task"), elearning("Coaching for first-time managers")] },
      { competency_code: "LEAD-COACH", title: "Develop coaching practice", description: "Apply structured coaching frameworks with peers.", gap_score: 30,
        actions: [elearning("Coaching for first-time managers")] },
      { competency_code: "LEAD-MOTV", title: "Sustain team motivation", description: "Maintain engagement across a small group.", gap_score: 25,
        actions: [ojt("Lead a weekly team standup for four consecutive weeks")] },
      { competency_code: "COMM-XFN", title: "Cross-functional collaboration depth", description: "Increase reach and effectiveness across functions.", gap_score: 25,
        actions: [coaching("Monthly cross-functional working group with Maryam")] },
    ],
  },
  {
    // 8: Bader — Commercial Trainee — BIZ-FIN, gap-2, Self, 2ms, OJT-heavy
    employee_email: "bader.alrawahi@grism-demo.local",
    status: "pending_approval",
    narrative_source: "manual",
    narrative: "I want to be confident reading and using financial information by the time I move out of the trainee programme.",
    target_days_out: 120,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "BIZ-FIN", title: "Build financial literacy foundation", description: "Read financial statements; interpret commercial KPIs.", gap_score: 50,
        actions: [ojt("Build and present a data-driven status report"), ojt("Run a stakeholder mapping exercise for an upcoming initiative")] },
      { competency_code: "BIZ-STRAT", title: "Connect tasks to commercial strategy", description: "Trace daily work to commercial outcomes.", gap_score: 40,
        actions: [ojt("Present a quarterly results summary to a leadership audience"), elearning("Financial literacy for non-finance professionals")] },
    ],
  },

  // ============ active × 2 ============
  {
    // 9: Salma — Sr Ops Analyst — BIZ-STRAT — approved_recent 2 days ago, balanced
    employee_email: "salma.alriyami@grism-demo.local",
    status: "active",
    narrative_source: "template",
    narrative: "Step-up to Operations Manager. Builds strategic thinking and broader leadership exposure on top of strong analytical foundation.",
    target_days_out: 180,
    approved_days_ago: 2,
    lifecycle_state: "approved_recent",
    completed_action_count: 0,
    milestones: [
      { competency_code: "BIZ-STRAT", title: "Connect operations to enterprise strategy", description: "Frame operations work in commercial-strategy terms.", gap_score: 30,
        actions: [elearning("Energy industry primer (GCC context)"), ojt("Present a quarterly results summary to a leadership audience")] },
      { competency_code: "LEAD-COACH", title: "Develop direct-report coaching", description: "Practise coaching one direct report through a stretch task.", gap_score: 25,
        actions: [ojt("Mentor a trainee through their first independent task")] },
      { competency_code: "BIZ-PM", title: "Lead a multi-team project", description: "Plan and run a project crossing two ops sub-teams.", gap_score: 25,
        actions: [ojt("Draft a project plan for a 4-week deliverable"), elearning("Project management essentials")] },
    ],
  },
  {
    // 10: Mohammed — Sr Mech Engineer — LEAD-COACH — in_progress 21 days ago, balanced, 50% actions complete
    employee_email: "mohammed.almawali@grism-demo.local",
    status: "active",
    narrative_source: "template",
    narrative: "Engineering Manager track. Translates strong technical capability into people-leadership and project ownership.",
    target_days_out: 200,
    approved_days_ago: 21,
    lifecycle_state: "in_progress",
    completed_action_count: 3, // mark first 3 actions completed
    milestones: [
      { competency_code: "LEAD-COACH", title: "Coach junior engineers", description: "Active coaching of 2 junior engineers through stretch work.", gap_score: 30,
        actions: [elearning("Coaching for first-time managers"), ojt("Mentor a trainee through their first independent task")] },
      { competency_code: "LEAD-PERF", title: "Performance management practice", description: "Run light-touch performance conversations with directs.", gap_score: 25,
        actions: [elearning("Coaching for first-time managers"), ojt("Lead a weekly team standup for four consecutive weeks")] },
      { competency_code: "BIZ-STRAT", title: "Develop engineering-strategic alignment", description: "Connect engineering decisions to commercial signals.", gap_score: 25,
        actions: [coaching("Monthly strategic-thinking session with Maryam"), elearning("Energy industry primer (GCC context)")] },
    ],
  },

  // ============ draft × 1 ============
  {
    // 11: Noura — Field Ops Specialist — ANLY-DEC, Self draft
    employee_email: "noura.alwahaibi@grism-demo.local",
    status: "draft",
    narrative_source: "manual",
    narrative: "Working draft. Want to get more confident making decisions on partial information in the field.",
    target_days_out: 90,
    approved_days_ago: null,
    lifecycle_state: null,
    completed_action_count: 0,
    milestones: [
      { competency_code: "ANLY-DEC", title: "Decision-making with partial information", description: "Practise making and explaining timely decisions in the field.", gap_score: 35,
        actions: [elearning("Decision-making under uncertainty")] },
      { competency_code: "BIZ-RISK", title: "Risk identification habit", description: "Surface and escalate operational risks earlier.", gap_score: 30,
        actions: [ojt("Run a stakeholder mapping exercise for an upcoming initiative")] },
    ],
  },

  // ============ completed × 1 ============
  {
    // 12: Hessa — Logistics Coordinator — TECH-TOOL, L&D template, completed 90 days ago
    employee_email: "hessa.altoubi@grism-demo.local",
    status: "completed",
    narrative_source: "template",
    narrative: "Tooling step-change for the logistics function. Closed cycle — moved Hessa from spreadsheet-heavy work onto SAP-native workflows.",
    target_days_out: -10, // already past
    approved_days_ago: 90,
    lifecycle_state: null,
    completed_action_count: 99, // sentinel meaning "all actions complete"
    milestones: [
      { competency_code: "TECH-TOOL", title: "SAP fluency for logistics", description: "Move primary workflow from spreadsheets to SAP.", gap_score: 30,
        actions: [elearning("SAP for operations analysts"), ojt("Build and present a data-driven status report")] },
      { competency_code: "TECH-DATA", title: "Data analysis stretch", description: "Build first multi-source logistics dashboard.", gap_score: 25,
        actions: [elearning("Data analysis with Power BI")] },
      { competency_code: "ANLY-PROC", title: "Process improvement deliverable", description: "One concrete process change shipped during cycle.", gap_score: 20,
        actions: [ojt("Write up a process improvement proposal")] },
    ],
  },
]

// ============================================================================

type SeedContext = {
  client: pg.Client
  tenantId: string
  competencyIds: CompetencyMap
  catalogues: CatalogueIds
  employeeIdByEmail: Map<string, string>
  ldAdminUserProfileId: string // Aisha's user_profile.id, for approved_by
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString()
}

function daysAgoDate(days: number): string {
  return daysAgoIso(days).slice(0, 10)
}

export async function seedAssessmentsAndIdps(
  ctx: SeedContext,
): Promise<{ idpCount: number; milestoneCount: number; actionCount: number; assessmentCount: number; enrolmentCount: number; ojtAssignmentCount: number }> {
  let idpCount = 0
  let milestoneCount = 0
  let actionCount = 0
  let assessmentCount = 0
  let enrolmentCount = 0
  let ojtAssignmentCount = 0

  for (const def of IDP_DEFINITIONS) {
    const employeeId = ctx.employeeIdByEmail.get(def.employee_email)
    if (!employeeId) throw new Error(`Unknown employee email: ${def.employee_email}`)

    // 1. Assessment row that "drove" this IDP — created at IDP creation time.
    const assessmentDate = daysAgoDate(def.approved_days_ago != null ? def.approved_days_ago + 7 : 5)
    const assessmentFound = await ctx.client.query<{ id: string }>(
      `SELECT id FROM public.assessments
         WHERE tenant_id = $1 AND employee_id = $2 AND source_platform = $3 AND assessment_date = $4
         LIMIT 1`,
      [ctx.tenantId, employeeId, "Manual demo seed", assessmentDate],
    )
    let assessmentId: string
    if (assessmentFound.rows.length > 0) {
      assessmentId = assessmentFound.rows[0].id
    } else {
      const inserted = await ctx.client.query<{ id: string }>(
        `INSERT INTO public.assessments (tenant_id, employee_id, source_platform, assessment_date, raw_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          ctx.tenantId,
          employeeId,
          "Manual demo seed",
          assessmentDate,
          JSON.stringify({ note: "Synthetic assessment generated for demo seed." }),
        ],
      )
      assessmentId = inserted.rows[0].id
      assessmentCount++
    }

    // 2. IDP row (one per employee, version 1).
    const aiMetadata = def.lifecycle_state ? { lifecycle_state: def.lifecycle_state } : null
    const approvedAt = def.approved_days_ago != null ? daysAgoIso(def.approved_days_ago) : null
    const approvedBy = def.approved_days_ago != null ? ctx.ldAdminUserProfileId : null
    const targetCompletionDate = daysAgoDate(-def.target_days_out)

    const idpFound = await ctx.client.query<{ id: string }>(
      `SELECT id FROM public.idps WHERE employee_id = $1 AND version = 1 LIMIT 1`,
      [employeeId],
    )
    let idpId: string
    if (idpFound.rows.length > 0) {
      idpId = idpFound.rows[0].id
      await ctx.client.query(
        `UPDATE public.idps
           SET status = $1, narrative = $2, narrative_source = $3, target_completion_date = $4,
               approved_by = $5, approved_at = $6, ai_generation_metadata = $7, updated_at = now()
           WHERE id = $8`,
        [def.status, def.narrative, def.narrative_source, targetCompletionDate, approvedBy, approvedAt, aiMetadata ? JSON.stringify(aiMetadata) : null, idpId],
      )
    } else {
      const inserted = await ctx.client.query<{ id: string }>(
        `INSERT INTO public.idps
           (tenant_id, employee_id, version, status, narrative, narrative_source,
            target_completion_date, approved_by, approved_at, ai_generation_metadata)
         VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [ctx.tenantId, employeeId, def.status, def.narrative, def.narrative_source, targetCompletionDate, approvedBy, approvedAt, aiMetadata ? JSON.stringify(aiMetadata) : null],
      )
      idpId = inserted.rows[0].id
      idpCount++
    }

    // 3. Milestones + actions.
    let actionsSeenForIdp = 0
    for (let i = 0; i < def.milestones.length; i++) {
      const m = def.milestones[i]
      const competencyId = ctx.competencyIds.get(m.competency_code)
      if (!competencyId) throw new Error(`Unknown competency code: ${m.competency_code}`)

      const milestoneTargetDate = daysAgoDate(-(def.target_days_out - (def.milestones.length - i) * 14))

      // Milestone status mapping per IDP state:
      let milestoneStatus: "not_started" | "in_progress" | "completed" = "not_started"
      let milestoneCompletedAt: string | null = null
      if (def.status === "completed") {
        milestoneStatus = "completed"
        milestoneCompletedAt = daysAgoIso(Math.max(1, (def.approved_days_ago ?? 90) - (def.milestones.length - i) * 5))
      } else if (def.status === "active" && def.lifecycle_state === "in_progress") {
        // Mark earlier milestones as completed/in_progress to match completed_action_count.
        const cumulativeActionsBeforeThis = def.milestones
          .slice(0, i)
          .reduce((acc, prev) => acc + prev.actions.length, 0)
        if (cumulativeActionsBeforeThis < def.completed_action_count) {
          const actionsAfterThis = cumulativeActionsBeforeThis + m.actions.length
          if (actionsAfterThis <= def.completed_action_count) {
            milestoneStatus = "completed"
            milestoneCompletedAt = daysAgoIso(Math.max(1, def.approved_days_ago! - (def.milestones.length - i) * 5))
          } else {
            milestoneStatus = "in_progress"
          }
        }
      }

      const milestoneFound = await ctx.client.query<{ id: string }>(
        `SELECT id FROM public.idp_milestones WHERE idp_id = $1 AND sequence_order = $2 LIMIT 1`,
        [idpId, i + 1],
      )
      let milestoneId: string
      if (milestoneFound.rows.length > 0) {
        milestoneId = milestoneFound.rows[0].id
        await ctx.client.query(
          `UPDATE public.idp_milestones
             SET competency_id = $1, title = $2, description = $3, gap_score_at_creation = $4,
                 status = $5, target_date = $6, completed_at = $7, updated_at = now()
             WHERE id = $8`,
          [competencyId, m.title, m.description, m.gap_score, milestoneStatus, milestoneTargetDate, milestoneCompletedAt, milestoneId],
        )
      } else {
        const inserted = await ctx.client.query<{ id: string }>(
          `INSERT INTO public.idp_milestones
             (idp_id, competency_id, sequence_order, title, description, gap_score_at_creation, status, target_date, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [idpId, competencyId, i + 1, m.title, m.description, m.gap_score, milestoneStatus, milestoneTargetDate, milestoneCompletedAt],
        )
        milestoneId = inserted.rows[0].id
        milestoneCount++
      }

      // Actions for this milestone.
      for (const a of m.actions) {
        const refId =
          a.catalogue === "elearning"
            ? ctx.catalogues.elearning.get(a.title) ?? null
            : a.catalogue === "ojt"
              ? ctx.catalogues.ojt.get(a.title) ?? null
              : null
        const refTable =
          a.catalogue === "elearning" ? "elearning_catalogue" : a.catalogue === "ojt" ? "ojt_catalogue" : null

        const actionFound = await ctx.client.query<{ id: string }>(
          `SELECT id FROM public.idp_actions WHERE milestone_id = $1 AND title = $2 AND modality = $3 LIMIT 1`,
          [milestoneId, a.title, a.modality],
        )
        if (actionFound.rows.length > 0) {
          await ctx.client.query(
            `UPDATE public.idp_actions
               SET external_ref_id = $1, external_ref_table = $2, updated_at = now()
               WHERE id = $3`,
            [refId, refTable, actionFound.rows[0].id],
          )
        } else {
          await ctx.client.query(
            `INSERT INTO public.idp_actions (milestone_id, modality, title, external_ref_id, external_ref_table)
             VALUES ($1, $2, $3, $4, $5)`,
            [milestoneId, a.modality, a.title, refId, refTable],
          )
          actionCount++
        }

        // Side-effect rows for active/completed: enrolments / ojt_assignments
        // tied to this milestone, so the demo shows downstream activity.
        if (def.status === "active" || def.status === "completed") {
          if (a.catalogue === "elearning" && refId) {
            const enrolStatus =
              def.status === "completed"
                ? "completed"
                : actionsSeenForIdp < def.completed_action_count
                  ? "completed"
                  : "enrolled"
            const enrolledAtIso = daysAgoIso(def.approved_days_ago ?? 30)
            const completedAtIso = enrolStatus === "completed" ? daysAgoIso(Math.max(1, (def.approved_days_ago ?? 30) - 5)) : null

            const enrolFound = await ctx.client.query<{ id: string }>(
              `SELECT id FROM public.elearning_enrolments
                 WHERE tenant_id = $1 AND employee_id = $2 AND course_id = $3 AND milestone_id = $4
                 LIMIT 1`,
              [ctx.tenantId, employeeId, refId, milestoneId],
            )
            if (enrolFound.rows.length === 0) {
              await ctx.client.query(
                `INSERT INTO public.elearning_enrolments
                   (tenant_id, employee_id, course_id, milestone_id, enrolled_at, status, completed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [ctx.tenantId, employeeId, refId, milestoneId, enrolledAtIso, enrolStatus, completedAtIso],
              )
              enrolmentCount++
            }
          } else if (a.catalogue === "ojt" && refId) {
            const ojtStatus =
              def.status === "completed"
                ? "validated"
                : actionsSeenForIdp < def.completed_action_count
                  ? "evidence_submitted"
                  : "assigned"
            const dueDate = daysAgoDate(-30)

            const assignmentFound = await ctx.client.query<{ id: string }>(
              `SELECT id FROM public.ojt_assignments
                 WHERE tenant_id = $1 AND employee_id = $2 AND ojt_catalogue_id = $3 AND milestone_id = $4
                 LIMIT 1`,
              [ctx.tenantId, employeeId, refId, milestoneId],
            )
            if (assignmentFound.rows.length === 0) {
              await ctx.client.query(
                `INSERT INTO public.ojt_assignments
                   (tenant_id, employee_id, milestone_id, ojt_catalogue_id, assigned_by, due_date, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [ctx.tenantId, employeeId, milestoneId, refId, ctx.ldAdminUserProfileId, dueDate, ojtStatus],
              )
              ojtAssignmentCount++
            }
          }
        }
        actionsSeenForIdp++
      }
    }
  }

  return { idpCount, milestoneCount, actionCount, assessmentCount, enrolmentCount, ojtAssignmentCount }
}
