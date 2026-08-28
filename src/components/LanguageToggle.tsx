import { useI18n } from '../i18n/I18nContext'

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useI18n()

  const targetLanguageLabel = language === 'en' ? 'Thai' : 'English'
  const ariaLabel = t('languageToggleAria', { targetLang: targetLanguageLabel })

  return (
    <button
      type="button"
      className="btn btn-lang"
      onClick={toggleLanguage}
      aria-label={ariaLabel}
      data-language={language}
      title={ariaLabel}
    >
      <span
        className={`lang-option ${language === 'en' ? 'lang-option--active' : ''}`}
        aria-hidden="true"
      >
        {t('langEn')}
      </span>
      <span className="lang-divider" aria-hidden="true">
        /
      </span>
      <span
        className={`lang-option ${language === 'th' ? 'lang-option--active' : ''}`}
        aria-hidden="true"
      >
        {t('langTh')}
      </span>
    </button>
  )
}
