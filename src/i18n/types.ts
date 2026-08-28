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
  executeTool: string
  executingTool: string
  runHeroJourney: string
  runningHeroJourney: string
  parametersLabel: string
  toolOutputLabel: string

  // Guide Modal
  guideButton: string
  guideButtonAria: string
  guideButtonTitle: string
  guideModalTitle: string
  guideModalCloseAria: string
  guideModalClose: string
  guideTabConcept: string
  guideTabWebmcp: string
  guideTabUsecases: string
  guideTabTour: string
  guideConceptTitle: string
  guideConceptSubtitle: string
  guideDetectiveTitle: string
  guideDetectiveDesc: string
  guideJudgeTitle: string
  guideJudgeDesc: string
  guideWebmcpTitle: string
  guideWebmcpSubtitle: string
  guideWebmcpPoint1Title: string
  guideWebmcpPoint1Desc: string
  guideWebmcpPoint2Title: string
  guideWebmcpPoint2Desc: string
  guideWebmcpPoint3Title: string
  guideWebmcpPoint3Desc: string
  guideUsecasesTitle: string
  guideUsecasesSubtitle: string
  guideUsecase1Title: string
  guideUsecase1Desc: string
  guideUsecase1Demo: string
  guideUsecase2Title: string
  guideUsecase2Desc: string
  guideUsecase2Demo: string
  guideUsecase3Title: string
  guideUsecase3Desc: string
  guideUsecase3Demo: string
  guideUsecase4Title: string
  guideUsecase4Desc: string
  guideUsecase4Demo: string
  guideTourTitle: string
  guideTourSubtitle: string
  guideTourStep1: string
  guideTourStep2: string
  guideTourStep3: string
  guideTourStep4: string
}

export type TranslationKey = keyof TranslationDictionary
