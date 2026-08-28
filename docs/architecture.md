# Reviewline architecture

## System shape

Reviewline is a client-only React 19 + TypeScript + Vite application. There is no backend, authentication service, network mutation, external policy engine, or LLM API. Synthetic fixtures and deterministic domain functions make the contest journey reproducible.

```text
Browser agent                         Human reviewer
     │                                      │
     │ current document.modelContext tools  │ consequence-specific UI form
     ▼                                      ▼
registration.ts ────────────────► App.tsx / AppState
     │                                │
     │ validated tool handlers         ├─ visible capability manifest
     ▼                                ├─ append-only session timeline
  tools.ts                            ├─ evidence / replay / review UI
     │                                └─ session-only in-memory state
     ▼
  domain.ts
  deterministic replay + proposal preconditions + human audit record
```

Tool executions run through one serialized state-transaction queue. Each transaction reads only the latest acknowledged `stateRef`, calculates one complete next state, and resolves only after a React layout-effect acknowledges the visible commit. A bounded timeout rejects and rolls back an unacknowledged candidate, so failed commits cannot become the basis of later calls. No transaction depends on `requestAnimationFrame`.

## Domain state

`AppState` contains:

- three synthetic incidents with trace evidence and replay cohorts;
- deterministic simulations with per-case baseline/candidate decisions;
- pending or decided review proposals;
- human decision audit records (`actor: human`, reviewer identity, reviewer note);
- selected/focused identities and the current workflow phase;
- an append-only session timeline for registration, unregistration, invocation, result, workflow, and human-decision evidence.

Workflow state is deliberately session-only. Reviewline never reads or writes simulations, proposals, decisions, audit records, phases, selections, or timeline events through `localStorage`; a reload and the explicit Reset action both start a fresh investigation session. IDs use canonical four-digit forms, ignore malformed suffixes, fail closed at exhaustion, and reject ambiguous simulation references.

## State-aware capability reconciliation

`getAvailableToolNames(state)` is a pure policy function. App derives a stable manifest key and registers only the next phase’s tools. Registration generations use execution leases: retirement is requested at a phase change, but the inner registration signal is not aborted until every in-flight execution from that generation has completed. Each native registration call has a bounded timeout.

```text
INVESTIGATION
  list + inspect
      │ inspect/select
      ▼
INCIDENT_SELECTED
  list + inspect + simulate
      │ clean replay: blocked trigger + allowed benign + no delta
      ▼
REPLAY_READY
  list + inspect + simulate + draft
      │ draft proposal
      ▼
AWAITING_HUMAN_DECISION
  list + inspect + status
      │ UI-only human decision
      ▼
DECIDED
  list + inspect + status
```

Approval, rejection, activation, and deployment are absent in every phase. Lease-aware AbortController cleanup prevents stale registrations from surviving after in-flight work completes. Manifest diff and explicit workflow-transition events are recorded without feeding back into the manifest key, avoiding effect loops.

## Counterfactual replay

`runSimulation` is a pure deterministic evaluator. The procurement hero records:

- stable `simId` plus content-derived `resultId`;
- baseline and candidate policy versions;
- exact rule expression;
- an evidence case ID and label per cohort item;
- explicit `BLOCKED`/`ALLOWED` baseline and candidate decisions;
- named triggering and benign-control cases;
- symmetric regression detection: both newly allowed blocked cases and newly blocked benign cases are deltas.

A proposal can be drafted only after verifying that the full deep-cloned incident collection still matches the canonical fixtures, then recomputing the stored simulation inputs and matching every derived trust field. The authoritative replay must use a canonical unambiguous simulation ID, belong to the selected incident, retain a blocked trigger and allowed benign control, and have zero regressions. Thresholds are nonnegative safe integers: whole USD for spending/refund and whole hours for stale evidence.

## Decision state model

Reviewline deliberately separates five concepts that dashboards often collapse:

