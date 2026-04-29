/**
 * OJT activities + eLearning courses catalogues for the demo tenant.
 * Each entry is tagged against a small set of competency codes so the
 * IDP recommender path can pull modality-aligned activities later.
 */

import type pg from "pg"
import type { CompetencyMap } from "./framework"

type OjtDef = {
  title: string
  description: string
  competency_codes: readonly string[]
  effort_hours: number
  role_levels: readonly string[]
  deliverable_type: string
}

type ElearningDef = {
  title: string
  provider: string
  external_url: string
  competency_codes: readonly string[]
  duration_minutes: number
}

export const OJT_CATALOGUE: ReadonlyArray<OjtDef> = [
  {
    title: "Shadow a senior engineer for one operational shift",
    description: "Spend a full 8-hour shift alongside a senior engineer on the operational floor; document three observations afterwards.",
    competency_codes: ["TECH-IND", "ANLY-CRIT"],
    effort_hours: 8,
    role_levels: ["Trainee", "Junior", "Coordinator"],
    deliverable_type: "written_observations",
  },
  {
    title: "Lead a weekly team standup for four consecutive weeks",
    description: "Run the team's standup, capture actions, follow up on blockers between sessions.",
    competency_codes: ["LEAD-MOTV", "COMM-PRES"],
    effort_hours: 4,
    role_levels: ["Senior", "Coordinator", "Specialist"],
    deliverable_type: "manager_attestation",
  },
  {
    title: "Write up a process improvement proposal",
    description: "Identify a recurring inefficiency in your team's process; document the issue, root cause, and proposed change.",
    competency_codes: ["ANLY-PROC", "ANLY-RCA", "TECH-WRIT"],
    effort_hours: 6,
    role_levels: ["Junior", "Senior", "Analyst", "Coordinator"],
    deliverable_type: "proposal_document",
  },
  {
    title: "Facilitate a cross-functional alignment meeting",
    description: "Convene representatives from at least two functions, drive a documented decision on a shared issue.",
    competency_codes: ["COMM-XFN", "ANLY-DEC", "LEAD-CONF"],
    effort_hours: 3,
    role_levels: ["Senior", "Coordinator", "Manager"],
    deliverable_type: "meeting_minutes",
  },
  {
    title: "Build and present a data-driven status report",
    description: "Pull data from operational systems, structure a 1-page report, present to your manager and at least one peer.",
    competency_codes: ["TECH-DATA", "COMM-PRES", "TECH-TOOL"],
    effort_hours: 4,
    role_levels: ["Junior", "Analyst", "Senior"],
    deliverable_type: "report_artifact",
  },
  {
    title: "Mentor a trainee through their first independent task",
    description: "Be assigned as primary mentor to a trainee for a discrete deliverable; document feedback rounds.",
    competency_codes: ["LEAD-COACH", "COMM-XFN"],
    effort_hours: 6,
    role_levels: ["Senior", "Coordinator"],
    deliverable_type: "mentee_feedback",
  },
  {
    title: "Lead a root-cause investigation of a recent incident",
    description: "Apply 5-Why or fishbone analysis to a real recent incident; produce a written RCA.",
    competency_codes: ["ANLY-RCA", "ANLY-CRIT", "TECH-WRIT"],
    effort_hours: 8,
    role_levels: ["Junior", "Analyst", "Senior", "Engineer"],
    deliverable_type: "rca_document",
  },
  {
    title: "Draft a project plan for a 4-week deliverable",
    description: "Choose a real upcoming deliverable; produce a Gantt-style plan with risks and milestones.",
    competency_codes: ["BIZ-PM", "BIZ-RISK", "TECH-WRIT"],
    effort_hours: 5,
    role_levels: ["Junior", "Senior", "Analyst", "Coordinator"],
    deliverable_type: "project_plan",
  },
  {
    title: "Present a quarterly results summary to a leadership audience",
    description: "Prepare and deliver a 15-minute presentation to senior leaders; field three live questions.",
    competency_codes: ["COMM-PRES", "BIZ-STRAT", "TECH-DATA"],
    effort_hours: 6,
    role_levels: ["Senior", "Manager"],
    deliverable_type: "leadership_presentation",
  },
  {
    title: "Run a stakeholder mapping exercise for an upcoming initiative",
    description: "Identify and classify stakeholders for a real initiative; agree communication cadence with each.",
    competency_codes: ["COMM-XFN", "COMM-EXT", "BIZ-STRAT"],
    effort_hours: 3,
    role_levels: ["Senior", "Coordinator", "Analyst"],
    deliverable_type: "stakeholder_map",
  },
]

