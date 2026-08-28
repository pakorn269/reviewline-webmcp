// Eli5GuideModal — plain-language explanation of the authority model plus the
// real-world situations it maps onto.
// MIT License

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/types'

interface Eli5GuideModalProps {
  isOpen: boolean
  onClose: () => void
}

type GuideTab = 'concept' | 'webmcp' | 'usecases' | 'tour'

const TABS: { id: GuideTab; labelKey: TranslationKey }[] = [
  { id: 'concept', labelKey: 'guideTabConcept' },
  { id: 'webmcp', labelKey: 'guideTabWebmcp' },
  { id: 'usecases', labelKey: 'guideTabUsecases' },
  { id: 'tour', labelKey: 'guideTabTour' },
]

const USE_CASES: {
  titleKey: TranslationKey
  descKey: TranslationKey
  demoKey: TranslationKey
  badgeKey: TranslationKey
  severity: string
}[] = [
  {
    titleKey: 'guideUsecase1Title',
    descKey: 'guideUsecase1Desc',
    demoKey: 'guideUsecase1Demo',
    badgeKey: 'guideBadgeCritical',
    severity: 'critical',
  },
  {
    titleKey: 'guideUsecase2Title',
    descKey: 'guideUsecase2Desc',
    demoKey: 'guideUsecase2Demo',
    badgeKey: 'guideBadgeHigh',
    severity: 'high',
  },
  {
    titleKey: 'guideUsecase3Title',
    descKey: 'guideUsecase3Desc',
    demoKey: 'guideUsecase3Demo',
    badgeKey: 'guideBadgeMedium',
    severity: 'medium',
  },
  {
    titleKey: 'guideUsecase4Title',
    descKey: 'guideUsecase4Desc',
    demoKey: 'guideUsecase4Demo',
    badgeKey: 'guideBadgeSafety',
    severity: 'safety',
  },
]

const TOUR_STEPS: TranslationKey[] = [
  'guideTourStep1',
  'guideTourStep2',
  'guideTourStep3',
  'guideTourStep4',
]

export function Eli5GuideModal({ isOpen, onClose }: Eli5GuideModalProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<GuideTab>('concept')
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      data-testid="guide-modal-backdrop"
    >
      <div
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-modal-title"
      >
        <header className="guide-modal-header">
          <div className="guide-modal-header-info">
            <span className="panel-eyebrow">{t('guideModalBadge')}</span>
            <h2 id="guide-modal-title" className="guide-modal-title">
              {t('guideModalTitle')}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="guide-modal-close"
            onClick={onClose}
            aria-label={t('guideModalCloseAria')}
            data-testid="guide-close-button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <nav className="guide-tabs" role="tablist" aria-label={t('guideSectionsAria')}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`guide-tab ${activeTab === tab.id ? 'guide-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>

        <div className="guide-modal-body" role="tabpanel">
          {activeTab === 'concept' && (
            <div className="guide-section">
              <h3 className="guide-section-title">{t('guideConceptTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideConceptSubtitle')}</p>
              <div className="guide-concept-grid">
                <div className="guide-card guide-card--detective">
                  <h4>{t('guideDetectiveTitle')}</h4>
                  <p className="guide-card-text">{t('guideDetectiveDesc')}</p>
                </div>
                <div className="guide-card guide-card--judge">
                  <h4>{t('guideJudgeTitle')}</h4>
                  <p className="guide-card-text">{t('guideJudgeDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'webmcp' && (
            <div className="guide-section">
              <h3 className="guide-section-title">{t('guideWebmcpTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideWebmcpSubtitle')}</p>
              <div className="guide-points-list">
                <div className="guide-point-card">
                  <h4>{t('guideWebmcpPoint1Title')}</h4>
                  <p>{t('guideWebmcpPoint1Desc')}</p>
                </div>
                <div className="guide-point-card">
                  <h4>{t('guideWebmcpPoint2Title')}</h4>
                  <p>{t('guideWebmcpPoint2Desc')}</p>
                </div>
                <div className="guide-point-card guide-point-card--boundary">
                  <h4>{t('guideWebmcpPoint3Title')}</h4>
                  <p>{t('guideWebmcpPoint3Desc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usecases' && (
            <div className="guide-section">
              <h3 className="guide-section-title">{t('guideUsecasesTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideUsecasesSubtitle')}</p>
              <div className="guide-usecases-grid">
                {USE_CASES.map((useCase) => (
                  <div key={useCase.titleKey} className="usecase-card">
                    <div className="usecase-card-header">
                      <h4>{t(useCase.titleKey)}</h4>
                      <span className={`usecase-badge usecase-badge--${useCase.severity}`}>
                        {t(useCase.badgeKey)}
                      </span>
                    </div>
                    <p className="usecase-desc">{t(useCase.descKey)}</p>
                    <p className="usecase-demo-tag">{t(useCase.demoKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tour' && (
            <div className="guide-section">
              <h3 className="guide-section-title">{t('guideTourTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideTourSubtitle')}</p>
              <ol className="guide-steps-list">
                {TOUR_STEPS.map((stepKey, index) => (
                  <li
                    key={stepKey}
                    className={`guide-step-card ${
                      index === TOUR_STEPS.length - 1 ? 'guide-step-card--human' : ''
                    }`}
                  >
                    <span className="guide-step-num">{String(index + 1).padStart(2, '0')}</span>
                    <p>{t(stepKey)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <footer className="guide-modal-footer">
          <button type="button" className="btn btn-guide-close" onClick={onClose}>
            {t('guideModalClose')}
          </button>
        </footer>
      </div>
    </div>
  )
}
