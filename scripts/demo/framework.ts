/**
 * Arwa Energy Core Competency Framework v1.
 *
 * Schema adaptations from the approved spec:
 *
 *   - Spec describes 5 categories (Technical / Leadership / Communication
 *     / Analytical / Business Acumen) but the gap_category enum on
 *     competencies has only 3 values (knowledge / behavioural /
 *     technical). We model the 5 categories as PARENT competency rows
 *     (parent_id link) and tag each with the closest gap_category enum
 *     value. The parent_id hierarchy is the source of truth for UI
 *     grouping; gap_category drives AI recommendation logic.
 *
 *   - Proficiency levels declared as a 5-level scale (1 Awareness …
 *     5 Expert) inside competencies.proficiency_levels (jsonb). Per-row
 *     proficiency definitions are identical across all competencies in
 *     this framework.
 */

import type pg from "pg"
import { findOrCreateId } from "./pg"

type GapCategory = "knowledge" | "behavioural" | "technical"

export const FRAMEWORK_NAME = "Arwa Energy Core Competency Framework"
export const FRAMEWORK_VERSION = 1

const PROFICIENCY_LEVELS = [
  { level: 1, name: "Awareness", description: "Knows it exists; reads about it." },
  { level: 2, name: "Beginner", description: "Performs the task with supervision." },
  { level: 3, name: "Intermediate", description: "Independent for routine cases." },
  { level: 4, name: "Advanced", description: "Handles complex cases; can teach others." },
  { level: 5, name: "Expert", description: "Recognised authority; sets standards." },
]

type CategoryDef = {
  code: string
  name: string
  description: string
  gap_category: GapCategory
  competencies: ReadonlyArray<{
    code: string
    name: string
    description: string
    gap_category: GapCategory
  }>
}

export const CATEGORIES: ReadonlyArray<CategoryDef> = [
  {
    code: "TECH",
    name: "Technical Skills",
    description: "Domain knowledge and hands-on capability for energy-sector knowledge work.",
    gap_category: "technical",
    competencies: [
      { code: "TECH-IND", name: "Industry knowledge (energy sector)", description: "Understands the energy value chain, regulatory context, and operational realities.", gap_category: "knowledge" },
      { code: "TECH-WRIT", name: "Technical writing", description: "Produces clear procedures, reports, and technical specifications.", gap_category: "technical" },
      { code: "TECH-DATA", name: "Data analysis & reporting", description: "Extracts, transforms, visualises, and explains operational data.", gap_category: "technical" },
      { code: "TECH-TOOL", name: "Software tool proficiency", description: "Operates industry tooling (SAP, AVEVA, BI suites) effectively.", gap_category: "technical" },
    ],
  },
  {
    code: "LEAD",
    name: "Leadership & People Management",
    description: "Guiding, developing, and managing the performance of others.",
    gap_category: "behavioural",
    competencies: [
      { code: "LEAD-COACH", name: "Coaching & mentoring", description: "Develops others through targeted feedback and stretch opportunities.", gap_category: "behavioural" },
      { code: "LEAD-PERF", name: "Performance management", description: "Sets expectations, monitors progress, and addresses under-performance.", gap_category: "behavioural" },
      { code: "LEAD-CONF", name: "Conflict resolution", description: "Surfaces disagreements early and brokers durable resolutions.", gap_category: "behavioural" },
      { code: "LEAD-MOTV", name: "Team motivation", description: "Sustains engagement and discretionary effort across a team.", gap_category: "behavioural" },
    ],
  },
  {
    code: "COMM",
    name: "Communication & Stakeholder Management",
    description: "Conveying information and managing relationships across audiences.",
    gap_category: "behavioural",
    competencies: [
      { code: "COMM-WRIT", name: "Written communication", description: "Produces clear, structured prose for varied audiences.", gap_category: "behavioural" },
      { code: "COMM-PRES", name: "Presentation & public speaking", description: "Delivers structured spoken communication to groups.", gap_category: "behavioural" },
      { code: "COMM-XFN", name: "Cross-functional collaboration", description: "Works effectively with peers in adjacent functions.", gap_category: "behavioural" },
      { code: "COMM-EXT", name: "Client & external engagement", description: "Manages external counterparties and customer relationships.", gap_category: "behavioural" },
    ],
  },
  {
    code: "ANAL",
    name: "Analytical & Problem Solving",
    description: "Structured thinking applied to operational and commercial problems.",
    gap_category: "knowledge",
    competencies: [
      { code: "ANAL-CRIT", name: "Critical thinking", description: "Evaluates evidence, surfaces assumptions, weighs trade-offs.", gap_category: "knowledge" },
      { code: "ANAL-RCA", name: "Root cause analysis", description: "Traces incidents and outcomes to their underlying drivers.", gap_category: "knowledge" },
      { code: "ANAL-DEC", name: "Decision-making under uncertainty", description: "Makes timely, defensible calls with incomplete information.", gap_category: "knowledge" },
      { code: "ANAL-PROC", name: "Process improvement", description: "Identifies inefficiencies and drives durable process change.", gap_category: "knowledge" },
    ],
  },
  {
    code: "BIZ",
    name: "Business Acumen",
    description: "Commercial and organisational fluency that shapes good operational decisions.",
    gap_category: "knowledge",
    competencies: [
      { code: "BIZ-FIN", name: "Financial literacy", description: "Reads financial statements; understands cost-of-capital implications.", gap_category: "knowledge" },
      { code: "BIZ-STRAT", name: "Strategic thinking", description: "Connects daily work to enterprise-level goals.", gap_category: "knowledge" },
      { code: "BIZ-PM", name: "Project management", description: "Plans, sequences, and tracks work to delivery.", gap_category: "knowledge" },
      { code: "BIZ-RISK", name: "Risk awareness", description: "Identifies, escalates, and mitigates operational and commercial risk.", gap_category: "knowledge" },
    ],
  },
]

