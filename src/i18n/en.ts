import type { TranslationDictionary } from './types'

export const en: TranslationDictionary = {
  // Shell / Header
  appTitle: 'Reviewline',
  tagline: 'Agents investigate. Humans authorize.',
  webmcpActive: 'WebMCP ✓',
  webmcpInactive: 'WebMCP —',
  webmcpActiveTitle: 'WebMCP tools registered',
  webmcpInactiveTitle: 'WebMCP not available',
  reset: 'Reset',
  resetDemoStateAria: 'Reset demo state',
  toolInspectorSummary: 'WebMCP Tool Inspector ({count} tools)',

  // Language Toggle
  languageToggleAria: 'Switch language to {targetLang}',
  langEn: 'EN',
  langTh: 'TH',

  // Incident Queue
  incidentQueueTitle: 'Incidents',
  incidentQueueRegionAria: 'Incident queue',
  selectedBadge: 'Selected',

  // Evidence Panel
  evidencePanelTitle: 'Evidence Trace',
  evidencePanelEmpty: 'Select an incident from the queue to inspect evidence.',
  evidenceWorkspaceAria: 'Evidence workspace',
  evidenceForAria: 'Evidence for {id}',
  traceHeading: 'Trace',
  cohortHeading: 'Cohort',

  // Simulation View
  simulationTitle: 'Guardrail Patch Simulation',
  simulationEmpty: 'No simulation run yet. Use simulate_guardrail_patch to replay a rule.',
  simCompleted: 'Completed',
  simAria: 'Simulation {simId}',
  resultIdentity: 'Result identity',
  baselinePolicy: 'Baseline policy',
  candidatePolicy: 'Candidate policy',
  executedAt: 'Executed',
  exactRule: 'Exact rule',
  ruleLabel: 'Rule: {ruleKind}',
  thresholdLabel: 'Threshold: {threshold}',
  enforcementLabel: 'Enforcement: {enforcement}',
  noRegressions: 'No regressions detected',
  regressionsDetected: '{count} regressions detected',
  cohortResultsAria: 'Candidate outcome totals',
  blockedCount: 'Blocked: {count}',
  allowedCount: 'Allowed: {count}',
  totalCases: 'Total cases: {count}',
  counterfactualReplay: 'Counterfactual replay',

  // Review Panel
  reviewPanelAria: 'Review panel',
  reviewPanelTitle: 'Human review panel',
  noProposalPending: 'No pending proposal. An agent can draft one only after a clean replay.',
  noProposalDesc:
    'No proposal is currently awaiting human decision. An agent must run a simulation and draft a proposal first.',
  humanReviewLine: 'Human review line',
  statusPending: 'PENDING',
  rationaleHeading: 'Rationale',
  notEligibleTitle: 'Replay evidence is not eligible for a human decision.',
  notEligibleDesc:
    'The decision controls remain unavailable. Run a fresh authoritative replay with a blocked trigger, allowed benign control, and zero regressions.',
  reviewerIdentityLabel: 'Reviewer identity',
  reviewerIdentityPlaceholder: 'e.g. alice@platform-safety',
  reviewNoteLabel: 'Review note',
  reviewNotePlaceholder: 'Explain the human authorization or rejection rationale...',
  confirmEvidenceLabel: 'I confirm I have reviewed the triggering trace and benign control simulation results.',
  confirmKeepPurchaseBlocked: 'Confirm policy patch · keep purchase blocked',
  confirmKeepRefundBlocked: 'Confirm policy patch · keep refund blocked',
  confirmKeepDeploymentBlocked: 'Confirm policy patch · keep deployment blocked',
  rejectProposalKeepBlock: 'Reject proposal · keep current block in force',
  decisionRecorded: 'Decision Recorded',
  purchaseRemainsBlocked: 'Purchase remains blocked',
  refundRemainsBlocked: 'Refund remains blocked',
  deploymentRemainsBlocked: 'Deployment remains blocked',
  completedStatus: 'Completed',
  awaitingHumanDecision: 'Awaiting human decision',
  openStatus: 'Open',
  noExternalDeployment: 'No external deployment',

  // Audit Log
  auditLogTitle: 'Audit Log',
  auditLogEmpty: 'No audit entries yet. Decisions appear here after human review.',
  auditLogAria: 'Audit log',

  // Session Timeline
  sessionTimelineTitle: 'Session Timeline',
  sessionTimelineEmpty: 'Capability changes and tool calls appear here.',
  sessionTimelineAria: 'Session timeline',

  // Tool Inspector
  toolInspectorTitle: 'WebMCP Tools',
  toolInspectorAria: 'WebMCP tool inspector',
  registeredStatus: '✓ Registered ({count})',
  fallbackStatus: 'WebMCP not available — dev inspector mode',
  inputSchemaSummary: 'Input Schema',
}
