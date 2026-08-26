# TDD Log — Reviewline

## Entry 1 — RED — 2026-08-26

### Slice
First vertical slice: `makeInitialState` returns the three named synthetic incident IDs and starts with empty collections.

### Command
```
npx vitest run src/domain/domain.test.ts
```

### Result (RED)
```
 FAIL  src/domain/domain.test.ts [ src/domain/domain.test.ts ]
Error: Failed to resolve import "./domain" from "src/domain/domain.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /root/reviewline-webmcp/src/domain/domain.test.ts:2:33

 Test Files  1 failed (1)
      Tests  no tests
   Start at  03:05:51
   Duration  1.50s
```

### Reason
`src/domain/domain.ts` does not exist. The test correctly fails because the wished-for module is absent.

---

## Entry 2 — GREEN — 2026-08-26

### Slice
GREEN for Entry 1: `makeInitialState` with three synthetic incidents.

### Command
```
npx vitest run src/domain/domain.test.ts
```

### Result (GREEN)
```
 ✓ src/domain/domain.test.ts (1 test) 8ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  03:08:15
   Duration  1.45s
```

### Files created
- `src/domain/domain.ts` — AppState types, three synthetic incidents, `makeInitialState`

---

## Entry 3 — RED/GREEN — Domain behavior (expanded)

### Slice
Full domain behavior: incidents metadata, `runSimulation` (determinism, regression detection, blocking), `draftProposal` (truncation, validation), `applyHumanDecision` (approval, rejection, double-decide guard, note truncation).

### RED evidence
Expanded `domain.test.ts` with 15 additional tests referencing `runSimulation`, `draftProposal`, `applyHumanDecision`, and `resetCounters` — all of which were absent from `domain.ts`. Running the test file produced import resolution failures for those symbols.

### GREEN command
```
npx vitest run src/domain/domain.test.ts
```

### Result (GREEN)
```
 ✓ src/domain/domain.test.ts (16 tests) 17ms
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  03:08:48
```

---

## Entry 4 — RED/GREEN — Tool handlers

### Slice
`handleListIncidents`, `handleInspectIncident`, `handleSimulateGuardrailPatch`, `handleDraftReviewGate`, `handleGetReviewStatus` — bounded output, strict validation, regression detection.

### RED evidence
```
FAIL  src/tools/tools.test.ts
Error: Failed to resolve import "./tools" from "src/tools/tools.test.ts". Does the file exist?
  Tests  no tests
```

### GREEN command
```
npx vitest run src/tools/tools.test.ts
```

### Result (GREEN)
```
 ✓ src/tools/tools.test.ts (18 tests) 21ms
 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  03:09:52
```

---

## Entry 5 — RED/GREEN — WebMCP registration lifecycle

### Slice
`registerTools` wires five tools with correct names, annotations, and setState calls. Lifecycle-safe via AbortController. Degrades gracefully when `modelContext` is absent.

### RED evidence
```
FAIL  src/tools/registration.test.ts
Error: Failed to resolve import "./registration" from "src/tools/registration.test.ts". Does the file exist?
  Tests  no tests
```

### GREEN command
```
npx vitest run src/tools/registration.test.ts
```

### Result (GREEN)
```
 ✓ src/tools/registration.test.ts (5 tests) 73ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  03:11:22
```

---

## Entry 6 — RED/GREEN — Component slices

### Slices (each RED-confirmed before implementation)
- `IncidentQueue`: renders incidents, severity badges, selection state, onSelect callback
- `EvidencePanel`: trace timeline, cohort, empty state, block styling
- `SimulationView`: counts, regression warnings, no-regression message
- `ReviewPanel`: human-only approve/reject, decided state disables buttons, simulation evidence
- `AuditLog`: empty state, approved/rejected entries
- `ToolInspector`: tool listing, WebMCP available/fallback status

### RED evidence
Each component test file was run before the component file existed:
```
FAIL  src/components/IncidentQueue.test.tsx — Error: Failed to resolve import "./IncidentQueue"
FAIL  src/components/EvidencePanel.test.tsx — Error: Failed to resolve import "./EvidencePanel"
FAIL  src/components/SimulationView.test.tsx — Error: Failed to resolve import "./SimulationView"
FAIL  src/components/ReviewPanel.test.tsx — Error: Failed to resolve import "./ReviewPanel"
FAIL  src/components/AuditLog.test.tsx — Error: Failed to resolve import "./AuditLog"
FAIL  src/components/ToolInspector.test.tsx — Error: Failed to resolve import "./ToolInspector"
```

