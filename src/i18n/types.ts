export type Language = 'en' | 'th'

export interface TranslationDictionary {
  // ── Shell / header ────────────────────────────────────────────────────────
  appTitle: string
  tagline: string
  webmcpActive: string
  webmcpInactive: string
  webmcpActiveTitle: string
  webmcpInactiveTitle: string
  reset: string
  resetDemoStateAria: string
  toolInspectorSummary: string

  // ── Language toggle ───────────────────────────────────────────────────────
  languageToggleAria: string
  langEn: string
  langTh: string

  // ── Authority bar ─────────────────────────────────────────────────────────
  authorityBarAria: string
  phaseEyebrow: string
  phaseInvestigation: string
  phaseReplayReady: string
  phaseAwaitingHumanDecision: string
  phaseDecided: string
  manifestTitle: string
  manifestHint: string
  exposureExposed: string
  exposureWithheld: string
  humanOnlyTitle: string
  humanOnlyNote: string
  exposureNever: string
  humanActionApprove: string
  humanActionReject: string
  humanActionActivate: string

  // ── Incident queue ────────────────────────────────────────────────────────
  incidentQueueTitle: string
  incidentQueueRegionAria: string
  selectedBadge: string

  // ── Evidence panel ────────────────────────────────────────────────────────
  evidencePanelTitle: string
  evidencePanelEmpty: string
  evidencePanelEmptyHint: string
  evidenceWorkspaceAria: string
  evidenceForAria: string
  traceHeading: string
  traceEntryAria: string
  cohortHeading: string
  blockedAtLabel: string

  // ── Simulation view ───────────────────────────────────────────────────────
  simulationTitle: string
  simulationEmpty: string
  simulationEmptyHint: string
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
  simNoRegressionDetail: string
  simRegressionFailedTitle: string
  simRegressionFailedDetail: string
  cohortResultsAria: string
  simLabelBlocked: string
  simLabelAllowed: string
  simLabelTotal: string
  simCaseTableAria: string
  simColEvidenceCase: string
  simColAmount: string
  simColTransition: string
  simBadgeTrigger: string
  simBadgeBenign: string
  simNotMonetary: string
  counterfactualReplay: string

  // ── Review panel ──────────────────────────────────────────────────────────
  reviewPanelAria: string
  reviewPanelTitle: string
  noProposalPending: string
  noProposalDesc: string
  humanReviewLine: string
  statusPending: string
  statusApproved: string
  statusRejected: string
  rationaleHeading: string
  notEligibleTitle: string
  notEligibleDesc: string
  decisionStateHeading: string
  dsEnforcementOutcome: string
  dsSimulationStatus: string
  dsHumanReview: string
  dsIncidentState: string
  dsPolicyDeployment: string
  simulationUnavailable: string
  consequencesTitle: string
  consequenceConfirm: string
  consequenceReject: string
  rulePurchaseCap: string
  ruleRefundLimit: string
  ruleEvidenceAge: string
  ruleFallback: string
  unauthorizedPurchase: string
  unauthorizedRefund: string
  unauthorizedDeployment: string
  confirmActionPurchase: string
  confirmActionRefund: string
  confirmActionDeployment: string
  rejectProposalKeepBlock: string
  replaySummaryLabel: string
  replayFieldSimulation: string
  replayFieldResult: string
  replayFieldTrigger: string
  replayFieldControl: string
  replayFieldRegressions: string
  recordedDecisionHeading: string
  recordedDecisionBody: string
  noteLabel: string
  humanDecisionRequiredTitle: string
  requiredConfirmationsHint: string
  requiredMarker: string
  reviewerIdentityLabel: string
  reviewNoteLabel: string
  confirmEvidenceLabel: string
  decisionRecorded: string
  decisionRecordedNote: string
  purchaseRemainsBlocked: string
  refundRemainsBlocked: string
  deploymentRemainsBlocked: string
  completedStatus: string
  awaitingHumanDecision: string
  openStatus: string
  noExternalDeployment: string

  // ── Audit log ─────────────────────────────────────────────────────────────
  auditLogTitle: string
  auditLogEmpty: string
  auditLogAria: string

  // ── Session timeline ──────────────────────────────────────────────────────
  sessionRecordAria: string
  sessionRecordSummary: string
  sessionTimelineTitle: string
  sessionTimelineEmpty: string
  sessionTimelineAria: string

  // ── Tool inspector ────────────────────────────────────────────────────────
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

  // ── Guide modal ───────────────────────────────────────────────────────────
  guideButton: string
  guideButtonAria: string
  guideButtonTitle: string
  guideModalTitle: string
  guideModalBadge: string
  guideModalCloseAria: string
  guideModalClose: string
  guideSectionsAria: string
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
  guideBadgeCritical: string
  guideBadgeHigh: string
  guideBadgeMedium: string
  guideBadgeSafety: string
  guideTourTitle: string
  guideTourSubtitle: string
  guideTourStep1: string
  guideTourStep2: string
  guideTourStep3: string
  guideTourStep4: string
}

export type TranslationKey = keyof TranslationDictionary
