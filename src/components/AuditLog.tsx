// AuditLog — immutable-in-session record of human decisions.
// Entries are local and deterministic; nothing is deployed to an external system.
// MIT License

import type { AuditEntry } from '../domain/domain'
import { useI18n } from '../i18n/I18nContext'

interface Props {
  entries: AuditEntry[]
}

export function AuditLog({ entries }: Props) {
  const { t } = useI18n()

  if (entries.length === 0) {
    return (
      <section className="panel audit-log audit-log--empty" aria-label={t('auditLogAria')}>
        <p className="empty-msg">{t('auditLogEmpty')}</p>
      </section>
    )
  }

  return (
    <section className="panel audit-log" aria-label={t('auditLogAria')}>
      <h3 className="panel-title">{t('auditLogTitle')}</h3>
      <ol className="audit-list" reversed>
        {[...entries].reverse().map((entry) => (
          <li key={entry.id} className={`audit-entry audit-entry--${entry.action}`}>
            <span className={`audit-action audit-action--${entry.action}`}>{entry.action}</span>
            <code className="audit-proposal-id">{entry.proposalId}</code>
            <span className="audit-actor">
              {entry.actor} · {entry.reviewerId}
            </span>
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