### GREEN command
```
npx vitest run
```

### Result (GREEN)
```
 ✓ src/components/IncidentQueue.test.tsx (4 tests)
 ✓ src/components/EvidencePanel.test.tsx (4 tests)
 ✓ src/components/SimulationView.test.tsx (4 tests)
 ✓ src/components/ReviewPanel.test.tsx (6 tests)
 ✓ src/components/AuditLog.test.tsx (2 tests)
 ✓ src/components/ToolInspector.test.tsx (3 tests)
 Test Files  10 passed (10)
      Tests  67 passed (67)
   Start at  03:21:04
```

---

## Entry 7 — Final quality gates — 2026-08-26

### Commands and results

```
npx vitest run
  Test Files  10 passed (10)
  Tests       67 passed (67)

npx tsc --noEmit
  exit 0 (no errors)

npx eslint . --ext .ts,.tsx --max-warnings 0
  exit 0 (zero warnings)

npm run build
  ✓ built in 2.21s

npm run e2e
  12 passed (17.2s)

npm audit --audit-level=moderate
  found 0 vulnerabilities
```

All gates pass cleanly.

---

## Entry 8 — RED/GREEN — substantive replay and proposal preconditions

- **RED:** `workflowPhase` remained `INVESTIGATION` after a human decision; the focused test expected `DECIDED` so `get_review_status` could remain available.
- **GREEN:** `npx vitest run src/domain/domain.test.ts -t "advances to DECIDED"` passed.
- **RED:** lowering the cap changed a benign case from `ALLOWED` to `BLOCKED` but the regression set stayed empty.
- **GREEN:** `npx vitest run src/domain/domain.test.ts -t "newly blocks a benign"` passed after symmetric delta detection.
- **RED:** a crafted clean simulation with no benign control could still draft a proposal.
- **GREEN:** `npx vitest run src/domain/domain.test.ts -t "no benign control"` passed after adding the explicit precondition.

## Entry 9 — RED/GREEN — dynamic least-authority WebMCP lifecycle

Each state transition was driven independently:

```text
RED initial registration: expected 2 tools, received 5
GREEN: investigation manifest = list_incidents + inspect_incident
RED selected incident: simulate_guardrail_patch absent
GREEN: selected manifest adds simulate_guardrail_patch
RED clean replay: draft_review_gate absent
GREEN: replay-ready manifest adds draft_review_gate
RED drafted proposal: mutation tools remained exposed
GREEN: awaiting-human manifest = list + inspect + get_review_status
RED decided proposal: get_review_status disappeared
GREEN: decided manifest retains status lookup and never exposes approval/rejection
```

Focused commands used `npx vitest run src/tools/registration.test.ts -t "<slice>"`; the integrated replay-to-review registration test passed with three invocation/result pairs.

## Entry 10 — RED/GREEN — visible append-only session evidence

- **RED:** `makeInitialState().sessionTimeline` was undefined and `appendTimelineEvent` did not exist.
- **GREEN:** deterministic immutable IDs `event-0001`, `event-0002` passed the focused domain test.
- **RED:** list/inspect/replay/draft/status handlers updated state but recorded no invocation or result evidence.
- **GREEN:** focused registration tests passed with ordered `invoked` and `result` events.
- **RED:** `SessionTimeline.test.tsx` failed because the component did not exist.
- **GREEN:** the component test passed and App renders initial registration events plus manifest add/remove events.

## Entry 11 — RED/GREEN — explicit review consequence and auditable simulation UI

- **RED:** SimulationView exposed only aggregate counts; provenance, exact rule, trigger, benign control, and baseline→candidate decisions were absent.
- **GREEN:** all 5 SimulationView tests passed with per-case outcomes and policy/result identities.
- **RED:** ReviewPanel lacked reviewer identity/note/confirmation and used ambiguous Approve/Reject actions.
- **GREEN:** all 7 ReviewPanel tests passed with consequence-specific actions, five separate state dimensions, and explicit no-deployment language.
- **RED:** selected incidents had `aria-current` but no visible selection affordance.
- **GREEN:** the focused IncidentQueue selection test passed.
- **RED:** at 320 px the minimum tested interactive target was 32 CSS px.
- **GREEN:** `npm run e2e -- --grep "mobile interactive targets"` passed with all tested targets ≥44 CSS px.

