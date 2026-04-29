import type { GrismAiCompletion } from "@/lib/ai/anthropic"
import {
  validateGeneratedIdpDraft,
  type GeneratedIdpDraft,
  type IdpGenerationPromptInput,
} from "@/lib/ai/idp-draft"
import type {
  IdpGenerationSuccess,
} from "@/lib/ai/idp-generation"

/**
 * Deterministic fallback for local demo mode only.
 *
 * This is intentionally not a production AI substitute. It lets a local
 * demo continue when the external Anthropic credential is missing or stale,
 * while still exercising the same machine-readable draft shape and
 * 70/20/10 validator used by live AI output.
 */
export function generateLocalDemoIdpDraft(
  input: IdpGenerationPromptInput,
  originalFailureMessage: string,
): IdpGenerationSuccess {
  const selectedGaps = input.competencyGaps.slice(
    0,
    Math.max(1, input.constraints?.maxMilestones ?? input.competencyGaps.length),
  )
  const gaps = selectedGaps.length > 0 ? selectedGaps : input.competencyGaps
  const targetRole = input.targetRoleTitle ?? "target role"

  const draft: GeneratedIdpDraft = {
    narrative: [
      `Local demo AI draft for progression toward ${targetRole}.`,
      "The plan is intentionally experience-led, with manager-visible OJT evidence, structured coaching, and a small formal-learning layer.",
      "This fallback appears only in localhost demo mode when the live AI provider is unavailable.",
    ].join(" "),
    blendSummary: { experience: 70, relationship: 20, formal: 10 },
    milestones: gaps.map((gap) => ({
      title: `Close ${gap.competencyName} gap`,
      competencyCode: gap.competencyCode,
      actions: [
        ...Array.from({ length: 7 }, (_, actionIndex) => ({
          title: `${gap.competencyName}: workplace practice ${actionIndex + 1}`,
          modality: "ojt" as const,
          blendCategory: "experience" as const,
          effortWeight: 1,
          rationale: "Build capability through observed work execution.",
        })),
        ...Array.from({ length: 2 }, (_, actionIndex) => ({
          title: `${gap.competencyName}: coaching checkpoint ${actionIndex + 1}`,
          modality: "coaching" as const,
          blendCategory: "relationship" as const,
          effortWeight: 1,
          rationale: "Add feedback and reflection around the work activity.",
        })),
        {
          title: `${gap.competencyName}: focused formal module`,
          modality: "elearning" as const,
          blendCategory: "formal" as const,
          effortWeight: 1,
          rationale: "Use formal content only to support the work practice.",
        },
      ],
    })),
  }

  const validation = validateGeneratedIdpDraft(draft)
  if (!validation.ok) {
    throw new Error("Local demo IDP fallback failed validation.")
  }

  const completion: GrismAiCompletion = {
    node: "idp_generation",
    model: "local-demo-fallback",
    text: JSON.stringify(draft),
    stopReason: "end_turn",
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    } as GrismAiCompletion["usage"],
  }

  return {
    ok: true,
    draft,
    validation,
    completion: {
      ...completion,
      text: JSON.stringify({
        ...draft,
        localDemoFallback: true,
        originalFailureMessage,
      }),
    },
  }
}
