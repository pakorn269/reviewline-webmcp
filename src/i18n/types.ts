export type Language = 'en' | 'th'

export interface TranslationDictionary {
  // Shell / Header
  appTitle: string
  tagline: string
  webmcpActive: string
  webmcpInactive: string
  webmcpActiveTitle: string
  webmcpInactiveTitle: string
  reset: string
  resetDemoStateAria: string
  toolInspectorSummary: string

  // Language Toggle
  languageToggleAria: string
  langEn: string
  langTh: string

  // Incident Queue
  incidentQueueTitle: string
  incidentQueueRegionAria: string
  selectedBadge: string

  // Evidence Panel
  evidencePanelTitle: string
  evidencePanelEmpty: string
  evidenceWorkspaceAria: string
  evidenceForAria: string
  traceHeading: string
  cohortHeading: string

  // Simulation View
  simulationTitle: string
  simulationEmpty: string
  simCompleted: string
  simAria: string
  resultIdentity: string
  baselinePolicy: string
  candidatePolicy: string
  executedAt: string
  exactRule: string
  ruleLabel: string
  thresholdLabel: string
  enforcementLabel: string
  noRegressions: string
  regressionsDetected: string
  cohortResultsAria: string
  blockedCount: string
  allowedCount: string
  totalCases: string
  counterfactualReplay: string

  // Review Panel
  reviewPanelAria: string
  reviewPanelTitle: string
  noProposalPending: string
  noProposalDesc: string
  humanReviewLine: string
  statusPending: string
  rationaleHeading: string
  notEligibleTitle: string
  notEligibleDesc: string
  reviewerIdentityLabel: string
  reviewerIdentityPlaceholder: string
  reviewNoteLabel: string
  reviewNotePlaceholder: string
  confirmEvidenceLabel: string
  confirmKeepPurchaseBlocked: string
  confirmKeepRefundBlocked: string
  confirmKeepDeploymentBlocked: string
  rejectProposalKeepBlock: string
  decisionRecorded: string
  purchaseRemainsBlocked: string
  refundRemainsBlocked: string
  deploymentRemainsBlocked: string
  completedStatus: string
  awaitingHumanDecision: string
  openStatus: string
  noExternalDeployment: string

  // Audit Log
  auditLogTitle: string
  auditLogEmpty: string
  auditLogAria: string

  // Session Timeline
  sessionTimelineTitle: string
  sessionTimelineEmpty: string
  sessionTimelineAria: string

  // Tool Inspector
  toolInspectorTitle: string
  toolInspectorAria: string
  registeredStatus: string
  fallbackStatus: string
  inputSchemaSummary: string
}

export type TranslationKey = keyof TranslationDictionary
