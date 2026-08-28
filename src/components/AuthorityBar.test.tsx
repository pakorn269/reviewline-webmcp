import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AuthorityBar } from './AuthorityBar'
import { I18nProvider } from '../i18n/I18nContext'

describe('AuthorityBar', () => {
  it('names the current workflow phase in human-readable and raw form', () => {
    render(<AuthorityBar workflowPhase="AWAITING_HUMAN_DECISION" availableToolNames={['list_incidents']} />)
    const phase = screen.getByTestId('workflow-phase')
    expect(phase).toHaveTextContent('AWAITING_HUMAN_DECISION')
    expect(phase).toHaveTextContent(/awaiting human decision/i)
  })

  it('marks every canonical tool as either exposed or withheld for the current phase', () => {
    render(
      <AuthorityBar
        workflowPhase="INVESTIGATION"
        availableToolNames={['list_incidents', 'inspect_incident']}
      />,
    )
    const manifest = screen.getByRole('region', { name: /agent capability manifest/i })
    const chips = within(manifest).getAllByRole('listitem')
    expect(chips).toHaveLength(5)

    const byName = new Map(
      chips.map((chip) => [within(chip).getByTestId('capability-name').textContent, chip]),
    )
    expect(byName.get('list_incidents')).toHaveAttribute('data-exposure', 'exposed')
    expect(byName.get('inspect_incident')).toHaveAttribute('data-exposure', 'exposed')
    expect(byName.get('simulate_guardrail_patch')).toHaveAttribute('data-exposure', 'withheld')
    expect(byName.get('draft_review_gate')).toHaveAttribute('data-exposure', 'withheld')
    expect(byName.get('get_review_status')).toHaveAttribute('data-exposure', 'withheld')
  })

  it('reports the exposed capability count for the current phase', () => {
    render(
      <AuthorityBar
        workflowPhase="REPLAY_READY"
        availableToolNames={['list_incidents', 'inspect_incident', 'simulate_guardrail_patch', 'draft_review_gate']}
      />,
    )
    expect(screen.getByTestId('capability-count')).toHaveTextContent('4 / 5')
  })

  it('lists approve, reject, and activate as human-only actions that are never registered', () => {
    render(<AuthorityBar workflowPhase="AWAITING_HUMAN_DECISION" availableToolNames={['get_review_status']} />)
    const humanOnly = screen.getByRole('region', { name: /human-only actions/i })
    const actions = within(humanOnly).getAllByRole('listitem')
    expect(actions.map((action) => action.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('approve'),
        expect.stringContaining('reject'),
        expect.stringContaining('activate'),
      ]),
    )
    for (const action of actions) {
      expect(action).toHaveAttribute('data-exposure', 'never')
    }
    expect(within(humanOnly).getByText(/never registered as a webmcp tool/i)).toBeInTheDocument()
  })

  it('never lists a human-only action inside the agent capability manifest', () => {
    render(
      <AuthorityBar
        workflowPhase="DECIDED"
        availableToolNames={['list_incidents', 'inspect_incident', 'get_review_status']}
      />,
    )
    const manifest = screen.getByRole('region', { name: /agent capability manifest/i })
    expect(within(manifest).queryByText(/approve/i)).not.toBeInTheDocument()
    expect(within(manifest).queryByText(/reject/i)).not.toBeInTheDocument()
    expect(within(manifest).queryByText(/activate/i)).not.toBeInTheDocument()
  })

  it('localizes phase and section copy in Thai', () => {
    render(
      <I18nProvider initialLanguage="th">
        <AuthorityBar workflowPhase="INVESTIGATION" availableToolNames={['list_incidents']} />
      </I18nProvider>,
    )
    expect(screen.getByTestId('workflow-phase')).toHaveTextContent('ขั้นสืบสวน')
    expect(screen.getByRole('region', { name: /สิทธิ์ของเอเจนต์/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /การกระทำที่มนุษย์เท่านั้นทำได้/ })).toBeInTheDocument()
  })
})
