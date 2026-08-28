// Reviewline — WebMCP-native incident review studio.
//
// Primary surface: Operate. Secondary surface: Command / Inspect.
// The agent investigates, replays, and drafts. Only the human authorizes.
//
// MIT License

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendTimelineEvent,
  applyHumanDecision,
  type AppState,
  type Incident,
  type ReviewProposal,
  type SimulationResult,
} from './domain/domain'
import { AuditLog } from './components/AuditLog'
import { AuthorityBar } from './components/AuthorityBar'
import { Eli5GuideModal } from './components/Eli5GuideModal'
import { EvidencePanel } from './components/EvidencePanel'
import { IncidentQueue } from './components/IncidentQueue'
import { LanguageToggle } from './components/LanguageToggle'
import { ReviewPanel } from './components/ReviewPanel'
import { SessionTimeline } from './components/SessionTimeline'
import { SimulationView } from './components/SimulationView'
import { ToolInspector } from './components/ToolInspector'
import { useHotkey } from './hooks/useHotkey'
import { useToolStateBridge } from './hooks/useToolStateBridge'
import { I18nProvider, useI18n } from './i18n/I18nContext'
import { runHeroJourney } from './lib/heroJourney'
import { selectToolDefinitions } from './tools/manifest'
import {
  executeToolByName,
  getAvailableToolNames,
  tryRegisterTools,
  type ReviewlineToolName,
} from './tools/registration'

function findById<T>(items: readonly T[], id: string | null, key: keyof T): T | null {
  if (!id) return null
  return items.find((item) => item[key] === id) ?? null
}

/** The proposal the human is being asked about: the focused one, else the newest pending. */
function selectProposalToShow(state: AppState): ReviewProposal | null {
  const focused = findById(state.proposals, state.focusedProposalId, 'proposalId')
  if (focused) return focused
  return state.proposals.filter((proposal) => proposal.status === 'pending').at(-1) ?? null
}

