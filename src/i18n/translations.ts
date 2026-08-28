import { en } from './en'
import { th } from './th'
import type { Language, TranslationDictionary } from './types'

export const translations: Record<Language, TranslationDictionary> = {
  en,
  th,
}

export function formatString(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    return key in params ? String(params[key]) : `{${key}}`
  })
}
