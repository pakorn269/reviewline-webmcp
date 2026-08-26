import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidencePanel } from './EvidencePanel'
import { makeInitialState } from '../domain/domain'

describe('EvidencePanel', () => {
  it('shows placeholder when no incident selected', () => {
    render(<EvidencePanel incident={null} />)
    expect(screen.getByText(/select an incident/i)).toBeInTheDocument()
  })

  it('renders trace entries for a selected incident', () => {
    const { incidents } = makeInitialState()
    render(<EvidencePanel incident={incidents[0]} />)
    // inc-001 trace has "Supplier-page" message
    expect(screen.getByText(/supplier-page/i)).toBeInTheDocument()
  })

  it('renders cohort cases', () => {
    const { incidents } = makeInitialState()
    render(<EvidencePanel incident={incidents[0]} />)
    expect(screen.getByText(/blocked order/i)).toBeInTheDocument()
  })

  it('shows block kind trace entries distinctively', () => {
    const { incidents } = makeInitialState()
    const { container } = render(<EvidencePanel incident={incidents[0]} />)
    const blockItems = container.querySelectorAll('.trace-entry--block')
    expect(blockItems.length).toBeGreaterThan(0)
  })
})
