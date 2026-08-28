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

## Entries 14–20 — Smoke shutdown, CI hardening, architecture simplification (condensed)

### 14 — Smoke hang fix (original)
**RED:** `Port 14175 still listening after killPreviewTree — orphan process remains`
**Fix:** Process-group kill via `process.kill(-pid, 'SIGTERM')` with `detached: true`.
**GREEN:** 2 tests pass; smoke exits 0, 5 manifests, 24 events, port free.

### 15 — Pages/CI workflow versions
**RED:** `actions/checkout@v4 below required @v7`; `node-version 20 not 24`
**Fix:** Both workflows: checkout@v7, setup-node@v7, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5, node-version '24'. CI adds `node --test scripts/*.node-test.mjs` step.
**GREEN:** All workflow tests pass.

### 16–17 — Process-group lifecycle gaps (superseded by 18)
PGID reuse risk identified; group-based approach replaced in Entry 18.

### 18 — Architecture simplification: direct-child Vite spawn
**Root cause:** npm intermediary created process tree; group-based fix introduced PGID reuse risk.
**Fix:** Spawn `node_modules/vite/bin/vite.js` directly. Own one ChildProcess, kill via handle.
Eliminated: detached groups, negative-PID signaling, `groupAlive`/`signalGroup`/`waitGroupGone`.
Structural YAML workflow validation via `yaml@2.9.0` replaces regex (immune to comment bypass).

### 19 — Spawn handshake, handle-based kill, validator tightening
`spawnPreview` async (rejects on missing executable/entry). `killPreview` uses `child.kill()` exclusively. Workflow validator uses exact inventories. Merged signal test; ephemeral ports.

### 20 — Fail-closed corrections
**RED (B):** `killPreview` returned early when `kill()` returned false without proving exit.
**GREEN:** Always wait boundedly for exit; escalate to SIGKILL; throw if not exited.

**RED (C):** Signal handler re-raised immediately without awaiting child retirement.
**GREEN:** Async handler awaits `cleanup()` (SIGTERM→SIGKILL as needed), then `process.exit(143/130)`.

**RED (A):** `validateCiWorkflow` used `.filter(expected.includes)` — extra `actions/evil@v99` passed.
**GREEN:** Compare full `uses` array directly to exact inventory. `findExpressions()` recursively locates all `${{}}` in parsed values; requires exactly one at `jobs.deploy.environment.url`. Exact workflow filenames and job keys enforced. Synthetic fixtures call same validators.

### Final state (Entry 20)
```
node --test scripts/*.node-test.mjs → 19 pass (8 lifecycle + 1 portable-build + 10 workflow)
npm test → 303 passed | typecheck/lint/build → exit 0
npm run e2e → 13 passed | audit → 0 vulnerabilities
smoke:native → exit 0, 5 manifests, 24 events, 0 errors
Pages build + verifier → verified
SIGTERM mid-smoke → exit 143, port free, no Vite/esbuild
actionlint → not installed locally
```

### 21 — Exact-tree reviewer corrections
**RED:** real validators accepted extra/suffixed/reordered workflow commands and unsafe permissions/inputs; verifier accepted symlinked `dist` and nested parents; hanging `browser.close()` retained Vite; lock metadata differed; fixture/listener/readiness gaps remained.

**Fix:** exact deep workflow schemas and least-privilege CI permissions; component-by-component symlink rejection including `dist` and `index.html`; canonical lock regeneration; bounded browser close with cleared timeout; first/second-signal child retirement; failure-safe fixtures; cleaned spawn listeners and signal-aware readiness.

**GREEN:** `node --test scripts/*.node-test.mjs` → 27 passed; Vitest 303; E2E 13; typecheck/lint/build/actionlint passed; audit 0; Chrome 152 smoke 5 manifests/24 events/0 errors; exact Pages verifier passed; no retained listener/process/temp residue.

