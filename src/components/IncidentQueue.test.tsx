import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IncidentQueue } from './IncidentQueue'
import { I18nProvider } from '../i18n/I18nContext'
import { makeInitialState } from '../domain/domain'

describe('IncidentQueue', () => {
  it('renders all three incidents', () => {
    const state = makeInitialState()
    render(
      <IncidentQueue
        incidents={state.incidents}
        selectedId={null}
        onSelect={() => undefined}
      />,
    )
    expect(screen.getByText(/inc-001/i)).toBeInTheDocument()
    expect(screen.getByText(/inc-002/i)).toBeInTheDocument()
    expect(screen.getByText(/inc-003/i)).toBeInTheDocument()
  })

  it('shows severity badges', () => {
    const state = makeInitialState()
    render(
      <IncidentQueue
        incidents={state.incidents}
        selectedId={null}
        onSelect={() => undefined}
      />,
    )
    expect(screen.getByText(/critical/i)).toBeInTheDocument()
    expect(screen.getByText(/high/i)).toBeInTheDocument()
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  it('calls onSelect with incident id when clicked', () => {
    const state = makeInitialState()
    const onSelect = vi.fn()
    render(
      <IncidentQueue
        incidents={state.incidents}
        selectedId={null}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByText(/procurement-agent/i))
    expect(onSelect).toHaveBeenCalledWith('inc-001')
  })

  it('marks selected incident with aria-current and a visible selection label', () => {
    const state = makeInitialState()
    const { container } = render(
      <IncidentQueue
        incidents={state.incidents}
        selectedId={'inc-001'}
        onSelect={() => undefined}
      />,
    )
    const selected = container.querySelector('[aria-current="true"]')
    expect(selected).not.toBeNull()
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  it('renders localized Thai summary and agent name when language is th', () => {
    const state = makeInitialState()
    render(
      <I18nProvider initialLanguage="th">
        <IncidentQueue
          incidents={state.incidents}
          selectedId={null}
          onSelect={() => undefined}
        />
      </I18nProvider>,
    )
    expect(screen.getByText(/เอเจนต์ฝ่ายจัดซื้อ/)).toBeInTheDocument()
    expect(screen.getByText(/เนื้อหาในหน้าเพจของซัพพลายเออร์พยายามแทนที่เพดานการจัดซื้อ/)).toBeInTheDocument()
  })
})

