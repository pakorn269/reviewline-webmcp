import { describe, it, expect, beforeEach } from 'vitest'
import {
  makeInitialState,
  runSimulation,
  draftProposal,
  applyHumanDecision,
  appendTimelineEvent,
  resetCounters,
  nextNumericId,
  isReviewRecordCoherent,
  isSimulationAuthoritativeAndDraftable,
  type AppState,
  type CohortCaseResult,
  INCIDENT_RULE_COMPATIBILITY,
} from './domain'

describe('makeInitialState', () => {
  it('returns exactly the three named synthetic incident IDs with no simulations, proposals, or audit entries', () => {
    const state = makeInitialState()

    const ids = state.incidents.map((inc: { id: string }) => inc.id)
    expect(ids).toEqual(['inc-001', 'inc-002', 'inc-003'])

    expect(state.simulations).toHaveLength(0)
    expect(state.proposals).toHaveLength(0)
    expect(state.auditLog).toHaveLength(0)
  })

  it('incidents have the correct agents and severities', () => {
    const state = makeInitialState()
    const [a, b, c] = state.incidents
    expect(a.agent).toBe('procurement-agent')
    expect(a.severity).toBe('critical')
    expect(b.agent).toBe('support-agent')
    expect(b.severity).toBe('high')
    expect(c.agent).toBe('deployment-agent')
    expect(c.severity).toBe('medium')
  })

  it('each incident has a non-empty trace and cohort', () => {
    const { incidents } = makeInitialState()
    for (const inc of incidents) {
      expect(inc.trace.length).toBeGreaterThan(0)
      expect(inc.cohort.length).toBeGreaterThan(0)
    }
  })

  it('returns deep-cloned fixtures that cannot poison later fresh sessions', () => {
    const first = makeInitialState()
    first.incidents[0].summary = 'poisoned summary'
    first.incidents[0].trace[0].message = 'poisoned trace'
    first.incidents[0].cohort[0].label = 'poisoned cohort'
    const second = makeInitialState()
    expect(second.incidents[0].summary).not.toBe('poisoned summary')
    expect(second.incidents[0].trace[0].message).not.toBe('poisoned trace')
    expect(second.incidents[0].cohort[0].label).not.toBe('poisoned cohort')
  })
})

describe('runSimulation', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('adds a simulation result to state with a unique simId', () => {
    const { nextState, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(nextState.simulations).toHaveLength(1)
    expect(sim.simId).toBe('sim-0001')
    expect(sim.incidentId).toBe('inc-001')
    expect(nextState.activeSimId).toBe('sim-0001')
  })

  it('blocks cases above threshold when enforcement is block', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    // cohort for inc-001: 142000 (blocked), 38000 (allowed), 4500 (allowed), 50000 (allowed, not >)
    expect(sim.blockedCount).toBe(1)
    expect(sim.allowedCount).toBe(3)
  })

  it('detects regressions when threshold is raised above original cap', () => {
    // Raising cap to 200 000 means the 142 000 case (was blocked) is now allowed — regression
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 200000, 'block')
    expect(sim.regressions).toContain('c-001-a')
  })

  it('no regressions when threshold keeps the originally blocked case still blocked', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(sim.regressions).toHaveLength(0)
  })

  it('is deterministic — same inputs produce same blocked/allowed counts', () => {
    const { sim: s1 } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const { sim: s2 } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(s1.blockedCount).toBe(s2.blockedCount)
    expect(s1.allowedCount).toBe(s2.allowedCount)
    expect(s1.regressions).toEqual(s2.regressions)
  })

  it('throws for unknown incident id', () => {
    expect(() => runSimulation(state, 'inc-999', 'spending_cap', 50000, 'block')).toThrow()
  })
})

describe('draftProposal', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('adds a pending proposal referencing the simulation', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2, proposal } = draftProposal(
      s1,
      'inc-001',
      'Lower procurement cap',
      'Prevent prompt injection from overriding purchase limits.',
      sim.simId,
    )
    expect(s2.proposals).toHaveLength(1)
    expect(proposal.proposalId).toBe('prop-0001')
    expect(proposal.status).toBe('pending')
    expect(proposal.simId).toBe(sim.simId)
    expect(s2.focusedProposalId).toBe(proposal.proposalId)
  })

  it('collapses pre-review replay history to the one proposal-owned simulation', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: first } = runSimulation(selected, 'inc-001', 'spending_cap', 45000, 'block')
    const { nextState: second, sim } = runSimulation(first, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: pending } = draftProposal(second, 'inc-001', 'title', 'rationale', sim.simId)
    expect(pending.simulations.map((item) => item.simId)).toEqual([sim.simId])
    expect(pending.proposals).toHaveLength(1)
  })

  it('throws when title exceeds 200 chars', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const longTitle = 'T'.repeat(201)
    expect(() => draftProposal(s1, 'inc-001', longTitle, 'rationale', sim.simId)).toThrow()
  })

  it('throws when rationale exceeds 1000 chars', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const longRationale = 'R'.repeat(1001)
    expect(() => draftProposal(s1, 'inc-001', 'title', longRationale, sim.simId)).toThrow()
  })

  it('throws when rationale is blank', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(() => draftProposal(s1, 'inc-001', 'title', '   ', sim.simId)).toThrow(/rationale is required/i)
  })

  it('rejects malformed preexisting timeline evidence before drafting', () => {
    const { nextState: replayed, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const malformed = {
      ...replayed,
      sessionTimeline: replayed.sessionTimeline.map((event) => ({ ...event, extra: true })),
    } as AppState
    expect(() => draftProposal(
      malformed, 'inc-001', 'title', 'rationale', sim.simId,
    )).toThrow(/timeline|canonical review graph/i)
  })

  it('throws for unknown simulation id', () => {
    expect(() =>
      draftProposal(state, 'inc-001', 'title', 'rationale', 'sim-9999'),
    ).toThrow()
  })
})

