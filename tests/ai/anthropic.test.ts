import { describe, expect, it, vi } from 'vitest'

import {
  assertNoForbiddenPromptKeys,
  completeWithAnthropic,
  createAnthropicClient,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_MAX_TOKENS,
  type AnthropicMessagesClient,
} from '@/lib/ai/anthropic'
import type { Message } from '@anthropic-ai/sdk/resources/messages'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Draft IDP ready.' }],
    model: DEFAULT_ANTHROPIC_MODEL,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 5,
      server_tool_use: null,
    },
    ...overrides,
  } as Message
}

function makeClient(message: Message = makeMessage()): {
  client: AnthropicMessagesClient
  create: ReturnType<typeof vi.fn>
} {
  const create = vi.fn().mockResolvedValue(message)
  return {
    create,
    client: { messages: { create } },
  }
}

describe('createAnthropicClient', () => {
  it('throws a loud setup error when ANTHROPIC_API_KEY is missing', () => {
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      expect(() => createAnthropicClient()).toThrowError(
        /ANTHROPIC_API_KEY is not set.*AI nodes cannot call Anthropic/,
      )
    } finally {
      process.env.ANTHROPIC_API_KEY = saved
    }
  })
})

describe('assertNoForbiddenPromptKeys', () => {
  it('allows pseudonymised role and gap context', () => {
    expect(() =>
      assertNoForbiddenPromptKeys({
        employee: {
          pseudonym: 'Employee_1234ABCD',
          role_title: 'Operations Analyst',
          target_role_title: 'Senior Operations Analyst',
        },
        gaps: [
          {
            competency_code: 'TECH-DATA',
            competency_name: 'Data analysis & reporting',
            gap_score: 25,
          },
        ],
      }),
    ).not.toThrow()
  })

  it('rejects direct identifiers anywhere in nested prompt payloads', () => {
    expect(() =>
      assertNoForbiddenPromptKeys({
        employee: {
          pseudonym: 'Employee_1234ABCD',
          email: 'person@example.com',
        },
      }),
    ).toThrowError(/forbidden identifier key "employee.email"/)
  })
})

describe('completeWithAnthropic', () => {
  it('sends the normalized Messages API request and returns text output', async () => {
    const { client, create } = makeClient()

    const result = await completeWithAnthropic(
      {
        node: 'idp_generation',
        system: 'Generate a concise IDP.',
        user: 'Use the following approved context.',
        payload: {
          employee: {
            pseudonym: 'Employee_1234ABCD',
            role_title: 'Operations Analyst',
          },
        },
      },
      client,
    )

    expect(create).toHaveBeenCalledWith({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: 'Generate a concise IDP.',
      messages: [
        {
          role: 'user',
          content: expect.stringContaining('Pseudonymised JSON input:'),
        },
      ],
    })
    expect(result).toMatchObject({
      node: 'idp_generation',
      model: DEFAULT_ANTHROPIC_MODEL,
      text: 'Draft IDP ready.',
      stopReason: 'end_turn',
    })
    expect(result.usage.output_tokens).toBe(5)
  })

  it('rejects unsafe payloads before calling Anthropic', async () => {
    const { client, create } = makeClient()

    await expect(
      completeWithAnthropic(
        {
          node: 'coaching_brief',
          system: 'Summarise coaching context.',
          user: 'Prepare a brief.',
          payload: { employee_id: '00000000-0000-0000-0000-000000000001' },
        },
        client,
      ),
    ).rejects.toThrowError(/forbidden identifier key "employee_id"/)

    expect(create).not.toHaveBeenCalled()
  })

  it('rejects unknown AI nodes before calling Anthropic', async () => {
    const { client, create } = makeClient()

    await expect(
      completeWithAnthropic(
        {
          node: 'unknown_node' as never,
          system: 'Use approved context.',
          user: 'Prepare output.',
        },
        client,
      ),
    ).rejects.toThrowError(/Unknown AI node: unknown_node/)

    expect(create).not.toHaveBeenCalled()
  })

  it('throws when Anthropic returns no text block', async () => {
    const { client } = makeClient(makeMessage({ content: [] }))

    await expect(
      completeWithAnthropic(
        {
          node: 'modality_recommender',
          system: 'Recommend modality.',
          user: 'Use approved context.',
        },
        client,
      ),
    ).rejects.toThrowError(/did not include a text block/)
  })
})
