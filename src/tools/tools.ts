// Reviewline tool handlers — pure functions used by WebMCP tool registrations
// Each handler validates its inputs strictly and returns bounded output.
// MIT License

import {
  type AppState,
  type Severity,
  type IncidentStatus,
  type RuleKind,
  type Enforcement,
  runSimulation,
  draftProposal,
  isCanonicalNumericId,
  isDescriptorSafeAppState,
  isReviewRecordCoherent,
} from '../domain/domain'

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const VALID_STATUSES: IncidentStatus[] = ['unresolved', 'in_review', 'resolved']
const VALID_RULE_KINDS: RuleKind[] = ['spending_cap', 'refund_limit', 'stale_evidence']
const VALID_ENFORCEMENTS: Enforcement[] = ['block', 'warn', 'allow']
const KNOWN_INCIDENT_IDS = ['inc-001', 'inc-002', 'inc-003']

/** Maximum characters for a bounded error message returned to the agent. */
const MAX_ERROR_CHARS = 200

/**
 * Truncate an error message to the bounded limit.
 * Never echoes giant unknown property names, IDs, or status strings.
 */
function boundedErrorMessage(message: string): string {
  if (message.length <= MAX_ERROR_CHARS) return message
  return message.slice(0, MAX_ERROR_CHARS - 3) + '...'
}

/**
 * Allowed keys for each tool's input to detect unknown properties.
 */
const LIST_INCIDENTS_KEYS = new Set(['severity', 'status'])
const SIMULATE_KEYS = new Set(['incident_id', 'rule_kind', 'threshold', 'enforcement'])
const DRAFT_KEYS = new Set(['incident_id', 'title', 'rationale', 'sim_id'])
const INSPECT_INCIDENT_KEYS = new Set(['incident_id'])
const GET_REVIEW_STATUS_KEYS = new Set(['proposal_id'])

function assertObject(val: unknown, name: string): Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(boundedErrorMessage(`Validation error: ${name} must be a non-null object`))
  }
  return val as Record<string, unknown>
}

function assertNoUnknownProps(obj: Record<string, unknown>, allowed: Set<string>, ctx: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      // Never echo the full unknown key name — truncate it
      const safeKey = key.slice(0, 40)
      throw new Error(boundedErrorMessage(`Validation error: unknown property "${safeKey}" in ${ctx}`))
    }
  }
}

function assertString(val: unknown, name: string): string {
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(boundedErrorMessage(`Validation error: ${name} must be a non-empty string`))
  }
  return val.trim()
}

function assertEnum<T extends string>(val: unknown, name: string, allowed: T[]): T {
  const str = assertString(val, name)
  if (!allowed.includes(str as T)) {
    throw new Error(
      boundedErrorMessage(`Validation error: ${name} must be one of [${allowed.join(', ')}], got "${str.slice(0, 30)}"`)
    )
  }
  return str as T
}

function assertSafeNonNegativeInteger(val: unknown, name: string): number {
  if (typeof val !== 'number') {
    throw new Error(boundedErrorMessage(`Validation error: ${name} must be a number`))
  }
  if (Number.isNaN(val)) {
    throw new Error(boundedErrorMessage(`Validation error: ${name} must be a finite number, got NaN`))
  }
  if (!Number.isFinite(val)) {
    throw new Error(boundedErrorMessage(`Validation error: ${name} must be a finite number, got Infinity`))
  }
  if (val < 0) {
    throw new Error(boundedErrorMessage(`Validation error: ${name} must be >= 0, got ${val}`))
  }
  if (!Number.isSafeInteger(val)) {
    throw new Error(
      boundedErrorMessage(
        `Validation error: ${name} must be a safe integer (spending_cap/refund_limit: whole USD; stale_evidence: whole hours)`
      )
    )
  }
  return val
}

/**
 * Sanitize a trace message for agent output.
 * If the message contains instruction-like patterns (e.g. embedded directives),
 * label it as [UNTRUSTED-CONTENT] so the agent doesn't follow it literally.
 * The original text is retained in the human UI via the raw incident data.
 */
function sanitizeTraceMessage(message: string, meta?: Record<string, string | number | boolean>): string {
  const isInstruction = meta?.injectedText === true ||
    /ignore\s+(cap|limit|policy|rule)|approve\s+purchase|override\s+(cap|limit)|system\s+prompt/i.test(message)

  if (isInstruction) {
    const truncated = message.slice(0, 60)
    return `[UNTRUSTED-CONTENT] Embedded instruction detected in trace (first 60 chars): ${truncated}…`
  }
  return message
}

function boundTraceMeta(meta?: Record<string, string | number | boolean>): Record<string, string | number | boolean> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const bounded: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(meta).slice(0, 5)) {
    bounded[key.slice(0, 30)] = typeof value === 'string' ? value.slice(0, 80) : value
  }
  return bounded
}

