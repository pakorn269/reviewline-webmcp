import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeInitialState, resetCounters, runSimulation, draftProposal, applyHumanDecision, appendTimelineEvent } from '../domain/domain'
import { getAvailableToolNames, createSerializedStateTransactions, executeWithinAgentBudget, registerTools } from './registration'
import type { AppState } from '../domain/domain'

// We test the registration module through a mock modelContext
// to verify lifecycle safety, tool names, and handler wiring.

describe('serialized state transactions', () => {
  it('preserves both concurrent updates and resolves only after each async commit', async () => {
    let state = makeInitialState()
    const committed: string[] = []
    const transact = createSerializedStateTransactions(
      () => state,
      async (nextState) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        state = nextState
        committed.push(nextState.sessionTimeline.at(-1)?.detail ?? '')
      },
    )

    const first = transact((current) => ({
      nextState: appendTimelineEvent(current, { kind: 'invoked', actor: 'agent', detail: 'first' }),
      result: 'first-result',
    }))
    const second = transact((current) => ({
      nextState: appendTimelineEvent(current, { kind: 'invoked', actor: 'agent', detail: 'second' }),
      result: 'second-result',
    }))

    expect(state.sessionTimeline).toEqual([])
    await expect(Promise.all([first, second])).resolves.toEqual(['first-result', 'second-result'])
    expect(state.sessionTimeline.map((event) => event.detail)).toEqual(['first', 'second'])
    expect(committed).toEqual(['first', 'second'])
  })
})

