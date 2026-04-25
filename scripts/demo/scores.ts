/**
 * Competency score generation for the 20 employees with employee
 * records. Each employee scores 8–12 of the 20 leaf competencies; the
 * distribution within each scored competency is:
 *
 *   40% at target_level - 1 (small gap)
 *   30% at target_level - 2 (significant gap — primary IDP candidate)
 *   20% at target_level     (on pace)
 *   10% at target_level + 1 (strength)
 *
 * Idempotent: re-runs check (tenant_id, employee_id, competency_id) and
 * UPDATE in place. Deterministic via the seeded rng.
 *
 * Note on scale: the spec describes proficiency as 1–5 levels, but
 * competency_scores.score_0_100 is integer 0–100. We use bucket
 * midpoints (1→10, 2→30, 3→50, 4→70, 5→90) plus ±5 jitter.
 */

import type pg from "pg"
import { LEAF_COMPETENCY_CODES, type CompetencyMap } from "./framework"
import { targetLevelForRoleTitle } from "./personas"
import { pickInt } from "./pg"

const LEVEL_TO_SCORE: Record<number, number> = {
  1: 10,
  2: 30,
  3: 50,
  4: 70,
  5: 90,
}

function levelToScore(level: number): number {
  const clamped = Math.max(1, Math.min(5, level))
  return LEVEL_TO_SCORE[clamped]
}

function shuffleAndTake<T>(items: readonly T[], n: number, rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

export type EmployeeForScoring = {
  id: string
  role_title: string
  email: string
}

export async function seedScores(
  client: pg.Client,
  tenantId: string,
  employees: ReadonlyArray<EmployeeForScoring>,
  competencyIds: CompetencyMap,
  rng: () => number,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  let touched = 0

  for (const emp of employees) {
    const targetLevel = targetLevelForRoleTitle(emp.role_title)
    const targetScore = levelToScore(targetLevel)
    const numScored = pickInt(rng, 8, 12)
    const codes = shuffleAndTake(LEAF_COMPETENCY_CODES, numScored, rng)

    for (const code of codes) {
      const competencyId = competencyIds.get(code)
      if (!competencyId) continue

      const r = rng()
      let actualLevel: number
      if (r < 0.4) actualLevel = targetLevel - 1
      else if (r < 0.7) actualLevel = targetLevel - 2
      else if (r < 0.9) actualLevel = targetLevel
      else actualLevel = targetLevel + 1
      actualLevel = Math.max(1, Math.min(5, actualLevel))

      const jitter = pickInt(rng, -5, 5)
      const score = Math.max(0, Math.min(100, levelToScore(actualLevel) + jitter))

      const found = await client.query<{ id: string }>(
        `SELECT id FROM public.competency_scores
           WHERE tenant_id = $1 AND employee_id = $2 AND competency_id = $3
           LIMIT 1`,
        [tenantId, emp.id, competencyId],
      )
      if (found.rows.length === 0) {
        await client.query(
          `INSERT INTO public.competency_scores
             (tenant_id, employee_id, competency_id, score_0_100, target_score_0_100, source, score_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenantId, emp.id, competencyId, score, targetScore, "Manual demo seed", today],
        )
      } else {
        await client.query(
          `UPDATE public.competency_scores
             SET score_0_100 = $1, target_score_0_100 = $2, score_date = $3
           WHERE id = $4`,
          [score, targetScore, today, found.rows[0].id],
        )
      }
      touched++
    }
  }

  return touched
}
