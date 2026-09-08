import type { UiText } from '../locales/en.ts'
import { serviceCategoryLabel, type UiLanguage } from '../i18n.ts'

interface Props {
  zurichReady: boolean
  kientalReady: boolean
  zurichContrastActiveCount: number
  kientalContrastActiveCount: number
  error: boolean
  loading: boolean
  enterKientalCorridor: () => void
  numberFormat: Intl.NumberFormat
  language: UiLanguage
  text: UiText
}

export default function ContrastCard({ zurichReady, kientalReady, zurichContrastActiveCount, kientalContrastActiveCount, error, loading, enterKientalCorridor, numberFormat, language, text }: Props) {
  return (
        <section
          className="journey-card network-card contrast-card"
          aria-label={text.contrastNetworkStatus}
        >
          <p className="contrast-card-title">{text.cityValley}</p>
          <div className="metric-grid">
            <div>
              <span>Zürich</span>
              <strong>
                {zurichReady
                  ? numberFormat.format(zurichContrastActiveCount)
                  : '—'}
              </strong>
              <small>{serviceCategoryLabel(language, 'tram')}</small>
            </div>
            <div>
              <span>Kiental</span>
              <strong>
                {kientalReady
                  ? numberFormat.format(kientalContrastActiveCount)
                  : '—'}
              </strong>
              <small>PostBus 220</small>
            </div>
          </div>
          <p className="between">
            {error
              ? text.contrastUnavailable
              : loading
                ? text.loadingContrast
                : text.synchronisedDay}
          </p>
          <button
            className="corridor-entry contrast-corridor-entry"
            type="button"
            data-tooltip={text.controlHelp.corridor} onClick={enterKientalCorridor}
          >
            <span aria-hidden="true">↘</span>
            {text.enterTerrain} · Kiental–Griesalp
          </button>
        </section>
  )
}
