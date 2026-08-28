import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Eli5GuideModal } from './Eli5GuideModal'
import { I18nProvider } from '../i18n/I18nContext'

describe('Eli5GuideModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <I18nProvider initialLanguage="en">
        <Eli5GuideModal isOpen={false} onClose={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders correctly with title, ELI5 concept, and 4 use cases when isOpen is true', () => {
    render(
      <I18nProvider initialLanguage="en">
        <Eli5GuideModal isOpen={true} onClose={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Reviewline Guide/i)).toBeInTheDocument()
    expect(screen.getByText(/Detective/i)).toBeInTheDocument()
    expect(screen.getByText(/Judge/i)).toBeInTheDocument()

    // Switch to usecases tab
    fireEvent.click(screen.getByRole('tab', { name: /Real-World Use Cases/i }))
    expect(screen.getByText(/Procurement & Expense Overrides/i)).toBeInTheDocument()
    expect(screen.getByText(/Customer Support & Refund Disputes/i)).toBeInTheDocument()
    expect(screen.getByText(/DevOps & CI\/CD Deployment Gates/i)).toBeInTheDocument()
    expect(screen.getByText(/AI Safety & Jailbreak Defense/i)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <I18nProvider initialLanguage="en">
        <Eli5GuideModal isOpen={true} onClose={handleClose} />
      </I18nProvider>,
    )
    const closeBtn = screen.getByTestId('guide-close-button')
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn()
    render(
      <I18nProvider initialLanguage="en">
        <Eli5GuideModal isOpen={true} onClose={handleClose} />
      </I18nProvider>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('renders in Thai when active language is th', () => {
    render(
      <I18nProvider initialLanguage="th">
        <Eli5GuideModal isOpen={true} onClose={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/คู่มือ Reviewline/i)).toBeInTheDocument()
    expect(screen.getByText(/นักสืบ/i)).toBeInTheDocument()
    expect(screen.getByText(/ผู้พิพากษา/i)).toBeInTheDocument()

    // Switch to Thai usecases tab
    fireEvent.click(screen.getByRole('tab', { name: /ตัวอย่างงานจริง/i }))
    expect(screen.getByText(/ระบบจัดซื้อและตรวจสอบการเบิกจ่าย/i)).toBeInTheDocument()
  })
})