// ── list_incidents ────────────────────────────────────────────────────────────

export interface ListIncidentsInput {
  severity?: Severity
  status?: IncidentStatus
}

export interface IncidentSummary {
  id: string
  agent: string
  severity: Severity
  status: IncidentStatus
  summary: string
  blockedAt: string
}

export interface ListIncidentsOutput {
  incidents: IncidentSummary[]
  total: number
}

export function handleListIncidents(
  state: AppState,
  input: ListIncidentsInput,
): ListIncidentsOutput {
  const obj = assertObject(input, 'input')
  assertNoUnknownProps(obj, LIST_INCIDENTS_KEYS, 'list_incidents')

  if (input.severity !== undefined) {
    assertEnum(input.severity, 'severity', VALID_SEVERITIES)
  }
  if (input.status !== undefined) {
    assertEnum(input.status, 'status', VALID_STATUSES)
  }

  let results = state.incidents
  if (input.severity) results = results.filter((i) => i.severity === input.severity)
  if (input.status) results = results.filter((i) => i.status === input.status)

  const capped = results.slice(0, 50)

  const incidents: IncidentSummary[] = capped.map((i) => ({
    id: i.id,
    agent: i.agent,
    severity: i.severity,
    status: i.status,
    summary: i.summary.slice(0, 200),
    blockedAt: i.blockedAt,
  }))

  while (
    incidents.length > 0 &&
    JSON.stringify({ incidents, total: incidents.length }).length >= 1500
  ) {
    incidents.pop()
  }

  return { incidents, total: incidents.length }
}

// ── inspect_incident ──────────────────────────────────────────────────────────

export interface InspectIncidentOutput {
  id: string
  agent: string
  severity: Severity
  status: IncidentStatus
  summary: string
  blockedAt: string
  trace: Array<{
    ts: string
    kind: string
    message: string
    meta?: Record<string, string | number | boolean>
  }>
  cohort: Array<{
    caseId: string
    label: string
    amount?: number
    context: string
  }>
}

export function handleInspectIncident(state: AppState, incidentId: unknown): InspectIncidentOutput {
  let id: string
  if (typeof incidentId === 'string') {
    id = assertString(incidentId, 'incident_id')
  } else {
    const obj = assertObject(incidentId, 'input')
    assertNoUnknownProps(obj, INSPECT_INCIDENT_KEYS, 'inspect_incident')
    id = assertString(obj['incident_id'], 'incident_id')
  }
  if (!KNOWN_INCIDENT_IDS.includes(id)) {
    throw new Error(boundedErrorMessage(`Unknown incident: ${id.slice(0, 20)}`))
  }
  const incident = state.incidents.find((i) => i.id === id)!
  if (!VALID_SEVERITIES.includes(incident.severity)) throw new Error('Invalid incident severity')
  if (!VALID_STATUSES.includes(incident.status)) throw new Error('Invalid incident status')
  const output: InspectIncidentOutput = {
    id: incident.id.slice(0, 40),
    agent: incident.agent.slice(0, 80),
    severity: incident.severity,
    status: incident.status,
    summary: incident.summary.slice(0, 300),
    blockedAt: String(incident.blockedAt).slice(0, 40),
    trace: incident.trace.slice(0, 10).map((t) => ({
      ts: String(t.ts).slice(0, 40),
      kind: String(t.kind).slice(0, 20),
      message: sanitizeTraceMessage(String(t.message).slice(0, 200), t.meta),
      meta: boundTraceMeta(t.meta),
    })),
    cohort: incident.cohort.slice(0, 10).map((c) => ({
      caseId: String(c.caseId).slice(0, 40),
      label: String(c.label).slice(0, 80),
      amount: typeof c.amount === 'number' && Number.isFinite(c.amount) ? c.amount : undefined,
      context: String(c.context).slice(0, 80),
    })),
  }
  while (JSON.stringify(output).length >= 1500 && output.cohort.length > 0) output.cohort.pop()
  while (JSON.stringify(output).length >= 1500 && output.trace.length > 0) output.trace.pop()
  if (JSON.stringify(output).length >= 1500) output.summary = output.summary.slice(0, 80)
  return output
}

// ── simulate_guardrail_patch ──────────────────────────────────────────────────

export interface SimulateInput {
  incident_id: string
  rule_kind: RuleKind
  threshold: number
  enforcement: Enforcement
}

