import type { CohortCaseResult, SimulationResult } from '../domain/domain'

interface Props {
  simulation: SimulationResult | null
}

function formatAmount(amount: number | undefined): string {
  if (amount === undefined) return 'Not monetary'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function decisionPath(result: CohortCaseResult): string {
  return `${result.baselineDecision} → ${result.candidateDecision}`
}

export function SimulationView({ simulation }: Props) {
  if (!simulation) {
    return (
      <section className="simulation-view simulation-view--empty" aria-label="Simulation results">
        <p className="simulation-empty-msg">No simulation run yet. Use simulate_guardrail_patch to replay a rule.</p>
      </section>
    )
  }

  const hasRegressions = simulation.regressions.length > 0

  return (
    <section className="simulation-view" aria-label={`Simulation ${simulation.simId}`}>
      <header className="sim-header">
        <div>
          <p className="sim-eyebrow">Counterfactual replay</p>
          <h3 className="sim-title">Simulation {simulation.simId}</h3>
        </div>
        <span className="sim-completion">Completed</span>
      </header>

      <dl className="sim-provenance">
        <div><dt>Result identity</dt><dd><code>{simulation.resultId}</code></dd></div>
        <div><dt>Baseline policy</dt><dd>{simulation.baselinePolicyVersion}</dd></div>
        <div><dt>Candidate policy</dt><dd>{simulation.candidatePolicyVersion}</dd></div>
        <div><dt>Executed</dt><dd><time dateTime={simulation.createdAt}>{new Date(simulation.createdAt).toLocaleString()}</time></dd></div>
      </dl>

      <div className="sim-rule-expression">
        <span>Exact rule</span>
        <code>{simulation.ruleExpression}</code>
      </div>

      <div className="sim-meta">
        <span className="sim-rule">Rule: {simulation.ruleKind}</span>
        <span className="sim-threshold">Threshold: {simulation.ruleKind === 'stale_evidence' ? `${simulation.threshold} h` : formatAmount(simulation.threshold)}</span>
        <span className="sim-enforcement">Enforcement: {simulation.enforcement}</span>
      </div>

      <div className="sim-cohort-results" aria-label="Candidate outcome totals">
        <div className="sim-stat sim-stat--blocked">
          <span className="sim-stat-label">Blocked</span>
          <span className="sim-stat-value">{simulation.blockedCount}</span>
        </div>
        <div className="sim-stat sim-stat--allowed">
          <span className="sim-stat-label">Allowed</span>
          <span className="sim-stat-value">{simulation.allowedCount}</span>
        </div>
        <div className="sim-stat">
          <span className="sim-stat-label">Total</span>
          <span className="sim-stat-value">{simulation.blockedCount + simulation.allowedCount}</span>
        </div>
      </div>

      <div className="sim-case-table" role="table" aria-label="Baseline and candidate case outcomes">
        <div className="sim-case-row sim-case-row--head" role="row">
          <span role="columnheader">Evidence case</span>
          <span role="columnheader">Amount</span>
          <span role="columnheader">Baseline → candidate</span>
        </div>
        {simulation.caseResults.map((result) => (
          <div
            className={`sim-case-row ${result.delta !== 'NO_CHANGE' ? 'sim-case-row--regression' : ''}`}
            role="row"
            key={result.caseId}
          >
            <div role="cell" className="sim-case-identity">
              <code>{result.caseId}</code>
              <span>{result.label}</span>
              <span className="sim-case-badges">
                {result.isTrigger && <strong className="case-badge case-badge--trigger">TRIGGER</strong>}
                {result.isBenignControl && <strong className="case-badge case-badge--benign">BENIGN CONTROL</strong>}
              </span>
            </div>
            <span role="cell">{formatAmount(result.amount)}</span>
            <strong
              role="cell"
              className={`decision-path decision-path--${result.candidateDecision.toLowerCase()}`}
            >
              {decisionPath(result)}
            </strong>
          </div>
        ))}
      </div>

      {hasRegressions ? (
        <div className="sim-regressions sim-regressions--warning" role="alert">
          <strong>Regression control failed</strong>
          <p>{simulation.regressions.length} baseline outcome(s) changed: {simulation.regressions.join(', ')}.</p>
        </div>
      ) : (
        <div className="sim-regressions sim-regressions--ok">
          <span className="sim-no-regression">No regressions — trigger remains blocked and benign controls remain allowed.</span>
        </div>
      )}
    </section>
  )
}
