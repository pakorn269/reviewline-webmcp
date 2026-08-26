import { describe, it, expect, beforeEach } from 'vitest'
import {
  handleListIncidents,
  handleInspectIncident,
  handleSimulateGuardrailPatch,
  handleDraftReviewGate,
  handleGetReviewStatus,
} from './tools'
import { applyHumanDecision, draftProposal, makeInitialState, resetCounters, runSimulation, type AppState } from '../domain/domain'

describe('handleListIncidents', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns all incidents when no filters applied', () => {
    const result = handleListIncidents(state, {})
    expect(result.incidents).toHaveLength(3)
    expect(result.incidents[0].id).toBe('inc-001')
  })

  it('filters by severity', () => {
    const result = handleListIncidents(state, { severity: 'critical' })
    expect(result.incidents).toHaveLength(1)
    expect(result.incidents[0].severity).toBe('critical')
  })

  it('filters by status', () => {
    const result = handleListIncidents(state, { status: 'unresolved' })
    expect(result.incidents).toHaveLength(3)
  })

  it('returns empty list when no match', () => {
    const result = handleListIncidents(state, { severity: 'low' })
    expect(result.incidents).toHaveLength(0)
  })

  it('result is bounded — each incident has only summary fields (no trace/cohort)', () => {
    const result = handleListIncidents(state, {})
    for (const inc of result.incidents) {
      expect(inc).not.toHaveProperty('trace')
      expect(inc).not.toHaveProperty('cohort')
    }
  })

  it('throws on invalid severity value', () => {
    expect(() => handleListIncidents(state, { severity: 'catastrophic' as never })).toThrow()
  })

  it('throws on null input', () => {
    expect(() => handleListIncidents(state, null as never)).toThrow()
  })

  it('throws on non-object input', () => {
    expect(() => handleListIncidents(state, 'string' as never)).toThrow()
  })

  it('throws on unknown property in input', () => {
    expect(() => handleListIncidents(state, { unknownProp: 'x' } as never)).toThrow()
  })

  it('output JSON is under 1500 characters', () => {
    const result = handleListIncidents(state, {})
    expect(JSON.stringify(result).length).toBeLessThan(1500)
  })
})

describe('handleInspectIncident', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns bounded evidence for a known incident', () => {
    const result = handleInspectIncident(state, 'inc-001')
    expect(result.id).toBe('inc-001')
    expect(result.trace).toBeDefined()
    expect(result.cohort).toBeDefined()
    expect(result.trace.length).toBeGreaterThan(0)
  })

  it('throws for unknown incident id', () => {
    expect(() => handleInspectIncident(state, 'inc-999')).toThrow(/unknown/i)
  })

  it('throws for empty incident id', () => {
    expect(() => handleInspectIncident(state, '')).toThrow()
  })

  it('sanitizes instruction-like trace messages in agent output (labels them)', () => {
    const result = handleInspectIncident(state, 'inc-001')
    // inc-001 trace[1] contains an embedded instruction
    const injectedEntry = result.trace.find((t) => t.meta?.injectedText)
    expect(injectedEntry).toBeDefined()
    // The message in agent output should be labeled as [UNTRUSTED-CONTENT]
    expect(injectedEntry!.message).toMatch(/\[UNTRUSTED-CONTENT\]/i)
  })

  it('output JSON is under 1500 characters', () => {
    const result = handleInspectIncident(state, 'inc-001')
    expect(JSON.stringify(result).length).toBeLessThan(1500)
  })
})

