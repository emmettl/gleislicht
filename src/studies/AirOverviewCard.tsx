import { useMemo } from 'react'
import type { AirTrack } from '@motionstudies/core/domain/air'
import { airTrafficSummary } from './air-traffic-summary.ts'
import type { UiText } from '../locales/en.ts'

interface Props {
  activeAirLoadState: 'idle' | 'loading' | 'ready' | 'error'
  tracks: readonly AirTrack[]
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function AirOverviewCard({ activeAirLoadState, tracks, numberFormat, text }: Props) {
  const airSummary = useMemo(() => airTrafficSummary(tracks), [tracks])
  return (
        <section className="journey-card network-card air-network-card" aria-label={text.aircraftInMotion}>
          <div className="network-count-row">
            <strong>{activeAirLoadState === 'ready' ? numberFormat.format(airSummary.aircraft) : '—'}</strong>
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