function AppContent() {
  const { t } = useI18n()
  const { state, getState, setState, runToolTransaction, reset } = useToolStateBridge()
  const [webmcpAvailable, setWebmcpAvailable] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(true)
  const previousManifestRef = useRef<string[]>([])

  const availableToolNames = getAvailableToolNames(state)
  const availableToolDefs = selectToolDefinitions(availableToolNames)
  const manifestKey = availableToolNames.join('|')

  const toggleGuide = useCallback(() => setGuideOpen((open) => !open), [])
  useHotkey('?', toggleGuide)

  // Reconcile native registration whenever the least-authority manifest changes,
  // and record every capability addition or removal in the session timeline.
  useEffect(() => {
    const controller = new AbortController()

    const current = manifestKey ? manifestKey.split('|') : []
    const previous = previousManifestRef.current
    const added = current.filter((name) => !previous.includes(name))
    const removed = previous.filter((name) => !current.includes(name))
    if (added.length > 0 || removed.length > 0) {
      setState((prev) => {
        let next = prev
        for (const name of removed) {
          next = appendTimelineEvent(next, {
            kind: 'unregistered',
            actor: 'system',
            toolName: name,
            detail: 'Capability removed by the least-authority workflow.',
          })
        }
        for (const name of added) {
          next = appendTimelineEvent(next, {
            kind: 'registered',
            actor: 'system',
            toolName: name,
            detail: 'Capability became available for the current workflow phase.',
          })
        }
        return next
      })
    }
    previousManifestRef.current = current

    tryRegisterTools(getState, runToolTransaction, controller.signal)
      .then(setWebmcpAvailable)
      .catch(() => setWebmcpAvailable(false))

    return () => controller.abort()
  }, [getState, setState, runToolTransaction, manifestKey])

  // Entering human review hands the review column to the decision.
  const phase = state.workflowPhase
  useEffect(() => {
    setRecordOpen(phase !== 'AWAITING_HUMAN_DECISION')
  }, [phase])

  const handleSelectIncident = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.selectedIncidentId === id) return prev
        return appendTimelineEvent(
          { ...prev, selectedIncidentId: id },
          { kind: 'workflow', actor: 'human', detail: `Incident selected: ${id}` },
        )
      })
    },
    [setState],
  )

  const handleDecision = useCallback(
    (action: 'approved' | 'rejected') =>
      (proposalId: string, reviewerId: string, note: string) => {
        setState((prev) => applyHumanDecision(prev, proposalId, action, note, reviewerId).nextState)
      },
    [setState],
  )

  const handleExecuteTool = useCallback(
    (toolName: ReviewlineToolName, input: Record<string, unknown>) =>
      executeToolByName(getState, runToolTransaction, toolName, input),
    [getState, runToolTransaction],
  )

  const handleRunHeroJourney = useCallback(
    () => runHeroJourney(getState, runToolTransaction),
    [getState, runToolTransaction],
  )

  const selectedIncident: Incident | null = findById(
    state.incidents,
    state.selectedIncidentId,
    'id',
  )
  const activeSim: SimulationResult | null = findById(state.simulations, state.activeSimId, 'simId')
  const proposalToShow = selectProposalToShow(state)
  const simForProposal: SimulationResult | null = proposalToShow
    ? findById(state.simulations, proposalToShow.simId, 'simId')
    : null
  const awaitingHuman = state.workflowPhase === 'AWAITING_HUMAN_DECISION'

  return (
    <div className="app" data-testid="app-root" data-phase={state.workflowPhase}>
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">
            <span className="app-title-main">Reviewline</span>
            <span className="app-title-tagline">{t('tagline')}</span>
          </h1>
          <div className="app-header-actions">
            <span
              className={`webmcp-indicator ${
                webmcpAvailable ? 'webmcp-indicator--active' : 'webmcp-indicator--inactive'
              }`}
              title={webmcpAvailable ? t('webmcpActiveTitle') : t('webmcpInactiveTitle')}
            >
              {webmcpAvailable ? t('webmcpActive') : t('webmcpInactive')}
            </span>
            <button
              type="button"
              className="btn btn-guide"
              onClick={() => setGuideOpen(true)}
              aria-label={t('guideButtonAria')}
              title={t('guideButtonTitle')}
            >
              <span className="btn-guide-icon" aria-hidden="true">
                ?
              </span>
              <span className="btn-guide-text">{t('guideButton')}</span>
            </button>
            <LanguageToggle />
            <button
              type="button"
              className="btn btn-reset"
              onClick={reset}
              aria-label={t('resetDemoStateAria')}
            >
              {t('reset')}
            </button>
          </div>
        </div>
      </header>

      <AuthorityBar workflowPhase={state.workflowPhase} availableToolNames={availableToolNames} />

      <main className="app-main">
        <div className="app-layout">
          <div className="app-col app-col--queue">
            <IncidentQueue
              incidents={state.incidents}
              selectedId={state.selectedIncidentId}
              onSelect={handleSelectIncident}
            />
          </div>

          <div className="app-col app-col--workspace">
            <EvidencePanel incident={selectedIncident} />
            {selectedIncident && <SimulationView simulation={activeSim} />}
          </div>

          {/* The review line owns its own scroll area so the human decision is
              never pushed out of reach by the session record below it. */}
          <div
            className={`app-col app-col--review ${awaitingHuman ? 'app-col--review-active' : ''}`}
          >
            <ReviewPanel
              proposal={proposalToShow}
              simulation={simForProposal}
              onApprove={handleDecision('approved')}
              onReject={handleDecision('rejected')}
            />
            {/* Collapsed while a decision is pending so the decision owns the
                column; still rendered, and reopenable at any time. */}
            <details
              className="session-record"
              aria-label={t('sessionRecordAria')}
              open={recordOpen}
              onToggle={(event) => setRecordOpen(event.currentTarget.open)}
            >
              <summary className="session-record-summary">
                {t('sessionRecordSummary', { count: state.sessionTimeline.length })}
              </summary>
              <div className="session-record-body">
                {state.auditLog.length > 0 && <AuditLog entries={state.auditLog} />}
                <SessionTimeline events={state.sessionTimeline} />
              </div>
            </details>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <details className="tool-inspector-details">
          <summary className="tool-inspector-summary">
            {t('toolInspectorSummary', { count: availableToolDefs.length })}
          </summary>
          <ToolInspector
            tools={availableToolDefs}
            webmcpAvailable={webmcpAvailable}
            selectedIncidentId={state.selectedIncidentId}
            activeSimId={state.activeSimId}
            focusedProposalId={state.focusedProposalId}
            onExecuteTool={handleExecuteTool}
            onRunHeroJourney={handleRunHeroJourney}
          />
        </details>
      </footer>

      <Eli5GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}

export function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
