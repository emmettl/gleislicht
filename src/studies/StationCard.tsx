import StationDeparturesCard from './StationDeparturesCard.tsx'
import './station-hero.css'
import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import type { CSSProperties } from 'react'
import type { StationIndexEntry, ServiceCategory } from '@motionstudies/core/domain/network'
import type { UiText } from '../locales/en.ts'

interface Props {
  snapshot?: NetworkSnapshot
  time: number
  language: string
  onSelectTrain: (train: NetworkTrain) => void
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

export default function StationCard({ snapshot, time, language, onSelectTrain, selectedStation, serviceColors, onConnections, connectionsLabel, fullDay, frequencyNote, activeTrainCount, movementsLabel, callWindow, numberFormat, text }: Props) {
  const labels = language === 'de' ? { station: 'Bahnhof', departures: 'Abfahrten', service: 'Zug', time: 'Zeit', destination: 'Ziel', platform: 'Gleis', expected: 'Hinweis', empty: 'Keine weiteren Abfahrten im geladenen Zeitfenster.' }
    : language === 'fr' ? { station: 'Gare', departures: 'Départs', service: 'Train', time: 'Heure', destination: 'Destination', platform: 'Voie', expected: 'Info', empty: 'Aucun autre départ dans la fenêtre chargée.' }
    : language === 'it' ? { station: 'Stazione', departures: 'Partenze', service: 'Treno', time: 'Ora', destination: 'Destinazione', platform: 'Binario', expected: 'Info', empty: 'Nessun’altra partenza nella finestra caricata.' }
    : { empty: 'No further departures in the loaded window.' }
  const busLabels = language === 'de' ? { departures: 'Busabfahrten', route: 'Linie', due: 'Zeit', stop: 'Haltestelle', empty: labels.empty }
    : language === 'fr' ? { departures: 'Départs des bus', route: 'Ligne', due: 'Heure', stop: 'Arrêt', empty: labels.empty }
    : language === 'it' ? { departures: 'Partenze autobus', route: 'Linea', due: 'Ora', stop: 'Fermata', empty: labels.empty } : { due: 'Time', empty: labels.empty }
  const supported = selectedStation.routes.some(route => ['international', 'intercity', 'interregio', 'regional-express', 's-bahn', 'regional', 'tram', 'metro', 'bus'].includes(route.category))
  if (snapshot && supported) return <section className="journey-card station-card station-hero-card" aria-label={text.routesServing(selectedStation.name)}>
    <StationDeparturesCard snapshot={snapshot} name={selectedStation.name} time={time} presentation="sbb" statusLabels={language === 'de' ? {cancelled:'Ausfall',adjusted:'Aktuell'} : language === 'fr' ? {cancelled:'Supprimé',adjusted:'Actualisé'} : language === 'it' ? {cancelled:'Soppresso',adjusted:'Aggiornato'} : {cancelled:'Cancelled',adjusted:'Updated'}} labels={labels} busLabels={busLabels} onSelect={onSelectTrain}
      note={<>{text.allScheduledPaths} · {fullDay ? text.fullDayStudy : text.morningStudy}{frequencyNote && <> · {frequencyNote}</>}</>} />
    <div className="network-count-row"><strong>{numberFormat.format(activeTrainCount)}</strong><span>{movementsLabel}</span></div>
    {onConnections && <button type="button" className="corridor-entry" onClick={onConnections}>{connectionsLabel} →</button>}
  </section>
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
