// EvidencePanel — shows trace and cohort for the selected incident
// MIT License

import type { Incident } from '../domain/domain'

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
  if (!incident) {
    return (
      <section className="evidence-panel evidence-panel--empty" aria-label="Evidence workspace">
        <p className="evidence-empty-msg">Select an incident from the queue to inspect evidence.</p>
      </section>
    )
  }

  return (
    <section className="evidence-panel" aria-label={`Evidence for ${incident.id}`}>
      <header className="evidence-header">
        <div className="evidence-id">{incident.id}</div>
        <div className="evidence-agent">{incident.agent}</div>
        <p className="evidence-summary">{incident.summary}</p>
      </header>

      <div className="evidence-columns">
        <div className="evidence-trace">
          <h3 className="evidence-section-title">Trace</h3>
          <ol className="trace-list">
            {incident.trace.map((entry, i) => (
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
          <h3 className="evidence-section-title">Cohort</h3>
          <ul className="cohort-list">
            {incident.cohort.map((c) => (
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