export interface SimulateOutput {
  simId: string
  resultId: string
  incidentId: string
  ruleKind: RuleKind
  threshold: number
  enforcement: Enforcement
  ruleExpression: string
  baselinePolicyVersion: string
  candidatePolicyVersion: string
  triggeringCaseId: string | null
  benignControlCaseId: string | null
  blockedCount: number
  allowedCount: number
  regressions: string[]
  summary: string
}

export function handleSimulateGuardrailPatch(
  state: AppState,
  input: SimulateInput,
): { nextState: AppState; output: SimulateOutput } {
  const obj = assertObject(input as unknown, 'input')
  assertNoUnknownProps(obj, SIMULATE_KEYS, 'simulate_guardrail_patch')

  assertEnum(input.incident_id, 'incident_id', KNOWN_INCIDENT_IDS)
  assertEnum(input.rule_kind, 'rule_kind', VALID_RULE_KINDS)
  assertEnum(input.enforcement, 'enforcement', VALID_ENFORCEMENTS)
  assertSafeNonNegativeInteger(input.threshold, 'threshold')
  if (!isDescriptorSafeAppState(state)) throw new Error('Invalid canonical review state')

  if (state.workflowPhase !== 'INVESTIGATION' && state.workflowPhase !== 'REPLAY_READY') {
    throw new Error('Least-authority precondition failed: simulation is unavailable in this workflow phase')
  }
  if (state.selectedIncidentId !== null && state.selectedIncidentId !== input.incident_id) {
    throw new Error('Least-authority precondition failed: simulation incident is not selected')
  }

  const { nextState: replayedState, sim } = runSimulation(
    state,
    input.incident_id,
    input.rule_kind,
    input.threshold,
    input.enforcement,
  )
  const nextState: AppState = { ...replayedState, selectedIncidentId: input.incident_id }

  const regressionNote =
    sim.regressions.length > 0
      ? ` WARN: ${sim.regressions.length} regression(s): ${sim.regressions.join(', ')}.`
      : ' No regressions.'

  const output: SimulateOutput = {
    simId: sim.simId,
    resultId: sim.resultId,
    incidentId: sim.incidentId,
    ruleKind: sim.ruleKind,
    threshold: sim.threshold,
    enforcement: sim.enforcement,
    ruleExpression: sim.ruleExpression,
    baselinePolicyVersion: sim.baselinePolicyVersion,
    candidatePolicyVersion: sim.candidatePolicyVersion,
    triggeringCaseId: sim.triggeringCaseId,
    benignControlCaseId: sim.benignControlCaseId,
    blockedCount: sim.blockedCount,
    allowedCount: sim.allowedCount,
    regressions: sim.regressions,
    summary: `Sim ${sim.simId} (result:${sim.resultId}): ${sim.ruleExpression} — blocked=${sim.blockedCount} allowed=${sim.allowedCount}.${regressionNote}`,
  }

  return { nextState, output }
}

// ── draft_review_gate ─────────────────────────────────────────────────────────

export interface DraftReviewGateInput {
  incident_id: string
  title: string
  rationale: string
  sim_id: string
}

export interface DraftReviewGateOutput {
  proposalId: string
  status: string
  incidentId: string
  simId: string
  title: string
  message: string
}

export function handleDraftReviewGate(
  state: AppState,
  input: DraftReviewGateInput,
): { nextState: AppState; output: DraftReviewGateOutput } {
  const obj = assertObject(input as unknown, 'input')
  assertNoUnknownProps(obj, DRAFT_KEYS, 'draft_review_gate')

  assertEnum(input.incident_id, 'incident_id', KNOWN_INCIDENT_IDS)
  const title = assertString(input.title, 'title')
  const rationale = assertString(input.rationale, 'rationale')
  assertString(input.sim_id, 'sim_id')
  if (input.title.length > 200) throw new Error('Validation error: title exceeds 200 characters')
  if (input.rationale.length > 1000) throw new Error('Validation error: rationale exceeds 1000 characters')
  if (!isDescriptorSafeAppState(state)) throw new Error('Invalid canonical review state')

  if (state.workflowPhase !== 'REPLAY_READY') {
    throw new Error(boundedErrorMessage(`Least-authority precondition failed: workflow phase is ${state.workflowPhase}, not REPLAY_READY`))
  }
  if (state.selectedIncidentId !== input.incident_id) {
    throw new Error(boundedErrorMessage(`Least-authority precondition failed: selected incident is ${String(state.selectedIncidentId ?? 'none').slice(0, 20)}, not ${input.incident_id}`))
  }
  if (state.activeSimId !== input.sim_id) {
    throw new Error(boundedErrorMessage(`Least-authority precondition failed: active simulation is ${String(state.activeSimId ?? 'none').slice(0, 20)}, not ${input.sim_id.slice(0, 20)}`))
  }

  const { nextState, proposal } = draftProposal(
    state,
    input.incident_id,
    title,
    rationale,
    input.sim_id,
  )

  const enforcementStatus = proposal.incidentId === 'inc-002'
    ? 'The refund remains blocked and unapproved.'
    : proposal.incidentId === 'inc-003'
      ? 'The deployment remains blocked pending valid evidence and attestation.'
      : 'The blocked purchase remains unauthorized.'

  const output: DraftReviewGateOutput = {
    proposalId: proposal.proposalId,
    status: proposal.status,
    incidentId: proposal.incidentId,
    simId: proposal.simId,
    title: proposal.title,
    message: `Proposal ${proposal.proposalId} created and awaiting human review. No policy has been changed. ${enforcementStatus}`,
  }

  return { nextState, output }
}

