import type { ReactNode } from 'react'
import type { NetworkTrain } from '@motionstudies/core/domain/network'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { TransportIcon } from '../TransportIcon.tsx'
import type { ServiceFrequency } from './frequency.ts'
import type { UiText } from '../locales/en.ts'

interface Props {
  selectedTrain: NetworkTrain
  selectedFrom?: string
  selectedTo?: string
  selectedHeadway: boolean
  selectedFrequency?: ServiceFrequency
  frequency: { arrival: string; label: string; note: string }
  cogwheel: boolean
  color: string
  categoryName: string
  numberFormat: Intl.NumberFormat
  text: UiText
  children?: ReactNode
}

export default function TrainCard({ selectedTrain, selectedFrom, selectedTo, selectedHeadway, selectedFrequency, frequency, cogwheel, color, categoryName, numberFormat, text, children }: Props) {
  return (
        <section className="journey-card selected-card" aria-label={text.selectedTrain}>
          <div className="service-row">
            <TransportIcon mode={cogwheel ? 'cogwheel' : selectedTrain.category} color={color} />
            <span className="service">{selectedTrain.route}</span>
            <span className="arrow">→</span>
            <span>{selectedTrain.headsign}</span>
          </div>
          <p className="between">
            {selectedFrom ?? text.betweenStations} <span>/</span>{' '}
            {selectedTo ?? selectedTrain.headsign}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.train}</span>
              <strong>{selectedTrain.shortName || '—'}</strong>
              <small>{categoryName}</small>
            </div>
            <div>
              <span>{selectedHeadway ? frequency.arrival : text.arrival}</span>
              <strong>{selectedHeadway ? '≈' : ''}{formatServiceTime(selectedTrain.end)}</strong>
              <small>{selectedHeadway ? frequency.label : text.plan}</small>
            </div>
          </div>
          {selectedHeadway && selectedFrequency && <p className="between frequency-note">{frequency.note}: <span style={{ whiteSpace: 'nowrap' }}>{numberFormat.format(selectedFrequency.headwaySeconds % 60 === 0 ? selectedFrequency.headwaySeconds / 60 : selectedFrequency.headwaySeconds)} {selectedFrequency.headwaySeconds % 60 === 0 ? 'min' : 's'}</span></p>}
          {children}
        </section>
  )
}
