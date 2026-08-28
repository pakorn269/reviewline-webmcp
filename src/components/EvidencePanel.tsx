// EvidencePanel — the agent run trace and replay cohort for one incident.
// MIT License

import { useMemo } from 'react'
import type { Incident } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'
import { getLocalizedIncident } from '../i18n/incidentTranslations'
import { formatUsd } from '../lib/format'

interface Props {
  incident: Incident | null
}

const TRACE_KIND_LABEL: Record<string, string> = {
  action: 'ACTION',
  decision: 'DECISION',
  block: 'BLOCK',
  error: 'ERROR',
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
}

export function EvidencePanel({ incident }: Props) {
  const { t, language } = useI18n()

  const displayIncident = useMemo(
    () => (incident ? getLocalizedIncident(incident, language) : null),
    [incident, language],
  )

  if (!displayIncident) {
    return (
      <section
        className="evidence-panel evidence-panel--empty"
        aria-label={t('evidenceWorkspaceAria')}
      >
        <p className="panel-eyebrow">{t('evidencePanelTitle')}</p>
        <p className="empty-msg">{t('evidencePanelEmpty')}</p>
        <p className="empty-hint">{t('evidencePanelEmptyHint')}</p>
      </section>
    )
  }

  return (
    <section
      className="evidence-panel"
      aria-label={t('evidenceForAria', { id: displayIncident.id })}
    >
      <header className="evidence-header">
        <div className="evidence-header-meta">
          <code className="evidence-id">{displayIncident.id}</code>
          <span className={`severity-badge ${SEVERITY_CLASS[displayIncident.severity] ?? ''}`}>
            {displayIncident.severity}
          </span>
          <span className="status-badge">{displayIncident.status}</span>
          <time className="evidence-blocked-at" dateTime={displayIncident.blockedAt}>
            {t('blockedAtLabel')} {new Date(displayIncident.blockedAt).toLocaleString()}
          </time>
        </div>
        <h2 className="evidence-agent">{displayIncident.agent}</h2>
        <p className="evidence-summary">{displayIncident.summary}</p>
      </header>

      <div className="evidence-columns">
        <div className="evidence-trace">
          <h3 className="field-label">{t('traceHeading')}</h3>
          <ol className="trace-list">
            {displayIncident.trace.map((entry, i) => (
              <li
                key={i}
                className={`trace-entry trace-entry--${entry.kind}`}
                aria-label={t('traceEntryAria', {
                  kind: TRACE_KIND_LABEL[entry.kind] ?? entry.kind,
                  ts: entry.ts,
                })}
              >
                <div className="trace-entry-head">
                  <span className={`trace-kind-badge trace-kind--${entry.kind}`}>
                    {TRACE_KIND_LABEL[entry.kind] ?? entry.kind}
                  </span>
                  <time className="trace-ts" dateTime={entry.ts}>
                    {new Date(entry.ts).toLocaleTimeString()}
                  </time>
                </div>
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
          <h3 className="field-label">{t('cohortHeading')}</h3>
          <ul className="cohort-list">
            {displayIncident.cohort.map((c) => (
              <li key={c.caseId} className="cohort-case">
                <span className="cohort-label">{c.label}</span>
                {c.amount !== undefined && (
                  <span className="cohort-amount">{formatUsd(c.amount)}</span>
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