## Entry 12 — RED/GREEN — native Chrome dynamic WebMCP smoke

- **RED:** `npm run smoke:native` failed with `MODULE_NOT_FOUND` because the smoke artifact did not yet exist.
- The first script execution exposed two incorrect harness assumptions (`InspectIncidentOutput` is flat and the sanitizer label is `[UNTRUSTED-CONTENT]`); the harness was corrected to the tested public contract.
- **GREEN:** `npm run smoke:native` passed on Chrome `152.0.7977.42` using JSON-string arguments/results.

Verified manifest journey:

```text
INVESTIGATION             inspect_incident, list_incidents
INCIDENT_SELECTED         + simulate_guardrail_patch
REPLAY_READY              + draft_review_gate
AWAITING_HUMAN_DECISION   inspect_incident, list_incidents, get_review_status
DECIDED                   inspect_incident, list_incidents, get_review_status
```

The native run verified a blocked trigger, allowed benign control, zero regressions, UI-only human approval, final status `approved`, 20 visible timeline events, bounded outputs, and zero browser errors.

## Entry 13 — Independent-review invariant corrections

A fresh fail-closed review rejected the green baseline with eight blocking findings. Each correction received a focused RED before implementation:

- **ID ambiguity:** sparse/restored `sim`, `prop`, and `audit` suffix tests failed under length-based generation; GREEN now derives the next ID from the highest persisted suffix and duplicate simulation references fail closed.
- **Replay semantics:** deployment `allow` and 100-hour-threshold tests exposed hard-coded outcomes; GREEN evaluates explicit evidence age/attestation metadata with the supplied threshold and enforcement. Incompatible incident/rule combinations are rejected.
- **Concurrent state:** an async two-transaction test initially had no coordinator; GREEN serializes transactions, reads latest state, awaits commit, and preserves both event updates.
- **Retained draft authority:** moved-selection, inactive-simulation, and wrong-phase tests each drafted successfully in RED; GREEN rechecks `REPLAY_READY`, selected incident, and active simulation during execution.
- **Trust and validation:** native registration tests showed inspect/status silently ignored unknown properties and status claimed trusted output; GREEN forwards complete inputs to runtime validators and marks status output untrusted.
- **Human confirmation:** a replacement proposal inherited reviewer identity, note, and checkbox in RED; GREEN resets all three on proposal identity changes or disappearance.
- **Incident-specific consequences:** support/deployment tests exposed purchase/currency copy; GREEN renders refund and deployment outcomes and evidence-age units in both UI and draft output.
- **Persisted/output bounds:** malformed localStorage crashed App and a 60-record list serialized to 12,326 characters; GREEN discards invalid persisted structures, caps records, and trims list output below 1,500 characters.

Final focused accumulation before the second independent review: 189 unit/component/integration tests passed, including real async serialization and all three incident review paths.

## Second independent-review correction pass

The second fail-closed review reproduced one persisted-state security bypass and five additional logic defects. Publication remained blocked. Each behavior received a focused RED before correction:

- forged `REPLAY_READY` localStorage evidence exposed drafting authority;
- a 40-hour deployment replay reported a hard-coded 24-hour rule;
- SimulationView and the native input schema mislabeled evidence age as currency;
- adversarial nested trace metadata and restored proposal titles exceeded the 1,500-character tool-output budget;
- tool commits depended on `requestAnimationFrame`, which can be suspended;
- sparse restored timeline IDs collided.

GREEN corrections recompute and compare all simulation-derived trust fields, require unique IDs and proposal/simulation references, constrain restored record shapes and sizes, render executed units and thresholds truthfully, sanitize and aggregate-bound inspect/status output, derive timeline IDs from the highest persisted suffix, and acknowledge React commits with a bounded layout-effect handshake. A synchronous `flushSync` attempt passed the focused browserless test but failed native Chrome during in-flight capability reconciliation; the layout-effect handshake retained bounded commit acknowledgement without aborting the executing native tool.

Final focused accumulation after this pass: 197 unit/component/integration tests pass. Native Chrome 152 again completes the five-manifest journey with 20 timeline events and zero browser errors.

