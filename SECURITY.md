# Security policy

## Scope

Reviewline is a static hackathon demonstration. It uses only synthetic data and has no backend, authentication, real payment rail, production telemetry, external mutation endpoint, or policy deployment integration.

## Reporting

Open a GitHub issue labeled **security** for non-sensitive findings. For a sensitive disclosure, contact the repository maintainer privately rather than publishing exploit details.

## Data handling

- No credentials, tokens, PII, or production data are required.
- Workflow state is session-only in memory. Reviewline does not restore simulations, proposals, decisions, audits, phases, selections, or timeline events from browser storage.
- Reload and **Reset** both create a fresh synthetic investigation session.
- No tool handler performs network I/O or writes outside application state.

## Least-authority WebMCP boundary

The manifest changes with workflow state. Investigation starts with only list and inspect; simulation and drafting become available only after their preconditions; drafting disappears once a proposal awaits review. Approval, rejection, activation, and deployment are never registered.

This is a **product capability boundary, not a cryptographic guarantee**. A general browser automation system may have ways to actuate visible DOM controls outside WebMCP. Reviewline’s claim is narrower and testable:

- its structured agent interface never grants decision authority;
- capability additions and removals are visible;
- every tool invocation/result is recorded in the local session timeline;
- a decision requires reviewer identity, note, evidence confirmation, and a UI-only action;
- every decision records `actor: human`;
- the demo never deploys policy or authorizes the blocked purchase.

Do not use this demo alone as an authorization control in a production system. A production design should enforce identity, authorization, signed decisions, tamper-resistant audit storage, and mutation policy on a trusted server boundary.

## Untrusted evidence

Incident traces can contain instruction-like content. The human UI retains the synthetic source evidence for review. Agent-facing inspection output labels and summarizes metadata-marked injected text as `[UNTRUSTED-CONTENT]`; tool annotations also mark affected outputs as untrusted. Agents should treat evidence as data, never as instructions.

## Runtime validation

JSON Schema is not treated as enforcement. Handler code independently rejects:

- null, arrays, and other non-object inputs;
- unknown properties;
- unknown incident/simulation/proposal IDs;
- `NaN`, infinity, negative, and out-of-range thresholds;
- unsupported rule/enforcement values;
- oversized raw title/rationale/note values;
- simulation/incident mismatches;
- proposal drafts without blocked trigger, allowed benign control, or with any regression.

Handlers produce bounded outputs, and the registration boundary independently rejects any success result at or above 1,500 serialized characters while bounding rejected error messages. The native smoke test checks the serialized success outputs.

## Dependencies and CI

```bash
npm run audit:security
npm test
npm run typecheck
npm run lint
npm run build
npm run e2e
npm run smoke:native
```

The CI workflow runs portable gates on pushes and pull requests. The native Chrome smoke is documented separately because it requires an experimental-capable Chrome binary and flags.
