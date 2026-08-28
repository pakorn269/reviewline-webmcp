import { useEffect, useState } from 'react'
import type { ReviewProposal, SimulationResult } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'

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
  const { t, language } = useI18n()
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
        <p className="review-empty-msg">{t('noProposalPending')}</p>
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
      <aside className="review-panel" aria-label={t('reviewPanelTitle')}>
        <header className="review-header">
          <div>
            <p className="review-eyebrow">{t('humanReviewLine')}</p>
            <h3 className="review-title">{proposal.title}</h3>
          </div>
          <span className="review-status review-status--pending">{t('statusPending')}</span>
        </header>
        <div className="review-body">
          <section className="review-section">
            <h4>{t('rationaleHeading')}</h4>
            <p className="review-rationale">{proposal.rationale}</p>
          </section>
          <div className="review-consequence" role="alert">
            <strong>{t('notEligibleTitle')}</strong>
            <p>{t('notEligibleDesc')}</p>
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
    <aside className="review-panel" aria-label={t('reviewPanelTitle')}>
      <header className="review-header">
        <div>
          <p className="review-eyebrow">{t('humanReviewLine')}</p>
          <h3 className="review-title">{proposal.title}</h3>
        </div>
        <span className={`review-status review-status--${proposal.status}`}>
          {proposal.status.toUpperCase()}
        </span>
      </header>

      <div className="review-body">
        <section className="review-section">
          <h4>{t('rationaleHeading')}</h4>
          <p className="review-rationale">{proposal.rationale}</p>
        </section>

        <section className="review-section" aria-label="Decision state model">
          <h4>{language === 'th' ? 'สถานะการตัดสินใจ' : 'Decision state'}</h4>
          <dl className="decision-state-grid">
            <div><dt>{language === 'th' ? 'ผลลัพธ์การบังคับใช้' : 'Enforcement outcome'}</dt><dd>{reviewCopy.outcome}</dd></div>
            <div><dt>{language === 'th' ? 'สถานะการจำลอง' : 'Simulation status'}</dt><dd>{simulation ? (language === 'th' ? t('completedStatus') : 'Completed') : (language === 'th' ? 'ไม่พร้อมใช้งาน' : 'Unavailable')}</dd></div>
            <div><dt>{language === 'th' ? 'การตรวจสอบโดยมนุษย์' : 'Human review'}</dt><dd>{isPending ? (language === 'th' ? t('awaitingHumanDecision') : 'Awaiting human decision') : proposal.status}</dd></div>
            <div><dt>{language === 'th' ? 'สถานะเหตุการณ์' : 'Incident state'}</dt><dd>{language === 'th' ? t('openStatus') : 'Open'}</dd></div>
            <div><dt>{language === 'th' ? 'การปรับใช้นโยบาย' : 'Policy deployment'}</dt><dd>{language === 'th' ? t('noExternalDeployment') : 'No external deployment'}</dd></div>
          </dl>
        </section>

        <div className="review-consequence" role="note">
          <strong>{language === 'th' ? 'ผลที่ตามมาของการตัดสินใจ' : 'Decision consequences'}</strong>
          <p>
            {language === 'th'
              ? `การยืนยันจะคงไว้ซึ่งข้อเสนอ ${reviewCopy.rule}; ${reviewCopy.unauthorized}.`
              : `Confirming retains the candidate ${reviewCopy.rule}; ${reviewCopy.unauthorized}.`}
          </p>
          <p>
            {language === 'th'
              ? 'การปฏิเสธจะยกเลิกข้อเสนอนี้และคงการบล็อกปัจจุบันไว้ ทั้งสองการกระทำจะไม่มีการปรับใช้นโยบายจริงหรือแก้ไขระบบภายนอกใดๆ'
              : 'Rejecting discards this proposal and keeps the current block in force. Neither action deploys policy or mutates an external system.'}
          </p>
        </div>

        {simulation && (
          <details className="review-section review-sim-summary">
            <summary>{language === 'th' ? `หลักฐานการจำลอง · ${simulation.resultId}` : `Replay evidence · ${simulation.resultId}`}</summary>
            <dl className="review-sim-dl">
              <div><dt>{language === 'th' ? 'การจำลอง' : 'Simulation'}</dt><dd>{simulation.simId}</dd></div>
              <div><dt>{language === 'th' ? 'ผลลัพธ์' : 'Result'}</dt><dd><code>{simulation.resultId}</code></dd></div>
              <div><dt>{language === 'th' ? 'กฎที่แน่นอน' : 'Exact rule'}</dt><dd>{simulation.ruleExpression}</dd></div>
              <div><dt>{language === 'th' ? 'กรณีที่กระตุ้น' : 'Trigger'}</dt><dd>{simulation.triggeringCaseId} · BLOCKED</dd></div>
              <div><dt>{language === 'th' ? 'กรณีควบคุมปกติ' : 'Benign control'}</dt><dd>{simulation.benignControlCaseId} · ALLOWED</dd></div>
              <div><dt>{language === 'th' ? 'การถดถอย' : 'Regressions'}</dt><dd>{simulation.regressions.length}</dd></div>
            </dl>
          </details>
        )}

        {proposal.decidedAt && (
          <section className="review-section">
            <h4>{language === 'th' ? 'การตัดสินใจที่บันทึกไว้' : 'Recorded decision'}</h4>
            <p>{proposal.status} at {new Date(proposal.decidedAt).toLocaleString()}</p>
            {proposal.auditNote && <p className="review-audit-note">{language === 'th' ? 'บันทึก' : 'Note'}: {proposal.auditNote}</p>}
          </section>
        )}
      </div>

      {isPending ? (
        <form className="review-confirmation" onSubmit={(event) => event.preventDefault()}>
          <p className="review-actions-note">
            <strong>{language === 'th' ? 'จำเป็นต้องมีการตัดสินใจโดยมนุษย์' : 'Human decision required.'}</strong>{' '}
            {language === 'th'
              ? 'การอนุมัติและการปฏิเสธถูกละเว้นจาก WebMCP manifest โดยเจตนา นี่คือการออกแบบผลิตภัณฑ์ตามสิทธิ์ขั้นต่ำสุด ไม่ใช่การรับประกันการป้องกันการสั่งการของเบราว์เซอร์ทุกรูปแบบ'
              : 'Approval and rejection are intentionally absent from the WebMCP manifest. This is least-authority product design, not a guarantee against every form of browser actuation.'}
          </p>
          <p className="review-required-hint">
            {language === 'th'
              ? 'กรอกข้อมูลยืนยันที่จำเป็นทั้งสามส่วนเพื่อเปิดใช้งานการตัดสินใจ'
              : 'Complete all three required confirmations to enable a decision.'}
          </p>
          <label className="review-field">
            <span>
              {language === 'th' ? 'ตัวตนของผู้ตรวจสอบ' : 'Reviewer identity'}{' '}
              <strong>({language === 'th' ? 'จำเป็น' : 'required'})</strong>
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
              {language === 'th' ? 'บันทึกการตรวจสอบ' : 'Review note'}{' '}
              <strong>({language === 'th' ? 'จำเป็น' : 'required'})</strong>
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
              {language === 'th'
                ? 'ข้าพเจ้าได้ตรวจสอบหลักฐาน กรณีที่กระตุ้น กรณีควบคุมปกติ และผลกระทบต่อการปรับใช้แล้ว'
                : 'I reviewed the evidence, trigger, benign control, and deployment consequence.'}{' '}
              <strong>({language === 'th' ? 'จำเป็น' : 'required'})</strong>
            </span>
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
              {language === 'th' ? 'ปฏิเสธข้อเสนอ; บังคับใช้การบล็อกปัจจุบันต่อไป' : 'Reject proposal; keep current block'}
            </button>
          </div>
        </form>
      ) : (
        <div className="review-actions review-actions--decided" role="status">
          {language === 'th' ? 'บันทึกการตัดสินใจของมนุษย์แล้ว ไม่มีการปรับใช้นโยบายภายนอก' : 'Human decision recorded. No external policy was deployed.'}
        </div>
      )}
    </aside>
  )
}
