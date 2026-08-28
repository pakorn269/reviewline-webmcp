import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18nContext'

interface Eli5GuideModalProps {
  isOpen: boolean
  onClose: () => void
}

type GuideTab = 'concept' | 'webmcp' | 'usecases' | 'tour'

export function Eli5GuideModal({ isOpen, onClose }: Eli5GuideModalProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<GuideTab>('concept')
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      data-testid="guide-modal-backdrop"
    >
      <div
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-modal-title"
        ref={modalRef}
      >
        <header className="guide-modal-header">
          <div className="guide-modal-header-info">
            <span className="guide-modal-badge">GUIDE / ELI5</span>
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
            ✕
          </button>
        </header>

        <nav className="guide-tabs" role="tablist" aria-label="Guide Sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'concept'}
            className={`guide-tab ${activeTab === 'concept' ? 'guide-tab--active' : ''}`}
            onClick={() => setActiveTab('concept')}
          >
            {t('guideTabConcept')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'webmcp'}
            className={`guide-tab ${activeTab === 'webmcp' ? 'guide-tab--active' : ''}`}
            onClick={() => setActiveTab('webmcp')}
          >
            {t('guideTabWebmcp')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'usecases'}
            className={`guide-tab ${activeTab === 'usecases' ? 'guide-tab--active' : ''}`}
            onClick={() => setActiveTab('usecases')}
          >
            {t('guideTabUsecases')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tour'}
            className={`guide-tab ${activeTab === 'tour' ? 'guide-tab--active' : ''}`}
            onClick={() => setActiveTab('tour')}
          >
            {t('guideTabTour')}
          </button>
        </nav>

        <div className="guide-modal-body" role="tabpanel">
          {activeTab === 'concept' && (
            <div className="guide-section animate-fade">
              <h3 className="guide-section-title">{t('guideConceptTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideConceptSubtitle')}</p>

              <div className="guide-concept-grid">
                <div className="guide-card guide-card--detective">
                  <div className="guide-card-header">
                    <h4>{t('guideDetectiveTitle')}</h4>
                  </div>
                  <p className="guide-card-text">{t('guideDetectiveDesc')}</p>
                </div>

                <div className="guide-card guide-card--judge">
                  <div className="guide-card-header">
                    <h4>{t('guideJudgeTitle')}</h4>
                  </div>
                  <p className="guide-card-text">{t('guideJudgeDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'webmcp' && (
            <div className="guide-section animate-fade">
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
            <div className="guide-section animate-fade">
              <h3 className="guide-section-title">{t('guideUsecasesTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideUsecasesSubtitle')}</p>

              <div className="guide-usecases-grid">
                <div className="usecase-card">
                  <div className="usecase-card-header">
                    <h4>{t('guideUsecase1Title')}</h4>
                    <span className="usecase-badge usecase-badge--critical">Critical</span>
                  </div>
                  <p className="usecase-desc">{t('guideUsecase1Desc')}</p>
                  <div className="usecase-demo-tag">{t('guideUsecase1Demo')}</div>
                </div>

                <div className="usecase-card">
                  <div className="usecase-card-header">
                    <h4>{t('guideUsecase2Title')}</h4>
                    <span className="usecase-badge usecase-badge--high">High</span>
                  </div>
                  <p className="usecase-desc">{t('guideUsecase2Desc')}</p>
                  <div className="usecase-demo-tag">{t('guideUsecase2Demo')}</div>
                </div>

                <div className="usecase-card">
                  <div className="usecase-card-header">
                    <h4>{t('guideUsecase3Title')}</h4>
                    <span className="usecase-badge usecase-badge--medium">Medium</span>
                  </div>
                  <p className="usecase-desc">{t('guideUsecase3Desc')}</p>
                  <div className="usecase-demo-tag">{t('guideUsecase3Demo')}</div>
                </div>

                <div className="usecase-card">
                  <div className="usecase-card-header">
                    <h4>{t('guideUsecase4Title')}</h4>
                    <span className="usecase-badge usecase-badge--safety">Safety</span>
                  </div>
                  <p className="usecase-desc">{t('guideUsecase4Desc')}</p>
                  <div className="usecase-demo-tag">{t('guideUsecase4Demo')}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tour' && (
            <div className="guide-section animate-fade">
              <h3 className="guide-section-title">{t('guideTourTitle')}</h3>
              <p className="guide-section-subtitle">{t('guideTourSubtitle')}</p>

              <div className="guide-steps-list">
                <div className="guide-step-card">
                  <span className="guide-step-num">01</span>
                  <p>{t('guideTourStep1')}</p>
                </div>
                <div className="guide-step-card">
                  <span className="guide-step-num">02</span>
                  <p>{t('guideTourStep2')}</p>
                </div>
                <div className="guide-step-card">
                  <span className="guide-step-num">03</span>
                  <p>{t('guideTourStep3')}</p>
                </div>
                <div className="guide-step-card guide-step-card--human">
                  <span className="guide-step-num">04</span>
                  <p>{t('guideTourStep4')}</p>
                </div>
              </div>
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