// ── get_review_status ─────────────────────────────────────────────────────────

export interface ReviewStatusOutput {
  proposalId: string
  status: string
  title: string
  incidentId: string
  simId: string
  decidedAt?: string
  reviewerNote?: string
  actor?: string
  message: string
}

export function handleGetReviewStatus(state: AppState, proposalId: unknown): ReviewStatusOutput {
  let id: string
  if (typeof proposalId === 'string') {
    id = assertString(proposalId, 'proposal_id')
  } else {
    const obj = assertObject(proposalId, 'input')
    assertNoUnknownProps(obj, GET_REVIEW_STATUS_KEYS, 'get_review_status')
    id = assertString(obj['proposal_id'], 'proposal_id')
  }
  if (!isCanonicalNumericId(id, 'prop')) throw new Error('Invalid canonical proposal ID')
  if (!isDescriptorSafeAppState(state)) throw new Error('Invalid canonical review state')
  if (
    !state || typeof state !== 'object' ||
    !Array.isArray(state.incidents) || state.incidents.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.simulations) || state.simulations.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.proposals) || state.proposals.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.auditLog) || state.auditLog.some((item) => !item || typeof item !== 'object') ||
    !Array.isArray(state.sessionTimeline) || state.sessionTimeline.some((item) => !item || typeof item !== 'object')
  ) throw new Error('Invalid review state container')
  if (state.proposals.some((proposal) => {
    const descriptor = Object.getOwnPropertyDescriptor(proposal, 'proposalId')
    return !descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string'
  })) throw new Error('Invalid canonical proposal record')
  const matchingProposals = state.proposals.filter((proposal) =>
    Object.getOwnPropertyDescriptor(proposal, 'proposalId')?.value === id,
  )
  if (matchingProposals.length > 1) throw new Error('Ambiguous duplicate proposal ID')
  const proposal = matchingProposals[0]
  if (!proposal) {
    throw new Error(boundedErrorMessage(`Unknown proposal: ${id.slice(0, 20)}`))
  }

  const statusDescriptor = Object.getOwnPropertyDescriptor(proposal, 'status')
  if (!statusDescriptor || !('value' in statusDescriptor) || typeof statusDescriptor.value !== 'string') {
    throw new Error('Invalid coherent review state')
  }
  if (!['pending', 'approved', 'rejected'].includes(statusDescriptor.value)) {
    throw new Error('Invalid proposal status')
  }
  if (!isReviewRecordCoherent(state, id)) throw new Error('Invalid coherent review state')
  const matchingAudits = state.auditLog.filter((entry) => entry.proposalId === id)
  const auditEntry = matchingAudits[0]
  const boundedProposalId = proposal.proposalId.slice(0, 40)
  const boundedDecidedAt = proposal.decidedAt?.slice(0, 40)

  const output: ReviewStatusOutput = {
    proposalId: boundedProposalId,
    status: proposal.status,
    title: proposal.title.slice(0, 200),
    incidentId: proposal.incidentId.slice(0, 40),
    simId: proposal.simId.slice(0, 40),
    decidedAt: boundedDecidedAt,
    reviewerNote: auditEntry?.reviewerNote.slice(0, 500),
    actor: auditEntry?.actor,
    message:
      proposal.status === 'pending'
        ? `Proposal ${boundedProposalId} is awaiting human review. No policy deployed.`
        : `Proposal ${boundedProposalId} was ${proposal.status} by a human (actor:${auditEntry!.actor}) at ${boundedDecidedAt}. No external policy was deployed.`,
  }

  // Enforce overall output size budget — fail closed rather than silently returning partial data
  const serialized = JSON.stringify(output)
  if (serialized.length >= 1500) {
    return {
      proposalId: boundedProposalId,
      status: proposal.status,
      title: output.title.slice(0, 80),
      incidentId: output.incidentId,
      simId: output.simId,
      message: `Proposal ${boundedProposalId} status: ${proposal.status}. (Output truncated to stay within budget.)`,
    }
  }

  return output
}
