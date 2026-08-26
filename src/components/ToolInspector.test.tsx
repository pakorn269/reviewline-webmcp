import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolInspector } from './ToolInspector'

const TOOL_DEFS = [
  { name: 'list_incidents', description: 'List incidents', schema: {} },
  { name: 'inspect_incident', description: 'Inspect one incident', schema: {} },
]

describe('ToolInspector', () => {
  it('lists all tool names', () => {
    render(<ToolInspector tools={TOOL_DEFS} webmcpAvailable={false} />)
    expect(screen.getByText('list_incidents')).toBeInTheDocument()
    expect(screen.getByText('inspect_incident')).toBeInTheDocument()
  })

  it('shows fallback notice when WebMCP is unavailable', () => {
    render(<ToolInspector tools={TOOL_DEFS} webmcpAvailable={false} />)
    expect(screen.getByText(/WebMCP not available/i)).toBeInTheDocument()
  })

  it('shows registered notice when WebMCP is available', () => {
    render(<ToolInspector tools={TOOL_DEFS} webmcpAvailable={true} />)
    expect(screen.getByText(/registered/i)).toBeInTheDocument()
  })
})
