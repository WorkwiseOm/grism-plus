import Anthropic from '@anthropic-ai/sdk'
import type {
  Message,
  MessageCreateParamsNonStreaming,
  Model,
} from '@anthropic-ai/sdk/resources/messages'

import { getAiNodeContract, type AiNode } from '@/lib/ai/contracts'

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'
export const DEFAULT_MAX_TOKENS = 2048

const FORBIDDEN_PROMPT_KEYS = new Set([
  'id',
  'tenant_id',
  'tenant',
  'tenant_name',
  'employee_id',
  'employee_number',
  'user_profile_id',
  'manager_id',
  'competency_id',
  'course_id',
  'ojt_catalogue_id',
  'assessment_id',
  'full_name',
  'employee_name',
  'manager_name',
  'display_name',
  'email',
  'phone',
  'address',
])

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type GrismAiRequest = {
  node: AiNode
  system: string
  user: string
  payload?: JsonValue
  model?: Model
  maxTokens?: number
}

export type GrismAiCompletion = {
  node: AiNode
  model: string
  text: string
  stopReason: Message['stop_reason']
  usage: Message['usage']
}

export type AnthropicMessagesClient = {
  messages: {
    create(params: MessageCreateParamsNonStreaming): Promise<Message>
  }
}

export function createAnthropicClient(
  apiKey = process.env.ANTHROPIC_API_KEY,
): Anthropic {
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. AI nodes cannot call Anthropic. ' +
      'See docs/env-reference.md and docs/security.md.',
    )
  }

  return new Anthropic({ apiKey })
}

export function assertNoForbiddenPromptKeys(value: JsonValue): void {
  visitJson(value, [])
}

export async function completeWithAnthropic(
  request: GrismAiRequest,
  client?: AnthropicMessagesClient,
): Promise<GrismAiCompletion> {
  getAiNodeContract(request.node)

  if (request.payload !== undefined) {
    assertNoForbiddenPromptKeys(request.payload)
  }

  const anthropic = client ?? createAnthropicClient()
  const model = request.model ?? getDefaultModel()
  const message = await anthropic.messages.create({
    model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: request.system,
    messages: [
      {
        role: 'user',
        content: buildUserContent(request.user, request.payload),
      },
    ],
  })

  return {
    node: request.node,
    model: message.model,
    text: extractText(message),
    stopReason: message.stop_reason,
    usage: message.usage,
  }
}

function getDefaultModel(): Model {
  return (process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL) as Model
}

function buildUserContent(user: string, payload: JsonValue | undefined): string {
  if (payload === undefined) return user

  return [
    user,
    '',
    'Pseudonymised JSON input:',
    JSON.stringify(payload, null, 2),
  ].join('\n')
}

function extractText(message: Message): string {
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Anthropic response did not include a text block.')
  }

  return text
}

function visitJson(value: JsonValue, path: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitJson(item, [...path, String(index)]))
    return
  }

  if (value === null || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    if (FORBIDDEN_PROMPT_KEYS.has(normalizedKey)) {
      const location = [...path, key].join('.') || key
      throw new Error(
        `AI prompt payload contains forbidden identifier key "${location}". ` +
        'Route employee data through pseudonymiseEmployee() and send only allowed context fields.',
      )
    }
    visitJson(child, [...path, key])
  }
}
