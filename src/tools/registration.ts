// Reviewline WebMCP tool registration — lifecycle-safe via AbortController
// document.modelContext imperative API; degrades gracefully when unavailable.
// MIT License

/// <reference types="webmcp-types" />
import { appendTimelineEvent, isDescriptorSafeAppState, isReviewRecordCoherent, isSimulationAuthoritativeAndDraftable, type AppState } from '../domain/domain'
import {
  handleListIncidents,
  handleInspectIncident,
  handleSimulateGuardrailPatch,
  handleDraftReviewGate,
  handleGetReviewStatus,
  type ListIncidentsInput,
  type SimulateInput,
  type DraftReviewGateInput,
} from './tools'

export type GetState = () => AppState
export type SetState = (updater: (prev: AppState) => AppState) => void
export interface StateTransactionResult<T> {
  nextState: AppState
  result: T
}
export type RunStateTransaction = <T>(
  transaction: (current: AppState) => StateTransactionResult<T>,
) => Promise<T>

const MAX_AGENT_OUTPUT_CHARS = 1500
const MAX_AGENT_ERROR_CHARS = 180
const REGISTER_TIMEOUT_MS = 2000

export async function executeWithinAgentBudget<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    const result = await operation()
    if (JSON.stringify(result).length >= MAX_AGENT_OUTPUT_CHARS) {
      throw new Error('Tool output exceeds the Reviewline agent-output budget')
    }
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed'
    throw new Error(message.slice(0, MAX_AGENT_ERROR_CHARS))
  }
}

function registerWithTimeout(operation: Promise<void>, onTimeout: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      onTimeout()
      reject(new Error('WebMCP registration timed out'))
    }, REGISTER_TIMEOUT_MS)
    operation.then(
      () => { clearTimeout(timeout); resolve() },
      (error) => { clearTimeout(timeout); reject(error) },
    )
  })
}

export function createSerializedStateTransactions(
  getState: GetState,
  commitState: (nextState: AppState) => Promise<void>,
): RunStateTransaction {
  let tail: Promise<void> = Promise.resolve()
  return <T>(transaction: (current: AppState) => StateTransactionResult<T>): Promise<T> => {
    const operation = tail.then(async () => {
      const { nextState, result } = transaction(getState())
      await commitState(nextState)
      return result
    })
    tail = operation.then(() => undefined, () => undefined)
    return operation
  }
}

export type ReviewlineToolName =
  | 'list_incidents'
  | 'inspect_incident'
  | 'simulate_guardrail_patch'
  | 'draft_review_gate'
  | 'get_review_status'

function hasCoherentReviewRecord(state: AppState): boolean {
  return Boolean(state.focusedProposalId) && isReviewRecordCoherent(state, state.focusedProposalId!)
}

export function getAvailableToolNames(state: AppState): ReviewlineToolName[] {
  const names: ReviewlineToolName[] = ['list_incidents', 'inspect_incident']
  if (!isDescriptorSafeAppState(state)) return names
  try {
  if (
    !state || typeof state !== 'object' ||
    !Array.isArray(state.incidents) || state.incidents.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.simulations) || state.simulations.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.proposals) || state.proposals.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.auditLog) || state.auditLog.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.sessionTimeline) || state.sessionTimeline.some((item) => !item || typeof item !== 'object')
  ) return names
  if (!['INVESTIGATION', 'REPLAY_READY', 'AWAITING_HUMAN_DECISION', 'DECIDED'].includes(state.workflowPhase)) {
    return names
  }
  if (state.workflowPhase === 'AWAITING_HUMAN_DECISION' || state.workflowPhase === 'DECIDED') {
    if (hasCoherentReviewRecord(state)) names.push('get_review_status')
    return names
  }
  const selectionIsKnown = state.selectedIncidentId !== null &&
    state.incidents.some((incident) => incident.id === state.selectedIncidentId)
  if (selectionIsKnown) names.push('simulate_guardrail_patch')

  const activeSimulation = state.activeSimId
    ? state.simulations.find((simulation) => simulation.simId === state.activeSimId)
    : undefined
  const replayCanBeDrafted =
    state.workflowPhase === 'REPLAY_READY' &&
    activeSimulation?.incidentId === state.selectedIncidentId &&
    Boolean(state.activeSimId) &&
    Boolean(state.selectedIncidentId) &&
    isSimulationAuthoritativeAndDraftable(state, state.activeSimId!, state.selectedIncidentId!)
  if (replayCanBeDrafted) names.push('draft_review_gate')

    return names
  } catch {
    return ['list_incidents', 'inspect_incident']
  }
}