### 22 — Mixed-reference, runner, and pre-handshake corrections
**RED:** exact validators accepted arbitrary names and `self-hosted`; mixed HTML hid external/single-quoted/wrong-case executable references behind one valid pair; SIGTERM during the spawn handshake leaked the preview child.

**Fix:** exact workflow/job names and `ubuntu-latest`; parse5 validates every script and stylesheet reference; cleanup ownership transfers synchronously before awaiting spawn; `dist/index.html` and all path components must be real non-symlinks; fast browser-close timers are cleared.

**GREEN:** focused suites → 30 passed (13 workflow, 5 portable-build, 12 lifecycle); mixed-reference and pre-handshake signal matrices leave no process, port, or fixture residue.

### 23 — Active HTML and handshake-error closure
**RED:** semantic workflow names/runners were mutable; active HTML via preload, inline styles/events, iframe/object/embed, `javascript:`, external base, or duplicate attributes escaped the asset inventory; child errors during the 300 ms handshake were unhandled.

**Fix:** exact names/runners; strict parse5 element/attribute allowlist with parse-error rejection and verified script/style/modulepreload/icon URLs; base and inline active content prohibited; one continuous handshake error listener with deterministic cleanup.

**GREEN:** focused suites → 32 passed (13 workflow, 6 portable-build, 13 lifecycle) on Node 24; portable verifier also passes on Node 20; no process, port, timer, or fixture residue.

### 24 — Combined spawn-failure closure
**RED:** a throwing ownership callback combined with an executable ENOENT left the later ChildProcess error unhandled.

**Fix:** install handshake listeners before invoking `onChild`; callback failure kills the child and drains the protected handshake rejection.

**GREEN:** combined callback+ENOENT subprocess exits cleanly; lifecycle suite 14/14 passed; total dedicated suites 33 passed.

---

### 25 — RED/GREEN — Internationalization (i18n) English/Thai dictionaries and context

**RED Command:**
```
npx vitest run src/i18n/i18n.test.tsx
```
**Result (RED):**
```
FAIL  src/i18n/i18n.test.tsx
Error: Failed to resolve import "./translations" from "src/i18n/i18n.test.tsx". Does the file exist?
```

**Files created:**
- `src/i18n/types.ts` — TypeScript types for `Language` (`'en' | 'th'`) and `TranslationDictionary` schema
- `src/i18n/en.ts` — Complete English dictionary matching baseline interface copy
- `src/i18n/th.ts` — Complete Thai dictionary adapted for AI safety / incident operations console
- `src/i18n/translations.ts` — Combined translations dictionary and parameter interpolation helper
- `src/i18n/I18nContext.tsx` — React context, provider, and `useI18n()` hook

**GREEN Command:**
```
npx vitest run src/i18n/i18n.test.tsx
```
**Result (GREEN):**
```
✓ src/i18n/i18n.test.tsx (5 tests) 16ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

---

### 26 — RED/GREEN — State-driven LanguageToggle and UI localization integration

**RED Command:**
```
npx vitest run src/components/LanguageToggle.test.tsx
```
**Result (RED):**
```
FAIL  src/components/LanguageToggle.test.tsx
Error: Failed to resolve import "./LanguageToggle" from "src/components/LanguageToggle.test.tsx". Does the file exist?
```

**Implementation & Integration:**
- `src/components/LanguageToggle.tsx` — State-driven toggle button displaying active language badge with 44px min-height
- `src/styles.css` — High-contrast dark operations-console styling for `.btn-lang`, `.lang-option`, and `.lang-divider`
- `src/App.tsx` — Wrapped with `I18nProvider`, placed `LanguageToggle` in header actions, localized tagline, reset button, and tool inspector summary
- `src/components/IncidentQueue.tsx`, `EvidencePanel.tsx`, `SimulationView.tsx`, `ReviewPanel.tsx`, `AuditLog.tsx`, `SessionTimeline.tsx`, `ToolInspector.tsx` — Localized headings, status labels, aria regions, empty states, and decision copy
- `tests/e2e/app.spec.ts` — Added E2E language toggle journey test

**GREEN Commands & Quality Gates:**
```
npx vitest run src/components/LanguageToggle.test.tsx
  ✓ src/components/LanguageToggle.test.tsx (3 tests)

