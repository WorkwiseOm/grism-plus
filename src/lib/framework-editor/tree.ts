import type { CompetencyNode, FrameworkTree } from "@/lib/data/framework"

export type FrameworkStats = {
  totalCompetencies: number
  rootCount: number
  technical: number
  behavioural: number
  knowledge: number
}

export function buildFrameworkStats(tree: FrameworkTree): FrameworkStats {
  const flat = flattenCompetencies(tree.roots)
  return {
    totalCompetencies: flat.length,
    rootCount: tree.roots.length,
    technical: flat.filter((node) => node.category === "technical").length,
    behavioural: flat.filter((node) => node.category === "behavioural").length,
    knowledge: flat.filter((node) => node.category === "knowledge").length,
  }
}

export function flattenCompetencies(
  roots: ReadonlyArray<CompetencyNode>,
): CompetencyNode[] {
  const out: CompetencyNode[] = []
  const visit = (node: CompetencyNode): void => {
    out.push(node)
    for (const child of node.children) visit(child)
  }
  for (const root of roots) visit(root)
  return out
}

export function findCompetencyNode(
  roots: ReadonlyArray<CompetencyNode>,
  id?: string | null,
): CompetencyNode | null {
  if (!id) return roots[0] ?? null
  return flattenCompetencies(roots).find((node) => node.id === id) ?? roots[0] ?? null
}

export function countDescendants(node: CompetencyNode): number {
  return flattenCompetencies(node.children).length
}

export function categoryLabel(category: CompetencyNode["category"]): string {
  switch (category) {
    case "behavioural":
      return "Behavioural"
    case "technical":
      return "Technical"
    case "knowledge":
      return "Knowledge"
  }
}

export function getProficiencyLevelCount(node: CompetencyNode): number {
  return Array.isArray(node.proficiency_levels) ? node.proficiency_levels.length : 0
}

export function getProficiencyLevelLabels(node: CompetencyNode): string[] {
  if (!Array.isArray(node.proficiency_levels)) return []

  return node.proficiency_levels.map((level, index) => {
    if (typeof level === "string") return level
    if (level && typeof level === "object" && !Array.isArray(level)) {
      const record = level as Record<string, unknown>
      const label =
        record.label ?? record.name ?? record.title ?? record.level ?? `Level ${index + 1}`
      return String(label)
    }
    return `Level ${index + 1}`
  })
}
