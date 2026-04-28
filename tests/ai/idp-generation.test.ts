import { describe, expect, it, vi } from "vitest"

import {
  generateIdpDraft,
  parseModelJson,
} from "@/lib/ai/idp-generation"
import type { AnthropicMessagesClient } from "@/lib/ai/anthropic"
import type { PseudonymisedEmployee } from "@/lib/security/pseudonymise"

const employee = {
  pseudonym: "Employee_ABCDEF12",
  role_title: "Operations Analyst",
  target_role_title: "Operations Lead",
  department: "Operations",
  org_unit: "Field Ops",
} as unknown as PseudonymisedEmployee

const promptInput = {
  employee,
  targetRoleTitle: "Operations Lead",
  competencyGaps: [
    {
      competencyCode: "OPS-1",
      competencyName: "Operational planning",
      category: "technical",
      currentProficiency: "Gap score 45/100",
      targetProficiency: "Target proficiency",
      gapScore0To100: 45,
    },
  ],
}

function mockClient(text: string): AnthropicMessagesClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        model: "claude-test",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
        content: [{ type: "text", text }],
      }),
    },
  } as unknown as AnthropicMessagesClient
}

function validDraft() {
  return {
    narrative: "A practical development plan.",
    blendSummary: { experience: 70, relationship: 20, formal: 10 },
    milestones: [
      {
        title: "Build operational depth",
        competencyCode: "OPS-1",
        actions: [
          ...Array.from({ length: 7 }, (_, index) => ({
            title: `OJT action ${index + 1}`,
            modality: "ojt",
            blendCategory: "experience",
            effortWeight: 1,
          })),
          ...Array.from({ length: 2 }, (_, index) => ({
            title: `Coaching action ${index + 1}`,
            modality: "coaching",
            blendCategory: "relationship",
            effortWeight: 1,
          })),
          {
            title: "Complete formal module",
            modality: "elearning",
            blendCategory: "formal",
            effortWeight: 1,
          },
        ],
      },
    ],
  }
}

describe("parseModelJson", () => {
  it("parses JSON even when surrounded by a markdown fence", () => {
    expect(parseModelJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true })
  })
})

describe("generateIdpDraft", () => {
  it("returns a validated draft from a mocked Anthropic response", async () => {
    const result = await generateIdpDraft(
      promptInput,
      mockClient(JSON.stringify(validDraft())),
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.validation.computedBlend).toEqual({
        experience: 70,
        relationship: 20,
        formal: 10,
      })
      expect(result.completion.model).toBe("claude-test")
    }
  })

  it("rejects non-JSON model responses", async () => {
    const result = await generateIdpDraft(promptInput, mockClient("not json"))

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid_json",
    })
  })

  it("rejects drafts that fail the blend guard", async () => {
    const formalHeavy = {
      ...validDraft(),
      blendSummary: { experience: 10, relationship: 20, formal: 70 },
      milestones: [
        {
          title: "Formal-heavy plan",
          actions: Array.from({ length: 10 }, (_, index) => ({
            title: `Course ${index + 1}`,
            modality: "elearning",
          })),
        },
      ],
    }

    const result = await generateIdpDraft(
      promptInput,
      mockClient(JSON.stringify(formalHeavy)),
    )

    expect(result).toMatchObject({
      ok: false,
      reason: "validation_failed",
    })
  })

  it("rejects direct identifiers in model output", async () => {
    const unsafe = {
      ...validDraft(),
      narrative: "Contact user@example.com about this plan.",
    }

    const result = await generateIdpDraft(
      promptInput,
      mockClient(JSON.stringify(unsafe)),
    )

    expect(result).toMatchObject({
      ok: false,
      reason: "output_safety_failed",
    })
  })
})
