// SessionTimeline — append-only record of every capability change, tool call,
// result, and workflow transition in this session.
// MIT License

import type { SessionEvent } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'
import { getLocalizedEvent } from '../i18n/timelineTranslations'

interface Props {
  events: SessionEvent[]
}

export function SessionTimeline({ events }: Props) {
  const { t, language } = useI18n()

  return (
    <section className="panel session-timeline" aria-label={t('sessionTimelineAria')}>
      <h3 className="panel-title">{t('sessionTimelineTitle')}</h3>
      {events.length === 0 ? (
        <p className="empty-msg">{t('sessionTimelineEmpty')}</p>
      ) : (
        <ol className="timeline-list">
          {events.map((event) => {
            const localized = getLocalizedEvent(event, language)
            return (
              <li className={`timeline-event timeline-event--${event.kind}`} key={event.id}>
                <div className="timeline-event-header">
                  <span className="timeline-kind">{localized.kind}</span>
                  <span className="timeline-actor">{localized.actor}</span>
                  <time dateTime={event.ts}>{new Date(event.ts).toLocaleTimeString()}</time>
                </div>
                {event.toolName && <code className="timeline-tool">{event.toolName}</code>}
                <p className="timeline-detail">{localized.detail}</p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
