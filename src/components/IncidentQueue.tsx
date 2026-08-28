// IncidentQueue — displays the list of incidents for triage
// MIT License

import { useMemo } from 'react'
import type { Incident } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'
import { getLocalizedIncident } from '../i18n/incidentTranslations'

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
}

interface Props {
  incidents: Incident[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function IncidentQueue({ incidents, selectedId, onSelect }: Props) {
  const { t, language } = useI18n()

  const displayIncidents = useMemo(() => {
    return incidents.map((inc) => getLocalizedIncident(inc, language))
  }, [incidents, language])

  return (
    <section className="incident-queue" aria-label={t('incidentQueueRegionAria')}>
      <h2 className="queue-heading">
        {t('incidentQueueTitle')}
        <span className="queue-count">{incidents.length}</span>
      </h2>
      <ul className="queue-list" role="list">
        {displayIncidents.map((inc) => (
          <li key={inc.id}>
            <button
              type="button"
              className={`queue-item${selectedId === inc.id ? ' queue-item--selected' : ''}`}
              aria-current={selectedId === inc.id ? 'true' : undefined}
              onClick={() => onSelect(inc.id)}
            >
              <div className="queue-item-header">
                <span className="queue-item-id">{inc.id}</span>
                <span className={`severity-badge ${SEVERITY_CLASS[inc.severity] ?? ''}`}>
                  {inc.severity}
                </span>
                <span className="status-badge">{inc.status}</span>
                {selectedId === inc.id && <span className="selection-badge">{t('selectedBadge')}</span>}
              </div>
              <div className="queue-item-agent">{inc.agent}</div>
              <div className="queue-item-summary">{inc.summary}</div>
              <div className="queue-item-time">
                {new Date(inc.blockedAt).toLocaleString()}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