/**
 * Register all five Reviewline WebMCP tools against the provided modelContext.
 * Uses the AbortSignal to deregister cleanly when the calling component unmounts.
 */
export async function registerTools(
  modelContext: WebMCP.ModelContext,
  getState: GetState,
  runTransaction: RunStateTransaction,
  signal: AbortSignal,
): Promise<void> {
  const registrationController = new AbortController()
  let inFlightExecutions = 0
  let retirementRequested = signal.aborted
  const retireIfIdle = () => {
    if (retirementRequested && inFlightExecutions === 0) registrationController.abort()
  }
  const requestRetirement = () => {
    retirementRequested = true
    retireIfIdle()
  }
  signal.addEventListener('abort', () => {
    requestRetirement()
  }, { once: true })
  retireIfIdle()
  const opts = { signal: registrationController.signal }
  const available = new Set(getAvailableToolNames(getState()))
  type RegisterArgs = Parameters<WebMCP.ModelContext['registerTool']>
  const registerAvailable = async (...args: RegisterArgs): Promise<void> => {
    const [tool, options] = args
    if (retirementRequested || registrationController.signal.aborted) {
      throw new Error('WebMCP registration retired')
    }
    if (available.has(tool.name as ReviewlineToolName)) {
      const boundedTool: WebMCP.ModelContextTool = {
        ...tool,
        execute: async (input, executionOptions) => {
          if (retirementRequested || registrationController.signal.aborted) {
            throw new Error('WebMCP registration retired')
          }
          inFlightExecutions += 1
          try {
            return await executeWithinAgentBudget(() => tool.execute(input, executionOptions))
          } finally {
            inFlightExecutions -= 1
            retireIfIdle()
          }
        },
      }
      try {
        await registerWithTimeout(
          modelContext.registerTool(boundedTool, options),
          requestRetirement,
        )
      } catch (error) {
        requestRetirement()
        throw error
      }
      if (retirementRequested || registrationController.signal.aborted) {
        requestRetirement()
        throw new Error('WebMCP registration retired')
      }
    }
  }

  // ── list_incidents ───────────────────────────────────────────────────────
  await registerAvailable(
    {
      name: 'list_incidents',
      title: 'List Incidents',
      description:
        'List synthetic incidents with id, agent, severity, status, and summary. ' +
        'Optionally filter by severity (critical|high|medium|low) or status (unresolved|in_review|resolved). ' +
        'Returns at most 50 incidents. Does not include trace or cohort details.',
      inputSchema: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Filter by severity level.',
          },
          status: {
            type: 'string',
            enum: ['unresolved', 'in_review', 'resolved'],
            description: 'Filter by incident status.',
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => runTransaction((current) => {
        if (!isDescriptorSafeAppState(current)) throw new Error('Invalid canonical review state')
        const state = appendTimelineEvent(current, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'list_incidents',
          detail: 'Agent requested the bounded incident queue.',
        })
        const typed = input as ListIncidentsInput
        const result = handleListIncidents(state, typed)
        const nextState = appendTimelineEvent(state, {
          kind: 'result',
          actor: 'system',
          toolName: 'list_incidents',
          detail: `Returned ${result.total} incident summary record(s).`,
        })
        return { nextState, result }
      }),
    },
    opts,
  )

  // ── inspect_incident ─────────────────────────────────────────────────────
  await registerAvailable(
    {
      name: 'inspect_incident',
      title: 'Inspect Incident',
      description:
        'Return bounded evidence (trace, cohort) for one incident and focus it in the UI. ' +
        'incident_id must be one of: inc-001, inc-002, inc-003.',
      inputSchema: {
        type: 'object',
        required: ['incident_id'],
        properties: {
          incident_id: {
            type: 'string',
            enum: ['inc-001', 'inc-002', 'inc-003'],
            description: 'The incident to inspect.',
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => runTransaction((current) => {
        if (!isDescriptorSafeAppState(current)) throw new Error('Invalid canonical review state')
        const id = input['incident_id'] as string
        const invokedState = appendTimelineEvent(current, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'inspect_incident',
          detail: `Agent requested bounded evidence for ${id}.`,
        })
        const result = handleInspectIncident(invokedState, input)
        const selectedState = invokedState.selectedIncidentId === result.id
          ? invokedState
          : appendTimelineEvent({ ...invokedState, selectedIncidentId: result.id }, {
              kind: 'workflow',
              actor: 'agent',
              detail: `Incident selected: ${result.id}`,
            })
        const nextState = appendTimelineEvent(selectedState, {
          kind: 'result',
          actor: 'system',
          toolName: 'inspect_incident',
          detail: `Focused ${result.id}; simulation capability is now available.`,
        })
        return { nextState, result }
      }),
    },
    opts,
  )

  // ── simulate_guardrail_patch ─────────────────────────────────────────────
  await registerAvailable(
    {
      name: 'simulate_guardrail_patch',
      title: 'Simulate Guardrail Patch',
      description:
        'Replay a deterministic proposed guardrail rule against the incident cohort. ' +
        'Returns blocked/allowed counts and regression analysis. ' +
        'Does not persist policy — simulation only. ' +
        'rule_kind: spending_cap|refund_limit|stale_evidence. ' +
        'enforcement: block|warn|allow. threshold: non-negative number.',
      inputSchema: {
        type: 'object',
        required: ['incident_id', 'rule_kind', 'threshold', 'enforcement'],
        properties: {
          incident_id: {
            type: 'string',
            enum: ['inc-001', 'inc-002', 'inc-003'],
          },
          rule_kind: {
            type: 'string',
            enum: ['spending_cap', 'refund_limit', 'stale_evidence'],
          },
          threshold: {
            type: 'number',
            minimum: 0,
            maximum: Number.MAX_SAFE_INTEGER,
            multipleOf: 1,
            description: 'Exact whole-USD amount for spending/refund limits; whole evidence-age hours for stale_evidence.',
          },
          enforcement: {
            type: 'string',
            enum: ['block', 'warn', 'allow'],
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => runTransaction((current) => {
        if (!isDescriptorSafeAppState(current)) throw new Error('Invalid canonical review state')
        if (
          (current.workflowPhase !== 'INVESTIGATION' && current.workflowPhase !== 'REPLAY_READY') ||
          current.selectedIncidentId !== input['incident_id']
        ) {
          throw new Error('Least-authority precondition failed: simulation capability is no longer available')
        }
        const invokedState = appendTimelineEvent(current, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'simulate_guardrail_patch',
          detail: `Agent requested a deterministic replay for ${String(input['incident_id'])}.`,
        })
        const typed = input as unknown as SimulateInput
        const { nextState, output } = handleSimulateGuardrailPatch(invokedState, typed)
        const completedState = appendTimelineEvent(nextState, {
          kind: 'result',
          actor: 'system',
          toolName: 'simulate_guardrail_patch',
          detail: `Replay ${output.resultId} completed with ${output.regressions.length} regression(s).`,
        })
        return { nextState: completedState, result: output }
      }),
    },
    opts,
  )

  // ── draft_review_gate ────────────────────────────────────────────────────
  await registerAvailable(
    {
      name: 'draft_review_gate',
      title: 'Draft Review Gate',
      description:
        'Create a non-effective policy-change proposal for human review. ' +
        'Requires a completed simulation. Does NOT approve or activate policy. ' +
        'Opens the human review panel. title max 200 chars, rationale max 1000 chars.',
      inputSchema: {
        type: 'object',
        required: ['incident_id', 'title', 'rationale', 'sim_id'],
        properties: {
          incident_id: {
            type: 'string',
            enum: ['inc-001', 'inc-002', 'inc-003'],
          },
          title: {
            type: 'string',
            maxLength: 200,
            description: 'Concise proposal title.',
          },
          rationale: {
            type: 'string',
            maxLength: 1000,
            description: 'Human-readable rationale for the proposed change.',
          },
          sim_id: {
            type: 'string',
            description: 'ID of the simulation this proposal is based on.',
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => runTransaction((current) => {
        if (!isDescriptorSafeAppState(current)) throw new Error('Invalid canonical review state')
        const invokedState = appendTimelineEvent(current, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'draft_review_gate',
          detail: `Agent requested a review gate for ${String(input['incident_id'])}.`,
        })
        const typed = input as unknown as DraftReviewGateInput
        const { nextState, output } = handleDraftReviewGate(invokedState, typed)
        const completedState = appendTimelineEvent(nextState, {
          kind: 'result',
          actor: 'system',
          toolName: 'draft_review_gate',
          detail: `Proposal ${output.proposalId} is awaiting a human decision; no policy was deployed.`,
        })
        return { nextState: completedState, result: output }
      }),
    },
    opts,
  )

  // ── get_review_status ────────────────────────────────────────────────────
  await registerAvailable(
    {
      name: 'get_review_status',
      title: 'Get Review Status',
      description:
        'Read the human decision and policy-effect status for a proposal. ' +
        'Returns status (pending|approved|rejected), decidedAt, and auditNote if decided.',
      inputSchema: {
        type: 'object',
        required: ['proposal_id'],
        properties: {
          proposal_id: {
            type: 'string',
            description: 'The proposal ID returned by draft_review_gate.',
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => runTransaction((current) => {
        if (!isDescriptorSafeAppState(current)) throw new Error('Invalid canonical review state')
        const proposalId = input['proposal_id'] as string
        const invokedState = appendTimelineEvent(current, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'get_review_status',
          detail: `Agent requested the human decision for ${proposalId}.`,
        })
        const result = handleGetReviewStatus(invokedState, input)
        const focusedState = { ...invokedState, focusedProposalId: result.proposalId }
        const completedState = appendTimelineEvent(focusedState, {
          kind: 'result',
          actor: 'system',
          toolName: 'get_review_status',
          detail: `Proposal ${result.proposalId} status is ${result.status}.`,
        })
        return { nextState: completedState, result }
      }),
    },
    opts,
  )
}

/**
 * Attempt to register tools with native WebMCP.
 * Returns true if successful, false if the browser does not support modelContext.
 */
export async function tryRegisterTools(
  getState: GetState,
  runTransaction: RunStateTransaction,
  signal: AbortSignal,
): Promise<boolean> {
  if (typeof document === 'undefined' || !document.modelContext) {
    return false
  }
  try {
    await registerTools(document.modelContext, getState, runTransaction, signal)
    return true
  } catch (err) {
    console.warn('[Reviewline] WebMCP registration failed:', err)
    return false
  }
}

/**
 * Execute an available Reviewline tool directly through the transactional lifecycle.
 * Used by the interactive in-app Tool Inspector test harness.
 */
export async function executeToolByName(
  getState: GetState,
  runTransaction: RunStateTransaction,
  toolName: ReviewlineToolName,
  input: Record<string, unknown>,
): Promise<unknown> {
  const current = getState()
  const available = getAvailableToolNames(current)
  if (!available.includes(toolName)) {
    throw new Error(`Tool "${toolName}" is not available in the current workflow phase (${current.workflowPhase})`)
  }

  switch (toolName) {
    case 'list_incidents':
      return runTransaction((curr) => {
        if (!isDescriptorSafeAppState(curr)) throw new Error('Invalid canonical review state')
        const state = appendTimelineEvent(curr, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'list_incidents',
          detail: 'Agent requested the bounded incident queue.',
        })
        const typed = input as unknown as ListIncidentsInput
        const result = handleListIncidents(state, typed)
        const nextState = appendTimelineEvent(state, {
          kind: 'result',
          actor: 'system',
          toolName: 'list_incidents',
          detail: `Returned ${result.total} incident summary record(s).`,
        })
        return { nextState, result }
      })

    case 'inspect_incident':
      return runTransaction((curr) => {
        if (!isDescriptorSafeAppState(curr)) throw new Error('Invalid canonical review state')
        const id = (input['incident_id'] as string) || 'inc-001'
        const invokedState = appendTimelineEvent(curr, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'inspect_incident',
          detail: `Agent requested bounded evidence for ${id}.`,
        })
        const result = handleInspectIncident(invokedState, { incident_id: id })
        const selectedState = invokedState.selectedIncidentId === result.id
          ? invokedState
          : appendTimelineEvent({ ...invokedState, selectedIncidentId: result.id }, {
              kind: 'workflow',
              actor: 'agent',
              detail: `Incident selected: ${result.id}`,
            })
        const nextState = appendTimelineEvent(selectedState, {
          kind: 'result',
          actor: 'system',
          toolName: 'inspect_incident',
          detail: `Focused ${result.id}; simulation capability is now available.`,
        })
        return { nextState, result }
      })

    case 'simulate_guardrail_patch':
      return runTransaction((curr) => {
        if (!isDescriptorSafeAppState(curr)) throw new Error('Invalid canonical review state')
        if (
          (curr.workflowPhase !== 'INVESTIGATION' && curr.workflowPhase !== 'REPLAY_READY') ||
          curr.selectedIncidentId !== input['incident_id']
        ) {
          throw new Error('Least-authority precondition failed: simulation capability is no longer available')
        }
        const invokedState = appendTimelineEvent(curr, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'simulate_guardrail_patch',
          detail: `Agent requested a deterministic replay for ${String(input['incident_id'])}.`,
        })
        const typed = input as unknown as SimulateInput
        const { nextState, output } = handleSimulateGuardrailPatch(invokedState, typed)
        const completedState = appendTimelineEvent(nextState, {
          kind: 'result',
          actor: 'system',
          toolName: 'simulate_guardrail_patch',
          detail: `Replay ${output.resultId} completed with ${output.regressions.length} regression(s).`,
        })
        return { nextState: completedState, result: output }
      })

    case 'draft_review_gate':
      return runTransaction((curr) => {
        if (!isDescriptorSafeAppState(curr)) throw new Error('Invalid canonical review state')
        const invokedState = appendTimelineEvent(curr, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'draft_review_gate',
          detail: `Agent requested a review gate for ${String(input['incident_id'])}.`,
        })
        const typed = input as unknown as DraftReviewGateInput
        const { nextState, output } = handleDraftReviewGate(invokedState, typed)
        const completedState = appendTimelineEvent(nextState, {
          kind: 'result',
          actor: 'system',
          toolName: 'draft_review_gate',
          detail: `Proposal ${output.proposalId} is awaiting a human decision; no policy was deployed.`,
        })
        return { nextState: completedState, result: output }
      })

    case 'get_review_status':
      return runTransaction((curr) => {
        if (!isDescriptorSafeAppState(curr)) throw new Error('Invalid canonical review state')
        const proposalId = input['proposal_id'] as string
        const invokedState = appendTimelineEvent(curr, {
          kind: 'invoked',
          actor: 'agent',
          toolName: 'get_review_status',
          detail: `Agent requested the human decision for ${proposalId}.`,
        })
        const result = handleGetReviewStatus(invokedState, input)
        const focusedState = { ...invokedState, focusedProposalId: result.proposalId }
        const completedState = appendTimelineEvent(focusedState, {
          kind: 'result',
          actor: 'system',
          toolName: 'get_review_status',
          detail: `Proposal ${result.proposalId} status is ${result.status}.`,
        })
        return { nextState: completedState, result }
      })
  }
}

