// AuditLog — immutable-in-session audit trail of human decisions
// MIT License

import type { AuditEntry } from '../domain/domain'

interface Props {
  entries: AuditEntry[]
}

export function AuditLog({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <section className="audit-log audit-log--empty" aria-label="Audit log">
        <p className="audit-empty-msg">No audit entries yet. Decisions appear here after human review.</p>
      </section>
    )
  }

  return (
    <section className="audit-log" aria-label="Audit log">
      <h3 className="audit-title">Audit Log</h3>
      <ol className="audit-list" reversed>
        {[...entries].reverse().map((entry) => (
          <li key={entry.id} className={`audit-entry audit-entry--${entry.action}`}>
            <span className={`audit-action audit-action--${entry.action}`}>
              {entry.action.toUpperCase()}
            </span>
            <span className="audit-proposal-id">{entry.proposalId}</span>
            <span className="audit-actor">{entry.actor} · {entry.reviewerId}</span>
            <time className="audit-ts" dateTime={entry.ts}>
              {new Date(entry.ts).toLocaleString()}
            </time>
            {entry.reviewerNote && <span className="audit-note">{entry.reviewerNote}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
