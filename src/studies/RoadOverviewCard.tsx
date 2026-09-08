import type { RoadTrafficSummary } from './road-traffic-summary.ts'
import type { UiText } from '../locales/en.ts'

interface Props {
  roadOverview?: RoadTrafficSummary
  roadLoadState: 'idle' | 'loading' | 'ready' | 'error'
  roadMetricFormat: Intl.NumberFormat
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function RoadOverviewCard({ roadOverview, roadLoadState, roadMetricFormat, numberFormat, text }: Props) {
  return (
        <section className="journey-card network-card road-network-card" aria-label={text.estimatedVehicles}>
          <div className="network-count-row">
            <strong>{roadOverview ? `≈${numberFormat.format(roadOverview.vehicles)}` : '—'}</strong>
            <span>{text.estimatedVehicles}</span>
          </div>
          <p className="between">
            {roadOverview
              ? roadOverview.representative ? text.representativeRoadTraffic : text.counterRoadTraffic
              : roadLoadState === 'error' ? text.roadUnavailable
                : roadLoadState !== 'ready' ? text.loadingRoad : text.noRoadTraffic}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.roadDensity}</span>
              <strong>{roadOverview ? `≈${roadMetricFormat.format(roadOverview.density)}` : '—'}</strong>
              <small>{text.roadDensityUnit}</small>
            </div>
            <div>
              <span>{text.roadCoveredDistance}</span>
              <strong>{roadOverview ? roadMetricFormat.format(roadOverview.carriagewayKm) : '—'}</strong>
              <small>km</small>
            </div>
          </div>
        </section>
  )
}