describe('applyHumanDecision', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  function setupProposal(s: AppState) {
    const selected = { ...s, selectedIncidentId: 'inc-001' }
    const { nextState: s1, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2, proposal } = draftProposal(
      s1,
      'inc-001',
      'Cap enforcement',
      'Strengthen procurement guardrail.',
      sim.simId,
    )
    return { state: s2, proposalId: proposal.proposalId }
  }

  it('approved decision updates proposal status and adds audit entry', () => {
    const { state: s, proposalId } = setupProposal(state)
    const { nextState, entry } = applyHumanDecision(s, proposalId, 'approved', 'Looks good.', 'reviewer-1')
    const p = nextState.proposals.find((p) => p.proposalId === proposalId)!
    expect(p.status).toBe('approved')
    expect(nextState.auditLog).toHaveLength(1)
    expect(entry.action).toBe('approved')
    expect(entry.proposalId).toBe(proposalId)
    expect(nextState.sessionTimeline.filter((event) => event.kind === 'human_decision')).toEqual([
      expect.objectContaining({
        actor: 'human',
        detail: `reviewer-1 approved ${proposalId}; no external policy was deployed.`,
      }),
    ])
  })

  it('rejected decision updates proposal status and adds audit entry', () => {
    const { state: s, proposalId } = setupProposal(state)
    const { nextState, entry } = applyHumanDecision(s, proposalId, 'rejected', 'Needs revision.', 'reviewer-1')
    const p = nextState.proposals.find((p) => p.proposalId === proposalId)!
    expect(p.status).toBe('rejected')
    expect(entry.action).toBe('rejected')
  })

  it('throws when proposal is already decided', () => {
    const { state: s, proposalId } = setupProposal(state)
    const { nextState } = applyHumanDecision(s, proposalId, 'approved', 'First decision.', 'reviewer-1')
    expect(() =>
      applyHumanDecision(nextState, proposalId, 'rejected', 'Attempt double-decide', 'reviewer-1'),
    ).toThrow()
  })

  it('rejects ambiguous duplicate proposal IDs before a human decision', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const proposal = pending.proposals.find((candidate) => candidate.proposalId === proposalId)!
    const duplicated = { ...pending, proposals: [...pending.proposals, { ...proposal }] }
    expect(() => applyHumanDecision(duplicated, proposalId, 'approved', 'note', 'reviewer-1')).toThrow(/ambiguous|duplicate proposal/i)
  })

  it('rejects a throwing proposal ID accessor without invoking it', () => {
    const { state: pending, proposalId } = setupProposal(state)
    let idReads = 0
    const forgedProposal = { ...pending.proposals[0] }
    Object.defineProperty(forgedProposal, 'proposalId', {
      get: () => { idReads += 1; throw new Error('forged proposal accessor') },
      enumerable: true,
    })
    const forged = { ...pending, proposals: [forgedProposal] }
    try {
      applyHumanDecision(forged, proposalId, 'approved', 'note', 'reviewer-1')
      throw new Error('expected decision rejection')
    } catch (error) {
      expect((error as Error).message).not.toContain('forged proposal accessor')
      expect((error as Error).message).toMatch(/invalid|canonical|review state/i)
    }
    expect(idReads).toBe(0)
  })

  it('rejects throwing proposal status and audit accessors without invoking them', () => {
    const { state: pending, proposalId } = setupProposal(state)
    let statusReads = 0
    const statusProposal = { ...pending.proposals[0] }
    Object.defineProperty(statusProposal, 'status', {
      get: () => { statusReads += 1; throw new Error('forged status accessor') },
      enumerable: true,
    })
    expect(() => applyHumanDecision(
      { ...pending, proposals: [statusProposal] }, proposalId,
      'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid|canonical|review state/i)
    expect(statusReads).toBe(0)

    let auditReads = 0
    const forgedAudit = {
      id: 'audit-0001', ts: new Date().toISOString(), action: 'approved' as const,
      proposalId, reviewerNote: 'forged', actor: 'human' as const, reviewerId: 'reviewer-1',
    }
    Object.defineProperty(forgedAudit, 'reviewerNote', {
      get: () => { auditReads += 1; throw new Error('forged audit accessor') },
      enumerable: true,
    })
    expect(() => applyHumanDecision(
      { ...pending, auditLog: [forgedAudit] }, proposalId,
      'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid|canonical|review state/i)
    expect(auditReads).toBe(0)
  })

  it('rejects a human decision outside the awaiting-human phase', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const forged = { ...pending, workflowPhase: 'INVESTIGATION' as const }
    expect(() => applyHumanDecision(forged, proposalId, 'approved', 'note', 'reviewer-1')).toThrow(/awaiting human decision/i)
  })

  it('rejects a human decision without authoritative active replay evidence', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const forged = { ...pending, simulations: [], activeSimId: null }
    expect(() => applyHumanDecision(forged, proposalId, 'approved', 'note', 'reviewer-1')).toThrow(/authoritative replay/i)
  })

  it('rejects a pending proposal that already has an audit record', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const forged: AppState = {
      ...pending,
      auditLog: [{
        id: 'audit-0001', ts: new Date().toISOString(), action: 'approved',
        proposalId, reviewerNote: 'forged', actor: 'human', reviewerId: 'reviewer-1',
      }],
    }
    expect(() => applyHumanDecision(forged, proposalId, 'approved', 'note', 'reviewer-1')).toThrow(/pending proposal audit/i)
  })

  it('rejects an invalid runtime decision action', () => {
    const { state: pending, proposalId } = setupProposal(state)
    expect(() => applyHumanDecision(
      pending, proposalId, 'forged' as never, 'note', 'reviewer-1',
    )).toThrow(/decision action/i)
  })

  it('rejects a blank human reviewer note', () => {
    const { state: pending, proposalId } = setupProposal(state)
    expect(() => applyHumanDecision(
      pending, proposalId, 'approved', '   ', 'reviewer-1',
    )).toThrow(/reviewer note is required/i)
  })

  it('rejects a review graph with a second proposal', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const forged: AppState = {
      ...pending,
      proposals: [...pending.proposals, { ...pending.proposals[0], proposalId: 'prop-0002' }],
    }
    expect(() => applyHumanDecision(
      forged, proposalId, 'approved', 'note', 'reviewer-1',
    )).toThrow(/pending proposal audit|authoritative replay state/i)
  })

  it('rejects a review graph with a malformed simulation timestamp', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const forged = {
      ...pending,
      simulations: pending.simulations.map((simulation) => ({ ...simulation, createdAt: 'not-a-time' })),
    }
    expect(() => applyHumanDecision(
      forged, proposalId, 'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid canonical review state|authoritative replay state/i)
  })

  it('rejects a partial pending proposal or one carrying a prior audit note', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const partial = {
      ...pending,
      proposals: pending.proposals.map(({ title: _title, ...proposal }) => proposal),
    } as AppState
    expect(() => applyHumanDecision(
      partial, proposalId, 'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid canonical review state|authoritative replay state/i)

    const preNoted = {
      ...pending,
      proposals: pending.proposals.map((proposal) => ({ ...proposal, auditNote: 'forged' })),
    }
    expect(() => applyHumanDecision(
      preNoted, proposalId, 'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid canonical review state|authoritative replay state/i)
  })

  it('rejects malformed timeline timestamps, kinds, or actor relationships', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const mutations = [
      { ts: 'not-a-time' },
      { kind: 'forged' },
      { actor: 'human' },
      { kind: 'human_decision', actor: 'agent' },
    ]
    for (const mutation of mutations) {
      const forged = {
        ...pending,
        sessionTimeline: pending.sessionTimeline.map((event, index) =>
          index === 0 ? { ...event, ...mutation } : event,
        ),
      } as AppState
      expect(() => applyHumanDecision(
        forged, proposalId, 'approved', 'note', 'reviewer-1',
      )).toThrow(/invalid canonical review state|authoritative replay state/i)
    }
  })

  it('rejects proposal arrays with custom prototypes, symbols, or non-enumerable extras', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const customPrototype = [...pending.proposals]
    Object.setPrototypeOf(customPrototype, Object.create(Array.prototype))
    const symbolExtra = [...pending.proposals]
    Object.defineProperty(symbolExtra, Symbol('forged'), { value: true })
    const hiddenExtra = [...pending.proposals]
    Object.defineProperty(hiddenExtra, 'forged', { value: true, enumerable: false })

    for (const proposals of [customPrototype, symbolExtra, hiddenExtra]) {
      const forged = { ...pending, proposals } as AppState
      expect(isReviewRecordCoherent(forged, proposalId)).toBe(false)
      expect(() => applyHumanDecision(
        forged, proposalId, 'approved', 'note', 'reviewer-1',
      )).toThrow(/invalid|canonical|review state/i)
    }
  })

  it('rejects undeclared record fields and null pending decision fields', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const forgedStates: AppState[] = [
      { ...pending, simulations: pending.simulations.map((item) => ({ ...item, extra: true })) } as AppState,
      { ...pending, proposals: pending.proposals.map((item) => ({ ...item, extra: true })) } as AppState,
      { ...pending, sessionTimeline: pending.sessionTimeline.map((item) => ({ ...item, extra: true })) } as AppState,
      { ...pending, proposals: pending.proposals.map((item) => ({ ...item, decidedAt: null })) } as unknown as AppState,
    ]
    for (const forged of forgedStates) {
      expect(() => applyHumanDecision(
        forged, proposalId, 'approved', 'note', 'reviewer-1',
      )).toThrow(/invalid canonical review state|authoritative replay state/i)
    }

    const { nextState: decided } = applyHumanDecision(pending, proposalId, 'approved', 'note', 'reviewer-1')
    const extraAudit = {
      ...decided,
      auditLog: decided.auditLog.map((item) => ({ ...item, extra: true })),
    } as AppState
    expect(isReviewRecordCoherent(extraAudit, proposalId)).toBe(false)
  })

  it('rejects proposal-before-replay and reverse-ordered timeline timestamps', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const proposalBeforeReplay = {
      ...pending,
      proposals: pending.proposals.map((proposal) => ({ ...proposal, createdAt: '2000-01-01T00:00:00.000Z' })),
    }
    expect(() => applyHumanDecision(
      proposalBeforeReplay, proposalId, 'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid canonical review state|authoritative replay state/i)

    const reversed = {
      ...pending,
      sessionTimeline: pending.sessionTimeline.map((event, index) => ({
        ...event,
        ts: index === 0 ? '2030-01-01T00:00:00.000Z' : '2020-01-01T00:00:00.000Z',
      })),
    }
    expect(() => applyHumanDecision(
      reversed, proposalId, 'approved', 'note', 'reviewer-1',
    )).toThrow(/invalid canonical review state|authoritative replay state/i)
  })

  it('rejects an audit note longer than 500 characters', () => {
    const { state: s, proposalId } = setupProposal(state)
    expect(() => applyHumanDecision(
      s, proposalId, 'approved', 'N'.repeat(501), 'reviewer-1',
    )).toThrow(/reviewer note exceeds 500/i)
  })
})