describe('handleSimulateGuardrailPatch', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns sim result and updated state with activeSimId set', () => {
    const { nextState, output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(nextState.activeSimId).toBe(output.simId)
    expect(output.blockedCount).toBe(1)
    expect(output.allowedCount).toBe(3)
  })

  it('includes regression detection in output', () => {
    const { output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 200000,
      enforcement: 'block',
    })
    expect(output.regressions.length).toBeGreaterThan(0)
  })

  it('throws for invalid enforcement value', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'spending_cap',
        threshold: 50000,
        enforcement: 'invalidvalue' as never,
      }),
    ).toThrow()
  })

  it('throws for negative threshold', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'spending_cap',
        threshold: -1,
        enforcement: 'block',
      }),
    ).toThrow()
  })

  it('throws for NaN threshold', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'spending_cap',
        threshold: NaN,
        enforcement: 'block',
      }),
    ).toThrow(/nan|finite|number/i)
  })

  it('throws for Infinity threshold', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'spending_cap',
        threshold: Infinity,
        enforcement: 'block',
      }),
    ).toThrow(/finite|infinity|number/i)
  })

  it('throws for null input', () => {
    expect(() => handleSimulateGuardrailPatch(state, null as never)).toThrow()
  })

  it('output includes resultId, ruleExpression, triggeringCaseId, benignControlCaseId', () => {
    const { output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(output.resultId).toBeDefined()
    expect(output.ruleExpression).toBeDefined()
    expect(output.triggeringCaseId).toBe('c-001-a')
    expect(output.benignControlCaseId).toBe('c-001-b')
  })

  it('output JSON is under 1500 characters', () => {
    const { output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(JSON.stringify(output).length).toBeLessThan(1500)
  })

  it('focuses the simulated incident so execution-time drafting checks have an authoritative selection', () => {
    const { nextState } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    expect(nextState.selectedIncidentId).toBe('inc-001')
  })
})

describe('handleDraftReviewGate', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('creates a pending proposal and returns proposalId', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    const simId = s1.activeSimId!
    const { nextState: s2, output } = handleDraftReviewGate(s1, {
      incident_id: 'inc-001',
      title: 'Enforce procurement cap',
      rationale: 'Block prompt injection attempts to override purchase limits.',
      sim_id: simId,
    })
    expect(output.proposalId).toBeDefined()
    expect(s2.proposals).toHaveLength(1)
    expect(s2.proposals[0].status).toBe('pending')
  })

  it('throws if simulation does not exist for incident', () => {
    expect(() =>
      handleDraftReviewGate(state, {
        incident_id: 'inc-001',
        title: 'Test',
        rationale: 'Test rationale',
        sim_id: 'sim-9999',
      }),
    ).toThrow()
  })

  it('throws if title is empty', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(() =>
      handleDraftReviewGate(s1, {
        incident_id: 'inc-001',
        title: '   ',
        rationale: 'Some rationale',
        sim_id: s1.activeSimId!,
      }),
    ).toThrow()
  })

  it('throws if title exceeds 200 chars (reject, not silently truncate)', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(() =>
      handleDraftReviewGate(s1, {
        incident_id: 'inc-001',
        title: 'T'.repeat(201),
        rationale: 'Some rationale',
        sim_id: s1.activeSimId!,
      }),
    ).toThrow(/200/)
  })

  it('throws if rationale exceeds 1000 chars (reject, not silently truncate)', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(() =>
      handleDraftReviewGate(s1, {
        incident_id: 'inc-001',
        title: 'title',
        rationale: 'R'.repeat(1001),
        sim_id: s1.activeSimId!,
      }),
    ).toThrow(/1000/)
  })

  it('throws if simulation is for a different incident', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-002',
      rule_kind: 'refund_limit',
      threshold: 2000,
      enforcement: 'block',
    })
    const mismatched = { ...s1, selectedIncidentId: 'inc-001' }
    expect(() =>
      handleDraftReviewGate(mismatched, {
        incident_id: 'inc-001',
        title: 'title',
        rationale: 'rationale',
        sim_id: s1.activeSimId!,
      }),
    ).toThrow(/mismatch/i)
  })

  it('throws on null input', () => {
    expect(() => handleDraftReviewGate(state, null as never)).toThrow()
  })
})

describe('handleGetReviewStatus', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns pending status for a newly created proposal', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    const { nextState: s2, output: proposalOut } = handleDraftReviewGate(s1, {
      incident_id: 'inc-001',
      title: 'Cap enforcement',
      rationale: 'Guardrail rationale.',
      sim_id: s1.activeSimId!,
    })
    const status = handleGetReviewStatus(s2, proposalOut.proposalId)
    expect(status.status).toBe('pending')
    expect(status.proposalId).toBe(proposalOut.proposalId)
  })

  it('throws for unknown proposal id', () => {
    expect(() => handleGetReviewStatus(state, 'prop-9999')).toThrow(/unknown/i)
  })

  it('output JSON is under 1500 characters', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    const { nextState: s2, output: proposalOut } = handleDraftReviewGate(s1, {
      incident_id: 'inc-001',
      title: 'Cap enforcement',
      rationale: 'Guardrail rationale.',
      sim_id: s1.activeSimId!,
    })
    const status = handleGetReviewStatus(s2, proposalOut.proposalId)
    expect(JSON.stringify(status).length).toBeLessThan(1500)
  })
})