## Session-only fail-closed architecture pass

A third independent adversarial review still reproduced forged local decisions, summary-field drafting bypasses, aggregate output overruns, overflow IDs, unacknowledged commit poisoning, registration retirement races, fractional threshold contradictions, unsupported schema values, and missing workflow events. Publication remained blocked. After two automated correction cycles were exhausted, the user explicitly authorized an architectural simplification.

Kiro CLI began the correction but reached its monthly request limit after partial tests and implementation. Its partial tree was not trusted as complete: Hermes inspected the unstaged diff, observed 235/238 tests plus type/lint failures, and continued with focused RED→GREEN slices. Recorded focused REDs included:

- session-state storage tests observed `localStorage.getItem`/`setItem` calls;
- a forged trigger/control outcome still exposed `draft_review_gate`;
- a 5,000-character registered result crossed the central boundary;
- an oversized incident agent produced a 5,222-character direct inspect result;
- adversarial proposal status and an approved proposal without a human audit were accepted;
- noncanonical `sim-1`, `sim-01`, and `sim-00001` suffixes advanced the ID counter;
- an unmounted timed-out candidate became transaction B's input;
- native registration could hang indefinitely and an outer abort retired an in-flight tool;
- integer threshold schema constraints were absent;
- an ineligible ALLOW replay still rendered human decision controls;
- human and agent incident selection lacked explicit workflow events.
- a replay recomputed from a mutated incident fixture passed the supposed canonical check;
- a retained simulation tool still executed after the workflow entered human review.

Each focused test was observed failing for the stated behavior before its minimal correction passed. The resulting architecture is session-only, recomputes draft eligibility, centrally bounds registered success/error envelopes, uses canonical four-digit IDs, keeps only acknowledged committed state, leases in-flight registration generations, enforces whole-unit thresholds, removes unsupported rule kinds from production contracts, and records workflow transitions explicitly.

Current focused accumulation: 250 unit/component/integration tests pass.

## Canonical-state adversarial correction

The next independent review found nine remaining coherence gaps. Focused REDs reproduced malformed renamed simulation IDs, mutable fixture poisoning, non-replay incident mutation, duplicate IDs and duplicate proposal lookup/decision ambiguity, forged direct inspect enums, mismatched ReviewPanel evidence, incoherent manifest phases, non-retired timed-out registration signals, and inaccurate `REPLAY_READY` transitions. Each was corrected independently: canonical IDs and duplicate sets are validated at use, fixtures are deep-cloned and compared in full, direct handlers reject malformed enum state, review controls bind to proposal incident/simulation, status capability requires a coherent proposal/audit graph, registration timeout aborts its generation, fallback human attribution was removed, and only an eligible replay enters `REPLAY_READY`.

Current focused accumulation: 260 unit/component/integration tests pass.

## Canonical human-decision integrity correction

The next fail-closed review reproduced four remaining integrity gaps: decision calls could bypass phase/replay/audit coherence or omit reviewer identity; decided status accepted partial attribution records and globally malformed/duplicate audit IDs; retiring registrations admitted new executions while leasing an older call; and unknown workflow phases still exposed simulation authority. Focused RED→GREEN slices now require explicit reviewer identity, route decision/status/manifest authority through one canonical review-record predicate, validate all generated ID families and exact proposal/audit timestamp linkage, reject orphan audits, close registration admission immediately on retirement while allowing existing calls to finish, and expose only investigation tools for unknown phases.

Current focused accumulation: 269 unit/component/integration tests pass.

## Whole-session canonical graph correction

The following review showed that focused-record coherence was still too narrow. Focused RED→GREEN slices now runtime-reject unknown decision actions and blank reviewer notes; collapse pre-review replay history to the single simulation owned by the draft; require exactly one proposal throughout human review; validate canonical incident fixtures, simulation/proposal/audit/timeline arrays, replay and proposal timestamps, required bounded proposal fields, pending/decided audit-note semantics, timeline IDs/timestamps/kinds/actors/tool relationships, and all cross-record references; and revalidate the complete decided state before returning it. Direct status and manifest exposure consume this same total predicate, so partial proposals and conflicting audit notes fail closed with bounded errors.

Current focused accumulation: 277 unit/component/integration tests pass.

## Closed-schema and atomic-registration correction

