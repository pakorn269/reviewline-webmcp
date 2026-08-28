import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SimulationView } from './SimulationView'
import { I18nProvider } from '../i18n/I18nContext'
import { makeInitialState, runSimulation, resetCounters } from '../domain/domain'

describe('SimulationView', () => {
  it('shows placeholder when no simulation', () => {
    render(<SimulationView simulation={null} />)
    expect(screen.getByText(/no simulation/i)).toBeInTheDocument()
  })

  it('renders blocked and allowed counts', () => {
    resetCounters()
    const state = makeInitialState()
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    render(<SimulationView simulation={sim} />)
    // Check stat value elements for the counts (blockedCount=1, allowedCount=3, total=4)
    const statValues = screen.getAllByText(/^\d+$/)
    const nums = statValues.map((el) => el.textContent)
    expect(nums).toContain('1')
    expect(nums).toContain('3')
    expect(nums).toContain('4')
  })

  it('shows regression warning when regressions exist', () => {
    resetCounters()
    const state = makeInitialState()
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 200000, 'block')
    render(<SimulationView simulation={sim} />)
    expect(screen.getByText(/regression/i)).toBeInTheDocument()
  })

  it('shows no regression message when clean', () => {
    resetCounters()
    const state = makeInitialState()
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    render(<SimulationView simulation={sim} />)
    expect(screen.getByText(/no regressions/i)).toBeInTheDocument()
  })

  it('renders auditable per-case counterfactual evidence and provenance', () => {
    resetCounters()
    const { sim } = runSimulation(makeInitialState(), 'inc-001', 'spending_cap', 50000, 'block')
    render(<SimulationView simulation={sim} />)
    expect(screen.getByText(sim.resultId)).toBeInTheDocument()
    expect(screen.getByText(sim.ruleExpression)).toBeInTheDocument()
    expect(screen.getByText(sim.baselinePolicyVersion)).toBeInTheDocument()
    expect(screen.getByText(sim.candidatePolicyVersion)).toBeInTheDocument()
    expect(screen.getByText('TRIGGER')).toBeInTheDocument()
    expect(screen.getByText('BENIGN CONTROL')).toBeInTheDocument()
    expect(screen.getByText('BLOCKED → BLOCKED')).toBeInTheDocument()
    expect(screen.getAllByText('ALLOWED → ALLOWED').length).toBeGreaterThan(0)
  })

  it('localizes outcome totals, case-table headers, and the regression verdict in Thai', () => {
    resetCounters()
    const { sim } = runSimulation(makeInitialState(), 'inc-001', 'spending_cap', 50000, 'block')
    render(
      <I18nProvider initialLanguage="th">
        <SimulationView simulation={sim} />
      </I18nProvider>,
    )
    expect(screen.getByText('ถูกบล็อก')).toBeInTheDocument()
    expect(screen.getByText('ได้รับอนุญาต')).toBeInTheDocument()
    expect(screen.getByText('ทั้งหมด')).toBeInTheDocument()
    expect(screen.getByText('กรณีหลักฐาน')).toBeInTheDocument()
    expect(screen.getByText(/ตรวจไม่พบการถดถอย/)).toBeInTheDocument()
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument()
    expect(screen.queryByText('Allowed')).not.toBeInTheDocument()
    expect(screen.queryByText('Evidence case')).not.toBeInTheDocument()
  })

  it('localizes the regression failure verdict in Thai', () => {
    resetCounters()
    const { sim } = runSimulation(makeInitialState(), 'inc-001', 'spending_cap', 200000, 'block')
    render(
      <I18nProvider initialLanguage="th">
        <SimulationView simulation={sim} />
      </I18nProvider>,
    )
    expect(screen.getByText('การควบคุมการถดถอยไม่ผ่าน')).toBeInTheDocument()
    expect(screen.queryByText('Regression control failed')).not.toBeInTheDocument()
  })

  it('renders stale-evidence thresholds in hours rather than currency', () => {
    const { sim } = runSimulation(makeInitialState(), 'inc-003', 'stale_evidence', 40, 'block')
    render(<SimulationView simulation={sim} />)
    expect(screen.getByText('Threshold: 40 h')).toBeInTheDocument()
    expect(screen.queryByText(/Threshold: \$40/)).not.toBeInTheDocument()
  })
})