describe('handleListIncidents', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns all incidents when no filters applied', () => {
    const result = handleListIncidents(state, {})
    expect(result.incidents).toHaveLength(3)
    expect(result.incidents[0].id).toBe('inc-001')
  })

  it('filters by severity', () => {
    const result = handleListIncidents(state, { severity: 'critical' })
    expect(result.incidents).toHaveLength(1)
    expect(result.incidents[0].severity).toBe('critical')
  })

  it('filters by status', () => {
    const result = handleListIncidents(state, { status: 'unresolved' })
    expect(result.incidents).toHaveLength(3)
  })

  it('returns empty list when no match', () => {
    const result = handleListIncidents(state, { severity: 'low' })
    expect(result.incidents).toHaveLength(0)
  })

  it('result is bounded — each incident has only summary fields (no trace/cohort)', () => {
    const result = handleListIncidents(state, {})
    for (const inc of result.incidents) {
      expect(inc).not.toHaveProperty('trace')
      expect(inc).not.toHaveProperty('cohort')
    }
  })

  it('throws on invalid severity value', () => {
    expect(() => handleListIncidents(state, { severity: 'catastrophic' as never })).toThrow()
  })
})

describe('handleInspectIncident', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns bounded evidence for a known incident', () => {
    const result = handleInspectIncident(state, 'inc-001')
    expect(result.id).toBe('inc-001')
    expect(result.trace).toBeDefined()
    expect(result.cohort).toBeDefined()
    expect(result.trace.length).toBeGreaterThan(0)
  })

  it('throws for unknown incident id', () => {
    expect(() => handleInspectIncident(state, 'inc-999')).toThrow(/unknown/i)
  })

  it('throws for empty incident id', () => {
    expect(() => handleInspectIncident(state, '')).toThrow()
  })
})

describe('handleSimulateGuardrailPatch', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns sim result and updated state with activeSimId set', () => {
    const { nextState, output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(nextState.activeSimId).toBe(output.simId)
    expect(output.blockedCount).toBe(1)
    expect(output.allowedCount).toBe(3)
  })

  it('includes regression detection in output', () => {
    const { output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 200000,
      enforcement: 'block',
    })
    expect(output.regressions.length).toBeGreaterThan(0)
  })

  it('throws for invalid enforcement value', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'spending_cap',
        threshold: 50000,
        enforcement: 'invalidvalue' as never,
      }),
    ).toThrow()
  })

  it('throws for negative threshold', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'spending_cap',
        threshold: -1,
        enforcement: 'block',
      }),
    ).toThrow()
  })
})

describe('handleDraftReviewGate', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('creates a pending proposal and returns proposalId', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    const simId = s1.activeSimId!
    const { nextState: s2, output } = handleDraftReviewGate(s1, {
      incident_id: 'inc-001',
      title: 'Enforce procurement cap',
      rationale: 'Block prompt injection attempts to override purchase limits.',
      sim_id: simId,
    })
    expect(output.proposalId).toBeDefined()
    expect(s2.proposals).toHaveLength(1)
    expect(s2.proposals[0].status).toBe('pending')
  })

  it('throws if simulation does not exist for incident', () => {
    expect(() =>
      handleDraftReviewGate(state, {
        incident_id: 'inc-001',
        title: 'Test',
        rationale: 'Test rationale',
        sim_id: 'sim-9999',
      }),
    ).toThrow()
  })

  it('throws if title is empty', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    expect(() =>
      handleDraftReviewGate(s1, {
        incident_id: 'inc-001',
        title: '   ',
        rationale: 'Some rationale',
        sim_id: s1.activeSimId!,
      }),
    ).toThrow()
  })
})

describe('handleGetReviewStatus', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('returns pending status for a newly created proposal', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    const { nextState: s2, output: proposalOut } = handleDraftReviewGate(s1, {
      incident_id: 'inc-001',
      title: 'Cap enforcement',
      rationale: 'Guardrail rationale.',
      sim_id: s1.activeSimId!,
    })
    const status = handleGetReviewStatus(s2, proposalOut.proposalId)
    expect(status.status).toBe('pending')
    expect(status.proposalId).toBe(proposalOut.proposalId)
  })

  it('throws for unknown proposal id', () => {
    expect(() => handleGetReviewStatus(state, 'prop-9999')).toThrow(/unknown/i)
  })
})

