import { formatServiceTime, type NetworkSnapshot, type NetworkTrain, type NetworkRouteIndexEntry, type StationIndexEntry, type ServiceCategory } from '@motionstudies/core/domain/network'
import type { RoadTopologyRoad } from '@motionstudies/core/domain/road'
import type { StudyAirport } from '@motionstudies/core/domain/airport'
import type { AirSearchTrack } from '@motionstudies/core/air-search'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import type { UiText } from '../locales/en.ts'
import { TransportIcon } from '../TransportIcon.tsx'
import { isHeadwayTrain } from './frequency.ts'

interface Props {
  stationSearchResults: readonly StationIndexEntry[]
  routeSearchResults: readonly NetworkRouteIndexEntry[]
  roadSearchResults: readonly RoadTopologyRoad[]
  airportSearchResults: readonly StudyAirport[]
  airSearchResults: readonly AirSearchTrack[]
  searchResults: readonly NetworkTrain[]
  resolvedActiveSearchIndex: number
  selectedStationName: string | undefined
  selectedRouteId: string | undefined
  selectedRoadId: string | undefined
  selectedAirport: StudyAirport | undefined
  selectedAirTrackId: string | undefined
  selectedTrainId: string | undefined
  airEnabled: boolean
  isCogwheel: boolean
  isMountainStudy: boolean
  isPostbus: boolean
  isNationalDay: boolean
  cogwheelCopy: { label: string }
  frequencyCopy: { label: string }
  categoryLabel: (category: ServiceCategory) => string
  serviceColors: Record<ServiceCategory, string>
  numberFormat: Intl.NumberFormat
  language: UiLanguage
  network: NetworkSnapshot | undefined
  text: UiText
  setActiveSearchIndex: (index: number) => void
  selectStation: (station: StationIndexEntry) => void
  selectRoute: (route: NetworkRouteIndexEntry) => void
  selectRoad: (road: RoadTopologyRoad) => void
  selectAirport: (airport: StudyAirport) => void
  selectAirTrack: (id: string) => void
  selectTrain: (train: NetworkTrain) => void
}