The next adversarial review found that the total graph still accepted undeclared keys and noncausal timestamps, draft/decision inputs had a few permissive edges, malformed state containers could throw incidental errors, and native registration could leave a partial generation. Focused RED→GREEN slices now enforce exact plain-object key sets for AppState and every review record, true absence of pending decision fields, proposal-after-replay and monotonic timeline timestamps, canonical pre-draft timeline evidence, validated returned draft/decision graphs, nonblank rationale, strict string reviewer identity, rejection (not truncation) of notes above 500 characters, total bounded status/container failure, immediate registration admission closure, and controller abort on every registration failure so partial tools retire atomically.

Current focused accumulation: 285 unit/component/integration tests pass.

## Descriptor-safe authority and leased rollback correction

The next adversarial review found nested `toJSON`/prototype spoofing, raw whitespace-padding bounds, malformed manifest records, semantic timeline gaps, and direct controller aborts that bypassed leases. Focused RED→GREEN slices replace all JSON serialization trust comparisons with strict recursive descriptor equality; reject accessors, hooks, symbols, non-enumerable extras, and nonplain nested records; enforce raw title/rationale bounds before normalization; make manifest element access total; create the exact human-decision event inside the validated domain transition; constrain workflow actor semantics; and route registration failures and timeouts through admission-closed, idle-aware retirement while explicitly testing both leased failure and leased timeout paths.

Current focused accumulation: 289 unit/component/integration tests pass.

## Top-level descriptor closure and semantic attestation correction

The next review found top-level non-enumerable/symbol/accessor gaps despite nested descriptor comparison, plus workflow timestamp attestation and lease-aware failure retirement edges. The correction makes exact-key validation use `Reflect.ownKeys` and data descriptors, validates SimulationResult before any authority-bearing property read, safely locates IDs through descriptors, binds AWAITING and DECIDED phase events to replay/proposal/audit timestamps, keeps failure and timeout retirement pending until admitted executions finish, enforces raw tool-input bounds before normalization, makes manifest record access total, moves the exact human-decision event into the validated domain transition, and aligns fallback inspector schemas with native contracts.

Current focused accumulation: 289 unit/component/integration tests pass.

## Accessor-safe boundary and exact-array correction

The next fail-closed review found ordinary property reads still reachable at manifest, simulation-authority, status, and decision boundaries, and found that authority-bearing arrays accepted custom prototypes and hidden/symbol extras. Focused RED→GREEN tests now require manifest derivation to return the minimal tool set without invoking forged accessors, simulation authority to return false, and status/decision paths to return bounded canonical errors. Review arrays now require dense native Array instances with exact index/length data descriptors and no holes, accessors, symbols, non-enumerable extras, or custom prototypes.

Current focused accumulation: 294 unit/component/integration tests pass.

## Zero-invocation descriptor decoder correction

The next independent probes showed that caught getter exceptions still allowed attacker-controlled side effects. A single descriptor-only AppState decoder now validates the exact top-level record, canonical incident fixtures, all five dense authority arrays, every record data descriptor, and all nested arrays/objects before any ordinary property read. Manifest derivation, simulation authority, review coherence, status output, and human decisions share this decoder. Regression tests count getter invocations and require exactly zero for top-level containers and nested incident, simulation, proposal status/ID, and audit fields; malformed authority arrays cannot expose phase capabilities.

Current focused accumulation: 298 unit/component/integration tests pass.

## Required-key schema closure

The next fail-closed review found that descriptor safety did not imply exact required-key presence. The decoder now requires every AppState and SimulationResult field, required proposal/event fields with only their documented optional fields, exact audit fields, and required cohort-result fields with optional `amount` only. Missing workflow pointers, simulation timestamps, or case-result fields—and undeclared case-result fields—fail before capability or authority derivation.

Current focused accumulation: 300 unit/component/integration tests pass.

## Retained-tool execution boundary correction

The schema decoder passed exhaustive mutation testing, but retained native tool objects could still read or append timeline events before invoking direct handlers. Every registered transaction—list, inspect, simulate, draft, and status—now descriptor-validates its current AppState as its first operation. Direct simulation and drafting handlers do the same before workflow reads. Regression tests install throwing getters after registration and require zero invocations across all five retained tools.

Current focused accumulation: 303 unit/component/integration tests pass.
