// AuthorityBar — the live agent-authority boundary.
//
// This is the primary surface of Reviewline: it names the current workflow phase,
// renders the live WebMCP capability manifest, and shows the human-only actions
// that are never registered as tools.
//
// MIT License

import type { WorkflowPhase } from '../domain/domain'
import { HUMAN_ONLY_ACTIONS, TOOL_NAMES } from '../tools/manifest'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/types'

interface Props {
  workflowPhase: WorkflowPhase
  availableToolNames: readonly string[]
}

const PHASE_LABEL_KEY: Record<WorkflowPhase, TranslationKey> = {
  INVESTIGATION: 'phaseInvestigation',
  REPLAY_READY: 'phaseReplayReady',
  AWAITING_HUMAN_DECISION: 'phaseAwaitingHumanDecision',
  DECIDED: 'phaseDecided',
}

const HUMAN_ACTION_LABEL_KEY: Record<string, TranslationKey> = {
  approve: 'humanActionApprove',
  reject: 'humanActionReject',
  activate: 'humanActionActivate',
}

export function AuthorityBar({ workflowPhase, availableToolNames }: Props) {
  const { t } = useI18n()
  const exposed = new Set(availableToolNames)

  return (
    <section className="authority-bar" aria-label={t('authorityBarAria')}>
      <div className="authority-phase" data-phase={workflowPhase} data-testid="workflow-phase">
        <span className="authority-phase-eyebrow">{t('phaseEyebrow')}</span>
        <strong className="authority-phase-label">{t(PHASE_LABEL_KEY[workflowPhase])}</strong>
        <code className="authority-phase-code">{workflowPhase}</code>
      </div>

      <section className="authority-group authority-group--agent" aria-label={t('manifestTitle')}>
        <header className="authority-group-head">
          <h2 className="authority-group-title">{t('manifestTitle')}</h2>
          <span className="authority-count" data-testid="capability-count">
            {exposed.size} / {TOOL_NAMES.length}
          </span>
        </header>
        <ul className="capability-list">
          {TOOL_NAMES.map((name) => {
            const isExposed = exposed.has(name)
            return (
              <li
                key={name}
                className={`capability capability--${isExposed ? 'exposed' : 'withheld'}`}
                data-exposure={isExposed ? 'exposed' : 'withheld'}
              >
                <code className="capability-name" data-testid="capability-name">
                  {name}
                </code>
                <span className="capability-state">
                  {isExposed ? t('exposureExposed') : t('exposureWithheld')}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="authority-group-note">{t('manifestHint')}</p>
      </section>

      <section className="authority-group authority-group--human" aria-label={t('humanOnlyTitle')}>
        <header className="authority-group-head">
          <h2 className="authority-group-title">{t('humanOnlyTitle')}</h2>
        </header>
        <ul className="capability-list">
          {HUMAN_ONLY_ACTIONS.map((action) => (
            <li key={action} className="capability capability--never" data-exposure="never">
              <code className="capability-name">{t(HUMAN_ACTION_LABEL_KEY[action])}</code>
              <span className="capability-state">{t('exposureNever')}</span>
            </li>
          ))}
        </ul>
        <p className="authority-group-note">{t('humanOnlyNote')}</p>
      </section>
    </section>
  )
}
