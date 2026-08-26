# Native WebMCP testing guide

## What is under test

Reviewline defines five tools but exposes only a state-appropriate subset. A valid native run must observe these exact sorted manifests:

```text
INVESTIGATION             inspect_incident, list_incidents
INCIDENT_SELECTED         inspect_incident, list_incidents, simulate_guardrail_patch
REPLAY_READY              draft_review_gate, inspect_incident, list_incidents, simulate_guardrail_patch
AWAITING_HUMAN_DECISION   get_review_status, inspect_incident, list_incidents
DECIDED                   get_review_status, inspect_incident, list_incidents
```

No manifest may contain approve, reject, activate, or deploy authority.

## Automated Chrome 152 smoke

Build and run the complete native journey:

```bash
npm run smoke:native
```

Defaults:

- Chrome: `/usr/local/bin/google-chrome` (override with `CHROME_BIN`)
- Preview port: `4175` (override with `REVIEWLINE_SMOKE_PORT`)
- Flags: `--enable-features=WebMCP,DevToolsWebMCPSupport`

The script starts a production preview, launches headless Chrome, and verifies:

1. native `document.modelContext.getTools()` exists;
2. each dynamic manifest transition occurs after the relevant state update;
3. Chrome 152 `executeTool` receives JSON-string arguments and returns serialized JSON;
4. all serialized outputs remain below 1,500 characters;
5. instruction-like trace evidence is labeled `[UNTRUSTED-CONTENT]`;
6. triggering purchase remains blocked and benign control remains allowed;
7. drafting removes mutation tools and exposes status lookup;
8. no approval/rejection tool ever appears;
9. a reviewer completes the UI-only confirmation with identity and note;
10. final status returns `approved`, `actor: human`, the reviewer note, and no-deployment language;
11. the visible timeline is substantive and browser console/page errors are empty.

The expected journey is also encoded in [`evals/procurement-journey.json`](../evals/procurement-journey.json).

## Manual native inspection

Start the app:

```bash
npm run dev
```

Launch a compatible Chrome build with the two feature flags, open `http://localhost:5173`, and inspect:

```js
const names = async () =>
  (await document.modelContext.getTools()).map(tool => tool.name).sort()

await names()
// ["inspect_incident", "list_incidents"]
```

Chrome 152 tool execution uses a tool object and JSON strings:

```js
const tool = (await document.modelContext.getTools())
  .find(candidate => candidate.name === 'inspect_incident')

const serialized = await document.modelContext.executeTool(
  tool,
  JSON.stringify({ incident_id: 'inc-001' }),
)
const output = JSON.parse(serialized)
```

After each tool call, wait for React’s state transition and call `names()` again to observe the next manifest.

## Normal-browser fallback

The footer Tool Inspector mirrors the **current** manifest; it does not show all five tools at once. Select an incident to see simulation appear. The fallback is a contract and lifecycle inspector, not an alternate authority path and not a tool executor.

## Automated project gates

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run e2e
npm run audit:security
npm run smoke:native
```

Unit tests cover strict runtime validation and domain preconditions. Registration integration tests cover state-aware tool availability and invocation/result timeline evidence. Playwright covers the responsive UI, keyboard basics, dynamic fallback manifest, and 44 CSS-pixel mobile targets.

## Human boundary interpretation

The absence of decision tools proves the WebMCP interface is least-authority. It does **not** prove that an arbitrary computer-use agent cannot click DOM controls. Production authorization belongs on a trusted server boundary; Reviewline demonstrates the collaboration pattern and makes its local authority transitions visible.
