import type { ReactNode } from 'react'
import type { RoadTopologyRoad } from '@motionstudies/core/domain/road'
import type { CantonalPilot } from './cantonal-road-pilot.ts'
import type { RoadTrafficSummary } from './road-traffic-summary.ts'
import type { UiText } from '../locales/en.ts'

interface Props {
  selectedRoad: RoadTopologyRoad
  activePilot?: CantonalPilot
  selectedRoadGeometryOnly: boolean
  selectedRoadLength?: number
  selectedRoadTraffic?: RoadTrafficSummary
  roadLoadState: 'idle' | 'loading' | 'ready' | 'error'
  roadMetricFormat: Intl.NumberFormat
  numberFormat: Intl.NumberFormat
  text: UiText
  children?: ReactNode
}

export default function RoadCard({ selectedRoad, activePilot, selectedRoadGeometryOnly, selectedRoadLength, selectedRoadTraffic, roadLoadState, roadMetricFormat, numberFormat, text, children }: Props) {
  return (
        <section
          className={`journey-card road-corridor-card${activePilot ? ' is-pilot' : ''}`}
          aria-label={`${text.selectedRoadCorridor}: ${selectedRoad.label}`}
        >
          <div className="service-row">
            <span className="road-card-mark" aria-hidden="true">━</span>
            <span className="service">{selectedRoad.label}</span>
            <span className="arrow">/</span>
            <span>{selectedRoad.officialLabel}</span>
          </div>
          <p className="between">
            {activePilot ? null : selectedRoad.description ?? text.nationalMotorway}
          </p>
          {children}
          <div className="metric-grid">
            <div>
              <span>{text.mappedRoadLength}</span>
              <strong>{activePilot ? `≈${roadMetricFormat.format(activePilot.topology.sections[0].distanceKm)}` : selectedRoadLength === undefined ? '—' : `≈${roadMetricFormat.format(selectedRoadLength)}`}</strong>
              <small>km</small>
            </div>
            {!selectedRoadGeometryOnly && <div>
              <span>{text.estimatedVehicles}</span>
              <strong>{selectedRoadTraffic ? `≈${numberFormat.format(selectedRoadTraffic.vehicles)}` : '—'}</strong>
            </div>}
          </div>
          <p className="road-traffic-summary">
            {selectedRoadGeometryOnly || activePilot
              ? <a href="https://geolion.zh.ch/geodatensatz/3177" target="_blank" rel="noreferrer">AUTO · Kanton Zürich</a>
              : selectedRoadTraffic
              ? <>
                  <span>{text.roadDensitySummary(roadMetricFormat.format(selectedRoadTraffic.density))}</span>
                  <span>{text.roadCoverageSummary(roadMetricFormat.format(selectedRoadTraffic.carriagewayKm))}</span>
                  <span>{selectedRoadTraffic.representative ? text.representativeRoadTraffic : text.counterRoadTraffic}</span>
                </>
              : roadLoadState === 'loading' ? text.loadingRoad : text.noRoadTraffic}
          </p>
        </section>
  )
}
