import { useEffect, useState } from 'react'
import type { ReviewProposal, SimulationResult } from '../domain/domain'

interface Props {
  proposal: ReviewProposal | null
  simulation: SimulationResult | null
  onApprove: (proposalId: string, reviewerId: string, note: string) => void
  onReject: (proposalId: string, reviewerId: string, note: string) => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function ReviewPanel({ proposal, simulation, onApprove, onReject }: Props) {
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
      <aside className="review-panel review-panel--empty" aria-label="Review panel">
        <p className="review-empty-msg">No pending proposal. An agent can draft one only after a clean replay.</p>
      </aside>
    )
  }

  const isPending = proposal.status === 'pending'
  const triggerResult = simulation?.caseResults.find((result) => result.caseId === simulation.triggeringCaseId)
  const controlResult = simulation?.caseResults.find((result) => result.caseId === simulation.benignControlCaseId)
  const evidenceEligible = Boolean(
    simulation &&
    simulation.simId === proposal.simId &&
    simulation.incidentId === proposal.incidentId &&
    simulation.enforcement === 'block' &&
    simulation.regressions.length === 0 &&
    triggerResult?.candidateDecision === 'BLOCKED' &&
    controlResult?.candidateDecision === 'ALLOWED',
  )
  const canDecide = isPending && evidenceEligible && reviewerId.trim().length > 0 && reviewerNote.trim().length > 0 && confirmed

  if (isPending && !evidenceEligible) {
    return (
      <aside className="review-panel" aria-label="Human review panel">
        <header className="review-header">
          <div>
            <p className="review-eyebrow">Human review line</p>
            <h3 className="review-title">{proposal.title}</h3>
          </div>
          <span className="review-status review-status--pending">PENDING</span>
        </header>
        <div className="review-body">
          <section className="review-section">
            <h4>Rationale</h4>
            <p className="review-rationale">{proposal.rationale}</p>
          </section>
          <div className="review-consequence" role="alert">
            <strong>Replay evidence is not eligible for a human decision.</strong>
            <p>The decision controls remain unavailable. Run a fresh authoritative replay with a blocked trigger, allowed benign control, and zero regressions.</p>
          </div>
        </div>
      </aside>
    )
  }
  const threshold = simulation ? formatCurrency(simulation.threshold) : 'the candidate threshold'
  const reviewCopy = (() => {
    if (proposal.incidentId === 'inc-003') {
      const hours = simulation ? `${simulation.threshold} h` : 'the candidate'
      return {
        outcome: 'Deployment remains blocked',
        rule: `${hours} evidence-age limit`,
        unauthorized: 'the deployment remains blocked pending valid evidence and attestation',
        confirm: `Confirm ${hours} evidence-age limit; keep deployment blocked`,
      }
    }
    if (proposal.incidentId === 'inc-002') {
      return {
        outcome: 'Refund remains blocked',
        rule: `${threshold} refund limit`,
        unauthorized: 'the refund remains unapproved',
        confirm: `Confirm ${threshold} refund limit; keep refund blocked`,
      }
    }
    return {
      outcome: 'Purchase remains blocked',
      rule: `${threshold} purchase cap`,
      unauthorized: 'the blocked purchase remains unauthorized',
      confirm: `Confirm ${threshold} cap; keep purchase blocked`,
    }
  })()

  return (
    <aside className="review-panel" aria-label="Human review panel">
      <header className="review-header">
        <div>
          <p className="review-eyebrow">Human review line</p>
          <h3 className="review-title">{proposal.title}</h3>
        </div>
        <span className={`review-status review-status--${proposal.status}`}>
          {proposal.status.toUpperCase()}
        </span>
      </header>

      <div className="review-body">
        <section className="review-section">
          <h4>Rationale</h4>
          <p className="review-rationale">{proposal.rationale}</p>
        </section>

        <section className="review-section" aria-label="Decision state model">
          <h4>Decision state</h4>
          <dl className="decision-state-grid">
            <div><dt>Enforcement outcome</dt><dd>{reviewCopy.outcome}</dd></div>
            <div><dt>Simulation status</dt><dd>{simulation ? 'Completed' : 'Unavailable'}</dd></div>
            <div><dt>Human review</dt><dd>{isPending ? 'Awaiting human decision' : proposal.status}</dd></div>
            <div><dt>Incident state</dt><dd>Open</dd></div>
            <div><dt>Policy deployment</dt><dd>No external deployment</dd></div>
          </dl>
        </section>

        <div className="review-consequence" role="note">
          <strong>Decision consequences</strong>
          <p>
            Confirming retains the candidate {reviewCopy.rule}; {reviewCopy.unauthorized}.
          </p>
          <p>
            Rejecting discards this proposal and keeps the current block in force. Neither action deploys policy or mutates an external system.
          </p>
        </div>

        {simulation && (
          <details className="review-section review-sim-summary">
            <summary>Replay evidence · {simulation.resultId}</summary>
            <dl className="review-sim-dl">
              <div><dt>Simulation</dt><dd>{simulation.simId}</dd></div>
              <div><dt>Result</dt><dd><code>{simulation.resultId}</code></dd></div>
              <div><dt>Exact rule</dt><dd>{simulation.ruleExpression}</dd></div>
              <div><dt>Trigger</dt><dd>{simulation.triggeringCaseId} · BLOCKED</dd></div>
              <div><dt>Benign control</dt><dd>{simulation.benignControlCaseId} · ALLOWED</dd></div>
              <div><dt>Regressions</dt><dd>{simulation.regressions.length}</dd></div>
            </dl>
          </details>
        )}

        {proposal.decidedAt && (
          <section className="review-section">
            <h4>Recorded decision</h4>
            <p>{proposal.status} at {new Date(proposal.decidedAt).toLocaleString()}</p>
            {proposal.auditNote && <p className="review-audit-note">Note: {proposal.auditNote}</p>}
          </section>
        )}
      </div>

      {isPending ? (
        <form className="review-confirmation" onSubmit={(event) => event.preventDefault()}>
          <p className="review-actions-note">
            <strong>Human decision required.</strong> Approval and rejection are intentionally absent from the WebMCP manifest. This is least-authority product design, not a guarantee against every form of browser actuation.
          </p>
          <p className="review-required-hint">Complete all three required confirmations to enable a decision.</p>
          <label className="review-field">
            <span>Reviewer identity <strong>(required)</strong></span>
            <input
              value={reviewerId}
              onChange={(event) => setReviewerId(event.target.value)}
              maxLength={80}
              autoComplete="off"
              required
            />
          </label>
          <label className="review-field">
            <span>Review note <strong>(required)</strong></span>
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
            <span>I reviewed the evidence, trigger, benign control, and deployment consequence. <strong>(required)</strong></span>
          </label>
          <div className="review-actions">
            <button
              type="button"
              className="btn btn-approve"
              disabled={!canDecide}
              onClick={() => onApprove(proposal.proposalId, reviewerId.trim(), reviewerNote.trim())}
            >
              {reviewCopy.confirm}
            </button>
            <button
              type="button"
              className="btn btn-reject"
              disabled={!canDecide}
              onClick={() => onReject(proposal.proposalId, reviewerId.trim(), reviewerNote.trim())}
            >
              Reject proposal; keep current block
            </button>
          </div>
        </form>
      ) : (
        <div className="review-actions review-actions--decided" role="status">
          Human decision recorded. No external policy was deployed.
        </div>
      )}
    </aside>
  )
}