// ── NEW TESTS for deepened domain ────────────────────────────────────────────

describe('runSimulation — substantive per-case results', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('produces per-case caseResults with explicit baseline/candidate decisions', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(sim.caseResults).toBeDefined()
    expect(sim.caseResults.length).toBe(4)
    const blockedCase = sim.caseResults.find((r: CohortCaseResult) => r.caseId === 'c-001-a')
    expect(blockedCase).toBeDefined()
    expect(blockedCase!.baselineDecision).toBe('BLOCKED')
    expect(blockedCase!.candidateDecision).toBe('BLOCKED')
  })

  it('identifies the triggering case (the one blocked in both baseline and candidate)', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(sim.triggeringCaseId).toBe('c-001-a')
  })

  it('identifies the benign control case (allowed in both baseline and candidate)', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    // c-001-b amount=38000 is under baseline cap (50000) and under candidate cap (50000)
    expect(sim.benignControlCaseId).toBe('c-001-b')
  })

  it('includes baseline and candidate policy version', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(sim.baselinePolicyVersion).toBeDefined()
    expect(sim.candidatePolicyVersion).toBeDefined()
    expect(sim.baselinePolicyVersion).not.toBe(sim.candidatePolicyVersion)
  })

  it('includes exact rule expression string', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(sim.ruleExpression).toBeDefined()
    expect(typeof sim.ruleExpression).toBe('string')
    expect(sim.ruleExpression.length).toBeGreaterThan(0)
  })

  it('has deterministic result identity (resultId) for same inputs', () => {
    const { sim: s1 } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    resetCounters()
    const state2 = makeInitialState()
    const { sim: s2 } = runSimulation(state2, 'inc-001', 'spending_cap', 50000, 'block')
    expect(s1.resultId).toBe(s2.resultId)
  })

  it('changes resultId when threshold changes', () => {
    const { sim: s1 } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const { sim: s2 } = runSimulation(state, 'inc-001', 'spending_cap', 60000, 'block')
    expect(s1.resultId).not.toBe(s2.resultId)
  })

  it('regression case: candidate allows previously-blocked case → delta BLOCKED→ALLOWED', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 200000, 'block')
    const regressionCase = sim.caseResults.find((r: CohortCaseResult) => r.caseId === 'c-001-a')
    expect(regressionCase!.baselineDecision).toBe('BLOCKED')
    expect(regressionCase!.candidateDecision).toBe('ALLOWED')
    expect(regressionCase!.delta).toBe('BLOCKED→ALLOWED')
  })

  it('regression case: candidate newly blocks a benign baseline case', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 30000, 'block')
    const regressionCase = sim.caseResults.find((r: CohortCaseResult) => r.caseId === 'c-001-b')
    expect(regressionCase!.baselineDecision).toBe('ALLOWED')
    expect(regressionCase!.candidateDecision).toBe('BLOCKED')
    expect(regressionCase!.delta).toBe('ALLOWED→BLOCKED')
    expect(sim.regressions).toContain('c-001-b')
  })

  it('happy-path case: triggering blocked, benign allowed, no regressions', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    // Triggering case blocked under candidate
    const trigger = sim.caseResults.find((r: CohortCaseResult) => r.caseId === sim.triggeringCaseId!)
    expect(trigger!.candidateDecision).toBe('BLOCKED')
    // Benign control allowed under candidate
    const benign = sim.caseResults.find((r: CohortCaseResult) => r.caseId === sim.benignControlCaseId!)
    expect(benign!.candidateDecision).toBe('ALLOWED')
    // No regressions
    expect(sim.regressions).toHaveLength(0)
  })
})

describe('AppState workflow phase', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('initial state has workflowPhase = INVESTIGATION', () => {
    expect(state.workflowPhase).toBe('INVESTIGATION')
  })

  it('workflowPhase advances to AWAITING_HUMAN_DECISION after draftProposal', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2 } = draftProposal(s1, 'inc-001', 'Cap', 'Rationale', sim.simId)
    expect(s2.workflowPhase).toBe('AWAITING_HUMAN_DECISION')
  })

  it('workflowPhase advances to DECIDED after human decision so the agent can verify status', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: s1, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2, proposal } = draftProposal(s1, 'inc-001', 'Cap', 'Rationale', sim.simId)
    const { nextState: s3 } = applyHumanDecision(s2, proposal.proposalId, 'approved', 'All clear', 'reviewer-1')
    expect(s3.workflowPhase).toBe('DECIDED')
  })
})

