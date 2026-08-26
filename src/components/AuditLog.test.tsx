import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditLog } from './AuditLog'
import { makeInitialState, runSimulation, draftProposal, applyHumanDecision, resetCounters, type AppState } from '../domain/domain'

describe('AuditLog', () => {
  it('shows empty state message when no entries', () => {
    render(<AuditLog entries={[]} />)
    expect(screen.getByText(/no audit entries/i)).toBeInTheDocument()
  })

  it('renders audit entries after a decision', () => {
    resetCounters()
    let state: AppState = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    state = s1
    const { nextState: s2, proposal } = draftProposal(
      state,
      'inc-001',
      'Cap enforcement',
      'Rationale.',
      sim.simId,
    )
    state = s2
    const { nextState: s3 } = applyHumanDecision(state, proposal.proposalId, 'approved', 'LGTM', 'reviewer-1')
    state = s3

    render(<AuditLog entries={state.auditLog} />)
    expect(screen.getByText(/approved/i)).toBeInTheDocument()
    expect(screen.getByText(/reviewer-1/i)).toBeInTheDocument()
    expect(screen.getByText(/LGTM/i)).toBeInTheDocument()
  })
})
