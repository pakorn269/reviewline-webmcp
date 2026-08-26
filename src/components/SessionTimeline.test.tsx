import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SessionTimeline } from './SessionTimeline'
import type { SessionEvent } from '../domain/domain'

const events: SessionEvent[] = [
  {
    id: 'event-0001',
    ts: '2026-08-26T02:00:00Z',
    kind: 'registered',
    actor: 'system',
    toolName: 'list_incidents',
    detail: 'Capability became available.',
  },
  {
    id: 'event-0002',
    ts: '2026-08-26T02:00:01Z',
    kind: 'invoked',
    actor: 'agent',
    toolName: 'list_incidents',
    detail: 'Tool invoked.',
  },
]

describe('SessionTimeline', () => {
  it('renders append-only capability and invocation evidence in order', () => {
    render(<SessionTimeline events={events} />)
    expect(screen.getByRole('heading', { name: /session timeline/i })).toBeInTheDocument()
    expect(screen.getByText('registered')).toBeInTheDocument()
    expect(screen.getByText('invoked')).toBeInTheDocument()
    expect(screen.getAllByText('list_incidents')).toHaveLength(2)
  })
})