describe('applyHumanDecision — reviewer note and actor', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  function setupProposal(s: AppState) {
    const selected = { ...s, selectedIncidentId: 'inc-001' }
    const { nextState: s1, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2, proposal } = draftProposal(s1, 'inc-001', 'Cap', 'Rationale', sim.simId)
    return { state: s2, proposalId: proposal.proposalId }
  }

  it('audit entry records the local human reviewer identity', () => {
    const { state: s, proposalId } = setupProposal(state)
    const { entry } = applyHumanDecision(s, proposalId, 'approved', 'Looks good', 'reviewer-1')
    expect(entry.reviewerId).toBe('reviewer-1')
    expect(entry.actor).toBe('human')
  })

  it('audit entry has reviewerNote', () => {
    const { state: s, proposalId } = setupProposal(state)
    const { entry } = applyHumanDecision(s, proposalId, 'approved', 'All verified', 'reviewer-1')
    expect(entry.reviewerNote).toBe('All verified')
  })

  it('rejects a decision when explicit reviewer identity is omitted', () => {
    const { state: s, proposalId } = setupProposal(state)
    expect(() => applyHumanDecision(s, proposalId, 'approved', 'Missing identity')).toThrow(/reviewer identity is required/i)
  })

  it('rejects non-string reviewer identity even when it supplies trim()', () => {
    const { state: s, proposalId } = setupProposal(state)
    const forgedIdentity = { trim: () => 'forged-reviewer' }
    expect(() => applyHumanDecision(
      s, proposalId, 'approved', 'note', forgedIdentity as never,
    )).toThrow(/reviewer identity/i)
  })

  it('rejects an unrelated preexisting audit before a human decision', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const sparse: AppState = {
      ...pending,
      auditLog: [{
        id: 'audit-0002', ts: new Date().toISOString(), action: 'rejected', proposalId: 'old-proposal',
        reviewerNote: 'Old', actor: 'human', reviewerId: 'old-reviewer',
      }],
    }
    expect(() => applyHumanDecision(sparse, proposalId, 'approved', 'OK', 'reviewer-1')).toThrow(/pending proposal audit/i)
  })
})

describe('session capability timeline', () => {
  it('appends immutable, ordered events with deterministic session ids', () => {
    const initial = makeInitialState()
    expect(initial.sessionTimeline).toEqual([])
    const first = appendTimelineEvent(initial, {
      kind: 'registered',
      actor: 'system',
      toolName: 'list_incidents',
      detail: 'Capability became available.',
    })
    const second = appendTimelineEvent(first, {
      kind: 'invoked',
      actor: 'agent',
      toolName: 'list_incidents',
      detail: 'Tool invoked.',
    })
    expect(initial.sessionTimeline).toEqual([])
    expect(second.sessionTimeline.map((event) => event.id)).toEqual(['event-0001', 'event-0002'])
    expect(second.sessionTimeline[1].actor).toBe('agent')
  })

  it('derives timeline IDs from the highest persisted suffix', () => {
    const initial = makeInitialState()
    const sparse: AppState = {
      ...initial,
      sessionTimeline: [{
        id: 'event-0002', ts: new Date().toISOString(), kind: 'registered', actor: 'system', detail: 'Old event',
      }],
    }
    const next = appendTimelineEvent(sparse, { kind: 'result', actor: 'system', detail: 'New event' })
    expect(next.sessionTimeline.at(-1)?.id).toBe('event-0003')
  })
})

// ── Finding 1: ID collision after counter reset with persisted state ─────────

describe('ID collision — simId uniqueness after counter reset with persisted sims', () => {
  it('rejects ambiguous duplicate simId: older clean sim-0001 must not bypass zero-regression check for newer regressing sim-0001', () => {
    // Simulate what happens after page reload: global counter was reset to 0
    // but state was reloaded from localStorage containing sim-0001 (clean).
    resetCounters()
    const s0 = makeInitialState()
    // First journey: produce a clean simulation
    const { nextState: s1, sim: cleanSim } = runSimulation(s0, 'inc-001', 'spending_cap', 50000, 'block')
    // Verify clean sim has no regressions and can draft
    expect(cleanSim.simId).toBe('sim-0001')
    expect(cleanSim.regressions).toHaveLength(0)
    const { nextState: s2, proposal } = draftProposal(s1, 'inc-001', 'Cap', 'Clean replay', cleanSim.simId)
    expect(proposal.proposalId).toBe('prop-0001')

    // Simulate page reload: reset counters but restore state from localStorage
    // (state still has sim-0001 in it). We then inject a second simulation with
    // the SAME simId into the state to simulate the collision scenario that was
    // previously possible.
    resetCounters()
    // Manually inject a collision: same simId but with regressions — this models
    // what the OLD code would produce (counter restarts at 0 → sim-0001 again).
    const regressingSimManual: ReturnType<typeof runSimulation>['sim'] = {
      ...cleanSim,
      simId: 'sim-0001', // same ID — collision!
      regressions: ['c-001-a'], // has regressions
      triggeringCaseId: null, // no trigger
    }
    const collisionState: AppState = {
      ...s2,
      simulations: [...s2.simulations, regressingSimManual],
    }
    // draftProposal must reject the ambiguous duplicate simId
    expect(() =>
      draftProposal(collisionState, 'inc-001', 'title', 'rationale', 'sim-0001')
    ).toThrow(/ambiguous|duplicate/i)
  })

  it('deriving sim IDs from state length prevents collision', () => {
    resetCounters()
    const s0 = makeInitialState()
    const { nextState: s1, sim: sim1 } = runSimulation(s0, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2, sim: sim2 } = runSimulation(s1, 'inc-001', 'spending_cap', 60000, 'block')
    // IDs should differ
    expect(sim1.simId).not.toBe(sim2.simId)
    // After counter reset, next sim index derives from state.simulations.length
    resetCounters()
    const { nextState: s3, sim: sim3 } = runSimulation(s2, 'inc-001', 'spending_cap', 50000, 'block')
    // s2 already has 2 sims so next index is 3
    expect(sim3.simId).toBe('sim-0003')
    expect(s3.simulations).toHaveLength(3)
  })

  it('derives the next simulation ID from the highest persisted suffix, not array length', () => {
    const s0 = makeInitialState()
    const { sim } = runSimulation(s0, 'inc-001', 'spending_cap', 50000, 'block')
    const sparseState: AppState = { ...s0, simulations: [{ ...sim, simId: 'sim-0002' }] }
    expect(runSimulation(sparseState, 'inc-001', 'spending_cap', 50000, 'block').sim.simId).toBe('sim-0003')
  })

  it('rejects drafting when a proposal already exists in the pre-review graph', () => {
    const s0 = makeInitialState()
    const { nextState: replayed, sim } = runSimulation(s0, 'inc-001', 'spending_cap', 50000, 'block')
    const existing = {
      proposalId: 'prop-0002', incidentId: 'inc-001', simId: sim.simId,
      title: 'Existing', rationale: 'Existing rationale', status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }
    const forged: AppState = { ...replayed, proposals: [existing] }
    expect(() => draftProposal(forged, 'inc-001', 'Next', 'Clean replay', sim.simId)).toThrow(/pre-review proposal/i)
  })
})