// ── Finding 2: tools-layer validation for incident/rule compatibility ─────────

describe('handleSimulateGuardrailPatch — incident/rule compatibility', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('throws for incompatible rule kind: stale_evidence on procurement inc-001', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'stale_evidence',
        threshold: 0,
        enforcement: 'block',
      })
    ).toThrow(/incompatible|stale_evidence/i)
  })

  it('throws for incompatible rule kind: spending_cap on deployment inc-003', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-003',
        rule_kind: 'spending_cap',
        threshold: 50000,
        enforcement: 'block',
      })
    ).toThrow(/incompatible|spending_cap/i)
  })

  it('throws for custom rule kind on any incident', () => {
    expect(() =>
      handleSimulateGuardrailPatch(state, {
        incident_id: 'inc-001',
        rule_kind: 'custom' as never,
        threshold: 50000,
        enforcement: 'block',
      })
    ).toThrow(/rule_kind.*one of/i)
  })

  it('accepts stale_evidence for inc-003 deployment', () => {
    const { output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-003',
      rule_kind: 'stale_evidence',
      threshold: 24,
      enforcement: 'block',
    })
    expect(output.triggeringCaseId).toBe('c-003-a')
    expect(output.benignControlCaseId).toBe('c-003-b')
  })
})

// ── Finding 5: inspect_incident/get_review_status non-null object validation ─

describe('handleInspectIncident — non-null object input validation', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('throws on null input', () => {
    expect(() => handleInspectIncident(state, null as never)).toThrow(/non-null|non-empty|required/i)
  })

  it('throws on non-object input (number)', () => {
    expect(() => handleInspectIncident(state, 42 as never)).toThrow()
  })

  it('throws on unknown properties in object input', () => {
    expect(() => handleInspectIncident(state, { incident_id: 'inc-001', unknownProp: 'x' } as never)).toThrow(/unknown/i)
  })

  it('accepts string incident_id directly', () => {
    const result = handleInspectIncident(state, 'inc-001')
    expect(result.id).toBe('inc-001')
  })

  it('accepts object with incident_id property', () => {
    const result = handleInspectIncident(state, { incident_id: 'inc-001' } as never)
    expect(result.id).toBe('inc-001')
  })
})

describe('handleGetReviewStatus — non-null object input validation', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  function setupProposal(s: AppState) {
    const { nextState: s1 } = handleSimulateGuardrailPatch(s, {
      incident_id: 'inc-001',
      rule_kind: 'spending_cap',
      threshold: 50000,
      enforcement: 'block',
    })
    const { nextState: s2, output } = handleDraftReviewGate(s1, {
      incident_id: 'inc-001',
      title: 'Cap enforcement',
      rationale: 'Guardrail rationale.',
      sim_id: s1.activeSimId!,
    })
    return { state: s2, proposalId: output.proposalId }
  }

  it('throws on null input', () => {
    expect(() => handleGetReviewStatus(state, null as never)).toThrow(/non-null|non-empty|required/i)
  })

  it('throws on unknown properties in object input', () => {
    const { state: s, proposalId } = setupProposal(state)
    expect(() => handleGetReviewStatus(s, { proposal_id: proposalId, unknownProp: 'x' } as never)).toThrow(/unknown/i)
  })

  it('accepts string proposal_id directly', () => {
    const { state: s, proposalId } = setupProposal(state)
    const result = handleGetReviewStatus(s, proposalId)
    expect(result.proposalId).toBe(proposalId)
  })

  it('accepts object with proposal_id property', () => {
    const { state: s, proposalId } = setupProposal(state)
    const result = handleGetReviewStatus(s, { proposal_id: proposalId } as never)
    expect(result.proposalId).toBe(proposalId)
  })

  it('rejects malformed state containers with a bounded domain error', () => {
    expect(() => handleGetReviewStatus(null as never, 'prop-0001')).toThrow(/invalid (?:canonical )?review state/i)
    const nullProposal = { ...makeInitialState(), proposals: [null] } as never
    expect(() => handleGetReviewStatus(nullProposal, 'prop-0001')).toThrow(/invalid (?:canonical )?review state/i)
    const nullIncident = { ...makeInitialState(), incidents: [null] } as never
    expect(() => handleGetReviewStatus(nullIncident, 'prop-0001')).toThrow(/invalid (?:canonical )?review state/i)
  })

  it('rejects a throwing proposal ID accessor with a bounded canonical error', () => {
    const { state: pending, proposalId } = setupProposal(state)
    let reads = 0
    const forgedProposal = { ...pending.proposals[0] }
    Object.defineProperty(forgedProposal, 'proposalId', {
      get: () => { reads += 1; throw new Error('forged proposal accessor') },
      enumerable: true,
    })
    const forged = { ...pending, proposals: [forgedProposal] }
    expect(() => handleGetReviewStatus(forged as never, { proposal_id: proposalId }))
      .toThrow(/invalid|canonical|review state/i)
    expect(reads).toBe(0)
  })

  it('rejects throwing audit accessors without invoking them', () => {
    const { state: pending, proposalId } = setupProposal(state)
    const decided = applyHumanDecision(
      pending, proposalId, 'approved', 'reviewed', 'reviewer-1',
    ).nextState
    let reads = 0
    const forgedAudit = { ...decided.auditLog[0] }
    Object.defineProperty(forgedAudit, 'reviewerNote', {
      get: () => { reads += 1; throw new Error('forged audit accessor') },
      enumerable: true,
    })
    expect(() => handleGetReviewStatus(
      { ...decided, auditLog: [forgedAudit] }, { proposal_id: proposalId },
    )).toThrow(/invalid|canonical|review state/i)
    expect(reads).toBe(0)
  })
})

