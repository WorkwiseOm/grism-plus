import { describe, expect, it } from "vitest"

import type { CompetencyNode, FrameworkTree } from "@/lib/data/framework"
import {
  buildFrameworkStats,
  categoryLabel,
  countDescendants,
  findCompetencyNode,
  flattenCompetencies,
  getProficiencyLevelCount,
  getProficiencyLevelLabels,
} from "@/lib/framework-editor/tree"

const root: CompetencyNode = {
  id: "root",
  parent_id: null,
  code: "TECH",
  name: "Technical",
  description: null,
  category: "technical",
  proficiency_levels: [],
  children: [
    {
      id: "child",
      parent_id: "root",
      code: "TECH-1",
      name: "Data pipelines",
      description: "Builds reliable data pipelines.",
      category: "knowledge",
      proficiency_levels: [
        "Awareness",
        { label: "Working knowledge" },
        { title: "Expert" },
      ],
      children: [],
    },
  ],
}

const secondRoot: CompetencyNode = {
  id: "beh",
  parent_id: null,
  code: "BEH",
  name: "Behaviour",
  description: null,
  category: "behavioural",
  proficiency_levels: [],
  children: [],
}

const tree: FrameworkTree = {
  framework: { id: "fw", name: "Core", version: 1, is_active: true },
  roots: [root, secondRoot],
}

describe("framework tree helpers", () => {
  it("flattens competencies depth-first", () => {
    expect(flattenCompetencies(tree.roots).map((node) => node.id)).toEqual([
      "root",
      "child",
      "beh",
    ])
  })

  it("builds framework stats by category", () => {
    expect(buildFrameworkStats(tree)).toEqual({
      totalCompetencies: 3,
      rootCount: 2,
      technical: 1,
      behavioural: 1,
      knowledge: 1,
    })
  })

  it("finds requested nodes and falls back to the first root", () => {
    expect(findCompetencyNode(tree.roots, "child")?.id).toBe("child")
    expect(findCompetencyNode(tree.roots, "missing")?.id).toBe("root")
    expect(findCompetencyNode([], undefined)).toBeNull()
  })

  it("counts descendants below a node", () => {
    expect(countDescendants(root)).toBe(1)
    expect(countDescendants(secondRoot)).toBe(0)
  })

  it("formats category and proficiency level labels", () => {
    const child = root.children[0]
    expect(categoryLabel("behavioural")).toBe("Behavioural")
    expect(categoryLabel("technical")).toBe("Technical")
    expect(categoryLabel("knowledge")).toBe("Knowledge")
    expect(getProficiencyLevelCount(child)).toBe(3)
    expect(getProficiencyLevelLabels(child)).toEqual([
      "Awareness",
      "Working knowledge",
      "Expert",
    ])
  })
})
