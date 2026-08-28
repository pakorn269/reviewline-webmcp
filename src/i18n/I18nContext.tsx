/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { translations, formatString } from './translations'
import type { Language, TranslationKey } from './types'

export interface I18nContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export interface I18nProviderProps {
  children: ReactNode
  initialLanguage?: Language
}

export function I18nProvider({ children, initialLanguage = 'en' }: I18nProviderProps) {
  const [language, setLanguage] = useState<Language>(initialLanguage)

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'en' ? 'th' : 'en'))
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] ?? translations.en
      const template = dict[key] ?? translations.en[key] ?? key
      return formatString(template, params)
    },
    [language],
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, toggleLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    // Graceful fallback to default English translations when rendered outside I18nProvider
    return {
      language: 'en',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        const template = translations.en[key] ?? key
        return formatString(template, params)
      },
    }
  }
  return context
}
