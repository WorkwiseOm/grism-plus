export type FrameworkImpactMilestoneRow = {
  id: string
  idp_id: string
  idps:
    | { employee_id: string | null }
    | { employee_id: string | null }[]
    | null
}

export type FrameworkImpactSummary = {
  competencyCount: number
  milestoneCount: number
  idpCount: number
  employeeCount: number
  ojtCatalogueCount: number
  elearningCatalogueCount: number
}

export function buildFrameworkImpactSummary({
  competencyCount,
  milestoneRows,
  ojtCatalogueCount,
  elearningCatalogueCount,
}: {
  competencyCount: number
  milestoneRows: FrameworkImpactMilestoneRow[]
  ojtCatalogueCount: number
  elearningCatalogueCount: number
}): FrameworkImpactSummary {
  const idpIds = new Set<string>()
  const employeeIds = new Set<string>()

  for (const row of milestoneRows) {
    idpIds.add(row.idp_id)
    const employeeId = normalizeEmployeeId(row.idps)
    if (employeeId) employeeIds.add(employeeId)
  }

  return {
    competencyCount,
    milestoneCount: milestoneRows.length,
    idpCount: idpIds.size,
    employeeCount: employeeIds.size,
    ojtCatalogueCount,
    elearningCatalogueCount,
  }
}

function normalizeEmployeeId(
  value:
    | { employee_id: string | null }
    | { employee_id: string | null }[]
    | null,
): string | null {
  if (Array.isArray(value)) return value[0]?.employee_id ?? null
  return value?.employee_id ?? null
}
