// ReviewPanel — the human review line.
//
// Approval and rejection live here and only here. They are never registered as
// WebMCP tools. Decision controls stay unavailable until the bound replay proves
// a blocked trigger, an allowed benign control, and zero regressions.
//
// MIT License

import { useEffect, useState } from 'react'
import type { ReviewProposal, SimulationResult } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/types'
import { formatUsd } from '../lib/format'

interface Props {
  proposal: ReviewProposal | null
  simulation: SimulationResult | null
  onApprove: (proposalId: string, reviewerId: string, note: string) => void
  onReject: (proposalId: string, reviewerId: string, note: string) => void
}

interface ConsequenceCopy {
  outcomeKey: TranslationKey
  ruleKey: TranslationKey
  unauthorizedKey: TranslationKey
  confirmKey: TranslationKey
}

const CONSEQUENCE_BY_INCIDENT: Record<string, ConsequenceCopy> = {
  'inc-002': {
    outcomeKey: 'refundRemainsBlocked',
    ruleKey: 'ruleRefundLimit',
    unauthorizedKey: 'unauthorizedRefund',
    confirmKey: 'confirmActionRefund',
  },
  'inc-003': {
    outcomeKey: 'deploymentRemainsBlocked',
    ruleKey: 'ruleEvidenceAge',
    unauthorizedKey: 'unauthorizedDeployment',
    confirmKey: 'confirmActionDeployment',
  },
}

const DEFAULT_CONSEQUENCE: ConsequenceCopy = {
  outcomeKey: 'purchaseRemainsBlocked',
  ruleKey: 'rulePurchaseCap',
  unauthorizedKey: 'unauthorizedPurchase',
  confirmKey: 'confirmActionPurchase',
}

const STATUS_LABEL_KEY: Record<ReviewProposal['status'], TranslationKey> = {
  pending: 'statusPending',
  approved: 'statusApproved',
  rejected: 'statusRejected',
}

/** A proposal is decidable only when its own bound replay proves the invariant. */
function isEvidenceEligible(
  proposal: ReviewProposal,
  simulation: SimulationResult | null,
): boolean {
  if (!simulation) return false
  const trigger = simulation.caseResults.find((r) => r.caseId === simulation.triggeringCaseId)
  const control = simulation.caseResults.find((r) => r.caseId === simulation.benignControlCaseId)
  return (
    simulation.simId === proposal.simId &&
    simulation.incidentId === proposal.incidentId &&
    simulation.enforcement === 'block' &&
    simulation.regressions.length === 0 &&
    trigger?.candidateDecision === 'BLOCKED' &&
    control?.candidateDecision === 'ALLOWED'
  )
}