export type CompetencyMap = Map<string, string>

/**
 * Idempotent: framework + parent rows + 20 leaf competencies.
 * Returns a Map<code, id> covering both the 5 parents and the 20 leaves.
 */
export async function seedFramework(
  client: pg.Client,
  tenantId: string,
): Promise<{ frameworkId: string; competencyIds: CompetencyMap }> {
  const frameworkId = await findOrCreateId(
    client,
    "public.competency_frameworks",
    "tenant_id = $1 AND name = $2 AND version = $3",
    [tenantId, FRAMEWORK_NAME, FRAMEWORK_VERSION],
    ["tenant_id", "name", "version"],
    [tenantId, FRAMEWORK_NAME, FRAMEWORK_VERSION],
  )

  const competencyIds: CompetencyMap = new Map()
  const proficiencyLevelsJson = JSON.stringify(PROFICIENCY_LEVELS)

  for (const cat of CATEGORIES) {
    const parentId = await findOrCreateId(
      client,
      "public.competencies",
      "framework_id = $1 AND code = $2",
      [frameworkId, cat.code],
      ["framework_id", "parent_id", "code", "name", "description", "category", "proficiency_levels"],
      [frameworkId, null, cat.code, cat.name, cat.description, cat.gap_category, proficiencyLevelsJson],
    )
    competencyIds.set(cat.code, parentId)

    for (const comp of cat.competencies) {
      const leafId = await findOrCreateId(
        client,
        "public.competencies",
        "framework_id = $1 AND code = $2",
        [frameworkId, comp.code],
        ["framework_id", "parent_id", "code", "name", "description", "category", "proficiency_levels"],
        [frameworkId, parentId, comp.code, comp.name, comp.description, comp.gap_category, proficiencyLevelsJson],
      )
      competencyIds.set(comp.code, leafId)
    }
  }

  return { frameworkId, competencyIds }
}

/**
 * The 20 LEAF competencies (children only). Used by score generation
 * and IDP definitions; the 5 parent rows exist only for grouping and
 * aren't scored against directly.
 */
export const LEAF_COMPETENCY_CODES: readonly string[] = CATEGORIES.flatMap((c) =>
  c.competencies.map((cc) => cc.code),
)
