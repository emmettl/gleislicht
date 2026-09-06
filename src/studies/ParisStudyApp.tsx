import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  type InterchangeComplex,
  type NetworkRouteIndexEntry,
  type NetworkSnapshot,
  type NetworkTrain,
  type StationIndexEntry,
} from '../domain/network.ts'
import { motionStudyMark } from '../editions/catalogue.ts'
import { editionDataUrl } from '../editions/edition.ts'
import {
  parisBoundary,
  parisReferences,
  parisWater,
  type ParisGeographySnapshot,
} from '../editions/paris-geography.ts'
import {
  CORRESPONDANCES_ROUTE_COLORS,
  type ParisEdition,
} from '../editions/paris.ts'
import type {
  MapCameraAction,
  MapCameraCommand,
} from '../scene/NationalNetworkScene.tsx'
import type { TrainLabelMode } from '../scene/train-labels.ts'
import { foldSearchText } from '../search-text.ts'
import { useProgressiveNetworkDay } from '../use-progressive-network-day.ts'

const NationalNetworkScene = lazy(() =>
  import('../scene/NationalNetworkScene.tsx').then(
    ({ NationalNetworkScene: Scene }) => ({ default: Scene }),
  ),
)

const PLAYBACK_RATES = [
  { label: '1×', value: 30 },
  { label: '4×', value: 120 },
  { label: '16×', value: 480 },
] as const

type SearchChoice =
  | { readonly kind: 'station'; readonly value: StationIndexEntry }
  | { readonly kind: 'route'; readonly value: NetworkRouteIndexEntry }
  | { readonly kind: 'train'; readonly value: NetworkTrain }

interface ConnectionOpportunity {
  readonly complex: InterchangeComplex
  readonly station: StationIndexEntry
  readonly incoming: NetworkTrain
  readonly outgoing: NetworkTrain
  readonly arrival: number
  readonly departure: number
  readonly minimumTransferSeconds: number
}

type ParisScaleView = 'centre' | 'region'

const PARIS_HUB_STUDIES = [
  {
    complexId: 'chatelet-les-halles',
    title: 'Cœur',
    description: 'densité Métro au centre',
    distanceScale: 0.16,
  },
  {
    complexId: 'gare-de-lyon',
    title: 'Traversée',
    description: 'échange Métro–RER est-ouest',
    distanceScale: 0.18,
  },
  {
    complexId: 'la-defense',
    title: 'Seuil',
    description: 'le réseau régional rencontre Paris',
    distanceScale: 0.2,
  },
] as const

function formatWindowBoundary(seconds: number): string {
  return seconds === 86_400 ? '24:00' : formatServiceTime(seconds)
}

function stationCoordinate(
  station: StationIndexEntry,
  snapshot: NetworkSnapshot,
): readonly [longitude: number, latitude: number] | undefined {
  const coordinates = station.stopIndexes.flatMap((index) => {
    const stop = snapshot.stops[index]
    return stop ? [[stop[0], stop[1]] as const] : []
  })
  if (!coordinates.length) return undefined
  return [
    coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0) /
      coordinates.length,
    coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
      coordinates.length,
  ]
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function searchChoices(
  query: string,
  snapshot: NetworkSnapshot,
  stations: readonly StationIndexEntry[],
  routes: readonly NetworkRouteIndexEntry[],
): readonly SearchChoice[] {
  const folded = foldSearchText(query.trim())
  if (!folded) return []
  const stationMatches = stations
    .filter((station) => foldSearchText(station.name).includes(folded))
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'station', value }))
  const routeMatches = routes
    .filter((route) =>
      foldSearchText(`${route.name} ${route.headsigns.join(' ')}`).includes(folded),
    )
    .slice(0, 2)
    .map((value): SearchChoice => ({ kind: 'route', value }))
  const trainMatches = snapshot.trains
    .filter((train) =>
      foldSearchText(`${train.shortName} ${train.route} ${train.headsign}`).includes(folded),
    )
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'train', value }))
  return [...stationMatches, ...routeMatches, ...trainMatches].slice(0, 8)
}