export function ReviewPanel({ proposal, simulation, onApprove, onReject }: Props) {
  const { t } = useI18n()
  const [reviewerId, setReviewerId] = useState('')
  const [reviewerNote, setReviewerNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setReviewerId('')
    setReviewerNote('')
    setConfirmed(false)
  }, [proposal?.proposalId])

  if (!proposal) {
    return (
      <aside className="review-panel review-panel--empty" aria-label={t('reviewPanelAria')}>
        <p className="panel-eyebrow">{t('humanReviewLine')}</p>
        <p className="empty-msg">{t('noProposalPending')}</p>
        <p className="empty-hint">{t('noProposalDesc')}</p>
      </aside>
    )
  }

  const isPending = proposal.status === 'pending'
  const evidenceEligible = isEvidenceEligible(proposal, simulation)

  if (isPending && !evidenceEligible) {
    return (
      <aside className="review-panel" aria-label={t('reviewPanelTitle')}>
        <header className="review-header">
          <div>
            <p className="panel-eyebrow">{t('humanReviewLine')}</p>
            <h3 className="review-title">{proposal.title}</h3>
          </div>
          <span className="review-status review-status--pending">{t('statusPending')}</span>
        </header>
        <section className="review-section">
          <h4 className="field-label">{t('rationaleHeading')}</h4>
          <p className="review-rationale">{proposal.rationale}</p>
        </section>
        <div className="callout callout--blocked" role="alert">
          <strong>{t('notEligibleTitle')}</strong>
          <p>{t('notEligibleDesc')}</p>
        </div>
      </aside>
    )
  }

  const copy = CONSEQUENCE_BY_INCIDENT[proposal.incidentId] ?? DEFAULT_CONSEQUENCE
  const thresholdDisplay = simulation
    ? proposal.incidentId === 'inc-003'
      ? `${simulation.threshold} h`
      : formatUsd(simulation.threshold)
    : null
  const rule =
    thresholdDisplay === null
      ? t('ruleFallback')
      : t(copy.ruleKey, { threshold: thresholdDisplay })
  const canDecide =
    isPending &&
    evidenceEligible &&
    reviewerId.trim().length > 0 &&
    reviewerNote.trim().length > 0 &&
    confirmed

  return (
    <aside className="review-panel" aria-label={t('reviewPanelTitle')}>
      <header className="review-header">
        <div>
          <p className="panel-eyebrow">{t('humanReviewLine')}</p>
          <h3 className="review-title">{proposal.title}</h3>
        </div>
        <span className={`review-status review-status--${proposal.status}`}>
          {t(STATUS_LABEL_KEY[proposal.status])}
        </span>
      </header>

      {/* Ordered by what the reviewer needs first: the consequence of confirming,
          then the state it changes, then why the agent proposed it, then the raw
          replay identifiers. The body scrolls; the top of it must carry the most
          decision-relevant facts. */}
      <div className="review-body">
        {isPending ? (
          <div className="callout callout--consequence" role="note">
            <strong>{t('consequencesTitle')}</strong>
            <p>{t('consequenceConfirm', { rule, unauthorized: t(copy.unauthorizedKey) })}</p>
            <p>{t('consequenceReject')}</p>
          </div>
        ) : (
          proposal.decidedAt && (
            <div className={`callout callout--${proposal.status}`} role="status">
              <strong>{t('recordedDecisionHeading')}</strong>
              <p>
                {t('recordedDecisionBody', {
                  status: t(STATUS_LABEL_KEY[proposal.status]),
                  ts: new Date(proposal.decidedAt).toLocaleString(),
                })}
              </p>
              {proposal.auditNote && (
                <p className="review-audit-note">
                  {t('noteLabel')}: {proposal.auditNote}
                </p>
              )}
            </div>
          )
        )}

        <section className="review-section" aria-label={t('decisionStateHeading')}>
          <h4 className="field-label">{t('decisionStateHeading')}</h4>
          <dl className="decision-state-grid">
            <div>
              <dt>{t('dsEnforcementOutcome')}</dt>
              <dd>{t(copy.outcomeKey)}</dd>
            </div>
            <div>
              <dt>{t('dsSimulationStatus')}</dt>
              <dd>{simulation ? t('completedStatus') : t('simulationUnavailable')}</dd>
            </div>
            <div>
              <dt>{t('dsHumanReview')}</dt>
              <dd>{isPending ? t('awaitingHumanDecision') : t(STATUS_LABEL_KEY[proposal.status])}</dd>
            </div>
            <div>
              <dt>{t('dsIncidentState')}</dt>
              <dd>{t('openStatus')}</dd>
            </div>
            <div>
              <dt>{t('dsPolicyDeployment')}</dt>
              <dd>{t('noExternalDeployment')}</dd>
            </div>
          </dl>
        </section>

        <section className="review-section">
          <h4 className="field-label">{t('rationaleHeading')}</h4>
          <p className="review-rationale">{proposal.rationale}</p>
        </section>

        {simulation && (
          <details className="review-section review-sim-summary">
            <summary>{t('replaySummaryLabel', { resultId: simulation.resultId })}</summary>
            <dl className="review-sim-dl">
              <div>
                <dt>{t('replayFieldSimulation')}</dt>
                <dd>{simulation.simId}</dd>
              </div>
              <div>
                <dt>{t('replayFieldResult')}</dt>
                <dd>
                  <code>{simulation.resultId}</code>
                </dd>
              </div>
              <div>
                <dt>{t('exactRule')}</dt>
                <dd>{simulation.ruleExpression}</dd>
              </div>
              <div>
                <dt>{t('replayFieldTrigger')}</dt>
                <dd>{simulation.triggeringCaseId} · BLOCKED</dd>
              </div>
              <div>
                <dt>{t('replayFieldControl')}</dt>
                <dd>{simulation.benignControlCaseId} · ALLOWED</dd>
              </div>
              <div>
                <dt>{t('replayFieldRegressions')}</dt>
                <dd>{simulation.regressions.length}</dd>
              </div>
            </dl>
          </details>
        )}

      </div>

      {/* The least-authority disclaimer lives in the always-visible authority bar;
          repeating it here only pushed the decision below the fold. */}
      {isPending ? (
        <form className="review-confirmation" onSubmit={(event) => event.preventDefault()}>
          <p className="review-required-hint">
            <strong>{t('humanDecisionRequiredTitle')}</strong> {t('requiredConfirmationsHint')}
          </p>
          <label className="review-field">
            <span>
              {t('reviewerIdentityLabel')} <strong>({t('requiredMarker')})</strong>
            </span>
            <input
              value={reviewerId}
              onChange={(event) => setReviewerId(event.target.value)}
              maxLength={80}
              autoComplete="off"
              required
            />
          </label>
          <label className="review-field">
            <span>
              {t('reviewNoteLabel')} <strong>({t('requiredMarker')})</strong>
            </span>
            <textarea
              value={reviewerNote}
              onChange={(event) => setReviewerNote(event.target.value)}
              maxLength={500}
              required
            />
          </label>
          <label className="review-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {t('confirmEvidenceLabel')} <strong>({t('requiredMarker')})</strong>
            </span>
          </label>
          <div className="review-actions">
            <button
              type="button"
              className="btn btn-approve"
              disabled={!canDecide}
              onClick={() => onApprove(proposal.proposalId, reviewerId.trim(), reviewerNote.trim())}
            >
              {t(copy.confirmKey, { rule })}
            </button>
            <button
              type="button"
              className="btn btn-reject"
              disabled={!canDecide}
              onClick={() => onReject(proposal.proposalId, reviewerId.trim(), reviewerNote.trim())}
            >
              {t('rejectProposalKeepBlock')}
            </button>
          </div>
        </form>
      ) : (
        <div className="review-actions review-actions--decided" role="status">
          {t('decisionRecordedNote')}
        </div>
      )}
    </aside>
  )
}