// ── Finding 8: list_incidents cap at 50 and localStorage structural validation ─

describe('handleListIncidents — bounded output cap at 50', () => {
  const makeLargeState = (): AppState => {
    const base = makeInitialState()
    const manyIncidents = Array.from({ length: 60 }, (_, i) => ({
      ...base.incidents[0],
      id: `inc-${String(i + 100).padStart(3, '0')}`,
    }))
    return { ...base, incidents: manyIncidents }
  }

  it('caps output at 50 incidents even if state has more', () => {
    resetCounters()
    const result = handleListIncidents(makeLargeState(), {})
    expect(result.incidents.length).toBeLessThanOrEqual(50)
    expect(result.total).toBe(result.incidents.length)
  })

  it('keeps a large restored incident list below the serialized output budget', () => {
    const result = handleListIncidents(makeLargeState(), {})
    expect(JSON.stringify(result).length).toBeLessThan(1500)
  })
})

describe('draft_review_gate — execution-time least-authority checks', () => {
  it('rejects a retained simulation tool after the workflow reaches human review', () => {
    const { nextState: replayed, output: replay } = handleSimulateGuardrailPatch(
      { ...makeInitialState(), selectedIncidentId: 'inc-001' },
      { incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block' },
    )
    const { nextState: awaiting } = handleDraftReviewGate(replayed, {
      incident_id: 'inc-001', title: 'Review', rationale: 'Clean replay.', sim_id: replay.simId,
    })
    expect(() => handleSimulateGuardrailPatch(awaiting, {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })).toThrow(/workflow phase|least-authority/i)
  })

  it('rejects a retained draft tool when the selected incident has moved', () => {
    const { nextState: replayed, output } = handleSimulateGuardrailPatch(makeInitialState(), {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    const moved = { ...replayed, selectedIncidentId: 'inc-002' }
    expect(() => handleDraftReviewGate(moved, {
      incident_id: 'inc-001', title: 'Stale draft', rationale: 'Should fail closed', sim_id: output.simId,
    })).toThrow(/selected incident|selection/i)
  })

  it('rejects a retained draft tool when its simulation is no longer active', () => {
    const { nextState: replayed, output } = handleSimulateGuardrailPatch(makeInitialState(), {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    const stale = { ...replayed, activeSimId: null }
    expect(() => handleDraftReviewGate(stale, {
      incident_id: 'inc-001', title: 'Stale draft', rationale: 'Should fail closed', sim_id: output.simId,
    })).toThrow(/active simulation/i)
  })

  it('rejects a retained draft tool outside the replay-ready workflow phase', () => {
    const { nextState: replayed, output } = handleSimulateGuardrailPatch(makeInitialState(), {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    const stale = { ...replayed, workflowPhase: 'INVESTIGATION' as const }
    expect(() => handleDraftReviewGate(stale, {
      incident_id: 'inc-001', title: 'Stale draft', rationale: 'Should fail closed', sim_id: output.simId,
    })).toThrow(/workflow phase|replay.ready/i)
  })
})

describe('draft_review_gate — incident-specific status copy', () => {
  it('describes the blocked refund rather than a purchase for support incidents', () => {
    const { nextState, output: replay } = handleSimulateGuardrailPatch(makeInitialState(), {
      incident_id: 'inc-002', rule_kind: 'refund_limit', threshold: 2000, enforcement: 'block',
    })
    const { output } = handleDraftReviewGate(nextState, {
      incident_id: 'inc-002', title: 'Refund gate', rationale: 'Clean refund replay.', sim_id: replay.simId,
    })
    expect(output.message).toMatch(/refund remains blocked/i)
    expect(output.message).not.toMatch(/purchase/i)
  })

  it('describes the blocked deployment rather than a purchase for stale-evidence incidents', () => {
    const { nextState, output: replay } = handleSimulateGuardrailPatch(makeInitialState(), {
      incident_id: 'inc-003', rule_kind: 'stale_evidence', threshold: 24, enforcement: 'block',
    })
    const { output } = handleDraftReviewGate(nextState, {
      incident_id: 'inc-003', title: 'Evidence gate', rationale: 'Clean deployment replay.', sim_id: replay.simId,
    })
    expect(output.message).toMatch(/deployment remains blocked/i)
    expect(output.message).not.toMatch(/purchase/i)
  })
})

describe('adversarial aggregate output bounds', () => {
  function makePendingState(): { state: AppState; proposalId: string } {
    const selected = { ...makeInitialState(), selectedIncidentId: 'inc-001' }
    const { nextState: replayed, sim } = runSimulation(selected, 'inc-001', 'spending_cap', 50000, 'block')
    const { nextState: pending, proposal } = draftProposal(replayed, 'inc-001', 'title', 'rationale', sim.simId)
    return { state: pending, proposalId: proposal.proposalId }
  }

  function makeDecidedState(): { state: AppState; proposalId: string } {
    const { state: pending, proposalId } = makePendingState()
    const { nextState: decided } = applyHumanDecision(pending, proposalId, 'approved', 'note', 'reviewer-1')
    return { state: decided, proposalId }
  }

  it('keeps inspect output below budget when the incident agent is oversized', () => {
    const base = makeInitialState()
    const state = {
      ...base,
      incidents: base.incidents.map((incident) =>
        incident.id === 'inc-001' ? { ...incident, agent: 'a'.repeat(5000) } : incident,
      ),
    }
    expect(JSON.stringify(handleInspectIncident(state, 'inc-001')).length).toBeLessThan(1500)
  })

  it('keeps inspect output below budget when severity and status are forged oversized strings', () => {
    const base = makeInitialState()
    const state = {
      ...base,
      incidents: base.incidents.map((incident) =>
        incident.id === 'inc-001'
          ? { ...incident, severity: 's'.repeat(5000), status: 'x'.repeat(5000) }
          : incident,
      ),
    } as unknown as AppState
    expect(() => handleInspectIncident(state, 'inc-001')).toThrow(/invalid incident severity|invalid incident status/i)
  })

  it('keeps inspect output below budget when nested trace metadata is oversized', () => {
    const base = makeInitialState()
    const oversized = {
      ...base.incidents[0],
      summary: 's'.repeat(5000),
      trace: [{
        ts: 't'.repeat(5000), kind: 'k'.repeat(5000), message: 'm'.repeat(5000),
        meta: { payload: 'x'.repeat(5000) },
      }],
    }
    const state = { ...base, incidents: [oversized, ...base.incidents.slice(1)] } as unknown as AppState
    expect(JSON.stringify(handleInspectIncident(state, 'inc-001')).length).toBeLessThan(1500)
  })

  it('rejects an oversized proposal title with a bounded coherent-state error', () => {
    const { state: pending, proposalId } = makePendingState()
    const state = {
      ...pending,
      proposals: pending.proposals.map((proposal) => ({ ...proposal, title: 't'.repeat(5000) })),
    }
    expect(() => handleGetReviewStatus(state, proposalId)).toThrow(/(?:canonical|coherent) review state/i)
    try {
      handleGetReviewStatus(state, proposalId)
    } catch (error) {
      expect((error as Error).message.length).toBeLessThan(180)
    }
  })

  it('rejects adversarial status and actor values with a bounded error', () => {
    const base = makeInitialState()
    const state = {
      ...base,
      proposals: [{
        proposalId: 'prop-0001', incidentId: 'inc-001', simId: 'sim-0001',
        title: 'title', rationale: 'rationale', status: 'x'.repeat(5000), createdAt: new Date().toISOString(),
      }],
      auditLog: [{
        id: 'audit-0001', proposalId: 'prop-0001', action: 'approved', actor: 'x'.repeat(5000),
        reviewerId: 'reviewer', reviewerNote: 'note', ts: new Date().toISOString(),
      }],
    } as unknown as AppState
    try {
      handleGetReviewStatus(state, 'prop-0001')
      throw new Error('Expected invalid status rejection')
    } catch (error) {
      expect((error as Error).message).toMatch(/invalid proposal status/i)
      expect((error as Error).message.length).toBeLessThan(200)
    }
  })

  it('rejects an approved proposal without one matching human audit entry', () => {
    const base = makeInitialState()
    const state = {
      ...base,
      proposals: [{
        proposalId: 'prop-0001', incidentId: 'inc-001', simId: 'sim-0001',
        title: 'title', rationale: 'rationale', status: 'approved',
        createdAt: new Date().toISOString(), decidedAt: new Date().toISOString(),
      }],
      auditLog: [],
    } as unknown as AppState
    expect(() => handleGetReviewStatus(state, 'prop-0001')).toThrow(/(?:canonical|coherent) review state/i)
  })

  it('rejects decided status with a malformed audit ID', () => {
    const { state, proposalId } = makeDecidedState()
    const forged = { ...state, auditLog: state.auditLog.map((entry) => ({ ...entry, id: 'audit-1e5' })) }
    expect(() => handleGetReviewStatus(forged, proposalId)).toThrow(/(?:canonical|coherent) review state/i)
  })

  it('rejects decided status without an explicit nonempty reviewer identity', () => {
    const { state, proposalId } = makeDecidedState()
    const forged = { ...state, auditLog: state.auditLog.map((entry) => ({ ...entry, reviewerId: '' })) }
    expect(() => handleGetReviewStatus(forged, proposalId)).toThrow(/(?:canonical|coherent) review state/i)
  })

  it('rejects decided status when decidedAt is absent or differs from the audit timestamp', () => {
    const { state, proposalId } = makeDecidedState()
    const missing = {
      ...state,
      proposals: state.proposals.map(({ decidedAt: _decidedAt, ...proposal }) => proposal),
    } as AppState
    expect(() => handleGetReviewStatus(missing, proposalId)).toThrow(/(?:canonical|coherent) review state/i)

    const mismatched = {
      ...state,
      proposals: state.proposals.map((proposal) => ({ ...proposal, decidedAt: '2026-01-01T00:00:00.000Z' })),
    }
    expect(() => handleGetReviewStatus(mismatched, proposalId)).toThrow(/(?:canonical|coherent) review state/i)
  })

  it('rejects decided status whose proposal is not linked to authoritative active replay evidence', () => {
    const { state, proposalId } = makeDecidedState()
    const forged = {
      ...state,
      proposals: state.proposals.map((proposal) => ({ ...proposal, simId: 'sim-9999' })),
    }
    expect(() => handleGetReviewStatus(forged, proposalId)).toThrow(/(?:canonical|coherent) review state/i)
  })

  it('rejects status for a partial proposal or conflicting proposal/audit notes', () => {
    const { state: pending, proposalId: pendingId } = makePendingState()
    const partial = {
      ...pending,
      proposals: pending.proposals.map(({ title: _title, ...proposal }) => proposal),
    } as AppState
    expect(() => handleGetReviewStatus(partial, pendingId)).toThrow(/(?:canonical|coherent) review state/i)

    const { state: decided, proposalId } = makeDecidedState()
    const conflicting = {
      ...decided,
      proposals: decided.proposals.map((proposal) => ({ ...proposal, auditNote: 'different note' })),
    }
    expect(() => handleGetReviewStatus(conflicting, proposalId)).toThrow(/(?:canonical|coherent) review state/i)
  })

  it('rejects ambiguous duplicate proposal IDs during status lookup', () => {
    const base = makeInitialState()
    const proposal = {
      proposalId: 'prop-0001', incidentId: 'inc-001', simId: 'sim-0001',
      title: 'title', rationale: 'rationale', status: 'pending', createdAt: new Date().toISOString(),
    }
    const state = { ...base, proposals: [proposal, { ...proposal }] } as unknown as AppState
    expect(() => handleGetReviewStatus(state, 'prop-0001')).toThrow(/ambiguous|duplicate proposal/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED ARCHITECTURAL CORRECTION TESTS — tools layer
// ═══════════════════════════════════════════════════════════════════════════

// ── Item 3: Hard output/error bound <1500 chars ──────────────────────────────

describe('handleSimulateGuardrailPatch — adversarial oversized inputs', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('rejects unknown keys without echoing the giant key name in the error message', () => {
    const hugeKey = 'x'.repeat(2000)
    let errorMsg = ''
    try {
      handleSimulateGuardrailPatch(state, { [hugeKey]: 'value' } as never)
    } catch (e) {
      errorMsg = String(e)
    }
    expect(errorMsg.length).toBeLessThan(1500)
  })

  it('rejects oversized sim_id input without echoing it in the error', () => {
    // Simulate a request that would produce an error with a huge string
    const giantSimId = 'sim-' + 'a'.repeat(2000)
    let errorMsg = ''
    try {
      handleDraftReviewGate(state, {
        incident_id: 'inc-001',
        title: 'title',
        rationale: 'rationale',
        sim_id: giantSimId,
      })
    } catch (e) {
      errorMsg = String(e)
    }
    expect(errorMsg.length).toBeLessThan(1500)
  })
})

describe('handleDraftReviewGate — adversarial oversized title/rationale', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('rejects raw whitespace-padded values that exceed schema bounds before trimming', () => {
    const { nextState: replayed, output } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    expect(() => handleDraftReviewGate(replayed, {
      incident_id: 'inc-001', sim_id: output.simId,
      title: `x${' '.repeat(200)}`, rationale: 'valid rationale',
    })).toThrow(/title exceeds 200/i)
    expect(() => handleDraftReviewGate(replayed, {
      incident_id: 'inc-001', sim_id: output.simId,
      title: 'valid title', rationale: `x${' '.repeat(1000)}`,
    })).toThrow(/rationale exceeds 1000/i)
  })

  it('error for oversized title does not echo the full oversized string', () => {
    const { nextState: s1 } = handleSimulateGuardrailPatch(state, {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    let errorMsg = ''
    try {
      handleDraftReviewGate(s1, {
        incident_id: 'inc-001',
        title: 't'.repeat(5000),
        rationale: 'rationale',
        sim_id: s1.activeSimId!,
      })
    } catch (e) {
      errorMsg = String(e)
    }
    expect(errorMsg.length).toBeLessThan(1500)
  })
})

describe('retained direct state handler descriptor boundary', () => {
  beforeEach(() => resetCounters())

  it('rejects simulation state before invoking malformed getters', () => {
    let reads = 0
    const malformed = makeInitialState()
    Object.defineProperty(malformed, 'workflowPhase', {
      get: () => { reads += 1; throw new Error('forged simulation state getter') },
      enumerable: true,
    })
    expect(() => handleSimulateGuardrailPatch(malformed, {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })).toThrow(/invalid canonical review state/i)
    expect(reads).toBe(0)
  })

  it('rejects draft state before invoking malformed getters', () => {
    const { nextState: replayed, output } = handleSimulateGuardrailPatch(makeInitialState(), {
      incident_id: 'inc-001', rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block',
    })
    let reads = 0
    Object.defineProperty(replayed, 'activeSimId', {
      get: () => { reads += 1; throw new Error('forged draft state getter') },
      enumerable: true,
    })
    expect(() => handleDraftReviewGate(replayed, {
      incident_id: 'inc-001', title: 'title', rationale: 'rationale', sim_id: output.simId,
    })).toThrow(/invalid canonical review state/i)
    expect(reads).toBe(0)
  })
})

describe('handleListIncidents — adversarial unknown actor/status/error strings in errors', () => {
  let state: AppState
  beforeEach(() => {
    resetCounters()
    state = makeInitialState()
  })

  it('rejects unknown actor string without echoing it at length', () => {
    const giantActor = 'actor_'.repeat(500)
    let errorMsg = ''
    try {
      handleListIncidents(state, { actor: giantActor } as never)
    } catch (e) {
      errorMsg = String(e)
    }
    expect(errorMsg.length).toBeLessThan(1500)
  })
})
