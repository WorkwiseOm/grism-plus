import {
  completeWithAnthropic,
  type AnthropicMessagesClient,
  type GrismAiCompletion,
} from "@/lib/ai/anthropic"
import {
  buildIdpGenerationPromptPayload,
  validateGeneratedIdpDraft,
  type GeneratedIdpDraft,
  type IdpDraftValidationResult,
  type IdpGenerationPromptInput,
} from "@/lib/ai/idp-draft"

export type IdpGenerationSuccess = {
  ok: true
  draft: GeneratedIdpDraft
  validation: IdpDraftValidationResult
  completion: GrismAiCompletion
}

export type IdpGenerationFailure = {
  ok: false
  reason:
    | "model_error"
    | "invalid_json"
    | "validation_failed"
    | "output_safety_failed"
  message: string
  validation?: IdpDraftValidationResult
  completion?: GrismAiCompletion
}

export type IdpGenerationResult = IdpGenerationSuccess | IdpGenerationFailure

const IDP_GENERATION_SYSTEM_PROMPT = [
  "You generate individual development plan drafts for an enterprise talent-development platform.",
  "Return JSON only. Do not include markdown fences, commentary, employee names, email addresses, tenant identifiers, or internal IDs.",
  "Use this JSON shape: { narrative: string, blendSummary: { experience: number, relationship: number, formal: number }, milestones: [{ title: string, competencyCode: string, actions: [{ title: string, modality: 'ojt' | 'coaching' | 'elearning' | 'ilt' | 'workshop', blendCategory: 'experience' | 'relationship' | 'formal', effortWeight: number, rationale?: string }] }] }.",
  "The default development blend must be approximately 70% experience, 20% relationship-based development, and 10% formal learning unless the input constraints say otherwise.",
].join(" ")

const IDP_GENERATION_USER_PROMPT = [
  "Create a practical development plan draft from the supplied pseudonymised role context and competency gaps.",
  "Use work-based OJT or stretch activity as the primary layer, coaching or mentoring as the relationship layer, and formal learning as the smallest layer.",
  "Keep milestone and action titles specific enough for an L&D admin to review.",
].join(" ")

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const FORBIDDEN_IDENTIFIER_LABEL_PATTERN =
  /\b(employee_id|tenant_id|user_profile_id|manager_id|employee_number)\b/i

export async function generateIdpDraft(
  input: IdpGenerationPromptInput,
  client?: AnthropicMessagesClient,
): Promise<IdpGenerationResult> {
  const payload = buildIdpGenerationPromptPayload(input)

  let completion: GrismAiCompletion
  try {
    completion = await completeWithAnthropic(
      {
        node: "idp_generation",
        system: IDP_GENERATION_SYSTEM_PROMPT,
        user: IDP_GENERATION_USER_PROMPT,
        payload,
        maxTokens: 2400,
      },
      client,
    )
  } catch (error) {
    return {
      ok: false,
      reason: "model_error",
      message: error instanceof Error ? error.message : "IDP generation failed.",
    }
  }

  let parsed: unknown
  try {
    parsed = parseModelJson(completion.text)
  } catch (error) {
    return {
      ok: false,
      reason: "invalid_json",
      message:
        error instanceof Error ? error.message : "Model response was not JSON.",
      completion,
    }
  }

  const safetyIssue = detectOutputSafetyIssue(parsed)
  if (safetyIssue) {
    return {
      ok: false,
      reason: "output_safety_failed",
      message: safetyIssue,
      completion,
    }
  }

  const validation = validateGeneratedIdpDraft(parsed)
  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation_failed",
      message: "Generated draft failed the 70/20/10 validation guardrails.",
      validation,
      completion,
    }
  }

  return {
    ok: true,
    draft: parsed as GeneratedIdpDraft,
    validation,
    completion,
  }
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")

  if (start < 0 || end <= start) {
    throw new Error("Model response did not contain a JSON object.")
  }

  return JSON.parse(candidate.slice(start, end + 1))
}

function detectOutputSafetyIssue(value: unknown): string | null {
  const text = JSON.stringify(value)
  if (EMAIL_PATTERN.test(text)) return "Generated draft included an email address."
  if (UUID_PATTERN.test(text)) return "Generated draft included an internal ID."
  if (FORBIDDEN_IDENTIFIER_LABEL_PATTERN.test(text)) {
    return "Generated draft included internal identifier labels."
  }
  return null
}