describe('draftProposal — pre-conditions', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('throws when simulation is for a different incident', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-002', 'refund_limit', 2000, 'block')
    expect(() =>
      draftProposal(s1, 'inc-001', 'title', 'rationale', sim.simId)
    ).toThrow(/mismatch/i)
  })

  it('throws when simulation has no triggering case blocked', () => {
    // enforcement=allow means nothing is blocked in candidate — which also causes a regression
    // (c-001-a was blocked in baseline but is now allowed). The regression check fires first.
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'allow')
    expect(() =>
      draftProposal(s1, 'inc-001', 'title', 'rationale', sim.simId)
    ).toThrow(/regression|trigger/i)
  })

  it('throws when simulation has regressions', () => {
    // Threshold 200000 allows the 142000 case → regression
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 200000, 'block')
    expect(() =>
      draftProposal(s1, 'inc-001', 'title', 'rationale', sim.simId)
    ).toThrow(/regression/i)
  })

  it('throws when simulation has no benign control that remains allowed', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const withoutBenign: AppState = {
      ...s1,
      simulations: s1.simulations.map((candidate) =>
        candidate.simId === sim.simId
          ? { ...candidate, benignControlCaseId: null, regressions: [] }
          : candidate,
      ),
    }
    expect(() =>
      draftProposal(withoutBenign, 'inc-001', 'title', 'rationale', sim.simId)
    ).toThrow(/benign/i)
  })

  it('throws when title exceeds 200 chars', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(() =>
      draftProposal(s1, 'inc-001', 'T'.repeat(201), 'rationale', sim.simId)
    ).toThrow(/title.*200|200.*title/i)
  })

  it('throws when rationale exceeds 1000 chars', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(() =>
      draftProposal(s1, 'inc-001', 'title', 'R'.repeat(1001), sim.simId)
    ).toThrow(/rationale.*1000|1000.*rationale/i)
  })
})

// ── Finding 2: Incident/rule compatibility and truthful semantics ─────────────

describe('INCIDENT_RULE_COMPATIBILITY — exported compatibility matrix', () => {
  it('exports the compatibility matrix', () => {
    expect(INCIDENT_RULE_COMPATIBILITY).toBeDefined()
    expect(typeof INCIDENT_RULE_COMPATIBILITY).toBe('object')
  })

  it('procurement inc-001 is compatible with spending_cap but not stale_evidence', () => {
    expect(INCIDENT_RULE_COMPATIBILITY['inc-001']).toContain('spending_cap')
    expect(INCIDENT_RULE_COMPATIBILITY['inc-001']).not.toContain('stale_evidence')
  })

  it('support inc-002 is compatible with refund_limit but not stale_evidence or spending_cap', () => {
    expect(INCIDENT_RULE_COMPATIBILITY['inc-002']).toContain('refund_limit')
    expect(INCIDENT_RULE_COMPATIBILITY['inc-002']).not.toContain('stale_evidence')
    expect(INCIDENT_RULE_COMPATIBILITY['inc-002']).not.toContain('spending_cap')
  })

  it('deployment inc-003 is compatible with stale_evidence but not spending_cap or refund_limit', () => {
    expect(INCIDENT_RULE_COMPATIBILITY['inc-003']).toContain('stale_evidence')
    expect(INCIDENT_RULE_COMPATIBILITY['inc-003']).not.toContain('spending_cap')
    expect(INCIDENT_RULE_COMPATIBILITY['inc-003']).not.toContain('refund_limit')
  })
})

