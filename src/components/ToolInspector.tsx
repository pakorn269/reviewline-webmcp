import { useState, useCallback } from 'react'
import { useI18n } from '../i18n/I18nContext'
import type { ReviewlineToolName } from '../tools/registration'

interface ToolDef {
  name: string
  description: string
  schema: object
}

interface Props {
  tools: ToolDef[]
  webmcpAvailable: boolean
  selectedIncidentId?: string | null
  activeSimId?: string | null
  focusedProposalId?: string | null
  onExecuteTool?: (name: ReviewlineToolName, input: Record<string, unknown>) => Promise<unknown>
  onRunHeroJourney?: () => Promise<void>
}

function getDefaultInput(
  toolName: string,
  selectedIncidentId?: string | null,
  activeSimId?: string | null,
  focusedProposalId?: string | null,
): Record<string, unknown> {
  const incId = selectedIncidentId || 'inc-001'
  switch (toolName) {
    case 'list_incidents':
      return {}
    case 'inspect_incident':
      return { incident_id: incId }
    case 'simulate_guardrail_patch': {
      if (incId === 'inc-002') {
        return { incident_id: incId, rule_kind: 'refund_limit', threshold: 100, enforcement: 'block' }
      }
      if (incId === 'inc-003') {
        return { incident_id: incId, rule_kind: 'stale_evidence', threshold: 24, enforcement: 'block' }
      }
      return { incident_id: incId, rule_kind: 'spending_cap', threshold: 50000, enforcement: 'block' }
    }
    case 'draft_review_gate':
      return {
        incident_id: incId,
        title: incId === 'inc-001' ? 'Cap procurement at $50,000' : 'Remediate policy violations',
        rationale: 'Counterfactual replay proves trigger blocked and benign control passes with 0 regressions.',
        sim_id: activeSimId || 'sim-0001',
      }
    case 'get_review_status':
      return { proposal_id: focusedProposalId || 'prop-0001' }
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
  const [toolOutputs, setToolOutputs] = useState<Record<string, { success: boolean; data: string }>>({})
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})

  const handleExecute = useCallback(
    async (toolName: string) => {
      if (!onExecuteTool) return
      setExecutingToolName(toolName)
      try {
        let input: Record<string, unknown>
        if (customInputs[toolName]) {
          input = JSON.parse(customInputs[toolName])
        } else {
          input = getDefaultInput(toolName, selectedIncidentId, activeSimId, focusedProposalId)
        }
        const result = await onExecuteTool(toolName as ReviewlineToolName, input)
        setToolOutputs((prev) => ({
          ...prev,
          [toolName]: { success: true, data: JSON.stringify(result, null, 2) },
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed'
        setToolOutputs((prev) => ({
          ...prev,
          [toolName]: { success: false, data: message },
        }))
      } finally {
        setExecutingToolName(null)
      }
    },
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
          {webmcpAvailable ? (
            <span className="inspector-status inspector-status--ok">
              {t('registeredStatus', { count: tools.length })}
            </span>
          ) : (
            <span className="inspector-status inspector-status--fallback">
              {t('fallbackStatus')}
            </span>
          )}
        </div>

        {onRunHeroJourney && (
          <div className="inspector-header-right">
            <button
              type="button"
              className="btn btn-hero-journey"
              onClick={handleHeroClick}
              disabled={isHeroRunning || executingToolName !== null}
            >
              {isHeroRunning ? t('runningHeroJourney') : t('runHeroJourney')}
            </button>
          </div>
        )}
      </header>

      <ul className="inspector-list">
        {tools.map((tool) => {
          const defaultInput = getDefaultInput(
            tool.name,
            selectedIncidentId,
            activeSimId,
            focusedProposalId,
          )
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
                    disabled={executingToolName !== null || isHeroRunning}
                  >
                    {executingToolName === tool.name ? t('executingTool') : `▶ ${t('executeTool')}`}
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
                    defaultValue={JSON.stringify(defaultInput, null, 2)}
                    onChange={(e) => {
                      setCustomInputs((prev) => ({ ...prev, [tool.name]: e.target.value }))
                    }}
                  />
                </details>
              )}

              {output && (
                <div
                  className={`inspector-tool-output ${output.success ? 'inspector-tool-output--ok' : 'inspector-tool-output--err'}`}
                >
                  <span className="inspector-output-label">{t('toolOutputLabel')}</span>
                  <pre className="inspector-output-pre">{output.data}</pre>
                </div>
              )}

              <details className="inspector-schema">
                <summary>{t('inputSchemaSummary')}</summary>
                <pre className="inspector-schema-pre">
                  {JSON.stringify(tool.schema, null, 2)}
                </pre>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
