// Reviewline App — main application component
// Operate surface with Command/Inspect secondary surface
// MIT License

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import {
  makeInitialState,
  applyHumanDecision,
  appendTimelineEvent,
  resetCounters,
  type AppState,
  type Incident,
  type SimulationResult,
  type ReviewProposal,
} from './domain/domain'
import { IncidentQueue } from './components/IncidentQueue'
import { EvidencePanel } from './components/EvidencePanel'
import { SimulationView } from './components/SimulationView'
import { ReviewPanel } from './components/ReviewPanel'
import { AuditLog } from './components/AuditLog'
import { ToolInspector } from './components/ToolInspector'
import { SessionTimeline } from './components/SessionTimeline'
import { LanguageToggle } from './components/LanguageToggle'
import { I18nProvider, useI18n } from './i18n/I18nContext'
import {
  createSerializedStateTransactions,
  getAvailableToolNames,
  tryRegisterTools,
  type RunStateTransaction,
} from './tools/registration'

const TOOL_DEFS = [
  {
    name: 'list_incidents',
    description:
      'List synthetic incidents. Optional severity/status filters. readOnly, untrustedContent.',
    schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        status: { type: 'string', enum: ['unresolved', 'in_review', 'resolved'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_incident',
    description: 'Return bounded evidence for one incident and focus it in UI. readOnly.',
    schema: {
      type: 'object',
      required: ['incident_id'],
      properties: { incident_id: { type: 'string', enum: ['inc-001', 'inc-002', 'inc-003'] } },
      additionalProperties: false,
    },
  },
  {
    name: 'simulate_guardrail_patch',
    description:
      'Replay a guardrail rule against the incident cohort. Deterministic. readOnly.',
    schema: {
      type: 'object',
      required: ['incident_id', 'rule_kind', 'threshold', 'enforcement'],
      properties: {
        incident_id: { type: 'string', enum: ['inc-001', 'inc-002', 'inc-003'] },
        rule_kind: { type: 'string', enum: ['spending_cap', 'refund_limit', 'stale_evidence'] },
        threshold: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER, multipleOf: 1 },
        enforcement: { type: 'string', enum: ['block', 'warn', 'allow'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'draft_review_gate',
    description: 'Create a pending proposal for human review. Does not approve or activate policy.',
    schema: {
      type: 'object',
      required: ['incident_id', 'title', 'rationale', 'sim_id'],
      properties: {
        incident_id: { type: 'string', enum: ['inc-001', 'inc-002', 'inc-003'] },
        title: { type: 'string', maxLength: 200 },
        rationale: { type: 'string', maxLength: 1000 },
        sim_id: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_review_status',
    description: 'Read the human decision for a proposal. readOnly.',
    schema: {
      type: 'object',
      required: ['proposal_id'],
      properties: { proposal_id: { type: 'string' } },
      additionalProperties: false,
    },
  },
]

interface PendingToolCommit {
  nextState: AppState
  resolve: () => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

function AppContent() {
  const { t } = useI18n()
  const [state, setStateRaw] = useState<AppState>(() => makeInitialState())
  const [webmcpAvailable, setWebmcpAvailable] = useState(false)
  const abortRef = useRef<AbortController>(new AbortController())
  const previousManifestRef = useRef<string[]>([])
  const availableToolNames = getAvailableToolNames(state)
  const availableToolNameSet = new Set<string>(availableToolNames)
  const availableToolDefs = TOOL_DEFS.filter((tool) => availableToolNameSet.has(tool.name))
  const manifestKey = availableToolNames.join('|')

  // Keep a ref that always reflects the latest state for tool handlers
  const stateRef = useRef<AppState>(state)
  const pendingToolCommitsRef = useRef<PendingToolCommit[]>([])

  useLayoutEffect(() => {
    stateRef.current = state
    const remaining: PendingToolCommit[] = []
    for (const pending of pendingToolCommitsRef.current) {
      if (pending.nextState === state) {
        clearTimeout(pending.timeout)
        pending.resolve()
      } else {
        remaining.push(pending)
      }
    }
    pendingToolCommitsRef.current = remaining
  }, [state])

  useEffect(() => () => {
    for (const pending of pendingToolCommitsRef.current) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Tool state commit cancelled because Reviewline unmounted'))
    }
    pendingToolCommitsRef.current = []
  }, [])

  const setState = useCallback((updater: (prev: AppState) => AppState) => {
    setStateRaw((prev) => updater(prev))
  }, [])

  const getState = useCallback(() => {
    return stateRef.current
  }, [])

  const commitToolState = useCallback((nextState: AppState): Promise<void> => {
    return new Promise((resolve, reject) => {
      const pending: PendingToolCommit = {
        nextState,
        resolve,
        reject,
        timeout: setTimeout(() => {
          pendingToolCommitsRef.current = pendingToolCommitsRef.current.filter((candidate) => candidate !== pending)
          setStateRaw(stateRef.current)
          reject(new Error('Timed out waiting for the Reviewline UI state to commit'))
        }, 2000),
      }
      pendingToolCommitsRef.current.push(pending)
      setStateRaw(nextState)
    })
  }, [])

  const toolTransactionsRef = useRef<RunStateTransaction | null>(null)
  if (!toolTransactionsRef.current) {
    toolTransactionsRef.current = createSerializedStateTransactions(getState, commitToolState)
  }
  const runToolTransaction = toolTransactionsRef.current

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    const currentManifest = manifestKey ? manifestKey.split('|') : []
    const previous = previousManifestRef.current
    const added = currentManifest.filter((name) => !previous.includes(name))
    const removed = previous.filter((name) => !currentManifest.includes(name))
    if (added.length > 0 || removed.length > 0) {
      setState((current) => {
        let next = current
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
    previousManifestRef.current = currentManifest

    tryRegisterTools(getState, runToolTransaction, controller.signal)
      .then((available) => setWebmcpAvailable(available))
      .catch(() => setWebmcpAvailable(false))

    return () => {
      controller.abort()
    }
  }, [getState, setState, runToolTransaction, manifestKey])

  const handleSelectIncident = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.selectedIncidentId === id) return prev
        return appendTimelineEvent({ ...prev, selectedIncidentId: id }, {
          kind: 'workflow',
          actor: 'human',
          detail: `Incident selected: ${id}`,
        })
      })
    },
    [setState],
  )

  const handleApprove = useCallback(
    (proposalId: string, reviewerId: string, note: string) => {
      setState((prev) => {
        const { nextState } = applyHumanDecision(prev, proposalId, 'approved', note, reviewerId)
        return nextState
      })
    },
    [setState],
  )

  const handleReject = useCallback(
    (proposalId: string, reviewerId: string, note: string) => {
      setState((prev) => {
        const { nextState } = applyHumanDecision(prev, proposalId, 'rejected', note, reviewerId)
        return nextState
      })
    },
    [setState],
  )

  const handleReset = useCallback(() => {
    resetCounters()
    setStateRaw(makeInitialState())
  }, [])

  const selectedIncident: Incident | null =
    state.selectedIncidentId
      ? (state.incidents.find((i) => i.id === state.selectedIncidentId) ?? null)
      : null

  const activeSim: SimulationResult | null =
    state.activeSimId
      ? (state.simulations.find((s) => s.simId === state.activeSimId) ?? null)
      : null

  const focusedProposal: ReviewProposal | null =
    state.focusedProposalId
      ? (state.proposals.find((p) => p.proposalId === state.focusedProposalId) ?? null)
      : null

  // Show the latest pending proposal if one exists, otherwise focused proposal
  const proposalToShow: ReviewProposal | null =
    focusedProposal ??
    (state.proposals.filter((p) => p.status === 'pending').at(-1) ?? null)

  const simForProposal: SimulationResult | null =
    proposalToShow
      ? (state.simulations.find((s) => s.simId === proposalToShow.simId) ?? null)
      : null

  return (
    <div className="app" data-testid="app-root">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">
            <span className="app-title-main">Reviewline</span>
            <span className="app-title-tagline">{t('tagline')}</span>
          </h1>
          <div className="app-header-actions">
            <span
              className={`webmcp-indicator ${webmcpAvailable ? 'webmcp-indicator--active' : 'webmcp-indicator--inactive'}`}
              title={webmcpAvailable ? t('webmcpActiveTitle') : t('webmcpInactiveTitle')}
            >
              {webmcpAvailable ? t('webmcpActive') : t('webmcpInactive')}
            </span>
            <LanguageToggle />
            <button
              type="button"
              className="btn btn-reset"
              onClick={handleReset}
              aria-label={t('resetDemoStateAria')}
            >
              {t('reset')}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-layout">
          {/* Left: Incident queue */}
          <div className="app-col app-col--queue">
            <IncidentQueue
              incidents={state.incidents}
              selectedId={state.selectedIncidentId}
              onSelect={handleSelectIncident}
            />
          </div>

          {/* Center: Evidence + Simulation */}
          <div className="app-col app-col--workspace">
            <EvidencePanel incident={selectedIncident} />
            {(activeSim || state.simulations.length > 0) && (
              <SimulationView simulation={activeSim} />
            )}
          </div>

          {/* Right: Review panel + Audit log */}
          <div className="app-col app-col--review">
            <ReviewPanel
              proposal={proposalToShow}
              simulation={simForProposal}
              onApprove={handleApprove}
              onReject={handleReject}
            />
            {state.auditLog.length > 0 && <AuditLog entries={state.auditLog} />}
            <SessionTimeline events={state.sessionTimeline} />
          </div>
        </div>
      </main>

      {/* Footer: Tool inspector (always visible for dev transparency) */}
      <footer className="app-footer">
        <details className="tool-inspector-details">
          <summary className="tool-inspector-summary">
            {t('toolInspectorSummary', { count: availableToolDefs.length })}
          </summary>
          <ToolInspector tools={availableToolDefs} webmcpAvailable={webmcpAvailable} />
        </details>
      </footer>
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
