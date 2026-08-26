# Reviewline — Product Brief

## One-line pitch

Reviewline is a WebMCP-native incident review studio where a browser agent investigates a failed autonomous-agent run, proves a guardrail change against triggering and benign traces, drafts a reviewable gate, and then stops at the human review line.

## Hackathon thesis

Existing operations consoles make browser agents scrape dense traces and guess UI controls. Reviewline exposes precise, state-aware WebMCP tools over the same live incident evidence and policy simulator the human sees. The agent can do the synthesis-heavy work; only the human can approve a consequential policy change.

## Target user

An AI platform safety or reliability lead who reviews remediation proposals for production autonomous agents and needs triggering evidence, a proposed policy delta, a benign control, and a complete action history in one shared workspace.

## Critical demo journey

1. The page opens on a queue of three synthetic incidents across procurement, support, and deployment agents.
2. The user asks a WebMCP-capable browser agent to investigate the highest-severity unresolved incident.
3. The agent calls `list_incidents`, then `inspect_incident`; the page selects the incident and reveals the same trace/evidence to the human.
4. The agent calls `simulate_guardrail_patch` with a structured deterministic rule. The page replays the triggering trace and a closely related benign control, then renders before/after outcomes, evidence links, and regressions.
5. The agent calls `draft_review_gate`, creating a pending proposal with evidence, rationale, and replay results.
6. The UI opens a review panel, enters `AWAITING_HUMAN_DECISION`, and visibly removes drafting from the available capability manifest. There is deliberately no agent-callable approval tool.
7. The human reviews, identifies themselves, records a note, confirms the evidence, and chooses a consequence-specific confirm or reject action; either way, the current block stays in force and no external policy is deployed.
8. The agent calls `get_review_status` and reports the final human decision.

## WebMCP tools

### `list_incidents`
- Purpose: list synthetic incidents with id, agent, severity, status, and summary.
- Inputs: optional severity/status filters.
- Annotations: `readOnlyHint: true`, `untrustedContentHint: true`.
- UI effect: filters/highlights the incident queue.

### `inspect_incident`
- Purpose: return bounded evidence for one incident and focus it in the UI.
- Inputs: `incident_id` enum/string validated in code.
- Annotations: `readOnlyHint: true`, `untrustedContentHint: true`.
- UI effect: selects incident and opens evidence timeline.

### `simulate_guardrail_patch`
- Purpose: replay a deterministic proposed guardrail against the selected incident cohort.
- Inputs: incident id, rule kind enum, threshold/condition, enforcement enum.
- Annotations: `readOnlyHint: true`, `untrustedContentHint: true` because it does not persist policy, though it updates the visible simulation.
- UI effect: opens a reproducible compare view showing the triggering trace, benign control, policy version/input, evidence identifiers, blocked/allowed changes, regressions, and cohort counts.

### `draft_review_gate`
- Purpose: create a non-effective proposal for human review from a completed simulation.
- Inputs: incident id, concise title, rationale, simulation id.
- Annotations: `readOnlyHint: false`, `untrustedContentHint: true`.
- UI effect: creates a pending proposal and opens the human review drawer.
- Must never approve or activate policy.

### `get_review_status`
- Purpose: read the human decision and policy-effect status for a proposal.
- Inputs: proposal id.
- Annotations: `readOnlyHint: true`, `untrustedContentHint: true` because titles and reviewer notes are human-entered text.
- UI effect: focuses the proposal/audit event.

## Human control invariant

`approve`, `reject`, and `activate` are never registered as WebMCP tools. They are explicit UI-only human actions. A proposal must show its evidence and replay result before either action becomes available. Approval records a deterministic local audit event but does not touch any external system.

This is a least-authority product capability boundary, not a claim that the page cryptographically prevents every form of browser actuation. Submission copy must state that distinction accurately.

## Capability lifecycle

- The UI includes a live agent-capability manifest.
- Investigation tools are available initially.
- `simulate_guardrail_patch` becomes useful only after an incident is inspected.
- `draft_review_gate` is registered only after the selected incident has a completed replay with a triggering outcome and benign control.
- After a proposal is drafted, the workflow enters `AWAITING_HUMAN_DECISION`; drafting is unregistered for that active proposal.
- Every registration, unregistration, invocation, result, and workflow-state transition is recorded in a visible append-only session timeline.
- Approval and rejection never appear in the WebMCP manifest.

## Synthetic scenario set

1. **Procurement agent / critical** — supplier-page content attempts to override a purchase cap; the mutation gateway blocks a high-value purchase.
2. **Support agent / high** — a refund request exceeds policy after the agent misbinds account context.
3. **Deployment agent / medium** — deployment is blocked because test evidence is stale and rollback readiness is missing.

All data is fictional, local, deterministic, and contains no real credentials, identities, or production details.

## Product scope

### In scope
- React + TypeScript + Vite single-page app.
- Local deterministic domain logic and fixtures; session-only workflow state with fresh reload/reset behavior.
- Native imperative WebMCP via `document.modelContext.registerTool`.
- Graceful unsupported-browser mode and in-app tool inspector/test harness for normal browsers.
- State synchronization between tool execution and visible UI.
- Dynamic state-aware registration with AbortController and a visible capability manifest.
- Strict input validation independent of JSON Schema.
- Tool descriptions/output character budgets and security annotations.
- Responsive, keyboard-accessible dark operations interface.
- Unit/component/E2E tests, typecheck, lint, production build, and CI.
- Public open-source repository and static deployment.

### Out of scope
- Real LLM/API calls.
- Authentication, multi-tenancy, backend database, or remote mutations.
- Real trading, payments, purchases, deployments, or production telemetry.
- Agent-callable approval.
- Generic chatbot embedded in the page.

## Visual direction

Primary surface: **Operate**. Secondary surface: **Command / Inspect**.

Original dark operations-console design informed by precise, low-chroma developer tools: near-black canvas, cool graphite layers, thin borders, strong typographic hierarchy, one electric cyan/blue interaction accent, and semantic amber/red/green only for risk state. Avoid gradients, glassmorphism, hero sections, generic equal-weight metric cards, oversized numbers, and decorative icons. Desktop uses queue + evidence workspace + contextual review panel; mobile becomes a staged drill-down flow with 44px targets.

## Acceptance criteria

1. A fresh checkout installs and builds with documented commands.
2. The five tool contracts are implemented, while only the state-appropriate least-authority subset is registered and mirrored by fallback inspector mode at any moment.
3. Each tool uses clear non-overlapping names/descriptions, JSON Schema, strict runtime validation, bounded structured output, and appropriate annotations.
4. Tool calls update visible application state before resolving.
5. The full demo journey works without network/API keys.
6. No WebMCP tool can approve, reject, or activate a policy.
7. Simulation results are deterministic and reproducible, include regression detection, and prove both the triggering trace outcome and a related benign control with evidence identifiers.
8. Human approval/rejection creates an immutable-in-session audit entry and can be reset only through an explicit demo reset.
9. Tests cover domain invariants, tool handlers, dynamic registration lifecycle, append-only capability/audit events, human-only gate, triggering and benign replay outcomes, and the primary browser journey.
10. `npm test`, `npm run typecheck`, `npm run lint`, E2E, and `npm run build` pass cleanly.
11. UI is responsive, keyboard usable, reduced-motion aware, and has no serious accessibility violations.
12. Repository includes MIT license, contribution/security notes, architecture, WebMCP testing instructions, and hackathon disclosure.
13. No secrets or production data are committed.

## Naming

Product name: **Reviewline**
Repository working name: `reviewline-webmcp`
Tagline: **Agents investigate. Humans authorize.**
