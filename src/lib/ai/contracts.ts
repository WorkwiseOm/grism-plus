import type { Database } from '@/lib/types/database'

export type AiNode = Database['public']['Enums']['ai_node']

export type AiNodeContract = {
  label: string
  purpose: string
  allowedPromptInputs: string[]
}

export const AI_NODE_CONTRACTS = {
  idp_generation: {
    label: 'IDP generation',
    purpose: 'Generate a draft individual development plan from role context and competency gaps.',
    allowedPromptInputs: [
      'pseudonymised employee role context',
      'target role title',
      'competency gap summaries',
      'recommended milestone/action structure',
    ],
  },
  modality_recommender: {
    label: 'Modality recommender',
    purpose: 'Recommend learning modalities for a competency gap.',
    allowedPromptInputs: [
      'competency gap summary',
      'current and target proficiency levels',
      'available modality constraints',
    ],
  },
  ojt_recommender: {
    label: 'OJT recommender',
    purpose: 'Recommend OJT catalogue candidates for a competency gap.',
    allowedPromptInputs: [
      'pseudonymised employee role context',
      'competency gap summary',
      'filtered OJT catalogue candidate summaries',
    ],
  },
  coaching_brief: {
    label: 'Coaching brief',
    purpose: 'Summarise IDP status and recent activity for a manager or coach.',
    allowedPromptInputs: [
      'pseudonymised employee role context',
      'IDP status summary',
      'recent OJT and milestone activity',
      'coaching focus questions',
    ],
  },
} satisfies Record<AiNode, AiNodeContract>

export function getAiNodeContract(node: AiNode): AiNodeContract {
  const contract = (AI_NODE_CONTRACTS as Partial<Record<string, AiNodeContract>>)[
    node
  ]
  if (!contract) {
    throw new Error(`Unknown AI node: ${node}`)
  }

  return contract
}
