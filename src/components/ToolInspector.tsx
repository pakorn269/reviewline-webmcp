import { useI18n } from '../i18n/I18nContext'

interface ToolDef {
  name: string
  description: string
  schema: object
}

interface Props {
  tools: ToolDef[]
  webmcpAvailable: boolean
}

export function ToolInspector({ tools, webmcpAvailable }: Props) {
  const { t } = useI18n()

  return (
    <section className="tool-inspector" aria-label={t('toolInspectorAria')}>
      <header className="inspector-header">
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
      </header>

      <ul className="inspector-list">
        {tools.map((tool) => (
          <li key={tool.name} className="inspector-tool">
            <code className="inspector-tool-name">{tool.name}</code>
            <p className="inspector-tool-desc">{tool.description}</p>
            <details className="inspector-schema">
              <summary>{t('inputSchemaSummary')}</summary>
              <pre className="inspector-schema-pre">
                {JSON.stringify(tool.schema, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
