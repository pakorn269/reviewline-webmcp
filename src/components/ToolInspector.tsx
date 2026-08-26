// ToolInspector — fallback dev harness showing registered tools in normal browsers
// MIT License

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
  return (
    <section className="tool-inspector" aria-label="WebMCP tool inspector">
      <header className="inspector-header">
        <h3 className="inspector-title">WebMCP Tools</h3>
        {webmcpAvailable ? (
          <span className="inspector-status inspector-status--ok">
            ✓ Registered ({tools.length})
          </span>
        ) : (
          <span className="inspector-status inspector-status--fallback">
            WebMCP not available — dev inspector mode
          </span>
        )}
      </header>

      <ul className="inspector-list">
        {tools.map((tool) => (
          <li key={tool.name} className="inspector-tool">
            <code className="inspector-tool-name">{tool.name}</code>
            <p className="inspector-tool-desc">{tool.description}</p>
            <details className="inspector-schema">
              <summary>Input Schema</summary>
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