describe('getAvailableToolNames', () => {
  it('exposes only investigation tools before an incident is selected', () => {
    const names = getAvailableToolNames(makeInitialState())
    expect(names).toEqual(['list_incidents', 'inspect_incident'])
    expect(names).not.toContain('draft_review_gate')
    expect(names).not.toContain('get_review_status')
  })

  it('adds simulation only after an incident is selected', () => {
    const state = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    expect(getAvailableToolNames(state)).toEqual([
      'list_incidents',
      'inspect_incident',
      'simulate_guardrail_patch',
    ])
  })

  it('does not expose phase tools for an unknown selection, unknown phase, or incoherent terminal phase', () => {
    const unknownSelection = { ...makeInitialState(), selectedIncidentId: 'inc-forged' }
    expect(getAvailableToolNames(unknownSelection)).toEqual(['list_incidents', 'inspect_incident'])

    const unknownPhase = {
      ...makeInitialState(),
      selectedIncidentId: 'inc-001',
      workflowPhase: 'BOGUS',
    } as unknown as AppState
    expect(getAvailableToolNames(unknownPhase)).toEqual(['list_incidents', 'inspect_incident'])

    const forgedAwaiting = { ...makeInitialState(), workflowPhase: 'AWAITING_HUMAN_DECISION' as const }
    expect(getAvailableToolNames(forgedAwaiting)).toEqual(['list_incidents', 'inspect_incident'])

    expect(getAvailableToolNames(null as never)).toEqual(['list_incidents', 'inspect_incident'])
    expect(getAvailableToolNames({ ...makeInitialState(), proposals: null } as never)).toEqual([
      'list_incidents', 'inspect_incident',
    ])
    expect(getAvailableToolNames({
      ...makeInitialState(), incidents: [null], selectedIncidentId: 'inc-001',
    } as never)).toEqual(['list_incidents', 'inspect_incident'])
    expect(getAvailableToolNames({
      ...makeInitialState(), simulations: [null], selectedIncidentId: 'inc-001', activeSimId: 'sim-0001',
    } as never)).toEqual(['list_incidents', 'inspect_incident'])
  })

  it('returns the minimal manifest without invoking throwing state or record accessors', () => {
    let workflowReads = 0
    const topLevel = makeInitialState() as AppState
    Object.defineProperty(topLevel, 'workflowPhase', {
      get: () => { workflowReads += 1; throw new Error('forged workflow accessor') },
      enumerable: true,
    })
    expect(getAvailableToolNames(topLevel)).toEqual(['list_incidents', 'inspect_incident'])
    expect(workflowReads).toBe(0)

    let incidentReads = 0
    const nested = makeInitialState() as AppState
    const incident = { ...nested.incidents[0] }
    Object.defineProperty(incident, 'id', {
      get: () => { incidentReads += 1; throw new Error('forged incident accessor') },
      enumerable: true,
    })
    nested.incidents = [incident, ...nested.incidents.slice(1)]
    nested.selectedIncidentId = 'inc-001'
    expect(getAvailableToolNames(nested)).toEqual(['list_incidents', 'inspect_incident'])
    expect(incidentReads).toBe(0)
  })

  it('returns the minimal manifest when any required AppState key is missing', () => {
    const { nextState: replayed } = runSimulation(
      { ...makeInitialState(), selectedIncidentId: 'inc-001' },
      'inc-001', 'spending_cap', 50000, 'block',
    )
    for (const key of [
      'selectedIncidentId', 'focusedProposalId', 'activeSimId', 'workflowPhase',
    ] as const) {
      const malformed = { ...replayed } as AppState
      delete (malformed as unknown as Record<string, unknown>)[key]
      expect(getAvailableToolNames(malformed)).toEqual(['list_incidents', 'inspect_incident'])
    }
  })

  it('does not grant capabilities from malformed authority arrays', () => {
    const malformedStates: AppState[] = []
    for (const field of ['incidents', 'simulations'] as const) {
      const customPrototype = [...makeInitialState()[field]]
      Object.setPrototypeOf(customPrototype, Object.create(Array.prototype))
      const symbolExtra = [...makeInitialState()[field]]
      Object.defineProperty(symbolExtra, Symbol('forged'), { value: true })
      const hiddenExtra = [...makeInitialState()[field]]
      Object.defineProperty(hiddenExtra, 'forged', { value: true, enumerable: false })
      for (const value of [customPrototype, symbolExtra, hiddenExtra]) {
        malformedStates.push({
          ...makeInitialState(),
          [field]: value,
          selectedIncidentId: 'inc-001',
          workflowPhase: 'REPLAY_READY',
        } as AppState)
      }
    }
    for (const malformed of malformedStates) {
      expect(getAvailableToolNames(malformed)).toEqual(['list_incidents', 'inspect_incident'])
    }
  })

  it('adds drafting only after a passing trigger and benign-control replay', () => {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    expect(getAvailableToolNames(nextState)).toEqual([
      'list_incidents',
      'inspect_incident',
      'simulate_guardrail_patch',
      'draft_review_gate',
    ])
  })

  it('does not expose drafting when in-memory case outcomes are forged', () => {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const forged = {
      ...nextState,
      simulations: nextState.simulations.map((simulation) => ({
        ...simulation,
        regressions: [],
        caseResults: simulation.caseResults.map((result) =>
          result.caseId === simulation.triggeringCaseId
            ? { ...result, candidateDecision: 'ALLOWED' as const }
            : result.caseId === simulation.benignControlCaseId
              ? { ...result, candidateDecision: 'BLOCKED' as const }
              : result,
        ),
      })),
    }
    expect(getAvailableToolNames(forged)).not.toContain('draft_review_gate')
  })

  it('removes mutation tools and exposes review status while awaiting a human', () => {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: awaiting } = draftProposal(
      replayed,
      'inc-001',
      'Retain the procurement cap',
      'The trigger is blocked and benign control remains allowed.',
      sim.simId,
    )
    expect(getAvailableToolNames(awaiting)).toEqual([
      'list_incidents',
      'inspect_incident',
      'get_review_status',
    ])
  })

  it('keeps review status available after the human decision', () => {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: awaiting, proposal } = draftProposal(
      replayed,
      'inc-001',
      'Retain the procurement cap',
      'The trigger is blocked and benign control remains allowed.',
      sim.simId,
    )
    const { nextState: decided } = applyHumanDecision(
      awaiting,
      proposal.proposalId,
      'approved',
      'Evidence reviewed.',
      'reviewer-1',
    )
    expect(getAvailableToolNames(decided)).toEqual([
      'list_incidents',
      'inspect_incident',
      'get_review_status',
    ])
  })

  it('hides review status when any audit ID in the state is malformed', () => {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: awaiting, proposal } = draftProposal(replayed, 'inc-001', 'title', 'rationale', sim.simId)
    const { nextState: decided } = applyHumanDecision(awaiting, proposal.proposalId, 'approved', 'note', 'reviewer-1')
    const forged: AppState = {
      ...decided,
      auditLog: [...decided.auditLog, {
        ...decided.auditLog[0], id: 'audit-1e5', proposalId: 'prop-9999',
      }],
    }
    expect(getAvailableToolNames(forged)).not.toContain('get_review_status')

    const duplicated: AppState = {
      ...decided,
      auditLog: [...decided.auditLog, {
        ...decided.auditLog[0], proposalId: 'prop-9999',
      }],
    }
    expect(getAvailableToolNames(duplicated)).not.toContain('get_review_status')
  })

  it('hides decided status capability for missing reviewer identity or mismatched timestamp', () => {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: awaiting, proposal } = draftProposal(replayed, 'inc-001', 'title', 'rationale', sim.simId)
    const { nextState: decided } = applyHumanDecision(awaiting, proposal.proposalId, 'approved', 'note', 'reviewer-1')
    const missingReviewer = {
      ...decided,
      auditLog: decided.auditLog.map((entry) => ({ ...entry, reviewerId: '' })),
    }
    expect(getAvailableToolNames(missingReviewer)).not.toContain('get_review_status')

    const mismatchedTimestamp = {
      ...decided,
      proposals: decided.proposals.map((item) => ({ ...item, decidedAt: '2026-01-01T00:00:00.000Z' })),
    }
    expect(getAvailableToolNames(mismatchedTimestamp)).not.toContain('get_review_status')
  })
})

