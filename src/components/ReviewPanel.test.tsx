import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReviewPanel } from './ReviewPanel'
import { I18nProvider } from '../i18n/I18nContext'
import { makeInitialState, runSimulation, draftProposal, resetCounters } from '../domain/domain'
import type { ReviewProposal, SimulationResult } from '../domain/domain'

function makeProposalAndSim() {
  resetCounters()
  const state = makeInitialState()
  const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
  const { proposal } = draftProposal(
    s1,
    'inc-001',
    'Enforce procurement cap',
    'Prevent prompt injection from overriding caps.',
    sim.simId,
  )
  return { proposal, sim }
}

describe('ReviewPanel', () => {
  it('shows placeholder when no proposal', () => {
    render(<ReviewPanel proposal={null} simulation={null} onApprove={() => undefined} onReject={() => undefined} />)
    expect(screen.getByText(/no pending proposal/i)).toBeInTheDocument()
  })

  it('renders proposal title and rationale', () => {
    const { proposal, sim } = makeProposalAndSim()
    render(
      <ReviewPanel
        proposal={proposal}
        simulation={sim}
        onApprove={() => undefined}
        onReject={() => undefined}
      />,
    )
    expect(screen.getByText(/Enforce procurement cap/i)).toBeInTheDocument()
    expect(screen.getByText(/Prevent prompt injection/i)).toBeInTheDocument()
  })

  it('refuses human decision controls when replay evidence is not eligible', () => {
    const { proposal, sim } = makeProposalAndSim()
    const forged: SimulationResult = {
      ...sim,
      enforcement: 'allow',
      regressions: [],
      caseResults: sim.caseResults.map((result) => ({ ...result, candidateDecision: 'ALLOWED' })),
    }
    render(
      <ReviewPanel
        proposal={proposal}
        simulation={forged}
        onApprove={() => undefined}
        onReject={() => undefined}
      />,
    )
    expect(screen.getByText(/replay evidence is not eligible/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
  })

  it('refuses decision controls when clean replay evidence belongs to another incident', () => {
    const { proposal } = makeProposalAndSim()
    const { sim: unrelated } = runSimulation(makeInitialState(), 'inc-002', 'refund_limit', 2000, 'block')
    render(
      <ReviewPanel
        proposal={proposal}
        simulation={unrelated}
        onApprove={() => undefined}
        onReject={() => undefined}
      />,
    )
    expect(screen.getByText(/replay evidence is not eligible/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
  })

  it('requires explicit human confirmation and records reviewer identity and note', () => {
    const { proposal, sim } = makeProposalAndSim()
    const onApprove = vi.fn()
    render(
      <ReviewPanel
        proposal={proposal}
        simulation={sim}
        onApprove={onApprove}
        onReject={() => undefined}
      />,
    )
    const approve = screen.getByRole('button', { name: /confirm.*keep purchase blocked/i })
    expect(approve).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/reviewer identity/i), { target: { value: 'safety-lead' } })
    fireEvent.change(screen.getByLabelText(/review note/i), { target: { value: 'Trigger and benign control verified.' } })
    fireEvent.click(screen.getByLabelText(/reviewed the evidence/i))
    fireEvent.click(approve)
    expect(onApprove).toHaveBeenCalledWith(
      proposal.proposalId,
      'safety-lead',
      'Trigger and benign control verified.',
    )
  })

  it('uses a consequence-specific rejection action', () => {
    const { proposal, sim } = makeProposalAndSim()
    const onReject = vi.fn()
    render(
      <ReviewPanel
        proposal={proposal}
        simulation={sim}
        onApprove={() => undefined}
        onReject={onReject}
      />,
    )
    fireEvent.change(screen.getByLabelText(/reviewer identity/i), { target: { value: 'risk-owner' } })
    fireEvent.change(screen.getByLabelText(/review note/i), { target: { value: 'Need broader benign coverage.' } })
    fireEvent.click(screen.getByLabelText(/reviewed the evidence/i))
    fireEvent.click(screen.getByRole('button', { name: /reject proposal.*keep current block/i }))
    expect(onReject).toHaveBeenCalledWith(
      proposal.proposalId,
      'risk-owner',
      'Need broader benign coverage.',
    )
  })

  it('separates enforcement, simulation, human review, incident, and deployment states', () => {
    const { proposal, sim } = makeProposalAndSim()
    render(
      <ReviewPanel proposal={proposal} simulation={sim} onApprove={() => undefined} onReject={() => undefined} />,
    )
    expect(screen.getByText('Purchase remains blocked')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Awaiting human decision')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('No external deployment')).toBeInTheDocument()
  })

  it('uses refund-specific consequences for the support incident', () => {
    const { nextState, sim } = runSimulation(makeInitialState(), 'inc-002', 'refund_limit', 2000, 'block')
    const { proposal } = draftProposal(nextState, 'inc-002', 'Retain refund authority', 'Clean refund replay.', sim.simId)
    render(<ReviewPanel proposal={proposal} simulation={sim} onApprove={() => undefined} onReject={() => undefined} />)
    expect(screen.getByText('Refund remains blocked')).toBeInTheDocument()
    expect(screen.getAllByText(/\$2,000 refund limit/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/purchase remains blocked/i)).not.toBeInTheDocument()
  })

  it('uses evidence-age units and deployment consequences for the deployment incident', () => {
    const { nextState, sim } = runSimulation(makeInitialState(), 'inc-003', 'stale_evidence', 24, 'block')
    const { proposal } = draftProposal(nextState, 'inc-003', 'Retain evidence gate', 'Clean deployment replay.', sim.simId)
    render(<ReviewPanel proposal={proposal} simulation={sim} onApprove={() => undefined} onReject={() => undefined} />)
    expect(screen.getByText('Deployment remains blocked')).toBeInTheDocument()
    expect(screen.getAllByText(/24 h evidence-age limit/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\$24/)).not.toBeInTheDocument()
  })

  it('explains required confirmation fields and both decision consequences', () => {
    const { proposal, sim } = makeProposalAndSim()
    render(
      <ReviewPanel proposal={proposal} simulation={sim} onApprove={() => undefined} onReject={() => undefined} />,
    )
    expect(screen.getByText(/complete all three required confirmations/i)).toBeInTheDocument()
    expect(screen.getByText(/confirming retains the candidate.*purchase cap/i)).toBeInTheDocument()
    expect(screen.getByText(/rejecting discards this proposal/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject proposal.*keep current block/i })).toBeDisabled()
  })

  it('approve/reject buttons are disabled when proposal is already decided', () => {
    const { proposal, sim } = makeProposalAndSim()
    const decided: ReviewProposal = { ...proposal, status: 'approved', decidedAt: new Date().toISOString() }
    render(
      <ReviewPanel
        proposal={decided}
        simulation={sim}
        onApprove={() => undefined}
        onReject={() => undefined}
      />,
    )
    const approveBtn = screen.queryByRole('button', { name: /approve/i })
    const rejectBtn = screen.queryByRole('button', { name: /reject/i })
    // Both should be absent or disabled when already decided
    if (approveBtn) expect(approveBtn).toBeDisabled()
    if (rejectBtn) expect(rejectBtn).toBeDisabled()
  })

  it('shows simulation summary if provided', () => {
    const { proposal, sim } = makeProposalAndSim()
    render(
      <ReviewPanel
        proposal={proposal}
        simulation={sim as SimulationResult}
        onApprove={() => undefined}
        onReject={() => undefined}
      />,
    )
    expect(screen.getByText(/sim-0001/i)).toBeInTheDocument()
  })

  it('clears reviewer confirmation when a different proposal replaces the current one', () => {
    const { proposal, sim } = makeProposalAndSim()
    const callbacks = { onApprove: vi.fn(), onReject: vi.fn() }
    const { rerender } = render(<ReviewPanel proposal={proposal} simulation={sim} {...callbacks} />)
    fireEvent.change(screen.getByLabelText(/reviewer identity/i), { target: { value: 'old-reviewer' } })
    fireEvent.change(screen.getByLabelText(/review note/i), { target: { value: 'Old evidence review.' } })
    fireEvent.click(screen.getByLabelText(/reviewed the evidence/i))
    expect(screen.getByRole('button', { name: /confirm.*keep purchase blocked/i })).toBeEnabled()

    const replacement = { ...proposal, proposalId: 'prop-0002', title: 'Second proposal' }
    rerender(<ReviewPanel proposal={replacement} simulation={sim} {...callbacks} />)

    expect(screen.getByLabelText(/reviewer identity/i)).toHaveValue('')
    expect(screen.getByLabelText(/review note/i)).toHaveValue('')
    expect(screen.getByLabelText(/reviewed the evidence/i)).not.toBeChecked()
    expect(screen.getByRole('button', { name: /confirm.*keep purchase blocked/i })).toBeDisabled()
  })

  it('renders Thai copy when language is set to Thai', () => {
    render(
      <I18nProvider initialLanguage="th">
        <ReviewPanel proposal={null} simulation={null} onApprove={() => undefined} onReject={() => undefined} />
      </I18nProvider>,
    )
    expect(screen.getByText(/ไม่มีข้อเสนอที่รอดำเนินการ/i)).toBeInTheDocument()
  })
})

