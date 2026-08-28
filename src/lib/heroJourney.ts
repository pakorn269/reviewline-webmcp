// heroJourney — the scripted three-step agent journey used by the in-page harness
// when no WebMCP-capable browser agent is driving the page.
//
// It calls exactly the same tool handlers a real agent would, through the same
// transactional bridge. It cannot approve, reject, or activate anything.
//
// MIT License

import {
  executeToolByName,
  type GetState,
  type RunStateTransaction,
} from '../tools/registration'

/** Pause so a human watching the demo can see each capability transition land. */
const STEP_PAUSE_MS = 600

const HERO_INCIDENT_ID = 'inc-001'
const HERO_THRESHOLD = 50000

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runHeroJourney(
  getState: GetState,
  runTransaction: RunStateTransaction,
): Promise<void> {
  await executeToolByName(getState, runTransaction, 'inspect_incident', {
    incident_id: HERO_INCIDENT_ID,
  })
  await pause(STEP_PAUSE_MS)

  await executeToolByName(getState, runTransaction, 'simulate_guardrail_patch', {
    incident_id: HERO_INCIDENT_ID,
    rule_kind: 'spending_cap',
    threshold: HERO_THRESHOLD,
    enforcement: 'block',
  })
  await pause(STEP_PAUSE_MS)

  const simId = getState().activeSimId
  if (!simId) return

  await executeToolByName(getState, runTransaction, 'draft_review_gate', {
    incident_id: HERO_INCIDENT_ID,
    title: 'Cap procurement at $50,000',
    rationale:
      'Replay proves the trigger purchase stays blocked and the benign control passes with zero regressions.',
    sim_id: simId,
  })
}
