import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { translations } from './translations'
import { I18nProvider, useI18n } from './I18nContext'

describe('i18n translation system', () => {
  it('has identical keys in English and Thai translation dictionaries', () => {
    const enKeys = Object.keys(translations.en).sort()
    const thKeys = Object.keys(translations.th).sort()
    expect(enKeys).toEqual(thKeys)
    expect(enKeys.length).toBeGreaterThan(20)
  })

  it('translates keys in English and Thai correctly', () => {
    expect(translations.en.appTitle).toBe('Reviewline')
    expect(translations.en.tagline).toBe('Agents investigate. Humans authorize.')
    expect(translations.th.tagline).toBe('เอเจนต์ดำเนินการสืบสวน มนุษย์เป็นผู้อนุมัติ')
    expect(translations.th.reset).toBe('รีเซ็ต')
  })

  it('interpolates parameters correctly with t()', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider initialLanguage="en">{children}</I18nProvider>,
    })

    expect(result.current.t('toolInspectorSummary', { count: 5 })).toBe('WebMCP Tool Inspector (5 tools)')
  })

  it('allows toggling between English and Thai', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider initialLanguage="en">{children}</I18nProvider>,
    })

    expect(result.current.language).toBe('en')
    expect(result.current.t('tagline')).toBe('Agents investigate. Humans authorize.')

    act(() => {
      result.current.toggleLanguage()
    })

    expect(result.current.language).toBe('th')
    expect(result.current.t('tagline')).toBe('เอเจนต์ดำเนินการสืบสวน มนุษย์เป็นผู้อนุมัติ')

    act(() => {
      result.current.toggleLanguage()
    })

    expect(result.current.language).toBe('en')
  })

  it('allows explicitly setting language', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider initialLanguage="en">{children}</I18nProvider>,
    })

    act(() => {
      result.current.setLanguage('th')
    })
    expect(result.current.language).toBe('th')

    act(() => {
      result.current.setLanguage('en')
    })
    expect(result.current.language).toBe('en')
  })
})
