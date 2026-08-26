# Reviewline

**Agents investigate. Humans authorize.**

Reviewline is a WebMCP-native incident review studio for asymmetric human–agent collaboration. A browser agent investigates a failed autonomous-agent run, replays a candidate guardrail against a triggering case and a named benign control, and drafts an evidence-backed review gate. The agent then stops at a visible human decision line.

The app is a deterministic, client-only contest demo: no backend, credentials, real payments, policy deployment, LLM API, or restored workflow state. Reload and Reset both start a fresh in-memory session.

## Why WebMCP

Reviewline uses WebMCP for more than typed access to a dashboard:

- **Shared state:** every tool call focuses or updates the same evidence, replay, proposal, and audit state the reviewer sees.
- **Least-authority lifecycle:** tools are registered and unregistered as the workflow advances; the agent receives only capabilities useful in the current phase.
- **Reliable evidence flow:** strict runtime validation, bounded outputs, deterministic result IDs, and explicit untrusted-evidence labeling replace brittle DOM scraping.
- **Human consequence boundary:** approval and rejection never appear in the WebMCP manifest. A reviewer must identify themselves, leave a note, confirm the evidence, and choose a consequence-specific UI action.

Omitting decision tools is a **product capability boundary, not a cryptographic guarantee** against every possible browser automation technique. Reviewline makes authority narrower and auditable; it does not claim the DOM is an impenetrable security boundary.

## Capability lifecycle

| Phase | Native tools exposed |
|---|---|
| Investigation | `list_incidents`, `inspect_incident` |
| Incident selected | + `simulate_guardrail_patch` |
| Clean replay ready | + `draft_review_gate` |
| Awaiting human decision | `list_incidents`, `inspect_incident`, `get_review_status` |
| Decided | `list_incidents`, `inspect_incident`, `get_review_status` |

`approve`, `reject`, `activate`, and `deploy` are never tools. The current manifest and an append-only session timeline are visible in the app.

## Three-minute hero journey

1. Start with three synthetic incidents; select the critical procurement event.
2. Call `inspect_incident`. Instruction-like trace content is still visible to the human but returned to the agent as labeled untrusted evidence.
3. Call `simulate_guardrail_patch` with a `$50,000` blocking cap.
4. Review baseline→candidate outcomes: triggering purchase `c-001-a` stays **BLOCKED**, benign control `c-001-b` stays **ALLOWED**, and regressions remain zero.
5. Call `draft_review_gate`. Drafting is removed from the manifest and status lookup becomes available.
6. A human enters reviewer identity and note, confirms the evidence, and chooses **Confirm $50,000 cap; keep purchase blocked** or **Reject proposal; keep current block**.
7. Call `get_review_status`. The decision is returned with `actor: human`; the blocked purchase remains unauthorized and no external policy is deployed.

## Quick start

```bash
npm install
npm run dev             # http://localhost:5173
```

Normal browsers get the same state-aware in-page Tool Inspector. WebMCP-capable Chromium exposes native tools through `document.modelContext`.

## Verification

```bash
npm test                # unit + component + integration
npm run typecheck       # TypeScript, no emit
npm run lint            # zero-warning ESLint policy
npm run build           # production bundle
npm run e2e             # Playwright, including 320px target checks
npm run audit:security  # moderate threshold
npm run smoke:native    # Chrome 152 native dynamic-manifest journey
```

`npm run smoke:native` defaults to `/usr/local/bin/google-chrome`; override with `CHROME_BIN=/path/to/chrome`. It launches Chromium with `--enable-features=WebMCP,DevToolsWebMCPSupport`, executes Chrome 152 JSON-string tool arguments/results, performs the UI-only human decision, and asserts the full dynamic manifest journey.

## Tool catalogue

| Tool | Annotation intent | Purpose |
|---|---|---|
| `list_incidents` | read-only, untrusted content | Bounded synthetic incident summaries |
| `inspect_incident` | read-only, untrusted content | Bounded trace/cohort evidence and visible focus |
| `simulate_guardrail_patch` | read-only, untrusted content | Deterministic counterfactual replay and symmetric regression detection |
| `draft_review_gate` | state-changing, untrusted content | Create a pending proposal only from a matching clean replay |
| `get_review_status` | read-only, untrusted content | Read the human review record, including human-entered text |

All schemas are backed by independent runtime validation: null/non-object inputs, unknown properties, non-integer/out-of-range thresholds, oversized raw text, unknown IDs, and simulation/incident mismatches are rejected. Draft eligibility is recomputed from the canonical fixture, and a central registration envelope enforces the agent-output budget.

## Project evidence

- [Architecture](docs/architecture.md)
- [Native WebMCP testing](docs/webmcp-testing.md)
- [Authentic TDD log](docs/tdd-log.md)
- [Security model](SECURITY.md)
- [Machine-readable hero eval](evals/procurement-journey.json)

## Hackathon disclosure

Built for the WebMCP Challenge. All incidents, agents, vendors, IDs, and outcomes are synthetic. No real production system is connected.

## License

MIT — see [LICENSE](LICENSE).
