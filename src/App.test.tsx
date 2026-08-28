import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { makeInitialState, resetCounters } from './domain/domain'
import { tryRegisterTools } from './tools/registration'

// Mock only native registration while retaining manifest lifecycle logic.
vi.mock('./tools/registration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tools/registration')>()
  return {
    ...actual,
    tryRegisterTools: vi.fn().mockResolvedValue(false),
  }
})

describe('App', () => {
  beforeEach(() => {
    resetCounters()
    localStorage.clear()
    vi.mocked(tryRegisterTools).mockClear()
  })

  it('renders the application title', async () => {
    await act(async () => { render(<App />) })
    expect(screen.getByText(/Reviewline/i)).toBeInTheDocument()
  })

  it('renders all three incidents in the queue', async () => {
    await act(async () => { render(<App />) })
    expect(screen.getByText('inc-001')).toBeInTheDocument()
    expect(screen.getByText('inc-002')).toBeInTheDocument()
    expect(screen.getByText('inc-003')).toBeInTheDocument()
  })

  it('discards structurally invalid persisted state instead of trusting or crashing on it', async () => {
    localStorage.setItem('reviewline-state-v1', JSON.stringify({ incidents: [] }))
    await act(async () => { render(<App />) })
    expect(screen.getByText('inc-001')).toBeInTheDocument()
    expect(screen.getByText('inc-002')).toBeInTheDocument()
    expect(screen.getByText('inc-003')).toBeInTheDocument()
  })

  it('discards forged replay evidence instead of exposing drafting authority', async () => {
    const base = makeInitialState()
    const forged = {
      simId: 'sim-0001', resultId: 'forged', incidentId: 'inc-001', ruleKind: 'spending_cap',
      threshold: 50000, enforcement: 'block', ruleExpression: 'forged',
      baselinePolicyVersion: 'forged', candidatePolicyVersion: 'forged', caseResults: [],
      triggeringCaseId: 'fake-trigger', benignControlCaseId: 'fake-control', blockedCount: 1,
      allowedCount: 1, regressions: [], createdAt: new Date().toISOString(),
    }
    localStorage.setItem('reviewline-state-v1', JSON.stringify({
      ...base, simulations: [forged], selectedIncidentId: 'inc-001', activeSimId: 'sim-0001',
      workflowPhase: 'REPLAY_READY',
    }))
    await act(async () => { render(<App />) })
    expect(screen.getByText(/WebMCP Tool Inspector \(2 tools\)/i)).toBeInTheDocument()
  })

  it('renders the current least-authority capability manifest', async () => {
    await act(async () => { render(<App />) })
    expect(screen.getByText(/WebMCP Tool Inspector \(2 tools\)/i)).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByText('procurement-agent')) })
    expect(screen.getByText(/WebMCP Tool Inspector \(3 tools\)/i)).toBeInTheDocument()
  })

  it('records initial capability registration in the visible session timeline', async () => {
    await act(async () => { render(<App />) })
    const timeline = screen.getByLabelText(/session timeline/i)
    await waitFor(() => expect(within(timeline).getAllByText('registered')).toHaveLength(2))
    expect(within(timeline).getByText('list_incidents')).toBeInTheDocument()
    expect(within(timeline).getByText('inspect_incident')).toBeInTheDocument()
  })

  it('clicking an incident shows its evidence trace in the evidence panel', async () => {
    await act(async () => { render(<App />) })
    await act(async () => { fireEvent.click(screen.getByText('procurement-agent')) })
    // After selecting, the evidence panel should show the trace
    const traceSection = document.querySelector('.evidence-trace')
    expect(traceSection).not.toBeNull()
    // At least one trace entry should be visible
    const traceEntries = document.querySelectorAll('.trace-entry')
    expect(traceEntries.length).toBeGreaterThan(0)
  })

  it('records an explicit workflow event when a human selects an incident', async () => {
    await act(async () => { render(<App />) })
    await act(async () => { fireEvent.click(screen.getByText('procurement-agent')) })
    expect(screen.getByText(/Incident selected: inc-001/i)).toBeInTheDocument()
  })

  it('reconciles native tool registration when the available manifest changes', async () => {
    await act(async () => { render(<App />) })
    await waitFor(() => expect(tryRegisterTools).toHaveBeenCalledTimes(1))
    await act(async () => { fireEvent.click(screen.getByText('procurement-agent')) })
    await waitFor(() => expect(tryRegisterTools).toHaveBeenCalledTimes(2))
  })

  it('commits tool transactions without depending on requestAnimationFrame', async () => {
    await act(async () => { render(<App />) })
    const runTransaction = vi.mocked(tryRegisterTools).mock.calls[0][1]
    const original = globalThis.requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', undefined)
    try {
      let transactionPromise!: Promise<string>
      act(() => {
        transactionPromise = runTransaction((current) => ({
          nextState: { ...current, selectedIncidentId: 'inc-001' }, result: 'committed',
        }))
      })
      await act(async () => { await Promise.resolve() })
      const result = await transactionPromise
      await act(async () => { await Promise.resolve() })
      expect(result).toBe('committed')
    } finally {
      vi.stubGlobal('requestAnimationFrame', original)
    }
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  it('does not expose a timed-out unmounted candidate to the next transaction', async () => {
    vi.useFakeTimers()
    try {
      let view!: ReturnType<typeof render>
      await act(async () => { view = render(<App />) })
      const runTransaction = vi.mocked(tryRegisterTools).mock.calls[0][1]
      const first = runTransaction((current) => ({
        nextState: { ...current, selectedIncidentId: 'inc-001' }, result: 'first',
      }))
      const firstObserved = first.then(() => 'resolved', () => 'rejected')
      view.unmount()
      await act(async () => { await Promise.resolve() })
      await vi.advanceTimersByTimeAsync(2100)
      expect(await firstObserved).toBe('rejected')

      let secondSaw: string | null | undefined
      const second = runTransaction((current) => {
        secondSaw = current.selectedIncidentId
        return { nextState: current, result: 'second' }
      })
      const secondObserved = second.then(() => 'resolved', () => 'rejected')
      await act(async () => { await Promise.resolve() })
      expect(secondSaw).toBeNull()
      await vi.advanceTimersByTimeAsync(2100)
      await secondObserved
    } finally {
      vi.useRealTimers()
    }
  })

  it('approve/reject buttons are absent until a pending proposal exists', async () => {
    await act(async () => { render(<App />) })
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
  })

  it('reset button clears state', async () => {
    await act(async () => { render(<App />) })
    // Click an incident to select it
    await act(async () => { fireEvent.click(screen.getByText('procurement-agent')) })
    // Find and click Reset
    const resetBtn = screen.getByRole('button', { name: /reset/i })
    await act(async () => { fireEvent.click(resetBtn) })
    // After reset, nothing should be selected (evidence panel shows placeholder)
    expect(screen.getByText(/Select an incident/i)).toBeInTheDocument()
  })

  // ── Item 1: Session-only state — localStorage must not restore sessions ───
  it('never restores simulation/proposal/phase/selectedIncidentId from localStorage on load', async () => {
    const base = makeInitialState()
    // Construct a "plausible" state that was previously valid
    const fakeStoredState = {
      ...base,
      selectedIncidentId: 'inc-001',
      workflowPhase: 'AWAITING_HUMAN_DECISION',
      simulations: [],
      proposals: [{
        proposalId: 'prop-0001', incidentId: 'inc-001', simId: 'sim-0001',
        title: 'Stored proposal', rationale: 'Should not appear', status: 'pending',
        createdAt: new Date().toISOString(),
      }],
      auditLog: [],
      sessionTimeline: [],
      activeSimId: null,
      focusedProposalId: 'prop-0001',
    }
    localStorage.setItem('reviewline-state-v1', JSON.stringify(fakeStoredState))
    await act(async () => { render(<App />) })
    // Must start fresh — no selected incident
    expect(screen.getByText(/Select an incident/i)).toBeInTheDocument()
    // Must not show the stored proposal title
    expect(screen.queryByText('Stored proposal')).toBeNull()
    // Tool inspector must show only 2 investigation tools (no REPLAY_READY/AWAITING tools)
    expect(screen.getByText(/WebMCP Tool Inspector \(2 tools\)/i)).toBeInTheDocument()
  })

  it('does not read localStorage to decide workflow phase', async () => {
    const base = makeInitialState()
    localStorage.setItem('reviewline-state-v1', JSON.stringify({
      ...base,
      workflowPhase: 'REPLAY_READY',
      selectedIncidentId: 'inc-001',
      activeSimId: 'sim-0001',
    }))
    await act(async () => { render(<App />) })
    // Must start in INVESTIGATION — only 2 tools
    expect(screen.getByText(/WebMCP Tool Inspector \(2 tools\)/i)).toBeInTheDocument()
  })

  it('never writes to localStorage (no storage calls after actions)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    await act(async () => { render(<App />) })
    await act(async () => { fireEvent.click(screen.getByText('procurement-agent')) })
    // Must not write session state to localStorage
    expect(setItemSpy).not.toHaveBeenCalledWith('reviewline-state-v1', expect.anything())
    setItemSpy.mockRestore()
  })

  it('never reads from localStorage to init state (no getItem calls for session state)', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    await act(async () => { render(<App />) })
    // Must not attempt to read session state from storage
    expect(getItemSpy).not.toHaveBeenCalledWith('reviewline-state-v1')
    getItemSpy.mockRestore()
  })

  it('toggles interface language between English and Thai via the header toggle button', async () => {
    await act(async () => { render(<App />) })
    expect(screen.getByText('Agents investigate. Humans authorize.')).toBeInTheDocument()
    const langBtn = screen.getByRole('button', { name: /switch language/i })
    await act(async () => { fireEvent.click(langBtn) })
    expect(screen.getByText('เอเจนต์ดำเนินการสืบสวน มนุษย์เป็นผู้อนุมัติ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /รีเซ็ตสถานะการสาธิต/i })).toBeInTheDocument()
    await act(async () => { fireEvent.click(langBtn) })
    expect(screen.getByText('Agents investigate. Humans authorize.')).toBeInTheDocument()
  })
})