describe('runSimulation — incident/rule compatibility enforcement', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('throws for incompatible rule kind: stale_evidence on procurement inc-001', () => {
    expect(() =>
      runSimulation(state, 'inc-001', 'stale_evidence', 0, 'block')
    ).toThrow(/incompatible|stale_evidence.*inc-001|inc-001.*stale_evidence/i)
  })

  it('throws for incompatible rule kind: spending_cap on deployment inc-003', () => {
    expect(() =>
      runSimulation(state, 'inc-003', 'spending_cap', 50000, 'block')
    ).toThrow(/incompatible|spending_cap.*inc-003|inc-003.*spending_cap/i)
  })

  it('throws for incompatible rule kind: refund_limit on deployment inc-003', () => {
    expect(() =>
      runSimulation(state, 'inc-003', 'refund_limit', 2000, 'block')
    ).toThrow(/incompatible|refund_limit.*inc-003|inc-003.*refund_limit/i)
  })

  it('throws for incompatible rule kind: stale_evidence on support inc-002', () => {
    expect(() =>
      runSimulation(state, 'inc-002', 'stale_evidence', 0, 'block')
    ).toThrow(/incompatible/i)
  })

  it('throws for custom rule kind (not supported for any incident)', () => {
    expect(() =>
      runSimulation(state, 'inc-001', 'custom' as never, 50000, 'block')
    ).toThrow(/custom.*not supported|incompatible|unsupported/i)
  })

  it('procurement inc-001 with spending_cap — explicit trigger c-001-a BLOCKED, benign c-001-b ALLOWED', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(sim.triggeringCaseId).toBe('c-001-a')
    expect(sim.benignControlCaseId).toBe('c-001-b')
    const trigger = sim.caseResults.find(r => r.caseId === 'c-001-a')!
    expect(trigger.candidateDecision).toBe('BLOCKED')
    const benign = sim.caseResults.find(r => r.caseId === 'c-001-b')!
    expect(benign.candidateDecision).toBe('ALLOWED')
  })

  it('support inc-002 with refund_limit — explicit trigger c-002-a BLOCKED, benign c-002-b ALLOWED', () => {
    const { sim } = runSimulation(state, 'inc-002', 'refund_limit', 2000, 'block')
    expect(sim.triggeringCaseId).toBe('c-002-a')
    expect(sim.benignControlCaseId).toBe('c-002-b')
    const trigger = sim.caseResults.find(r => r.caseId === 'c-002-a')!
    expect(trigger.candidateDecision).toBe('BLOCKED')
    const benign = sim.caseResults.find(r => r.caseId === 'c-002-b')!
    expect(benign.candidateDecision).toBe('ALLOWED')
  })

  it('deployment inc-003 with stale_evidence — explicit trigger c-003-a BLOCKED, benign c-003-b ALLOWED', () => {
    const { sim } = runSimulation(state, 'inc-003', 'stale_evidence', 24, 'block')
    expect(sim.triggeringCaseId).toBe('c-003-a')
    expect(sim.benignControlCaseId).toBe('c-003-b')
    const trigger = sim.caseResults.find(r => r.caseId === 'c-003-a')!
    expect(trigger.candidateDecision).toBe('BLOCKED')
    const benign = sim.caseResults.find(r => r.caseId === 'c-003-b')!
    expect(benign.candidateDecision).toBe('ALLOWED')
  })

  it('deployment inc-003 stale_evidence: threshold is evidence_age_hours, NOT currency', () => {
    const { sim } = runSimulation(state, 'inc-003', 'stale_evidence', 24, 'block')
    // Rule expression must NOT contain currency symbols or dollar amounts
    expect(sim.ruleExpression).not.toMatch(/\$/)
    // Should reference evidence_age_hours or evidence_age
    expect(sim.ruleExpression).toMatch(/evidence_age|hours|attestation/i)
  })

  it('deployment rule expression reports the exact evidence-age threshold that was executed', () => {
    const { sim } = runSimulation(state, 'inc-003', 'stale_evidence', 40, 'block')
    expect(sim.ruleExpression).toContain('evidence_age_hours > 40')
    expect(sim.ruleExpression).not.toContain('evidence_age_hours > 24')
  })

  it('support inc-002 refund_limit: honors threshold — case with amount above threshold is BLOCKED', () => {
    // c-002-a has amount=8400, set limit to 5000: should still block
    const { sim } = runSimulation(state, 'inc-002', 'refund_limit', 5000, 'block')
    const trigger = sim.caseResults.find(r => r.caseId === 'c-002-a')!
    expect(trigger.candidateDecision).toBe('BLOCKED') // 8400 > 5000
  })

  it('support inc-002 refund_limit: threshold at 2000 — c-002-c (1999) stays ALLOWED', () => {
    const { sim } = runSimulation(state, 'inc-002', 'refund_limit', 2000, 'block')
    // c-002-c amount=1999 should NOT be blocked (1999 is not > 2000)
    const borderline = sim.caseResults.find(r => r.caseId === 'c-002-c')!
    expect(borderline.candidateDecision).toBe('ALLOWED') // 1999 <= 2000
  })

  it('deployment stale-evidence replay honors enforcement instead of hard-coding blocked outcomes', () => {
    const { sim } = runSimulation(state, 'inc-003', 'stale_evidence', 24, 'allow')
    const trigger = sim.caseResults.find((result) => result.caseId === 'c-003-a')!
    expect(trigger.candidateDecision).toBe('ALLOWED')
    expect(sim.regressions).toContain('c-003-a')
  })

  it('deployment stale-evidence replay honors the proposed evidence-age threshold', () => {
    const { sim } = runSimulation(state, 'inc-003', 'stale_evidence', 100, 'block')
    const staleWithAttestation = sim.caseResults.find((result) => result.caseId === 'c-003-c')!
    expect(staleWithAttestation.baselineDecision).toBe('BLOCKED')
    expect(staleWithAttestation.candidateDecision).toBe('ALLOWED')
    expect(sim.regressions).toContain('c-003-c')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED ARCHITECTURAL CORRECTION TESTS (third independent review)
// ═══════════════════════════════════════════════════════════════════════════

// ── Item 1: Session-only state — makeInitialState must not read localStorage ─

describe('makeInitialState — always fresh, never restored from localStorage', () => {
  it('returns a fresh state with empty sessionTimeline regardless of localStorage content', () => {
    // This is purely a domain purity test; localStorage interaction belongs to App
    // but we verify makeInitialState itself is always clean
    const s1 = makeInitialState()
    const s2 = makeInitialState()
    expect(s1.sessionTimeline).toHaveLength(0)
    expect(s2.sessionTimeline).toHaveLength(0)
    expect(s1.workflowPhase).toBe('INVESTIGATION')
    expect(s1.simulations).toHaveLength(0)
    expect(s1.proposals).toHaveLength(0)
    expect(s1.auditLog).toHaveLength(0)
    expect(s1.selectedIncidentId).toBeNull()
    expect(s1.activeSimId).toBeNull()
  })
})

// ── Item 2: Authoritative draft eligibility — recompute from canonical fixture ─

describe('draftProposal — authoritative eligibility recheck against canonical fixture', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('rejects adversarial in-memory state that mutates candidateDecision on the trigger case to ALLOWED', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    // Adversary mutates trigger case decision in memory
    const adversarialState: AppState = {
      ...s1,
      simulations: s1.simulations.map((candidate) =>
        candidate.simId === sim.simId
          ? {
              ...candidate,
              caseResults: candidate.caseResults.map((r) =>
                r.caseId === 'c-001-a'
                  ? { ...r, candidateDecision: 'ALLOWED' as const, isTrigger: true }
                  : r,
              ),
            }
          : candidate,
      ),
    }
    // Must recompute from canonical fixture and reject because trigger would be ALLOWED
    expect(() =>
      draftProposal(adversarialState, 'inc-001', 'title', 'rationale', sim.simId),
    ).toThrow(/trigger.*blocked|recompute|authoritative|candidate.*BLOCKED/i)
  })

  it('returns false without invoking throwing state or simulation accessors', () => {
    const { nextState: replayed, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    for (const field of ['incidents', 'simulations'] as const) {
      let reads = 0
      const forged = { ...replayed }
      Object.defineProperty(forged, field, {
        get: () => { reads += 1; throw new Error(`forged ${field} accessor`) },
        enumerable: true,
      })
      expect(isSimulationAuthoritativeAndDraftable(forged, sim.simId, 'inc-001')).toBe(false)
      expect(reads).toBe(0)
    }

    let nestedReads = 0
    const forgedSimulation = { ...replayed.simulations[0] }
    Object.defineProperty(forgedSimulation, 'incidentId', {
      get: () => { nestedReads += 1; throw new Error('forged simulation accessor') },
      enumerable: true,
    })
    const nested = { ...replayed, simulations: [forgedSimulation] }
    expect(isSimulationAuthoritativeAndDraftable(nested, sim.simId, 'inc-001')).toBe(false)
    expect(nestedReads).toBe(0)
  })

  it('rejects simulations missing required fields or carrying malformed case-result schemas', () => {
    const { nextState: replayed, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const missingCreatedAt = { ...replayed.simulations[0] }
    delete (missingCreatedAt as Partial<typeof missingCreatedAt>).createdAt
    expect(isSimulationAuthoritativeAndDraftable(
      { ...replayed, simulations: [missingCreatedAt] } as AppState,
      sim.simId, 'inc-001',
    )).toBe(false)

    const missingCaseField = { ...replayed.simulations[0].caseResults[0] }
    delete (missingCaseField as Partial<typeof missingCaseField>).delta
    const extraCaseField = { ...replayed.simulations[0].caseResults[0], forged: true }
    for (const forgedCase of [missingCaseField, extraCaseField]) {
      const forgedSimulation = {
        ...replayed.simulations[0],
        caseResults: [forgedCase, ...replayed.simulations[0].caseResults.slice(1)],
      }
      expect(isSimulationAuthoritativeAndDraftable(
        { ...replayed, simulations: [forgedSimulation] } as AppState,
        sim.simId, 'inc-001',
      )).toBe(false)
    }
  })

  it('rejects malformed top-level simulation arrays before authority derivation', () => {
    const { nextState: replayed, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const customPrototype = [...replayed.simulations]
    Object.setPrototypeOf(customPrototype, Object.create(Array.prototype))
    const symbolExtra = [...replayed.simulations]
    Object.defineProperty(symbolExtra, Symbol('forged'), { value: true })
    const hiddenExtra = [...replayed.simulations]
    Object.defineProperty(hiddenExtra, 'forged', { value: true, enumerable: false })
    for (const simulations of [customPrototype, symbolExtra, hiddenExtra]) {
      expect(isSimulationAuthoritativeAndDraftable(
        { ...replayed, simulations }, sim.simId, 'inc-001',
      )).toBe(false)
    }
  })

  it('rejects nested toJSON and nonplain-prototype simulation spoofs', () => {
    const { nextState: replayed, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const canonicalTrigger = sim.caseResults.find((item) => item.caseId === sim.triggeringCaseId)!
    const spoofedTrigger = { ...canonicalTrigger, candidateDecision: 'ALLOWED' as const }
    Object.defineProperty(spoofedTrigger, 'toJSON', {
      value: () => canonicalTrigger,
      enumerable: false,
    })
    const toJsonState: AppState = {
      ...replayed,
      simulations: replayed.simulations.map((item) => ({
        ...item,
        caseResults: item.caseResults.map((result) =>
          result.caseId === sim.triggeringCaseId ? spoofedTrigger : result,
        ),
      })),
    }
    expect(() => draftProposal(
      toJsonState, 'inc-001', 'title', 'rationale', sim.simId,
    )).toThrow(/recompute|authoritative|canonical/i)

    const prototypeSpoof = Object.assign(Object.create({ inherited: true }), canonicalTrigger)
    const prototypeState: AppState = {
      ...replayed,
      simulations: replayed.simulations.map((item) => ({
        ...item,
        caseResults: item.caseResults.map((result) =>
          result.caseId === sim.triggeringCaseId ? prototypeSpoof : result,
        ),
      })),
    }
    expect(() => draftProposal(
      prototypeState, 'inc-001', 'title', 'rationale', sim.simId,
    )).toThrow(/recompute|authoritative|canonical/i)
  })

  it('rejects adversarial in-memory state that clears regressions field to bypass check', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 200000, 'block')
    // Adversary clears regressions
    const adversarialState: AppState = {
      ...s1,
      simulations: s1.simulations.map((candidate) =>
        candidate.simId === sim.simId ? { ...candidate, regressions: [] } : candidate,
      ),
    }
    // Must recompute and detect regression from canonical fixture
    expect(() =>
      draftProposal(adversarialState, 'inc-001', 'title', 'rationale', sim.simId),
    ).toThrow(/regression/i)
  })

  it('rejects adversarial in-memory state that mutates benign control to BLOCKED', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const adversarialState: AppState = {
      ...s1,
      simulations: s1.simulations.map((candidate) =>
        candidate.simId === sim.simId
          ? {
              ...candidate,
              caseResults: candidate.caseResults.map((r) =>
                r.caseId === 'c-001-b'
                  ? { ...r, candidateDecision: 'BLOCKED' as const, isBenignControl: true }
                  : r,
              ),
              regressions: ['c-001-b'], // adversary leaves this intact
            }
          : candidate,
      ),
    }
    expect(() =>
      draftProposal(adversarialState, 'inc-001', 'title', 'rationale', sim.simId),
    ).toThrow(/regression|benign|mismatch|authoritative/i)
  })

  it('rejects adversarial state that changes the incidentId on a stored sim to bypass incident mismatch', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const adversarialState: AppState = {
      ...s1,
      simulations: s1.simulations.map((candidate) =>
        candidate.simId === sim.simId ? { ...candidate, incidentId: 'inc-002' } : candidate,
      ),
    }
    expect(() =>
      draftProposal(adversarialState, 'inc-001', 'title', 'rationale', sim.simId),
    ).toThrow(/mismatch|authoritative|recompute/i)
  })

  it('rejects adversarial state that changes ruleKind to bypass compatibility checks', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const adversarialState: AppState = {
      ...s1,
      simulations: s1.simulations.map((candidate) =>
        candidate.simId === sim.simId
          ? { ...candidate, ruleKind: 'refund_limit' as const }
          : candidate,
      ),
    }
    expect(() =>
      draftProposal(adversarialState, 'inc-001', 'title', 'rationale', sim.simId),
    ).toThrow(/recompute|authoritative|mismatch|incompatible/i)
  })

  it('rejects a simulation recomputed from a mutated noncanonical incident fixture', () => {
    const mutated = {
      ...state,
      selectedIncidentId: 'inc-001',
      incidents: state.incidents.map((incident) =>
        incident.id === 'inc-001'
          ? {
              ...incident,
              cohort: incident.cohort.map((entry) =>
                entry.caseId === 'c-001-a' ? { ...entry, label: 'forged trigger label' } : entry,
              ),
            }
          : incident,
      ),
    }
    const { nextState, sim } = runSimulation(mutated, 'inc-001', 'spending_cap', 50000, 'block')
    expect(() => draftProposal(nextState, 'inc-001', 'title', 'rationale', sim.simId)).toThrow(/authoritative|canonical|mismatch/i)
  })

  it('rejects a clean simulation renamed to a malformed noncanonical ID', () => {
    const { nextState, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const malformed = 'sim-1e5'
    const forged: AppState = {
      ...nextState,
      activeSimId: malformed,
      simulations: nextState.simulations.map((candidate) =>
        candidate.simId === sim.simId ? { ...candidate, simId: malformed } : candidate,
      ),
    }
    expect(() => draftProposal(forged, 'inc-001', 'title', 'rationale', malformed)).toThrow(/canonical.*simulation|invalid.*sim/i)
  })

  it('rejects drafting when non-replay incident evidence is mutated', () => {
    const { nextState, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    const forged: AppState = {
      ...nextState,
      incidents: nextState.incidents.map((incident) =>
        incident.id === 'inc-001'
          ? { ...incident, agent: 'forged-agent', summary: 'forged summary' }
          : incident,
      ),
    }
    expect(() => draftProposal(forged, 'inc-001', 'title', 'rationale', sim.simId)).toThrow(/canonical incident|fixture mismatch/i)
  })

  it('accepts a clean canonical simulation without false positive rejections', () => {
    const { nextState: s1, sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    expect(() =>
      draftProposal(s1, 'inc-001', 'title', 'rationale', sim.simId),
    ).not.toThrow()
  })
})

// ── Item 4: Canonical collision-safe IDs ─────────────────────────────────────

describe('nextNumericId — canonical decimal ID generation', () => {
  it('generates the first ID as prefix-0001 for an empty list', () => {
    expect(nextNumericId([], 'sim')).toBe('sim-0001')
    expect(nextNumericId([], 'prop')).toBe('prop-0001')
    expect(nextNumericId([], 'audit')).toBe('audit-0001')
    expect(nextNumericId([], 'event')).toBe('event-0001')
  })

  it('ignores IDs with exponent notation suffixes (scientific/overflow)', () => {
    // These malformed IDs must be ignored, not parsed as huge numbers
    const malformed = ['sim-1e5', 'sim-1E10', 'sim-9.9e20']
    const next = nextNumericId(malformed, 'sim')
    expect(next).toBe('sim-0001') // no valid decimal ID found → starts at 1
    // Critical: must not produce 'sim-100000' or exponent form
    expect(next).not.toMatch(/e/i)
  })

  it('ignores IDs with non-decimal suffixes', () => {
    const malformed = ['sim-abc', 'sim-0x10', 'sim-']
    expect(nextNumericId(malformed, 'sim')).toBe('sim-0001')
  })

  it('ignores decimal IDs that are not in canonical four-digit form', () => {
    expect(nextNumericId(['sim-1', 'sim-01', 'sim-00001'], 'sim')).toBe('sim-0001')
  })

  it('handles sparse IDs by using the highest valid decimal suffix', () => {
    expect(nextNumericId(['sim-0002', 'sim-0005'], 'sim')).toBe('sim-0006')
  })

  it('rejects duplicate canonical IDs for every record family', () => {
    for (const prefix of ['sim', 'prop', 'audit', 'event']) {
      expect(() => nextNumericId([`${prefix}-0001`, `${prefix}-0001`], prefix)).toThrow(/duplicate.*ID/i)
    }
  })

  it('handles huge valid decimal suffix safely up to MAX_SAFE_INTEGER boundary', () => {
    // A suffix within safe integer range should work
    const id = `sim-${String(9998).padStart(4, '0')}`
    expect(nextNumericId([id], 'sim')).toBe('sim-9999')
  })

  it('throws a bounded error when the next ID would exceed 9999 (four-digit exhaustion)', () => {
    // At 9999 we cannot produce sim-10000 in our four-digit canonical form
    // The implementation should throw when the next counter would overflow the prefix format
    const ids = [`sim-9999`]
    expect(() => nextNumericId(ids, 'sim')).toThrow(/exhausted|overflow|limit/i)
  })

  it('generated IDs never contain exponent notation', () => {
    const ids = ['sim-0001', 'sim-0002']
    const next = nextNumericId(ids, 'sim')
    expect(next).not.toMatch(/e/i)
    expect(next).toMatch(/^sim-\d{4}$/)
  })

  it('throws bounded error for duplicate detection (called from draftProposal guard)', () => {
    // validate that multiple sims with same ID still throw from draftProposal
    resetCounters()
    const s0 = makeInitialState()
    const { nextState: s1, sim } = runSimulation(s0, 'inc-001', 'spending_cap', 50000, 'block')
    const duplicateState: AppState = {
      ...s1,
      simulations: [...s1.simulations, { ...sim }], // duplicate simId
    }
    expect(() => draftProposal(duplicateState, 'inc-001', 'title', 'rationale', sim.simId)).toThrow(/ambiguous|duplicate/i)
  })
})

// ── Item 7: Exact threshold semantics — nonnegative safe integers only ────────

describe('runSimulation — threshold must be a nonnegative safe integer', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('rejects a fractional threshold', () => {
    expect(() =>
      runSimulation(state, 'inc-001', 'spending_cap', 50000.5, 'block'),
    ).toThrow(/integer|safe|fraction/i)
  })

  it('rejects MAX_SAFE_INTEGER + 1 (overflow)', () => {
    expect(() =>
      runSimulation(state, 'inc-001', 'spending_cap', Number.MAX_SAFE_INTEGER + 1, 'block'),
    ).toThrow(/safe integer|overflow|exceed/i)
  })

  it('rejects negative threshold', () => {
    expect(() =>
      runSimulation(state, 'inc-001', 'spending_cap', -1, 'block'),
    ).toThrow()
  })

  it('accepts zero as a valid threshold', () => {
    // zero is a valid nonneg safe integer
    expect(() =>
      runSimulation(state, 'inc-002', 'refund_limit', 0, 'block'),
    ).not.toThrow()
  })

  it('accepts MAX_SAFE_INTEGER as a valid threshold', () => {
    expect(() =>
      runSimulation(state, 'inc-001', 'spending_cap', Number.MAX_SAFE_INTEGER, 'block'),
    ).not.toThrow()
  })

  it('ruleExpression for spending_cap contains exact integer — no rounding', () => {
    const { sim } = runSimulation(state, 'inc-001', 'spending_cap', 50000, 'block')
    // Must show exactly $50,000 — no fractional amounts
    expect(sim.ruleExpression).toContain('50,000')
    expect(sim.ruleExpression).not.toMatch(/\.\d/)
  })

  it('ruleExpression for stale_evidence contains exact integer hours', () => {
    const { sim } = runSimulation(state, 'inc-003', 'stale_evidence', 24, 'block')
    expect(sim.ruleExpression).toContain('evidence_age_hours > 24')
    expect(sim.ruleExpression).not.toMatch(/24\.\d/)
  })
})

// ── Item 8: Remove custom RuleKind ───────────────────────────────────────────

describe('custom rule kind — removed', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('runSimulation throws for custom rule kind', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runSimulation(state, 'inc-001', 'custom' as any, 50000, 'block'),
    ).toThrow(/custom.*not valid|incompatible/i)
  })

  it('INCIDENT_RULE_COMPATIBILITY does not list custom in any incident', () => {
    for (const kinds of Object.values(INCIDENT_RULE_COMPATIBILITY)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(kinds).not.toContain('custom' as any)
    }
  })
})