describe('registerTools', () => {
  let capturedTools: Array<{ name: string; annotations?: unknown; inputSchema?: unknown; execute: (input: Record<string, unknown>) => unknown }>
  let abortController: AbortController
  let mockModelContext: {
    registerTool: ReturnType<typeof vi.fn>
    getTools: ReturnType<typeof vi.fn>
    ontoolchange: null
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    dispatchEvent: ReturnType<typeof vi.fn>
  }
  let state: AppState
  let setState: ReturnType<typeof vi.fn>
  let runTransaction: ReturnType<typeof createSerializedStateTransactions>

  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
    setState = vi.fn(async (nextState: AppState) => {
      await Promise.resolve()
      state = nextState
    })
    runTransaction = createSerializedStateTransactions(() => state, setState)
    capturedTools = []
    abortController = new AbortController()
    mockModelContext = {
      registerTool: vi.fn(async (tool: { name: string; annotations?: unknown; inputSchema?: unknown; execute: (input: Record<string, unknown>) => unknown }) => {
        capturedTools.push(tool)
      }),
      getTools: vi.fn(async () => capturedTools),
      ontoolchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
  })

  afterEach(() => {
    abortController.abort()
  })

  it('registers only the two least-authority investigation tools initially', async () => {
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const names = capturedTools.map((t) => t.name).sort()
    expect(names).toEqual([
      'inspect_incident',
      'list_incidents',
    ])
  })

  it('list_incidents tool has readOnlyHint and untrustedContentHint annotations', async () => {
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((t) => t.name === 'list_incidents')!
    expect((tool.annotations as { readOnlyHint?: boolean }).readOnlyHint).toBe(true)
    expect((tool.annotations as { untrustedContentHint?: boolean }).untrustedContentHint).toBe(true)
  })

  it('documents stale-evidence thresholds as integer hours in the native schema', async () => {
    state = { ...state, selectedIncidentId: 'inc-003' }
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((candidate) => candidate.name === 'simulate_guardrail_patch')!
    const schema = tool.inputSchema as { properties: { threshold: { description: string; multipleOf?: number; maximum?: number } } }
    expect(schema.properties.threshold.description).toMatch(/evidence.*hours/i)
    expect(schema.properties.threshold.multipleOf).toBe(1)
    expect(schema.properties.threshold.maximum).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('draft_review_gate does NOT have readOnlyHint:true when replay makes it available', async () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    state = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block').nextState
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((t) => t.name === 'draft_review_gate')!
    expect((tool.annotations as { readOnlyHint?: boolean }).readOnlyHint).not.toBe(true)
  })

  it('marks review status as untrusted because it returns human-entered text', async () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    state = draftProposal(replayed, 'inc-001', 'Human title', 'Human rationale', sim.simId).nextState
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((candidate) => candidate.name === 'get_review_status')!
    expect((tool.annotations as { untrustedContentHint?: boolean }).untrustedContentHint).toBe(true)
  })

  it('get_review_status registration rejects unknown input properties at runtime', async () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const drafted = draftProposal(replayed, 'inc-001', 'Human title', 'Human rationale', sim.simId)
    state = drafted.nextState
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((candidate) => candidate.name === 'get_review_status')!
    await expect(Promise.resolve(tool.execute({ proposal_id: drafted.proposal.proposalId, extra: true }))).rejects.toThrow(/unknown property/i)
  })

  it('list_incidents tool returns bounded output and appends invocation/result events', async () => {
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((t) => t.name === 'list_incidents')!
    const result = await tool.execute({}) as { incidents: unknown[] }
    expect(result.incidents).toHaveLength(3)
    expect(state.sessionTimeline.map((event) => event.kind)).toEqual(['invoked', 'result'])
    expect(state.sessionTimeline.every((event) => event.toolName === 'list_incidents')).toBe(true)
  })

  it('inspect_incident updates the UI and appends invocation/result events before resolving', async () => {
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const tool = capturedTools.find((t) => t.name === 'inspect_incident')!
    await tool.execute({ incident_id: 'inc-001' })
    expect(setState).toHaveBeenCalled()
    expect(state.selectedIncidentId).toBe('inc-001')
    expect(state.sessionTimeline.map((event) => event.kind)).toEqual(['invoked', 'workflow', 'result'])
    expect(state.sessionTimeline.some((event) => event.detail === 'Incident selected: inc-001')).toBe(true)
  })

  it('inspect_incident registration rejects unknown input properties at runtime', async () => {
    const { registerTools } = await import('./registration')
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const inspect = capturedTools.find((tool) => tool.name === 'inspect_incident')!
    await expect(inspect.execute({ incident_id: 'inc-001', extra: true })).rejects.toThrow(/unknown property/i)
  })

  it('centrally rejects oversized registered-tool results with a bounded error', async () => {
    try {
      await executeWithinAgentBudget(() => ({ oversized: 'x'.repeat(5000) }))
      throw new Error('Expected oversized result rejection')
    } catch (error) {
      expect((error as Error).message).toMatch(/output.*budget|too large/i)
      expect((error as Error).message.length).toBeLessThan(200)
    }
  })

  it('records the replay-to-review tool journey in the append-only timeline', async () => {
    const { registerTools } = await import('./registration')
    state = { ...state, selectedIncidentId: 'inc-001' }
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const simulate = capturedTools.find((tool) => tool.name === 'simulate_guardrail_patch')!
    const simulation = await simulate.execute({
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    }) as { simId: string }

    capturedTools = []
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const draft = capturedTools.find((tool) => tool.name === 'draft_review_gate')!
    const proposal = await draft.execute({
      incident_id: 'inc-001',
      title: 'Retain the procurement cap',
      rationale: 'Trigger blocked; benign control allowed.',
      sim_id: simulation.simId,
    }) as { proposalId: string }

    capturedTools = []
    await registerTools(mockModelContext as never, () => state, runTransaction, abortController.signal)
    const reviewStatus = capturedTools.find((tool) => tool.name === 'get_review_status')!
    await reviewStatus.execute({ proposal_id: proposal.proposalId })

    expect(state.workflowPhase).toBe('AWAITING_HUMAN_DECISION')
    expect(state.sessionTimeline.filter((event) => event.kind === 'invoked')).toHaveLength(3)
    expect(state.sessionTimeline.filter((event) => event.kind === 'result')).toHaveLength(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED ARCHITECTURAL CORRECTION TESTS — registration layer
// ═══════════════════════════════════════════════════════════════════════════

// ── Item 5: Atomic visible commit failure ────────────────────────────────────

describe('createSerializedStateTransactions — failed candidate does not poison next transaction', () => {
  it('transaction B reads pre-A state when commit A fails before resolve', async () => {
    let committedState = makeInitialState()
    let callCount = 0

    // Commit A fails, commit B succeeds
    const commitFn = vi.fn(async (nextState: AppState) => {
      callCount++
      if (callCount === 1) {
        throw new Error('commit A failed')
      }
      committedState = nextState
    })

    const transact = createSerializedStateTransactions(() => committedState, commitFn as never)

    // Transaction A — should fail
    const promiseA = transact((current) => ({
      nextState: appendTimelineEvent(current, { kind: 'invoked', actor: 'agent', detail: 'A' }),
      result: 'A',
    }))

    // Wait for A to fail
    await expect(promiseA).rejects.toThrow('commit A failed')

    // Transaction B — should see original committed state (not A's uncommitted nextState)
    let bReadState: AppState | undefined
    const promiseB = transact((current) => {
      bReadState = current
      return {
        nextState: appendTimelineEvent(current, { kind: 'invoked', actor: 'agent', detail: 'B' }),
        result: 'B',
      }
    })

    await expect(promiseB).resolves.toBe('B')

    // B must not see A's uncommitted mutation
    const bDetails = bReadState?.sessionTimeline.map((e) => e.detail) ?? []
    expect(bDetails).not.toContain('A')
    // B's committed state should only have B's event
    expect(committedState.sessionTimeline.map((e) => e.detail)).toContain('B')
    expect(committedState.sessionTimeline.map((e) => e.detail)).not.toContain('A')
  })

  it('a timed-out commit rolls back: getState returns pre-timeout state', async () => {
    const committedState = makeInitialState()

    // commitState that always rejects (simulates persistent failure)
    const commitAlwaysFails = vi.fn(async (_nextState: AppState): Promise<void> => {
      throw new Error('commit failed')
    })

    const transact = createSerializedStateTransactions(() => committedState, commitAlwaysFails as never)

    // Transaction should reject
    await expect(
      transact((current) => ({
        nextState: appendTimelineEvent(current, { kind: 'invoked', actor: 'agent', detail: 'failing' }),
        result: 'x',
      })),
    ).rejects.toThrow()

    // getState must still return the pre-transaction state
    // (not the uncommitted nextState from the failed transaction)
    expect(committedState.sessionTimeline).toHaveLength(0)
  })
})

// ── Item 6: Safe bounded manifest reconciliation ─────────────────────────────

describe('registerTools — in-flight execution lifecycle safety', () => {
  it('stops registration admission after retirement is requested mid-registration', async () => {
    let resolveFirst!: () => void
    let calls = 0
    const context = {
      registerTool: vi.fn(async () => {
        calls += 1
        if (calls === 1) await new Promise<void>((resolve) => { resolveFirst = resolve })
      }),
      getTools: vi.fn(async () => []), ontoolchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }
    const controller = new AbortController()
    const registration = registerTools(
      context as never,
      makeInitialState,
      vi.fn() as never,
      controller.signal,
    )
    await vi.waitFor(() => expect(calls).toBe(1))
    controller.abort()
    resolveFirst()
    await expect(registration).rejects.toThrow(/registration retired/i)
    expect(calls).toBe(1)
  })

  it('rolls back earlier registrations when a later registration fails', async () => {
    let firstSignal: AbortSignal | undefined
    let calls = 0
    const context = {
      registerTool: vi.fn(async (_tool: unknown, options?: { signal?: AbortSignal }) => {
        calls += 1
        if (calls === 1) firstSignal = options?.signal
        if (calls === 2) throw new Error('second registration failed')
      }),
      getTools: vi.fn(async () => []), ontoolchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }
    await expect(registerTools(
      context as never,
      makeInitialState,
      vi.fn() as never,
      new AbortController().signal,
    )).rejects.toThrow(/second registration failed/i)
    expect(firstSignal?.aborted).toBe(true)
  })

  it('defers failure rollback until an already admitted execution completes', async () => {
    let firstTool: { execute: (input: Record<string, unknown>) => unknown } | undefined
    let firstSignal: AbortSignal | undefined
    let rejectSecond!: (error: Error) => void
    let calls = 0
    const context = {
      registerTool: vi.fn(async (tool: { execute: (input: Record<string, unknown>) => unknown }, options?: { signal?: AbortSignal }) => {
        calls += 1
        if (calls === 1) {
          firstTool = tool
          firstSignal = options?.signal
          return
        }
        if (calls === 2) return new Promise<void>((_resolve, reject) => { rejectSecond = reject })
      }),
      getTools: vi.fn(async () => []), ontoolchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }
    let resolveExecution!: (value: unknown) => void
    const transaction = vi.fn(() => new Promise((resolve) => { resolveExecution = resolve }))
    const registration = registerTools(context as never, makeInitialState, transaction as never, new AbortController().signal)
    await vi.waitFor(() => expect(calls).toBe(2))
    const execution = Promise.resolve(firstTool!.execute({}))
    rejectSecond(new Error('second registration failed'))
    await expect(registration).rejects.toThrow(/second registration failed/i)
    expect(firstSignal?.aborted).toBe(false)
    resolveExecution({ incidents: [], total: 0 })
    await execution
    expect(firstSignal?.aborted).toBe(true)
  })

  it('defers timeout rollback until an already admitted execution completes', async () => {
    let firstTool: { execute: (input: Record<string, unknown>) => unknown } | undefined
    let firstSignal: AbortSignal | undefined
    let calls = 0
    const context = {
      registerTool: vi.fn(async (tool: { execute: (input: Record<string, unknown>) => unknown }, options?: { signal?: AbortSignal }) => {
        calls += 1
        if (calls === 1) {
          firstTool = tool
          firstSignal = options?.signal
          return
        }
        return new Promise<void>(() => { /* timeout */ })
      }),
      getTools: vi.fn(async () => []), ontoolchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }
    let resolveExecution!: (value: unknown) => void
    const transaction = vi.fn(() => new Promise((resolve) => { resolveExecution = resolve }))
    vi.useFakeTimers()
    try {
      const registration = registerTools(context as never, makeInitialState, transaction as never, new AbortController().signal)
      await vi.waitFor(() => expect(calls).toBe(2))
      const execution = Promise.resolve(firstTool!.execute({}))
      const observed = registration.then(() => 'resolved', (error: Error) => error.message)
      await vi.advanceTimersByTimeAsync(2100)
      expect(await observed).toMatch(/registration timed out/i)
      expect(firstSignal?.aborted).toBe(false)
      resolveExecution({ incidents: [], total: 0 })
      await execution
      expect(firstSignal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retire a registration signal until its in-flight execution completes', async () => {
    let capturedList: { execute: (input: Record<string, unknown>) => unknown } | undefined
    let registeredSignal: AbortSignal | undefined
    const context = {
      registerTool: vi.fn(async (tool: { name: string; execute: (input: Record<string, unknown>) => unknown }, options?: { signal?: AbortSignal }) => {
        if (tool.name === 'list_incidents') {
          capturedList = tool
          registeredSignal = options?.signal
        }
      }),
      getTools: vi.fn(async () => []), ontoolchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }
    let resolveTransaction!: (value: unknown) => void
    let transactionCalls = 0
    const transaction = vi.fn(() => {
      transactionCalls += 1
      if (transactionCalls === 1) return new Promise((resolve) => { resolveTransaction = resolve })
      return Promise.resolve({ incidents: [], total: 0 })
    })
    const controller = new AbortController()
    await registerTools(context as never, makeInitialState, transaction as never, controller.signal)

    const execution = Promise.resolve(capturedList!.execute({}))
    controller.abort()
    expect(registeredSignal?.aborted).toBe(false)
    await expect(Promise.resolve(capturedList!.execute({}))).rejects.toThrow(/registration retired/i)
    resolveTransaction({ incidents: [], total: 0 })
    await execution
    expect(registeredSignal?.aborted).toBe(true)
  })

  it('a never-resolving registerTool call does not permanently strand reconciliation', async () => {
    resetCounters()
    let state = makeInitialState()
    const setState = vi.fn(async (nextState: AppState) => { state = nextState })
    const runTransaction = createSerializedStateTransactions(() => state, setState)

    let registerCallCount = 0
    let timedOutSignal: AbortSignal | undefined
    const neverResolvingMockContext = {
      registerTool: vi.fn(async (_tool: unknown, options?: { signal?: AbortSignal }) => {
        registerCallCount++
        timedOutSignal = options?.signal
        if (registerCallCount === 1) {
          // First registerTool never resolves
          return new Promise<void>(() => { /* hang */ })
        }
        // Subsequent calls resolve normally
      }),
      getTools: vi.fn(async () => []),
      ontoolchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }

    const { registerTools } = await import('./registration')
    const abortController = new AbortController()

    vi.useFakeTimers()
    try {
      const registerPromise = registerTools(
        neverResolvingMockContext as never,
        () => state,
        runTransaction,
        abortController.signal,
      )
      const observed = registerPromise.then(() => 'resolved', (error: Error) => error.message)
      await vi.advanceTimersByTimeAsync(2100)
      expect(await observed).toMatch(/registration timed out/i)
      expect(timedOutSignal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
      abortController.abort()
    }
  }, 10000)
})

describe('retained registered tool descriptor boundary', () => {
  it('validates malformed state before simulate, draft, and status reads or timeline appends', async () => {
    const initial = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const replayed = runSimulation(initial, 'inc-001', 'spending_cap', 50000, 'block').nextState
    const replayReady = { ...replayed, selectedIncidentId: 'inc-001' }
    const drafted = draftProposal(
      replayReady, 'inc-001', 'title', 'rationale', replayReady.activeSimId!,
    ).nextState
    const scenarios = [
      {
        state: makeInitialState(),
        name: 'list_incidents',
        field: 'sessionTimeline',
        input: {},
      },
      {
        state: makeInitialState(),
        name: 'inspect_incident',
        field: 'selectedIncidentId',
        input: { incident_id: 'inc-001' },
      },
      {
        state: initial,
        name: 'simulate_guardrail_patch',
        field: 'workflowPhase',
        input: { incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block' },
      },
      {
        state: replayReady,
        name: 'draft_review_gate',
        field: 'activeSimId',
        input: { incident_id: 'inc-001', title: 'title', rationale: 'rationale', sim_id: replayReady.activeSimId },
      },
      {
        state: drafted,
        name: 'get_review_status',
        field: 'sessionTimeline',
        input: { proposal_id: drafted.focusedProposalId },
      },
    ] as const

    for (const scenario of scenarios) {
      let captured: { execute: (input: Record<string, unknown>) => unknown } | undefined
      const context = {
        registerTool: vi.fn(async (tool: { name: string; execute: (input: Record<string, unknown>) => unknown }) => {
          if (tool.name === scenario.name) captured = tool
        }),
        getTools: vi.fn(async () => []), ontoolchange: null,
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      }
      let reads = 0
      const malformed = { ...scenario.state } as AppState
      Object.defineProperty(malformed, scenario.field, {
        get: () => { reads += 1; throw new Error('forged retained state getter') },
        enumerable: true,
      })
      const runTransaction = vi.fn(async <T>(transaction: (state: AppState) => { result: T }) =>
        transaction(malformed).result)
      await registerTools(
        context as never,
        () => scenario.state,
        runTransaction as never,
        new AbortController().signal,
      )
      expect(captured).toBeDefined()
      await expect(Promise.resolve(captured!.execute(scenario.input as never))).rejects.toThrow(/invalid canonical review state/i)
      expect(reads).toBe(0)
    }
  })
})

// ── Item 6: getAvailableToolNames — never exposes approve/reject ─────────────

describe('getAvailableToolNames — never exposes approve/reject/activate/deploy', () => {
  it('no tool names contain approve, reject, activate, or deploy in any phase', () => {
    const forbidden = ['approve', 'reject', 'activate', 'deploy']
    // Check all phases
    const states = [
      makeInitialState(),
      { ...makeInitialState(), selectedIncidentId: 'inc-001' as const },
    ]
    for (const s of states) {
      const names = getAvailableToolNames(s)
      for (const name of names) {
        for (const word of forbidden) {
          expect(name).not.toContain(word)
        }
      }
    }
  })
})