1. **Enforcement outcome:** the relevant purchase, refund, or deployment remains blocked.
2. **Simulation status:** the counterfactual replay completed locally.
3. **Human review:** pending, approved, or rejected.
4. **Incident state:** still open in this demo.
5. **Policy deployment:** no external policy is deployed.

The reviewer must provide an explicit string identity and a nonblank note of at most 500 raw characters, confirm the evidence/consequence, and then choose exactly `approved` or `rejected`. Creating a draft intentionally collapses replay history to one canonical active simulation and one focused proposal. Decision, status-output, status-capability, direct handler, and retained native-tool execution paths share one descriptor-only AppState decoder and total review-graph predicate. Every registered transaction validates current state before workflow reads or timeline appends. The exact required top-level record, canonical incident fixtures, strict recursive descriptor comparison without serialization hooks, required-key plain-object schemas with only documented optional fields, exact dense native-array schemas, globally unique canonical IDs, causal timestamps, valid timeline actor/kind/tool relationships, authoritative replay ownership, and complete referential integrity are all required before ordinary property access. Accessor-backed, incomplete, or malformed records fail closed with zero getter invocation. `applyHumanDecision` creates both the immutable-in-session human audit entry and matching human-decision timeline event inside one validated transition, links `decidedAt` to the audit timestamp, copies the exact trimmed reviewer note to the proposal, and advances to `DECIDED`; only that coherent graph keeps `get_review_status` available for agent verification.

## Trust and output boundaries

JSON Schema guides the browser agent, but every handler independently rejects malformed runtime values. A central registration-boundary envelope rejects any success result at or above 1,500 serialized characters and truncates runtime errors to a short bounded message; handlers also produce bounded outputs directly. Trace entries whose metadata marks injected text are transformed into labeled `[UNTRUSTED-CONTENT]` summaries for the agent while the original synthetic evidence remains visible in the human UI.

See [SECURITY.md](../SECURITY.md) for the boundary caveat and [webmcp-testing.md](webmcp-testing.md) for native verification.

## Internationalization (i18n) and presentation boundaries

Reviewline provides a bilingual operator interface supporting English (`en`) and Thai (`th`) via a state-driven toggle in the header action bar.

- **Invariant preservation:** Machine-level WebMCP identifiers (`list_incidents`, `inspect_incident`, `simulate_guardrail_patch`, `draft_review_gate`, `get_review_status`), domain record schemas, simulation mathematics, and tool return payloads remain strictly canonical English ASCII.
- **Typed dictionary schema:** `TranslationDictionary` guarantees compile-time key symmetry between `en.ts` and `th.ts`.
- **Presentation mapping:** `getLocalizedIncident` and `getLocalizedEvent` dynamically map incident summaries, traces, cohort cases, event kinds, and actor titles for human display when Thai mode is active without mutating underlying domain fixtures or affecting agent tool transactions.
- **Accessibility:** The language toggle adheres to WCAG touch targets (44px min height/width), keyboard focus, and localized dynamic `aria-label` tags.

## Key paths

```text
src/domain/domain.ts                 deterministic state and replay engine
src/tools/tools.ts                   validation and bounded tool contracts
src/tools/registration.ts            dynamic native registration and tool-call evidence
src/i18n/types.ts                    strongly typed dictionary schema
src/i18n/en.ts, th.ts                bilingual translation dictionaries
src/i18n/I18nContext.tsx             state-driven i18n provider and hook
src/i18n/incidentTranslations.ts     localized incident summary/trace/cohort mapper
src/i18n/timelineTranslations.ts     localized session timeline mapper
src/components/LanguageToggle.tsx    accessible EN/TH toggle component
src/components/SimulationView.tsx    per-case counterfactual UI
src/components/ReviewPanel.tsx        UI-only reviewed decision
src/components/SessionTimeline.tsx    visible append-only session evidence
scripts/native-webmcp-smoke.mjs       Chrome 152 native journey
evals/*.json                          machine-readable expected manifests/invariants
tests/e2e/app.spec.ts                 responsive, i18n, and browser UI checks
```

