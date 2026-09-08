import type { UiText } from '../locales/en.ts'

interface Props {
  activeAirLoadState: 'idle' | 'loading' | 'ready' | 'error'
  activeAircraftCount: number
  airSummary: { origins: number; destinations: number }
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function AirOverviewCard({ activeAirLoadState, activeAircraftCount, airSummary, numberFormat, text }: Props) {
  return (
        <section className="journey-card network-card air-network-card" aria-label={text.aircraftInMotion}>
          <div className="network-count-row">
            <strong>{activeAirLoadState === 'ready' ? numberFormat.format(activeAircraftCount) : '—'}</strong>
            <span>{text.aircraftInMotion}</span>
          </div>
          <p className="between">
            {activeAirLoadState === 'error' ? text.airUnavailable
              : activeAirLoadState !== 'ready' ? text.loadingAir : text.airAirportSummary}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.airOrigins}</span>
              <strong>{activeAirLoadState === 'ready' ? numberFormat.format(airSummary.origins) : '—'}</strong>
            </div>
            <div>
              <span>{text.airDestinations}</span>
              <strong>{activeAirLoadState === 'ready' ? numberFormat.format(airSummary.destinations) : '—'}</strong>
            </div>
          </div>
        </section>
  )
}
