// IncidentQueue — triage list. Selecting an incident is the human's entry point;
// an agent reaches the same state through inspect_incident.
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

  const displayIncidents = useMemo(
    () => incidents.map((incident) => getLocalizedIncident(incident, language)),
    [incidents, language],
  )

  return (
    <section className="incident-queue" aria-label={t('incidentQueueRegionAria')}>
      <h2 className="queue-heading">
        {t('incidentQueueTitle')}
        <span className="queue-count">{incidents.length}</span>
      </h2>
      <ul className="queue-list" role="list">
        {displayIncidents.map((incident) => {
          const isSelected = selectedId === incident.id
          return (
            <li key={incident.id}>
              <button
                type="button"
                className={`queue-item${isSelected ? ' queue-item--selected' : ''}`}
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelect(incident.id)}
              >
                <span className="queue-item-header">
                  <code className="queue-item-id">{incident.id}</code>
                  <span className={`severity-badge ${SEVERITY_CLASS[incident.severity] ?? ''}`}>
                    {incident.severity}
                  </span>
                  <span className="status-badge">{incident.status}</span>
                  {isSelected && <span className="selection-badge">{t('selectedBadge')}</span>}
                </span>
                <span className="queue-item-agent">{incident.agent}</span>
                <span className="queue-item-summary">{incident.summary}</span>
                <time className="queue-item-time" dateTime={incident.blockedAt}>
                  {new Date(incident.blockedAt).toLocaleString()}
                </time>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