// Download result rendering only when a non-empty search opens. Keyboard
// selection and result ordering remain in the parent so lazy loading cannot reset them.
export default function SearchResults({ stationSearchResults, routeSearchResults, roadSearchResults, airportSearchResults, airSearchResults, searchResults, resolvedActiveSearchIndex, selectedStationName, selectedRouteId, selectedRoadId, selectedAirport, selectedAirTrackId, selectedTrainId, airEnabled, isCogwheel, isMountainStudy, isPostbus, isNationalDay, cogwheelCopy, frequencyCopy, categoryLabel, serviceColors, numberFormat, language, network, text, setActiveSearchIndex, selectStation, selectRoute, selectRoad, selectAirport, selectAirTrack, selectTrain }: Props) {
  return (
            <div
              id="train-search-results"
              className="search-results"
              role="listbox"
              aria-label={
                airEnabled ? text.matchingAirResults : text.matchingResults
              }
            >
              {stationSearchResults.map((station, index) => (
                <button
                  id={`train-search-result-${index}`}
                  className={`station-result${resolvedActiveSearchIndex === index ? ' is-active' : ''}`}
                  key={`station:${station.name}`}
                  type="button"
                  role="option"
                  aria-selected={station.name === selectedStationName}
                  onMouseEnter={() => setActiveSearchIndex(index)}
                  onClick={() => selectStation(station)}
                >
                  <span className="station-result-mark" aria-hidden="true">◎</span>
                  <span className="result-service">{station.name}</span>
                  <span className="result-route">
                    {text.routesAndCalls(
                      station.routes.length,
                      station.trainIds.length,
                    )}
                  </span>
                </button>
              ))}
              {routeSearchResults.map((route, routeIndex) => {
                const index = stationSearchResults.length + routeIndex
                return (
                  <button
                    id={`train-search-result-${index}`}
                    className={`route-result${resolvedActiveSearchIndex === index ? ' is-active' : ''}`}
                    key={route.id}
                    type="button"
                    role="option"
                    aria-selected={route.id === selectedRouteId}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectRoute(route)}
                  >
                    <TransportIcon mode={isCogwheel || isMountainStudy && route.category === 'other' ? 'cogwheel' : route.category} color={serviceColors[route.category]} />
                    <span className="result-service">
                      {isCogwheel ? cogwheelCopy.label : categoryLabel(route.category)} {route.name}
                    </span>
                    <span className="result-route">
                      {isPostbus && <>{route.headsigns.slice(0, 2).join(' / ')} · </>}
                      {numberFormat.format(route.trainIds.length)} {text.trips.toLocaleLowerCase(LANGUAGE_LOCALES[language])}
                      {' · '}
                      {numberFormat.format(route.stopIndexes.length)} {text.stops.toLocaleLowerCase(LANGUAGE_LOCALES[language])}
                    </span>
                  </button>
                )
              })}
              {roadSearchResults.map((road, roadIndex) => {
                const index =
                  stationSearchResults.length +
                  routeSearchResults.length +
                  roadIndex
                return (
                  <button
                    id={`train-search-result-${index}`}
                    className={`road-result${resolvedActiveSearchIndex === index ? ' is-active' : ''}`}
                    key={`road:${road.id}`}
                    type="button"
                    role="option"
                    aria-selected={road.id === selectedRoadId}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectRoad(road)}
                  >
                    <TransportIcon mode="road" color="#ffb36b" />
                    <span className="result-service">
                      {road.label}
                    </span>
                    <span className="result-route">
                      {text.wholeMotorway}
                      {road.description ? ` · ${road.description}` : ''}
                    </span>
                  </button>
                )
              })}
              {airportSearchResults.map((airport, airportIndex) => {
                const index = stationSearchResults.length + routeSearchResults.length +
                  roadSearchResults.length + airportIndex
                return (
                  <button
                    id={`train-search-result-${index}`}
                    className={`air-result${resolvedActiveSearchIndex === index ? ' is-active' : ''}`}
                    key={`airport:${airport.id}`}
                    type="button"
                    role="option"
                    aria-selected={airport.id === selectedAirport?.id}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectAirport(airport)}
                  >
                    <TransportIcon mode="air" color="#ff5edb" />
                    <span className="result-service">{airport.name}</span>
                    <span className="result-route">{airport.iata} · {airport.icao}</span>
                  </button>
                )
              })}
              {airSearchResults.map((track, airIndex) => {
                const index =
                  stationSearchResults.length +
                  routeSearchResults.length +
                  roadSearchResults.length +
                  airportSearchResults.length +
                  airIndex
                return (
                  <button
                    id={`train-search-result-${index}`}
                    className={`air-result${resolvedActiveSearchIndex === index ? ' is-active' : ''}`}
                    key={`air:${track.id}`}
                    type="button"
                    role="option"
                    aria-selected={track.id === selectedAirTrackId}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectAirTrack(track.id)}
                  >
                    <TransportIcon mode="air" color="#ff5edb" />
                    <span className="result-service">{track.callsign}</span>
                    <span className="result-route">
                      {text.luftraum} ·{' '}
                      {(track.icaoAddress ?? track.id).toUpperCase()} ·{' '}
                      {formatServiceTime(track.start)}–{formatServiceTime(track.end)}
                    </span>
                  </button>
                )
              })}
              {searchResults.map((train, trainIndex) => {
                  const origin = network?.stops[train.stops[0]?.[0]]?.[2]
                  const index =
                    stationSearchResults.length +
                    routeSearchResults.length +
                    roadSearchResults.length +
                    airportSearchResults.length +
                    airSearchResults.length +
                    trainIndex
                  return (
                    <button
                      id={`train-search-result-${index}`}
                      className={resolvedActiveSearchIndex === index ? 'is-active' : undefined}
                      key={train.id}
                      type="button"
                      role="option"
                      aria-selected={train.id === selectedTrainId}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onClick={() => selectTrain(train)}
                    >
                      <TransportIcon mode={isCogwheel || isMountainStudy && train.category === 'other' ? 'cogwheel' : train.category} color={serviceColors[train.category]} />
                      <span className="result-service">
                        {train.route} <b>{train.shortName}</b>
                      </span>
                      <span className="result-route">
                        {isHeadwayTrain(train) ? `${frequencyCopy.label} · ≈` : ''}{formatServiceTime(train.start)} · {origin} → {train.headsign}
                      </span>
                    </button>
                  )
                })}
              {!stationSearchResults.length &&
                !routeSearchResults.length &&
                !roadSearchResults.length &&
                !airportSearchResults.length &&
                !airSearchResults.length &&
                !searchResults.length && (
                <p>{isNationalDay || isMountainStudy ? text.noResultsDay : text.noResults}</p>
              )}
            </div>
  )
}
