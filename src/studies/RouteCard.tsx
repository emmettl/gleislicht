import type { CogwheelCatalogue } from './cogwheel.ts'
import type { CSSProperties } from 'react'
import type { NetworkRouteIndexEntry, ServiceCategory } from '@motionstudies/core/domain/network'
import { TransportIcon } from '../TransportIcon.tsx'
import type { UiText } from '../locales/en.ts'

interface Props {
  selectedRoute: NetworkRouteIndexEntry
  serviceColors: Readonly<Record<ServiceCategory, string>>
  categoryName: string
  cogwheel: boolean
  studyLabel: string
  catalogue?: CogwheelCatalogue
  frequencyNote?: string
  callWindow: string
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function RouteCard({ selectedRoute, serviceColors, categoryName, cogwheel, studyLabel, catalogue, frequencyNote, callWindow, numberFormat, text }: Props) {
  const operators = catalogue ? [...new Set(selectedRoute.trainIds.map(id => catalogue.routes[catalogue.trips[id]]?.operator).filter(Boolean))].join(' · ') : undefined
  return (
        <section
          className="journey-card route-card"
          aria-label={`${text.selectedLine}: ${categoryName} ${selectedRoute.name}`}
          style={
            {
              '--service-accent': serviceColors[selectedRoute.category],
            } as CSSProperties
          }
        >
          <div className="service-row">
            <TransportIcon mode={cogwheel ? 'cogwheel' : selectedRoute.category} color={serviceColors[selectedRoute.category]} />
            <span className="service">
              {categoryName}{' '}
              {selectedRoute.name}
            </span>
          </div>
          <p className="between">
            {selectedRoute.headsigns.slice(0, 2).join(' ↔ ') ||
              (studyLabel)}
          </p>
          {operators !== undefined && <p className="between">{operators}</p>}
          {frequencyNote && <p className="between frequency-note">{frequencyNote}</p>}
          <div className="metric-grid">
            <div>
              <span>{text.trips}</span>
              <strong>{numberFormat.format(selectedRoute.trainIds.length)}</strong>
              <small>{callWindow}</small>
            </div>
            <div>
              <span>{text.stops}</span>
              <strong>{numberFormat.format(selectedRoute.stopIndexes.length)}</strong>
              <small>{text.unique}</small>
            </div>
          </div>
        </section>
  )
}