function stationForComplex(
  complex: InterchangeComplex,
  snapshot: NetworkSnapshot,
): StationIndexEntry {
  const stopIds = new Set(complex.stopIds)
  const stopIndexes = snapshot.stops.flatMap((stop, index) =>
    stop[4] && stopIds.has(stop[4]) ? [index] : [],
  )
  const trainIds = snapshot.trains.flatMap((train) =>
    train.stops.some((call) => stopIndexes.includes(call[0])) ? [train.id] : [],
  )
  const routeRecords = new Map<string, { name: string; category: NetworkTrain['category'] }>()
  for (const train of snapshot.trains) {
    if (!trainIds.includes(train.id)) continue
    routeRecords.set(train.route, { name: train.route, category: train.category })
  }
  return {
    name: complex.name,
    labelRank: 1,
    stopIndexes,
    trainIds,
    routes: [...routeRecords.values()],
  }
}

function nextConnection(
  snapshot: NetworkSnapshot,
  fromTime: number,
  complexId?: string,
): ConnectionOpportunity | undefined {
  const stopIndexById = new Map(
    snapshot.stops.flatMap((stop, index) => stop[4] ? [[stop[4], index] as const] : []),
  )
  const candidates: ConnectionOpportunity[] = []
  for (const complex of snapshot.metadata.interchangeStudy?.complexes ?? []) {
    if (complexId && complex.id !== complexId) continue
    const station = stationForComplex(complex, snapshot)
    for (const link of complex.links) {
      const fromIndex = stopIndexById.get(link.fromStopId)
      const toIndex = stopIndexById.get(link.toStopId)
      if (fromIndex === undefined || toIndex === undefined) continue
      const arrivals = snapshot.trains.flatMap((train) =>
        train.stops.flatMap((call) =>
          call[0] === fromIndex && call[1] >= fromTime
            ? [{ train, arrival: call[1] }]
            : [],
        ),
      )
      for (const arrival of arrivals) {
        const threshold = arrival.arrival + link.minimumTransferSeconds
        const departure = snapshot.trains
          .flatMap((train) =>
            train.id === arrival.train.id
              ? []
              : train.stops.flatMap((call) =>
                  call[0] === toIndex && call[2] >= threshold
                    ? [{ train, departure: call[2] }]
                    : [],
                ),
          )
          .sort((first, second) => first.departure - second.departure)[0]
        if (!departure) continue
        candidates.push({
          complex,
          station,
          incoming: arrival.train,
          outgoing: departure.train,
          arrival: arrival.arrival,
          departure: departure.departure,
          minimumTransferSeconds: link.minimumTransferSeconds,
        })
      }
    }
  }
  return candidates.sort(
    (first, second) => first.arrival - second.arrival || first.departure - second.departure,
  )[0]
}

