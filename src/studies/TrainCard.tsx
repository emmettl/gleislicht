import type { ReactNode } from 'react'
import { NetworkVehicleHeroCard } from '@motionstudies/web/components/NetworkVehicleHeroCard'
import '@motionstudies/web/vehicle-hero-card.css'
import './vehicle-hero.css'
import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { TransportIcon } from '../TransportIcon.tsx'
import type { ServiceFrequency } from './frequency.ts'
import type { UiText } from '../locales/en.ts'

interface Props {
  snapshot?: NetworkSnapshot
  time?: number
  language?: string
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

export default function TrainCard({ snapshot, time = 0, language = 'en', selectedTrain, selectedFrom, selectedTo, selectedHeadway, selectedFrequency, frequency, cogwheel, color, categoryName, numberFormat, text, children }: Props) {
  const copy = language === 'de' ? { atStop: 'Am Halt', rail: 'Zug', destination: 'Nach', destinationUnknown: 'Ziel nicht verfügbar', nextStop: 'Nächster Halt', callingAt: 'Weitere Halte', terminus: 'Endstation', platform: 'Gleis', empty: 'Keine weiteren Halte in den geladenen Daten.' }
    : language === 'fr' ? { atStop: 'À l’arrêt', rail: 'Train', destination: 'Destination', destinationUnknown: 'Destination indisponible', nextStop: 'Prochain arrêt', callingAt: 'Arrêts suivants', terminus: 'Terminus', platform: 'Voie', empty: 'Aucun autre arrêt dans les données chargées.' }
    : language === 'it' ? { atStop: 'Alla fermata', rail: 'Treno', destination: 'Destinazione', destinationUnknown: 'Destinazione non disponibile', nextStop: 'Prossima fermata', callingAt: 'Fermate successive', terminus: 'Capolinea', platform: 'Binario', empty: 'Nessun’altra fermata nei dati caricati.' }
    : { atStop: 'At stop' }
  if (snapshot && !cogwheel && !['ferry', 'cableway', 'funicular', 'other'].includes(selectedTrain.category)) return <section className="journey-card selected-card vehicle-hero-card" aria-label={text.selectedTrain}>
    <NetworkVehicleHeroCard snapshot={snapshot} train={selectedTrain} time={time} showTimes={!selectedHeadway} atStopLabel={copy.atStop} labels={copy}
      presentation={selectedTrain.category === 'bus' ? 'yellow-bus' : 'sbb'} note={<>{text.allScheduledPaths}{selectedHeadway && <> · {frequency.note}</>}</>} />
    {children}
  </section>
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
