// Canonical WebMCP tool manifest for Reviewline.
//
// Single source of truth for the tool identities, agent-facing descriptions, and
// JSON Schemas mirrored by the fallback inspector. Runtime validation lives in
// `src/tools/tools.ts`; JSON Schema alone is never treated as enforcement.
//
// MIT License

import type { ReviewlineToolName } from './registration'

export interface ToolDefinition {
  name: ReviewlineToolName
  description: string
  schema: Record<string, unknown>
}

const INCIDENT_ID_ENUM = ['inc-001', 'inc-002', 'inc-003'] as const

/**
 * Human-only actions. These are deliberately absent from `TOOL_DEFINITIONS`
 * and are never passed to `document.modelContext.registerTool`.
 */
export const HUMAN_ONLY_ACTIONS = ['approve', 'reject', 'activate'] as const

export type HumanOnlyAction = (typeof HUMAN_ONLY_ACTIONS)[number]

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'list_incidents',
    description:
      'List synthetic incidents. Optional severity/status filters. readOnly, untrustedContent.',
    schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        status: { type: 'string', enum: ['unresolved', 'in_review', 'resolved'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_incident',
    description: 'Return bounded evidence for one incident and focus it in UI. readOnly.',
    schema: {
      type: 'object',
      required: ['incident_id'],
      properties: { incident_id: { type: 'string', enum: [...INCIDENT_ID_ENUM] } },
      additionalProperties: false,
    },
  },
  {
    name: 'simulate_guardrail_patch',
    description: 'Replay a guardrail rule against the incident cohort. Deterministic. readOnly.',
    schema: {
      type: 'object',
      required: ['incident_id', 'rule_kind', 'threshold', 'enforcement'],
      properties: {
        incident_id: { type: 'string', enum: [...INCIDENT_ID_ENUM] },
        rule_kind: { type: 'string', enum: ['spending_cap', 'refund_limit', 'stale_evidence'] },
        threshold: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
        enforcement: { type: 'string', enum: ['block', 'warn', 'allow'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'draft_review_gate',
    description: 'Create a pending proposal for human review. Does not approve or activate policy.',
    schema: {
      type: 'object',
      required: ['incident_id', 'title', 'rationale', 'sim_id'],
      properties: {
        incident_id: { type: 'string', enum: [...INCIDENT_ID_ENUM] },
        title: { type: 'string', maxLength: 200 },
        rationale: { type: 'string', maxLength: 1000 },
        sim_id: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_review_status',
    description: 'Read the human decision for a proposal. readOnly.',
    schema: {
      type: 'object',
      required: ['proposal_id'],
      properties: { proposal_id: { type: 'string' } },
      additionalProperties: false,
    },
  },
]

export const TOOL_NAMES: readonly ReviewlineToolName[] = TOOL_DEFINITIONS.map((tool) => tool.name)

/** Filter the canonical manifest down to the tools exposed in the current phase. */
export function selectToolDefinitions(
  availableToolNames: readonly string[],
): readonly ToolDefinition[] {
  const exposed = new Set(availableToolNames)
  return TOOL_DEFINITIONS.filter((tool) => exposed.has(tool.name))
}
