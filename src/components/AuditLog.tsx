// AuditLog — immutable-in-session audit trail of human decisions
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
      <section className="audit-log audit-log--empty" aria-label={t('auditLogAria')}>
        <p className="audit-empty-msg">{t('auditLogEmpty')}</p>
      </section>
    )
  }

  return (
    <section className="audit-log" aria-label={t('auditLogAria')}>
      <h3 className="audit-title">{t('auditLogTitle')}</h3>
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
