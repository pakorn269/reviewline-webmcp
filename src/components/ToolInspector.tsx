// ToolInspector — in-page harness that mirrors the live manifest.
//
// In a WebMCP-capable browser this shows exactly the tools registered on
// document.modelContext. In any other browser it is the fallback way to drive the
// same handlers. It never exposes approval, rejection, or activation.
//
// MIT License

import { useCallback, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import type { ToolDefinition } from '../tools/manifest'
import type { ReviewlineToolName } from '../tools/registration'

interface Props {
  tools: readonly ToolDefinition[]
  webmcpAvailable: boolean
  selectedIncidentId?: string | null
  activeSimId?: string | null
  focusedProposalId?: string | null
  onExecuteTool?: (name: ReviewlineToolName, input: Record<string, unknown>) => Promise<unknown>
  onRunHeroJourney?: () => Promise<void>
}

interface ToolOutput {
  success: boolean
  data: string
}

interface DefaultInputContext {
  incidentId: string
  activeSimId?: string | null
  focusedProposalId?: string | null
}

const SIMULATION_DEFAULTS: Record<string, { rule_kind: string; threshold: number }> = {
  'inc-001': { rule_kind: 'spending_cap', threshold: 50000 },
  'inc-002': { rule_kind: 'refund_limit', threshold: 2000 },
  'inc-003': { rule_kind: 'stale_evidence', threshold: 24 },
}

function getDefaultInput(toolName: string, ctx: DefaultInputContext): Record<string, unknown> {
  switch (toolName) {
    case 'list_incidents':
      return {}
    case 'inspect_incident':
      return { incident_id: ctx.incidentId }
    case 'simulate_guardrail_patch': {
      const defaults = SIMULATION_DEFAULTS[ctx.incidentId] ?? SIMULATION_DEFAULTS['inc-001']
      return { incident_id: ctx.incidentId, ...defaults, enforcement: 'block' }
    }
    case 'draft_review_gate':
      return {
        incident_id: ctx.incidentId,
        title: 'Retain the candidate guardrail',
        rationale:
          'Counterfactual replay proves the trigger stays blocked and the benign control passes with zero regressions.',
        sim_id: ctx.activeSimId || 'sim-0001',
      }
    case 'get_review_status':
      return { proposal_id: ctx.focusedProposalId || 'prop-0001' }
    default:
      return {}
  }
}

export function ToolInspector({
  tools,
  webmcpAvailable,
  selectedIncidentId,
  activeSimId,
  focusedProposalId,
  onExecuteTool,
  onRunHeroJourney,
}: Props) {
  const { t } = useI18n()
  const [executingToolName, setExecutingToolName] = useState<string | null>(null)
  const [isHeroRunning, setIsHeroRunning] = useState(false)
  const [toolOutputs, setToolOutputs] = useState<Record<string, ToolOutput>>({})
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})

  const inputContext: DefaultInputContext = {
    incidentId: selectedIncidentId || 'inc-001',
    activeSimId,
    focusedProposalId,
  }

  const busy = executingToolName !== null || isHeroRunning

  const handleExecute = useCallback(
    async (toolName: ReviewlineToolName) => {
      if (!onExecuteTool) return
      setExecutingToolName(toolName)
      try {
        const raw = customInputs[toolName]
        const input = raw ? JSON.parse(raw) : getDefaultInput(toolName, inputContext)
        const result = await onExecuteTool(toolName, input)
        setToolOutputs((prev) => ({
          ...prev,
          [toolName]: { success: true, data: JSON.stringify(result, null, 2) },
        }))
      } catch (err) {
        setToolOutputs((prev) => ({
          ...prev,
          [toolName]: {
            success: false,
            data: err instanceof Error ? err.message : 'Execution failed',
          },
        }))
      } finally {
        setExecutingToolName(null)
      }
    },
    // inputContext is derived from props each render; the primitive parts are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onExecuteTool, customInputs, selectedIncidentId, activeSimId, focusedProposalId],
  )

  const handleHeroClick = useCallback(async () => {
    if (!onRunHeroJourney || isHeroRunning) return
    setIsHeroRunning(true)
    try {
      await onRunHeroJourney()
    } finally {
      setIsHeroRunning(false)
    }
  }, [onRunHeroJourney, isHeroRunning])

  return (
    <section className="tool-inspector" aria-label={t('toolInspectorAria')}>
      <header className="inspector-header">
        <div className="inspector-header-left">
          <h3 className="inspector-title">{t('toolInspectorTitle')}</h3>
          <span
            className={`badge ${webmcpAvailable ? 'badge--ok' : 'badge--warn'}`}
          >
            {webmcpAvailable ? t('registeredStatus', { count: tools.length }) : t('fallbackStatus')}
          </span>
        </div>

        {onRunHeroJourney && (
          <button
            type="button"
            className="btn btn-hero-journey"
            onClick={handleHeroClick}
            disabled={busy}
          >
            {isHeroRunning ? t('runningHeroJourney') : t('runHeroJourney')}
          </button>
        )}
      </header>

      <ul className="inspector-list">
        {tools.map((tool) => {
          const defaultInput = getDefaultInput(tool.name, inputContext)
          const output = toolOutputs[tool.name]

          return (
            <li key={tool.name} className="inspector-tool">
              <div className="inspector-tool-top">
                <div className="inspector-tool-info">
                  <code className="inspector-tool-name">{tool.name}</code>
                  <p className="inspector-tool-desc">{tool.description}</p>
                </div>

                {onExecuteTool && (
                  <button
                    type="button"
                    className="btn btn-tool-exec"
                    onClick={() => handleExecute(tool.name)}
                    disabled={busy}
                  >
                    {executingToolName === tool.name ? t('executingTool') : t('executeTool')}
                  </button>
                )}
              </div>

              {onExecuteTool && (
                <details className="inspector-params-details">
                  <summary className="inspector-params-summary">
                    {t('parametersLabel')} <code>{JSON.stringify(defaultInput)}</code>
                  </summary>
                  <textarea
                    className="inspector-params-textarea"
                    rows={3}
                    aria-label={`${tool.name} ${t('parametersLabel')}`}
                    defaultValue={JSON.stringify(defaultInput, null, 2)}
                    onChange={(event) =>
                      setCustomInputs((prev) => ({ ...prev, [tool.name]: event.target.value }))
                    }
                  />
                </details>
              )}

              {output && (
                <div
                  className={`inspector-tool-output ${
                    output.success ? 'inspector-tool-output--ok' : 'inspector-tool-output--err'
                  }`}
                >
                  <span className="inspector-output-label">{t('toolOutputLabel')}</span>
                  <pre className="inspector-output-pre">{output.data}</pre>
                </div>
              )}

              <details className="inspector-schema">
                <summary>{t('inputSchemaSummary')}</summary>
                <pre className="inspector-schema-pre">{JSON.stringify(tool.schema, null, 2)}</pre>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
