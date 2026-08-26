# AGENTS.md

## Mission

Build Reviewline as a polished, contest-ready WebMCP application according to `PRODUCT_BRIEF.md`.

## Hard constraints

- Work only inside this repository.
- Never read, copy, or depend on Goal1M or other private project code/data.
- No real credentials, external mutations, payments, trading, deployments, or production APIs in the app.
- Approval, rejection, and activation remain UI-only human actions; never expose them as WebMCP tools.
- Use strict test-driven development: write one behavior test, run it and confirm the expected failure, implement the minimum, rerun green, then refactor.
- Preserve a concise RED/GREEN evidence log in `docs/tdd-log.md` with commands and reasons; do not fabricate output.
- Prefer deterministic pure domain functions and real behavior tests over mocks.
- WebMCP uses the current `document.modelContext` imperative API and must degrade gracefully in unsupported browsers.
- Validate inputs in runtime code; JSON Schema alone is not trusted enforcement.
- Tool outputs must be bounded and avoid returning secrets or unnecessary trace text.
- Make tool exposure state-aware: investigation first, drafting only after a completed triggering + benign-control replay, then `AWAITING_HUMAN_DECISION` with drafting unavailable.
- Render a live capability manifest and append-only session timeline covering registration, unregistration, invocation, result, and workflow transitions.
- The replay must prove the hero incident is caught while a closely related benign control still passes, with deterministic evidence identifiers.
- Describe UI-only approval as least-authority product design, never as a cryptographic guarantee against all browser actuation.
- Do not commit generated dependencies, coverage, build output, videos, or secrets.
- Do not push, create remote repositories, deploy, or submit forms unless the brief explicitly authorizes it.

## Quality gates

Before declaring implementation complete, run all configured test, typecheck, lint, E2E, build, and security/dependency checks. Report exact commands and actual outcomes.

## Design constraints

This is an Operate surface with secondary Command/Inspect behavior. No hero, feature grid, fake KPI monument, generic tech gradient, glassmorphism, or decorative icon grid. Make evidence and human decision boundaries visually obvious.
