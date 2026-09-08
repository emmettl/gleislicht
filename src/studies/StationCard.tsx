import type { CSSProperties } from 'react'
import type { StationIndexEntry, ServiceCategory } from '@motionstudies/core/domain/network'
import type { UiText } from '../locales/en.ts'

interface Props {
  selectedStation: StationIndexEntry
  serviceColors: Readonly<Record<ServiceCategory, string>>
  onConnections?: () => void
  connectionsLabel: string
  fullDay: boolean
  frequencyNote?: string
  activeTrainCount: number
  movementsLabel?: string
  callWindow: string
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function StationCard({ selectedStation, serviceColors, onConnections, connectionsLabel, fullDay, frequencyNote, activeTrainCount, movementsLabel, callWindow, numberFormat, text }: Props) {
  return (
        <section
          className="journey-card station-card"
          aria-label={text.routesServing(selectedStation.name)}
        >
          <div className="service-row">
            <span className="station-card-mark" aria-hidden="true">◎</span>
            <span className="service">{selectedStation.name}</span>
          </div>
          {onConnections && <button type="button" className="corridor-entry" onClick={event => { event.currentTarget.focus(); onConnections() }}>{connectionsLabel} →</button>}
          <div
            className="station-route-strip"
            aria-label={text.routesServing(selectedStation.name)}
          >
            {selectedStation.routes.slice(0, 4).map((route) => (
              <span
                key={`${route.category}:${route.name}`}
                style={
                  {
                    '--route-accent': serviceColors[route.category],
                  } as CSSProperties
                }
              >
                {route.name}
              </span>
            ))}
            {selectedStation.routes.length > 4 && (
              <small>+{selectedStation.routes.length - 4}</small>
            )}
          </div>
          <p className="between">
            {text.allScheduledPaths} <span>/</span>{' '}
            {fullDay ? text.fullDayStudy : text.morningStudy}
            {frequencyNote && <> {frequencyNote}</>}
          </p>
          <div className="network-count-row">
            <strong>{numberFormat.format(activeTrainCount)}</strong>
            <span>{movementsLabel}</span>
          </div>
          <div className="metric-grid">
            <div>
              <span>{text.routes}</span>
              <strong>{selectedStation.routes.length}</strong>
              <small>{text.unique}</small>
            </div>
            <div>
              <span>{text.calls}</span>
              <strong>{selectedStation.trainIds.length}</strong>
              <small>{callWindow}</small>
            </div>
          </div>
        </section>
  )
}
