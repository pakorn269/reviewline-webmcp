import type { SessionEvent } from '../domain/domain'

interface Props {
  events: SessionEvent[]
}

export function SessionTimeline({ events }: Props) {
  return (
    <section className="session-timeline" aria-label="Session timeline">
      <h3 className="timeline-title">Session Timeline</h3>
      {events.length === 0 ? (
        <p className="timeline-empty">Capability changes and tool calls appear here.</p>
      ) : (
        <ol className="timeline-list">
          {events.map((event) => (
            <li className={`timeline-event timeline-event--${event.kind}`} key={event.id}>
              <div className="timeline-event-header">
                <span className="timeline-kind">{event.kind}</span>
                <span className="timeline-actor">{event.actor}</span>
                <time dateTime={event.ts}>{new Date(event.ts).toLocaleTimeString()}</time>
              </div>
              {event.toolName && <code className="timeline-tool">{event.toolName}</code>}
              <p>{event.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
