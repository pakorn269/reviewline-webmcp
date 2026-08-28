import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageToggle } from './LanguageToggle'
import { I18nProvider, useI18n } from '../i18n/I18nContext'

function TestComponent() {
  const { language, t } = useI18n()
  return (
    <div>
      <LanguageToggle />
      <span data-testid="current-lang">{language}</span>
      <span data-testid="translated-tagline">{t('tagline')}</span>
    </div>
  )
}

describe('LanguageToggle', () => {
  it('renders with accessible name and shows both language badges', () => {
    render(
      <I18nProvider initialLanguage="en">
        <TestComponent />
      </I18nProvider>,
    )

    const button = screen.getByRole('button', { name: /switch language/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('EN')
    expect(button).toHaveTextContent('TH')
  })

  it('switches language between English and Thai on click', () => {
    render(
      <I18nProvider initialLanguage="en">
        <TestComponent />
      </I18nProvider>,
    )

    expect(screen.getByTestId('current-lang')).toHaveTextContent('en')
    expect(screen.getByTestId('translated-tagline')).toHaveTextContent(
      'Agents investigate. Humans authorize.',
    )

    const button = screen.getByRole('button', { name: /switch language/i })
    fireEvent.click(button)

    expect(screen.getByTestId('current-lang')).toHaveTextContent('th')
    expect(screen.getByTestId('translated-tagline')).toHaveTextContent(
      'เอเจนต์ดำเนินการสืบสวน มนุษย์เป็นผู้อนุมัติ',
    )

    // Click again to toggle back to English
    fireEvent.click(button)
    expect(screen.getByTestId('current-lang')).toHaveTextContent('en')
    expect(screen.getByTestId('translated-tagline')).toHaveTextContent(
      'Agents investigate. Humans authorize.',
    )
  })

  it('indicates the active language with aria-pressed or aria attributes', () => {
    render(
      <I18nProvider initialLanguage="en">
        <TestComponent />
      </I18nProvider>,
    )

    const button = screen.getByRole('button', { name: /switch language/i })
    expect(button).toHaveAttribute('data-language', 'en')

    fireEvent.click(button)
    expect(button).toHaveAttribute('data-language', 'th')
  })
})