npm test
  Test Files  13 passed (13)
  Tests       313 passed (313)

npm run typecheck
  exit 0 (no errors)

npm run lint
  exit 0 (zero warnings)

npm run e2e
  14 passed (9.8s)

npm run build
  built in 753ms (exit 0)

npm audit --audit-level=moderate
  found 0 vulnerabilities
```

---

### 27 — RED/GREEN — Incident content localization (summaries, agents, traces, cohort cases)

**Slice:**
Dynamically translate synthetic incident summaries, agent names, trace events, and cohort cases when Thai language is active while retaining canonical English domain records and WebMCP tool outputs.

**RED Command:**
```
npx vitest run src/i18n/incidentTranslations.test.ts
```

**Result (RED):**
```
FAIL  src/i18n/incidentTranslations.test.ts
Error: Failed to resolve import "./incidentTranslations" from "src/i18n/incidentTranslations.test.ts". Does the file exist?
```

**Files created & updated:**
- `src/i18n/incidentTranslations.ts` — `getLocalizedIncident` mapper translating summaries, agents, trace messages, and cohort cases for all three incidents (`inc-001`, `inc-002`, `inc-003`)
- `src/components/IncidentQueue.tsx` — Map visible incidents through `getLocalizedIncident` with active language
- `src/components/EvidencePanel.tsx` — Map selected incident through `getLocalizedIncident` with active language
- `src/components/IncidentQueue.test.tsx` — Added test verifying Thai summary and agent name in queue
- `src/components/EvidencePanel.test.tsx` — Added test verifying Thai trace steps and cohort items in evidence panel

**GREEN Commands & Quality Gates:**
```
npx vitest run src/i18n/incidentTranslations.test.ts
  ✓ src/i18n/incidentTranslations.test.ts (3 tests)

npm test
  Test Files  14 passed (14)
  Tests       318 passed (318)

npm run typecheck
  exit 0 (no errors)

npm run lint
  exit 0 (zero warnings)

npm run e2e
  14 passed (9.3s)

npm run build
  built in 740ms (exit 0)

npm audit --audit-level=moderate
  found 0 vulnerabilities
```

---

### 28 — RED/GREEN — Session timeline event localization (kinds, actors, details)

**Slice:**
Translate session timeline event kinds (`registered`, `workflow`, `invoked`, etc.), actors (`system`, `human`, `agent`), and event details (capability lifecycle notifications, incident selections, invocation statuses) when Thai is active, while keeping original technical tool identifiers intact.

**RED Command:**
```
npx vitest run src/i18n/timelineTranslations.test.ts
```

**Result (RED):**
```
FAIL  src/i18n/timelineTranslations.test.ts
Error: Failed to resolve import "./timelineTranslations" from "src/i18n/timelineTranslations.test.ts". Does the file exist?
```

**Files created & updated:**
- `src/i18n/timelineTranslations.ts` — `getLocalizedEvent` mapper translating kinds, actors, and details for session events
- `src/components/SessionTimeline.tsx` — Display localized event kinds, actors, and details in `SessionTimeline`
- `src/components/SessionTimeline.test.tsx` — Added test verifying Thai timeline headings, kinds, and actors

**GREEN Commands & Quality Gates:**
```
npx vitest run src/i18n/timelineTranslations.test.ts
  ✓ src/i18n/timelineTranslations.test.ts (3 tests)

npm test
  Test Files  15 passed (15)
  Tests       322 passed (322)

npm run typecheck
  exit 0 (no errors)

npm run lint
  exit 0 (zero warnings)

npm run e2e
  14 passed (9.6s)

npm run build
  built in 865ms (exit 0)

npm audit --audit-level=moderate
  found 0 vulnerabilities
```


