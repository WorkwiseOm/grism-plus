import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"
import { fail, ok, type LoaderResult } from "./types"

type OjtStatus = Database["public"]["Enums"]["ojt_status"]

export type OjtAssignmentDetail = {
  assignment: {
    id: string
    employee_id: string
    milestone_id: string | null
    status: OjtStatus
    due_date: string
    assigned_at: string
    ai_recommendation_reasoning: string | null
  }
  catalogue: {
    title: string
    description: string
    deliverable_type: string | null
    effort_hours: number
  } | null
  latestEvidence: {
    id: string
    self_reflection: string
    submitted_at: string
    validation_status: string | null
    validated_at: string | null
    validation_notes: string | null
  } | null
}

type OjtAssignmentQueryRow = {
  id: string
  employee_id: string
  milestone_id: string | null
  status: OjtStatus
  due_date: string
  assigned_at: string
  ai_recommendation_reasoning: string | null
  ojt_catalogue:
    | {
        title: string
        description: string
        deliverable_type: string | null
        effort_hours: number
      }
    | Array<{
        title: string
        description: string
        deliverable_type: string | null
        effort_hours: number
      }>
    | null
}

type OjtEvidenceQueryRow = {
  id: string
  ojt_assignment_id: string
  self_reflection: string
  submitted_at: string
  validation_status: string | null
  validated_at: string | null
  validation_notes: string | null
}

export async function getEmployeeOjtAssignments(
  employeeId: string,
): Promise<LoaderResult<OjtAssignmentDetail[]>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("not_authenticated")

  const { data: assignments, error: assignmentsErr } = await supabase
    .from("ojt_assignments")
    .select(
      "id, employee_id, milestone_id, status, due_date, assigned_at, ai_recommendation_reasoning, ojt_catalogue(title, description, deliverable_type, effort_hours)",
    )
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (assignmentsErr) return fail("query_error", assignmentsErr.message)
  if (!assignments || assignments.length === 0) return ok([])

  const assignmentIds = assignments.map((assignment) => assignment.id)
  const { data: evidence, error: evidenceErr } = await supabase
    .from("ojt_evidence")
    .select(
      "id, ojt_assignment_id, self_reflection, submitted_at, validation_status, validated_at, validation_notes",
    )
    .in("ojt_assignment_id", assignmentIds)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })

  if (evidenceErr) return fail("query_error", evidenceErr.message)

  return ok(
    buildOjtAssignmentDetails(
      assignments as OjtAssignmentQueryRow[],
      evidence ?? [],
    ),
  )
}

export function buildOjtAssignmentDetails(
  assignments: ReadonlyArray<OjtAssignmentQueryRow>,
  evidence: ReadonlyArray<OjtEvidenceQueryRow>,
): OjtAssignmentDetail[] {
  const latestEvidenceByAssignment = new Map<string, OjtEvidenceQueryRow>()

  for (const row of evidence) {
    if (!latestEvidenceByAssignment.has(row.ojt_assignment_id)) {
      latestEvidenceByAssignment.set(row.ojt_assignment_id, row)
    }
  }

  return assignments.map((row) => {
    const catalogue = Array.isArray(row.ojt_catalogue)
      ? row.ojt_catalogue[0] ?? null
      : row.ojt_catalogue
    const latestEvidence = latestEvidenceByAssignment.get(row.id) ?? null

    return {
      assignment: {
        id: row.id,
        employee_id: row.employee_id,
        milestone_id: row.milestone_id,
        status: row.status,
        due_date: row.due_date,
        assigned_at: row.assigned_at,
        ai_recommendation_reasoning: row.ai_recommendation_reasoning,
      },
      catalogue: catalogue
        ? {
            title: catalogue.title,
            description: catalogue.description,
            deliverable_type: catalogue.deliverable_type,
            effort_hours: catalogue.effort_hours,
          }
        : null,
      latestEvidence: latestEvidence
        ? {
            id: latestEvidence.id,
            self_reflection: latestEvidence.self_reflection,
            submitted_at: latestEvidence.submitted_at,
            validation_status: latestEvidence.validation_status,
            validated_at: latestEvidence.validated_at,
            validation_notes: latestEvidence.validation_notes,
          }
        : null,
    }
  })
}
