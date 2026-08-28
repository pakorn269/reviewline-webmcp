import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

  it('renders execute buttons for tools and calls onExecuteTool when clicked', async () => {
    const handleExecute = vi.fn().mockResolvedValue({ total: 3 })
    render(
      <ToolInspector
        tools={TOOL_DEFS}
        webmcpAvailable={false}
        onExecuteTool={handleExecute}
      />,
    )
    const execBtns = screen.getAllByRole('button', { name: /execute/i })
    expect(execBtns.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(execBtns[0])
    })
    expect(handleExecute).toHaveBeenCalled()
  })

  it('renders hero journey button and calls onRunHeroJourney when clicked', async () => {
    const handleHero = vi.fn().mockResolvedValue(undefined)
    render(
      <ToolInspector
        tools={TOOL_DEFS}
        webmcpAvailable={false}
        onRunHeroJourney={handleHero}
      />,
    )
    const heroBtn = screen.getByRole('button', { name: /hero/i })
    expect(heroBtn).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(heroBtn)
    })
    expect(handleHero).toHaveBeenCalledTimes(1)
  })
})