// ── Item 9: Explicit workflow timeline events ────────────────────────────────

describe('workflow timeline events — emitted at phase transitions', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('runSimulation appends a workflow event when phase transitions to REPLAY_READY', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const workflowEvents = nextState.sessionTimeline.filter((e) => e.kind === 'workflow')
    expect(workflowEvents.length).toBeGreaterThanOrEqual(1)
    const replayEvent = workflowEvents.find((e) => /replay.ready/i.test(e.detail))
    expect(replayEvent).toBeDefined()
  })

  it('does not claim REPLAY_READY for a replay with regressions', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState } = runSimulation(selected, 'inc-001', 'spending_cap', 200000, 'block')
    expect(nextState.workflowPhase).toBe('INVESTIGATION')
    expect(nextState.sessionTimeline.some((event) =>
      event.kind === 'workflow' && /REPLAY_READY/.test(event.detail),
    )).toBe(false)
  })

  it('draftProposal appends a workflow event when phase transitions to AWAITING_HUMAN_DECISION', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: s1, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2 } = draftProposal(s1, 'inc-001', 'title', 'rationale', sim.simId)
    const workflowEvents = s2.sessionTimeline.filter((e) => e.kind === 'workflow')
    const awaitingEvent = workflowEvents.find((e) => /awaiting.human/i.test(e.detail))
    expect(awaitingEvent).toBeDefined()
  })

  it('applyHumanDecision appends a workflow event when phase transitions to DECIDED', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: s1, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: s2, proposal } = draftProposal(s1, 'inc-001', 'title', 'rationale', sim.simId)
    const { nextState: s3 } = applyHumanDecision(s2, proposal.proposalId, 'approved', 'ok', 'rev-1')
    const workflowEvents = s3.sessionTimeline.filter((e) => e.kind === 'workflow')
    const decidedEvent = workflowEvents.find((e) => /decided/i.test(e.detail))
    expect(decidedEvent).toBeDefined()
  })

  it('workflow events have canonical bounded IDs and correct actor', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const workflowEvents = nextState.sessionTimeline.filter((e) => e.kind === 'workflow')
    for (const event of workflowEvents) {
      expect(event.actor).toBe('system')
      expect(event.id).toMatch(/^event-\d{4}$/)
    }
  })

  it('workflow events are not duplicated when runSimulation is called twice in same phase', () => {
    const selected = { ...state, selectedIncidentId: 'inc-001' }
    const { nextState: s1 } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    // Phase is already REPLAY_READY; second sim in same phase should NOT add another transition event
    const { nextState: s2 } = runSimulation(s1, 'inc-001', 'spending_cap', 45000, 'block')
    const replayEvents = s2.sessionTimeline.filter(
      (e) => e.kind === 'workflow' && /→ REPLAY_READY$/.test(e.detail),
    )
    expect(replayEvents).toHaveLength(1)
  })
})
