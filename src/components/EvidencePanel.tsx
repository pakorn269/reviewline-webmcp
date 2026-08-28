import { useMemo } from 'react'
import type { Incident } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'
import { getLocalizedIncident } from '../i18n/incidentTranslations'

interface Props {
  incident: Incident | null
}

const TRACE_KIND_LABEL: Record<string, string> = {
  action: 'ACTION',
  decision: 'DECISION',
  block: 'BLOCK',
  error: 'ERROR',
}

export function EvidencePanel({ incident }: Props) {
  const { t, language } = useI18n()

  const displayIncident = useMemo(() => {
    return incident ? getLocalizedIncident(incident, language) : null
  }, [incident, language])

  if (!displayIncident) {
    return (
      <section className="evidence-panel evidence-panel--empty" aria-label={t('evidenceWorkspaceAria')}>
        <p className="evidence-empty-msg">{t('evidencePanelEmpty')}</p>
      </section>
    )
  }

  return (
    <section className="evidence-panel" aria-label={t('evidenceForAria', { id: displayIncident.id })}>
      <header className="evidence-header">
        <div className="evidence-id">{displayIncident.id}</div>
        <div className="evidence-agent">{displayIncident.agent}</div>
        <p className="evidence-summary">{displayIncident.summary}</p>
      </header>

      <div className="evidence-columns">
        <div className="evidence-trace">
          <h3 className="evidence-section-title">{t('traceHeading')}</h3>
          <ol className="trace-list">
            {displayIncident.trace.map((entry, i) => (
              <li
                key={i}
                className={`trace-entry trace-entry--${entry.kind}`}
                aria-label={`${TRACE_KIND_LABEL[entry.kind] ?? entry.kind} at ${entry.ts}`}
              >
                <span className={`trace-kind-badge trace-kind--${entry.kind}`}>
                  {TRACE_KIND_LABEL[entry.kind] ?? entry.kind}
                </span>
                <time className="trace-ts" dateTime={entry.ts}>
                  {new Date(entry.ts).toLocaleTimeString()}
                </time>
                <p className="trace-message">{entry.message}</p>
                {entry.meta && (
                  <dl className="trace-meta">
                    {Object.entries(entry.meta).map(([k, v]) => (
                      <div key={k} className="trace-meta-row">
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="evidence-cohort">
          <h3 className="evidence-section-title">{t('cohortHeading')}</h3>
          <ul className="cohort-list">
            {displayIncident.cohort.map((c) => (
              <li key={c.caseId} className="cohort-case">
                <span className="cohort-label">{c.label}</span>
                {c.amount !== undefined && (
                  <span className="cohort-amount">
                    ${c.amount.toLocaleString()}
                  </span>
                )}
                <span className="cohort-context">{c.context}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