export const ELEARNING_CATALOGUE: ReadonlyArray<ElearningDef> = [
  { title: "Effective stakeholder communication", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/stakeholder-comms", competency_codes: ["COMM-XFN", "COMM-EXT", "COMM-WRIT"], duration_minutes: 120 },
  { title: "Root cause analysis fundamentals", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/rca-fundamentals", competency_codes: ["ANLY-RCA", "ANLY-CRIT"], duration_minutes: 90 },
  { title: "SAP for operations analysts", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/sap-ops-analysts", competency_codes: ["TECH-TOOL", "TECH-DATA"], duration_minutes: 240 },
  { title: "Energy industry primer (GCC context)", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/energy-primer-gcc", competency_codes: ["TECH-IND", "BIZ-STRAT"], duration_minutes: 180 },
  { title: "Technical writing for engineers", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/tech-writing-engineers", competency_codes: ["TECH-WRIT", "COMM-WRIT"], duration_minutes: 150 },
  { title: "Coaching for first-time managers", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/coaching-first-managers", competency_codes: ["LEAD-COACH", "LEAD-PERF", "LEAD-MOTV"], duration_minutes: 200 },
  { title: "Decision-making under uncertainty", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/decision-uncertainty", competency_codes: ["ANLY-DEC", "ANLY-CRIT", "BIZ-RISK"], duration_minutes: 90 },
  { title: "Data analysis with Power BI", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/powerbi-analysis", competency_codes: ["TECH-DATA", "TECH-TOOL"], duration_minutes: 300 },
  { title: "Project management essentials", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/pm-essentials", competency_codes: ["BIZ-PM", "BIZ-RISK", "ANLY-PROC"], duration_minutes: 180 },
  { title: "Financial literacy for non-finance professionals", provider: "Internal Academy", external_url: "https://academy.arwa.demo/courses/finlit-non-finance", competency_codes: ["BIZ-FIN", "BIZ-STRAT"], duration_minutes: 120 },
]

export type CatalogueIds = {
  ojt: Map<string, string>
  elearning: Map<string, string>
}

export async function seedCatalogues(
  client: pg.Client,
  tenantId: string,
  competencyIds: Map<string, string>,
): Promise<CatalogueIds> {
  const ojtIds = new Map<string, string>()
  for (const item of OJT_CATALOGUE) {
    const tags = item.competency_codes
      .map((c) => competencyIds.get(c))
      .filter((id): id is string => Boolean(id))
    const found = await client.query<{ id: string }>(
      `SELECT id FROM public.ojt_catalogue WHERE tenant_id = $1 AND title = $2 LIMIT 1`,
      [tenantId, item.title],
    )
    let id: string
    if (found.rows.length > 0) {
      id = found.rows[0].id
      await client.query(
        `UPDATE public.ojt_catalogue
           SET description = $1, competency_tags = $2::uuid[], effort_hours = $3,
               role_levels = $4::text[], deliverable_type = $5, updated_at = now()
           WHERE id = $6`,
        [item.description, tags, item.effort_hours, item.role_levels, item.deliverable_type, id],
      )
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.ojt_catalogue
           (tenant_id, title, description, competency_tags, effort_hours, role_levels, deliverable_type)
         VALUES ($1, $2, $3, $4::uuid[], $5, $6::text[], $7)
         RETURNING id`,
        [tenantId, item.title, item.description, tags, item.effort_hours, item.role_levels, item.deliverable_type],
      )
      id = inserted.rows[0].id
    }
    ojtIds.set(item.title, id)
  }

  const elearningIds = new Map<string, string>()
  for (const item of ELEARNING_CATALOGUE) {
    const tags = item.competency_codes
      .map((c) => competencyIds.get(c))
      .filter((id): id is string => Boolean(id))
    const found = await client.query<{ id: string }>(
      `SELECT id FROM public.elearning_catalogue WHERE tenant_id = $1 AND title = $2 LIMIT 1`,
      [tenantId, item.title],
    )
    let id: string
    if (found.rows.length > 0) {
      id = found.rows[0].id
      await client.query(
        `UPDATE public.elearning_catalogue
           SET provider = $1, external_url = $2, competency_tags = $3::uuid[],
               duration_minutes = $4, updated_at = now()
           WHERE id = $5`,
        [item.provider, item.external_url, tags, item.duration_minutes, id],
      )
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.elearning_catalogue
           (tenant_id, title, provider, external_url, competency_tags, duration_minutes)
         VALUES ($1, $2, $3, $4, $5::uuid[], $6)
         RETURNING id`,
        [tenantId, item.title, item.provider, item.external_url, tags, item.duration_minutes],
      )
      id = inserted.rows[0].id
    }
    elearningIds.set(item.title, id)
  }

  return { ojt: ojtIds, elearning: elearningIds }
}
