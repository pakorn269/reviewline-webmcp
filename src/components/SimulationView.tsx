// SimulationView — reproducible counterfactual replay evidence.
// MIT License

import type { CohortCaseResult, SimulationResult } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'
import { formatUsd } from '../lib/format'

interface Props {
  simulation: SimulationResult | null
}

function decisionPath(result: CohortCaseResult): string {
  return `${result.baselineDecision} → ${result.candidateDecision}`
}

export function SimulationView({ simulation }: Props) {
  const { t } = useI18n()

  if (!simulation) {
    return (
      <section
        className="panel simulation-view simulation-view--empty"
        aria-label={t('simulationTitle')}
      >
        <h3 className="panel-title">{t('simulationTitle')}</h3>
        <p className="empty-msg">{t('simulationEmpty')}</p>
        <p className="empty-hint">{t('simulationEmptyHint')}</p>
      </section>
    )
  }

  const hasRegressions = simulation.regressions.length > 0
  const thresholdDisplay =
    simulation.ruleKind === 'stale_evidence'
      ? `${simulation.threshold} h`
      : formatUsd(simulation.threshold)

  const formatAmount = (amount: number | undefined): string =>
    amount === undefined ? t('simNotMonetary') : formatUsd(amount)

  return (
    <section className="panel simulation-view" aria-label={t('simAria', { simId: simulation.simId })}>
      <header className="panel-head">
        <div className="panel-head-main">
          <p className="panel-eyebrow">{t('counterfactualReplay')}</p>
          <h3 className="panel-title sim-title">{t('simAria', { simId: simulation.simId })}</h3>
        </div>
        <span className="badge badge--ok sim-completion">{t('simCompleted')}</span>
      </header>

      <div className="sim-verdict" role={hasRegressions ? 'alert' : undefined}>
        {hasRegressions ? (
          <div className="verdict verdict--fail">
            <strong className="verdict-title">{t('simRegressionFailedTitle')}</strong>
            <p className="verdict-detail">
              {t('simRegressionFailedDetail', {
                count: simulation.regressions.length,
                cases: simulation.regressions.join(', '),
              })}
            </p>
          </div>
        ) : (
          <div className="verdict verdict--pass">
            <strong className="verdict-title">{t('noRegressions')}</strong>
            <p className="verdict-detail">{t('simNoRegressionDetail')}</p>
          </div>
        )}
        <dl className="sim-tally" aria-label={t('cohortResultsAria')}>
          <div className="sim-stat sim-stat--blocked">
            <dt>{t('simLabelBlocked')}</dt>
            <dd>{simulation.blockedCount}</dd>
          </div>
          <div className="sim-stat sim-stat--allowed">
            <dt>{t('simLabelAllowed')}</dt>
            <dd>{simulation.allowedCount}</dd>
          </div>
          <div className="sim-stat">
            <dt>{t('simLabelTotal')}</dt>
            <dd>{simulation.blockedCount + simulation.allowedCount}</dd>
          </div>
        </dl>
      </div>

      <div className="sim-rule-expression">
        <span className="field-label">{t('exactRule')}</span>
        <code>{simulation.ruleExpression}</code>
      </div>

      <ul className="chip-row sim-meta">
        <li className="chip">{t('ruleLabel', { ruleKind: simulation.ruleKind })}</li>
        <li className="chip">{t('thresholdLabel', { threshold: thresholdDisplay })}</li>
        <li className="chip">{t('enforcementLabel', { enforcement: simulation.enforcement })}</li>
      </ul>

      <div className="sim-case-table" role="table" aria-label={t('simCaseTableAria')}>
        <div className="sim-case-row sim-case-row--head" role="row">
          <span role="columnheader">{t('simColEvidenceCase')}</span>
          <span role="columnheader">{t('simColAmount')}</span>
          <span role="columnheader">{t('simColTransition')}</span>
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
                {result.isTrigger && (
                  <strong className="case-badge case-badge--trigger">{t('simBadgeTrigger')}</strong>
                )}
                {result.isBenignControl && (
                  <strong className="case-badge case-badge--benign">{t('simBadgeBenign')}</strong>
                )}
              </span>
            </div>
            <span role="cell" className="sim-case-amount">
              {formatAmount(result.amount)}
            </span>
            <strong
              role="cell"
              className={`decision-path decision-path--${result.candidateDecision.toLowerCase()}`}
            >
              {decisionPath(result)}
            </strong>
          </div>
        ))}
      </div>

      <dl className="sim-provenance">
        <div>
          <dt>{t('resultIdentity')}</dt>
          <dd>
            <code>{simulation.resultId}</code>
          </dd>
        </div>
        <div>
          <dt>{t('baselinePolicy')}</dt>
          <dd>{simulation.baselinePolicyVersion}</dd>
        </div>
        <div>
          <dt>{t('candidatePolicy')}</dt>
          <dd>{simulation.candidatePolicyVersion}</dd>
        </div>
        <div>
          <dt>{t('executedAt')}</dt>
          <dd>
            <time dateTime={simulation.createdAt}>
              {new Date(simulation.createdAt).toLocaleString()}
            </time>
          </dd>
        </div>
      </dl>
    </section>
  )
}
