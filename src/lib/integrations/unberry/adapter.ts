import type { Database, Json } from "@/lib/types/database"

type AssessmentInsert = Database["public"]["Tables"]["assessments"]["Insert"]
type CompetencyScoreInsert =
  Database["public"]["Tables"]["competency_scores"]["Insert"]
type ProgressionEventInsert =
  Database["public"]["Tables"]["skill_progression_events"]["Insert"]

export type UnberryCompetencyResult = {
  competencyId: string
  competencyCode: string
  score0To100: number
  targetScore0To100?: number | null
  confidence0To100?: number | null
  summary?: string | null
}

export type UnberryAssessmentImportInput = {
  tenantId: string
  employeeId: string
  externalAssessmentId: string
  assessmentDate: string
  providerPayload?: Json
  competencyResults: UnberryCompetencyResult[]
}

export type UnberryImportIssue = {
  code:
    | "missing_tenant"
    | "missing_employee"
    | "missing_external_assessment"
    | "invalid_assessment_date"
    | "empty_results"
    | "duplicate_competency"
    | "invalid_score"
    | "invalid_target_score"
    | "invalid_confidence"
  path: string
  message: string
}

export type UnberryImportPlan = {
  assessment: AssessmentInsert
  competencyScores: CompetencyScoreInsert[]
  progressionEvents: ProgressionEventInsert[]
}

export type UnberryImportValidation =
  | { ok: true; input: UnberryAssessmentImportInput }
  | { ok: false; issues: UnberryImportIssue[] }

export function validateUnberryImportInput(
  input: UnberryAssessmentImportInput,
): UnberryImportValidation {
  const issues: UnberryImportIssue[] = []

  if (!input.tenantId.trim()) {
    issues.push({
      code: "missing_tenant",
      path: "tenantId",
      message: "Tenant id is required.",
    })
  }
  if (!input.employeeId.trim()) {
    issues.push({
      code: "missing_employee",
      path: "employeeId",
      message: "Employee id is required.",
    })
  }
  if (!input.externalAssessmentId.trim()) {
    issues.push({
      code: "missing_external_assessment",
      path: "externalAssessmentId",
      message: "External assessment id is required.",
    })
  }
  if (!isIsoDate(input.assessmentDate)) {
    issues.push({
      code: "invalid_assessment_date",
      path: "assessmentDate",
      message: "Assessment date must be YYYY-MM-DD.",
    })
  }
  if (input.competencyResults.length === 0) {
    issues.push({
      code: "empty_results",
      path: "competencyResults",
      message: "At least one competency result is required.",
    })
  }

  const seenCompetencies = new Set<string>()
  input.competencyResults.forEach((result, index) => {
    const basePath = `competencyResults.${index}`
    if (seenCompetencies.has(result.competencyId)) {
      issues.push({
        code: "duplicate_competency",
        path: `${basePath}.competencyId`,
        message: "Each competency may appear only once per assessment import.",
      })
    }
    seenCompetencies.add(result.competencyId)

    if (!isScore(result.score0To100)) {
      issues.push({
        code: "invalid_score",
        path: `${basePath}.score0To100`,
        message: "Score must be between 0 and 100.",
      })
    }
    if (
      result.targetScore0To100 !== undefined &&
      result.targetScore0To100 !== null &&
      !isScore(result.targetScore0To100)
    ) {
      issues.push({
        code: "invalid_target_score",
        path: `${basePath}.targetScore0To100`,
        message: "Target score must be between 0 and 100.",
      })
    }
    if (
      result.confidence0To100 !== undefined &&
      result.confidence0To100 !== null &&
      !isScore(result.confidence0To100)
    ) {
      issues.push({
        code: "invalid_confidence",
        path: `${basePath}.confidence0To100`,
        message: "Confidence must be between 0 and 100.",
      })
    }
  })

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, input }
}

export function buildUnberryImportPlan({
  input,
  assessmentId,
  createdBy,
}: {
  input: UnberryAssessmentImportInput
  assessmentId: string
  createdBy?: string | null
}): UnberryImportPlan {
  const validation = validateUnberryImportInput(input)
  if (!validation.ok) {
    throw new Error(
      `Invalid Unberry import input: ${validation.issues
        .map((issue) => issue.code)
        .join(", ")}`,
    )
  }

  const rawData = {
    provider: "unberry",
    import_mode: "manual_or_fixture",
    external_assessment_id: input.externalAssessmentId,
    result_count: input.competencyResults.length,
    provider_payload: input.providerPayload ?? null,
  } satisfies Json

  const assessment: AssessmentInsert = {
    id: assessmentId,
    tenant_id: input.tenantId,
    employee_id: input.employeeId,
    source_platform: "unberry",
    assessment_date: input.assessmentDate,
    raw_data: rawData,
  }

  const competencyScores: CompetencyScoreInsert[] = input.competencyResults.map(
    (result) => ({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      competency_id: result.competencyId,
      assessment_id: assessmentId,
      score_0_100: result.score0To100,
      target_score_0_100: result.targetScore0To100 ?? null,
      score_date: input.assessmentDate,
      source: "unberry",
    }),
  )

  const progressionEvents: ProgressionEventInsert[] =
    input.competencyResults.map((result) => ({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      competency_id: result.competencyId,
      signal_source: "assessment",
      source_table: "assessments",
      source_id: assessmentId,
      signal_date: input.assessmentDate,
      score_0_100: result.score0To100,
      confidence_0_100: result.confidence0To100 ?? null,
      summary:
        result.summary ??
        `Unberry assessment result for ${result.competencyCode}.`,
      created_by: createdBy ?? null,
    }))

  return { assessment, competencyScores, progressionEvents }
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function isScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}