export function ParisStudyApp({ edition }: { readonly edition: ParisEdition }) {
  const [openingNetwork, setOpeningNetwork] = useState<NetworkSnapshot>()
  const [geography, setGeography] = useState<ParisGeographySnapshot>()
  const [loadError, setLoadError] = useState(false)
  const [time, setTime] = useState(edition.defaultNetworkTime)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(120)
  const [studyWindow, setStudyWindow] = useState<'morning' | 'day'>('morning')
  const [scaleView, setScaleView] = useState<ParisScaleView>('region')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [selectedStation, setSelectedStation] = useState<StationIndexEntry>()
  const [selectedRoute, setSelectedRoute] = useState<NetworkRouteIndexEntry>()
  const [selectedTrain, setSelectedTrain] = useState<NetworkTrain>()
  const [selectedConnection, setSelectedConnection] = useState<ConnectionOpportunity>()
  const [activeHubStudyIndex, setActiveHubStudyIndex] = useState(-1)
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [limitedChrome, setLimitedChrome] = useState(false)
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand>()
  const webglAvailable = useMemo(() => supportsWebGL(), [])
  const dayStudy = useProgressiveNetworkDay(
    edition.data.opening.dayManifest,
    studyWindow === 'day',
    time,
  )
  const network = studyWindow === 'day'
    ? (dayStudy.network ?? openingNetwork)
    : openingNetwork

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(editionDataUrl(edition.data.opening.network)).then((response) => {
        if (!response.ok) throw new Error('Network unavailable')
        return response.json() as Promise<NetworkSnapshot>
      }),
      fetch(editionDataUrl(edition.data.opening.geography)).then((response) => {
        if (!response.ok) throw new Error('Geography unavailable')
        return response.json() as Promise<ParisGeographySnapshot>
      }),
    ])
      .then(([snapshot, geographySnapshot]) => {
        if (cancelled) return
        setOpeningNetwork(snapshot)
        setGeography(geographySnapshot)
        setTime(snapshot.metadata.focusTime)
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [edition])

  const stations = useMemo(
    () => (network ? buildStationIndex(network) : []),
    [network],
  )
  const routes = useMemo(
    () => (network ? buildRouteIndex(network) : []),
    [network],
  )
  const choices = useMemo(
    () => (network ? searchChoices(query, network, stations, routes) : []),
    [network, query, routes, stations],
  )
  const boundary = useMemo(
    () => (geography ? parisBoundary(geography) : undefined),
    [geography],
  )
  const water = useMemo(
    () => (geography ? parisWater(geography) : undefined),
    [geography],
  )
  const references = useMemo(
    () => (geography ? parisReferences(geography) : undefined),
    [geography],
  )
  const activeTrainCount = useMemo(
    () => network?.trains.filter((train) => time >= train.start && time <= train.end).length ?? 0,
    [network, time],
  )

  const moveCamera = useCallback((action: MapCameraAction) => {
    setCameraCommand((current) => ({ id: (current?.id ?? 0) + 1, action }))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedStation(undefined)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setSelectedConnection(undefined)
    setActiveHubStudyIndex(-1)
    setQuery('')
    setSearchOpen(false)
  }, [])

  const activateStudyWindow = useCallback((next: 'morning' | 'day') => {
    if (next === studyWindow) return
    clearSelection()
    setStudyWindow(next)
    setTime(
      next === 'day'
        ? time
        : (openingNetwork?.metadata.focusTime ?? edition.defaultNetworkTime),
    )
  }, [clearSelection, edition.defaultNetworkTime, openingNetwork, studyWindow, time])

  const toggleScaleView = useCallback(() => {
    if (!network) return
    if (scaleView === 'centre') {
      setScaleView('region')
      moveCamera('reset')
      return
    }
    const chatelet = stations.find((station) =>
      foldSearchText(station.name).includes('chatelet'),
    )
    const focus = chatelet && stationCoordinate(chatelet, network)
    if (!focus) return
    setScaleView('centre')
    setCameraCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      action: 'focus-location',
      focus,
      distanceScale: 0.16,
    }))
  }, [moveCamera, network, scaleView, stations])

  const selectStation = useCallback((station: StationIndexEntry) => {
    setActiveHubStudyIndex(-1)
    setSelectedStation(station)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setSelectedConnection(undefined)
    setQuery(station.name)
    setSearchOpen(false)
    setCameraCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      action: 'reveal-station',
      distanceScale: station.labelRank === 1 ? 0.22 : 0.32,
    }))
  }, [])

  const activateChoice = useCallback((choice: SearchChoice) => {
    setActiveHubStudyIndex(-1)
    setSelectedConnection(undefined)
    if (choice.kind === 'station') {
      selectStation(choice.value)
      return
    }
    setSelectedStation(undefined)
    setSearchOpen(false)
    if (choice.kind === 'route') {
      setSelectedRoute(choice.value)
      setSelectedTrain(undefined)
      setQuery(choice.value.name)
      moveCamera('reset')
      return
    }
    setSelectedTrain(choice.value)
    setSelectedRoute(undefined)
    setTime(Math.max(choice.value.start, Math.min(time, choice.value.end)))
    setQuery(`${choice.value.shortName} → ${choice.value.headsign}`)
  }, [moveCamera, selectStation, time])

  const selectRoute = useCallback((name: string) => {
    setActiveHubStudyIndex(-1)
    const route = routes.find((candidate) => candidate.name === name)
    setSelectedRoute((current) => current?.id === route?.id ? undefined : route)
    setSelectedStation(undefined)
    setSelectedTrain(undefined)
    setSelectedConnection(undefined)
    setQuery('')
    setSearchOpen(false)
    moveCamera('reset')
  }, [moveCamera, routes])

  const showNextConnection = useCallback(() => {
    if (!network) return
    const nextHubStudyIndex = (activeHubStudyIndex + 1) % PARIS_HUB_STUDIES.length
    const hubStudy = PARIS_HUB_STUDIES[nextHubStudyIndex]
    const connection =
      nextConnection(network, time + 15, hubStudy.complexId) ??
      nextConnection(network, network.metadata.windowStart, hubStudy.complexId)
    if (!connection) return
    setActiveHubStudyIndex(nextHubStudyIndex)
    setScaleView('centre')
    setSelectedConnection(connection)
    setSelectedStation(connection.station)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setQuery('')
    setSearchOpen(false)
    setTime(connection.arrival)
    setIsPlaying(false)
    setCameraCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      action: 'focus-location',
      focus: [connection.complex.longitude, connection.complex.latitude],
      distanceScale: hubStudy.distanceScale,
    }))
  }, [activeHubStudyIndex, network, time])

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSearchIndex((index) => Math.min(choices.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSearchIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const choice = choices[activeSearchIndex]
      if (choice) activateChoice(choice)
    } else if (event.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === ' ') {
        event.preventDefault()
        setIsPlaying((value) => !value)
      } else if (event.key.toLowerCase() === 'f') {
        setLimitedChrome((value) => !value)
      } else if (event.key === 'Escape') {
        if (limitedChrome) setLimitedChrome(false)
        else clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearSelection, limitedChrome])

  const hasSelection = Boolean(selectedStation || selectedRoute || selectedTrain || selectedConnection)
  const comparisonTrains = selectedConnection
    ? [selectedConnection.incoming, selectedConnection.outgoing]
    : []
  const comparisonColors = comparisonTrains.map(
    (train) => CORRESPONDANCES_ROUTE_COLORS[train.route] ?? edition.theme.primary,
  )
  const activeHubStudy = activeHubStudyIndex >= 0
    ? PARIS_HUB_STUDIES[activeHubStudyIndex]
    : undefined

  return (
    <main
      className={`experience view-network correspondances-experience${hasSelection ? ' has-selection' : ''}${limitedChrome ? ' is-limited-chrome' : ''}`}
      data-limited-chrome={limitedChrome}
      data-scale-view={scaleView}
    >
      <div className="scene" aria-hidden={webglAvailable ? true : undefined}>
        <Suspense fallback={null}>
          {!webglAvailable ? (
            <section className="no-webgl" role="status">
              <span aria-hidden="true">◉</span>
              <h2>Cette étude nécessite WebGL</h2>
              <p>Ouvrez Correspondances dans un navigateur avec accélération graphique.</p>
            </section>
          ) : network ? (
            <NationalNetworkScene
              boundary={scaleView === 'region' ? boundary : undefined}
              lakes={water}
              referencePaths={references}
              snapshot={network}
              referenceSnapshot={network}
              stations={stations}
              trainLabelMode={trainLabelMode}
              isPlaying={isPlaying}
              time={time}
              onTime={setTime}
              selectedTrain={selectedTrain}
              comparisonTrains={comparisonTrains}
              comparisonColors={comparisonColors}
              selectedRoute={selectedRoute}
              selectedStation={selectedStation}
              onSelectStation={selectStation}
              cameraCommand={cameraCommand}
              playbackRate={playbackRate}
              cameraFraming={edition.mapFraming}
              routeColors={CORRESPONDANCES_ROUTE_COLORS}
              routeColorMix={1}
              trafficOverviewEmphasis={scaleView === 'region' ? 1 : 0}
              stationLabelTierLimit={scaleView === 'region' ? 2 : 3}
              stationLabelSettleSeconds={0.42}
            />
          ) : null}
        </Suspense>
      </div>
      <div className="atmosphere" />
      <div className="scanlines" />

      <header className="paris-masthead">
        <div>
          <p>{motionStudyMark(edition.identity)}</p>
          <h1>Correspondances</h1>
          <small>Le centre respire; la région répond.</small>
        </div>
        <aside><span>A Paris motion study</span><small>Métro 1 · RER A · {studyWindow === 'day' ? '24 heures' : '07:00–09:00'}</small></aside>
      </header>

      <section className="paris-search" aria-label="Rechercher un mouvement">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            const choice = choices[activeSearchIndex]
            if (choice) activateChoice(choice)
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span className="search-mark" aria-hidden="true" />
          <label>
            <span className="sr-only">Rechercher une station, ligne ou mission</span>
            <input
              type="search"
              value={query}
              placeholder="Châtelet, RER A, ou QIWI90"
              autoComplete="off"
              aria-controls="paris-search-results"
              aria-expanded={searchOpen && choices.length > 0}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveSearchIndex(0)
                setSearchOpen(true)
              }}
              onKeyDown={onSearchKeyDown}
            />
          </label>
          {query && <button type="button" aria-label="Effacer" onClick={clearSelection}>×</button>}
          <nav className="paris-time-switch" aria-label="Durée de l’étude">
            <button type="button" aria-label="Étude du matin de deux heures" aria-pressed={studyWindow === 'morning'} onClick={() => activateStudyWindow('morning')}>2H</button>
            <button type="button" aria-label="Étude de vingt-quatre heures" aria-pressed={studyWindow === 'day'} aria-busy={dayStudy.loading} onClick={() => activateStudyWindow('day')}>{dayStudy.loading ? '…' : '24H'}</button>
            <button className="paris-scale-toggle" type="button" aria-label="Basculer entre le centre et la région" aria-pressed={scaleView === 'centre'} onClick={toggleScaleView}>{scaleView === 'centre' ? 'RÉGION' : 'CŒUR'}</button>
          </nav>
        </form>
        {searchOpen && query.trim() && (
          <div id="paris-search-results" className="paris-search-results" role="listbox">
            {choices.map((choice, index) => {
              const label = choice.kind === 'station'
                ? choice.value.name
                : choice.kind === 'route'
                  ? choice.value.name
                  : `${choice.value.shortName} → ${choice.value.headsign}`
              const detail = choice.kind === 'station'
                ? 'STATION'
                : choice.kind === 'route'
                  ? `${choice.value.trainIds.length} MISSIONS PLANIFIÉES`
                  : choice.value.route.toUpperCase()
              return (
                <button
                  key={`${choice.kind}:${choice.kind === 'station' ? choice.value.name : choice.value.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeSearchIndex}
                  onMouseEnter={() => setActiveSearchIndex(index)}
                  onClick={() => activateChoice(choice)}
                >
                  <strong>{label}</strong><small>{detail}</small>
                </button>
              )
            })}
            {choices.length === 0 && <p>Aucun mouvement dans cette étude.</p>}
          </div>
        )}
      </section>

      <section className="paris-status" aria-live="polite">
        {loadError || dayStudy.error ? <p>Étude indisponible.</p> : network ? (
          <>
            <div><strong>{activeTrainCount}</strong><span>trains en mouvement</span></div>
            <p>{selectedConnection?.complex.name ?? selectedStation?.name ?? selectedRoute?.name ?? (selectedTrain ? `${selectedTrain.shortName} → ${selectedTrain.headsign}` : scaleView === 'centre' ? 'Le cœur en détail' : 'Deux échelles, une ville')}</p>
            <small>{selectedConnection
              ? `${activeHubStudy?.description ?? 'correspondance planifiée'} · ${selectedConnection.incoming.route} → ${selectedConnection.outgoing.route} · ${Math.round((selectedConnection.departure - selectedConnection.arrival) / 60)} min disponibles · ${Math.round(selectedConnection.minimumTransferSeconds / 60)} min minimum publié`
              : selectedStation
              ? `${selectedStation.trainIds.length} passages planifiés dans l’étude`
              : selectedRoute
                ? `${selectedRoute.trainIds.length} missions · ${selectedRoute.stopIndexes.length} stations`
                : selectedTrain
                  ? `${selectedTrain.route} · ${formatServiceTime(selectedTrain.start)}–${formatServiceTime(selectedTrain.end)}`
                  : `${studyWindow === 'day' ? (dayStudy.manifest?.tripCount ?? network.trains.length) : network.trains.length} missions planifiées · pas de temps réel`}</small>
          </>
        ) : <p>Paris se dessine…</p>}
      </section>

      <nav className="paris-routes" aria-label="Lignes de l’étude">
        <button type="button" aria-pressed={selectedRoute?.name === 'Métro 1'} onClick={() => selectRoute('Métro 1')}><i /> Métro 1 <small>le centre</small></button>
        <button type="button" aria-pressed={selectedRoute?.name === 'RER A'} onClick={() => selectRoute('RER A')}><i /> RER A <small>la région</small></button>
        <button className="paris-connection-button" type="button" aria-label="Prochaine correspondance" onClick={showNextConnection}><i /> {activeHubStudy?.title ?? 'Correspondance'} <small>{activeHubStudy ? selectedConnection?.complex.name : '3 hubs · données IDFM'}</small></button>
      </nav>

      <aside className="paris-map-tools" aria-label="Contrôles de la carte">
        <button type="button" aria-label="Zoom avant" onClick={() => moveCamera('zoom-in')}>+</button>
        <button type="button" aria-label="Zoom arrière" onClick={() => moveCamera('zoom-out')}>−</button>
        <button type="button" aria-label="Réinitialiser la carte" onClick={() => moveCamera('reset')}>↺</button>
        <button type="button" aria-label={`Libellés ${trainLabelMode}`} onClick={() => setTrainLabelMode((value) => value === 'off' ? 'auto' : 'off')}>L·{trainLabelMode === 'off' ? '0' : 'A'}</button>
      </aside>

      {network && (
        <section className="paris-transport" aria-label="Lecture">
          <div><span>{formatWindowBoundary(network.metadata.windowStart)}</span><strong>{formatServiceTime(time)}</strong><span>{formatWindowBoundary(network.metadata.windowEnd)}</span></div>
          <label><span className="sr-only">Heure</span><input type="range" min={network.metadata.windowStart} max={network.metadata.windowEnd} step="10" value={time} onChange={(event) => setTime(Number(event.target.value))} /></label>
          <aside>
            <button type="button" aria-label={isPlaying ? 'Pause' : 'Lecture'} onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? 'Ⅱ' : '▶'}</button>
            <select aria-label="Vitesse" value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))}>{PLAYBACK_RATES.map((rate) => <option key={rate.value} value={rate.value}>{rate.label}</option>)}</select>
            <button type="button" aria-label={limitedChrome ? 'Afficher les commandes' : 'Plein écran'} aria-pressed={limitedChrome} onClick={() => setLimitedChrome((value) => !value)}>{limitedChrome ? '×' : '⛶'}</button>
            {hasSelection && <button type="button" onClick={clearSelection}>Libérer</button>}
          </aside>
        </section>
      )}

      <footer className="paris-footer">
        <span><a href="https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm" target="_blank" rel="noreferrer">IDFM GTFS</a> · <a href="https://opendata.paris.fr/explore/dataset/plan-de-voirie-voies-deau/" target="_blank" rel="noreferrer">Seine · Ville de Paris</a> · {studyWindow === 'day' ? 'progressive 24H' : '07:00–09:00'}</span>
        <span>Scheduled interpolation · <a href="https://www.iledefrance-mobilites.fr/medias/portail-idfm/4dc136f7-df23-449b-9670-24bc5254a706_RAA138.pdf" target="_blank" rel="noreferrer">Licence Mobilité</a> · water ODbL</span>
      </footer>
    </main>
  )
}
