import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  type NetworkRouteIndexEntry,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from '../domain/network.ts'
import { editionDataUrl, type SpatialLayoutId } from '../editions/edition.ts'
import {
  londonBoundary,
  londonWater,
  type LondonGeographySnapshot,
} from '../editions/london-geography.ts'
import type { LondonEdition } from '../editions/london.ts'
import { motionStudyMark } from '../editions/catalogue.ts'
import { foldSearchText } from '../search-text.ts'
import type {
  MapCameraAction,
  MapCameraCommand,
} from '../scene/NationalNetworkScene.tsx'
import type { TrainLabelMode } from '../scene/train-labels.ts'
import { SERVICE_COLORS } from '../theme/visual-language.ts'

const NationalNetworkScene = lazy(() =>
  import('../scene/NationalNetworkScene.tsx').then(
    ({ NationalNetworkScene: Scene }) => ({ default: Scene }),
  ),
)

const PLAYBACK_RATES = [
  { label: '1×', value: 30 },
  { label: '4×', value: 120 },
  { label: '16×', value: 480 },
  { label: '64×', value: 1920 },
] as const

const LABEL_MODES: Readonly<Record<TrainLabelMode, TrainLabelMode>> = {
  auto: 'on',
  on: 'off',
  off: 'auto',
}

const LONDON_CATEGORIES: readonly {
  id: ServiceCategory
  label: string
  detail: string
}[] = [
  { id: 'metro', label: 'Tube · DLR', detail: 'Underground and light metro' },
  {
    id: 'regional',
    label: 'Elizabeth · Overground',
    detail: 'Cross-city and orbital rail',
  },
  { id: 'tram', label: 'Tramlink', detail: 'South London tram services' },
]

type SearchChoice =
  | { readonly kind: 'station'; readonly value: StationIndexEntry }
  | { readonly kind: 'route'; readonly value: NetworkRouteIndexEntry }
  | { readonly kind: 'train'; readonly value: NetworkTrain }

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function trainSearchText(train: NetworkTrain, snapshot: NetworkSnapshot): string {
  return foldSearchText(
    [
      train.route,
      train.shortName,
      train.headsign,
      ...train.stops.map(([index]) => snapshot.stops[index]?.[2] ?? ''),
    ].join(' '),
  )
}

function stationCentre(
  station: StationIndexEntry,
  snapshot: NetworkSnapshot,
): readonly [number, number] {
  const coordinates = station.stopIndexes
    .map((index) => snapshot.stops[index])
    .filter((stop) => stop !== undefined)
  const divisor = Math.max(1, coordinates.length)
  return [
    coordinates.reduce((sum, stop) => sum + stop[0], 0) / divisor,
    coordinates.reduce((sum, stop) => sum + stop[1], 0) / divisor,
  ]
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
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'route', value }))
  const trainMatches = snapshot.trains
    .filter((train) => trainSearchText(train, snapshot).includes(folded))
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'train', value }))

  return [...stationMatches, ...routeMatches, ...trainMatches].slice(0, 9)
}

export function LondonStudyApp({ edition }: { readonly edition: LondonEdition }) {
  const [network, setNetwork] = useState<NetworkSnapshot>()
  const [geography, setGeography] = useState<LondonGeographySnapshot>()
  const [loadError, setLoadError] = useState(false)
  const [time, setTime] = useState(edition.defaultNetworkTime)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(120)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>()
  const [selectedStation, setSelectedStation] = useState<StationIndexEntry>()
  const [selectedRoute, setSelectedRoute] = useState<NetworkRouteIndexEntry>()
  const [selectedTrain, setSelectedTrain] = useState<NetworkTrain>()
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [layout, setLayout] = useState<SpatialLayoutId>('geographic')
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand>()
  const cameraCommandId = useRef(0)
  const webglAvailable = useMemo(() => supportsWebGL(), [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(editionDataUrl(edition.data.opening.network), {
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) throw new Error(`Network returned ${response.status}`)
        return response.json() as Promise<NetworkSnapshot>
      }),
      fetch(editionDataUrl(edition.data.opening.geography), {
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) throw new Error(`Geography returned ${response.status}`)
        return response.json() as Promise<LondonGeographySnapshot>
      }),
    ])
      .then(([nextNetwork, nextGeography]) => {
        setNetwork(nextNetwork)
        setGeography(nextGeography)
        setTime(nextNetwork.metadata.focusTime)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load the All Change opening study', error)
        setLoadError(true)
      })
    return () => controller.abort()
  }, [edition.data.opening.geography, edition.data.opening.network])

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
  const activeTrainCount = useMemo(
    () =>
      network
        ? network.trains.reduce(
            (count, train) => count + Number(Boolean(positionForTrain(train, time))),
            0,
          )
        : 0,
    [network, time],
  )
  const boundary = useMemo(
    () => (geography ? londonBoundary(geography) : undefined),
    [geography],
  )
  const water = useMemo(
    () => (geography ? londonWater(geography) : undefined),
    [geography],
  )
  const availableCategories = useMemo(
    () =>
      LONDON_CATEGORIES.filter((category) =>
        network?.trains.some((train) => train.category === category.id),
      ),
    [network],
  )

  const moveCamera = useCallback(
    (
      action: MapCameraAction,
      focus?: readonly [longitude: number, latitude: number],
    ) => {
      cameraCommandId.current += 1
      setCameraCommand({ id: cameraCommandId.current, action, focus })
    },
    [],
  )

  const clearSelection = useCallback(() => {
    setSelectedCategory(undefined)
    setSelectedStation(undefined)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setQuery('')
    setSearchOpen(false)
  }, [])

  const selectStation = useCallback(
    (station: StationIndexEntry) => {
      setSelectedStation(station)
      setSelectedRoute(undefined)
      setSelectedTrain(undefined)
      setSelectedCategory(undefined)
      setQuery(station.name)
      setSearchOpen(false)
      if (network) {
        moveCamera('reveal-station', stationCentre(station, network))
      }
    },
    [moveCamera, network],
  )

  const activateChoice = useCallback(
    (choice: SearchChoice) => {
      if (choice.kind === 'station') {
        selectStation(choice.value)
      } else if (choice.kind === 'route') {
        setSelectedRoute(choice.value)
        setSelectedStation(undefined)
        setSelectedTrain(undefined)
        setSelectedCategory(undefined)
        setQuery(choice.value.name)
        setSearchOpen(false)
      } else {
        setSelectedTrain(choice.value)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setQuery(`${choice.value.route} ${choice.value.shortName}`.trim())
        setSearchOpen(false)
      }
    },
    [selectStation],
  )

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
      event.preventDefault()
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
      } else if (event.key.toLowerCase() === 'l') {
        setTrainLabelMode((value) => LABEL_MODES[value])
      } else if (event.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearSelection])

  const selectedDescription = selectedStation
    ? `${selectedStation.routes.length} lines · ${selectedStation.trainIds.length} calls`
    : selectedRoute
      ? `${selectedRoute.trainIds.length} journeys · ${selectedRoute.stopIndexes.length} stops`
      : selectedTrain
        ? `${formatServiceTime(selectedTrain.start)}–${formatServiceTime(selectedTrain.end)} · ${selectedTrain.headsign}`
        : undefined

  return (
    <main
      className={`experience view-network london-experience${selectedStation || selectedRoute || selectedTrain || selectedCategory ? ' has-selection' : ''}`}
    >
      <div className="scene" aria-hidden={webglAvailable ? true : undefined}>
        <Suspense fallback={null}>
          {!webglAvailable ? (
            <section className="no-webgl" role="status">
              <span aria-hidden="true">◎</span>
              <h2>This study needs WebGL</h2>
              <p>Open All Change in a browser with hardware-accelerated graphics.</p>
            </section>
          ) : network ? (
            <NationalNetworkScene
              boundary={boundary}
              lakes={water}
              snapshot={network}
              referenceSnapshot={network}
              stations={stations}
              trainLabelMode={trainLabelMode}
              isPlaying={isPlaying}
              time={time}
              selectedTrain={selectedTrain}
              onTime={setTime}
              cameraCommand={cameraCommand}
              playbackRate={playbackRate}
              selectedCategory={selectedCategory}
              selectedRoute={selectedRoute}
              selectedStation={selectedStation}
              onSelectStation={selectStation}
              cameraFraming="london"
            />
          ) : null}
        </Suspense>
      </div>
      <div className="atmosphere" />
      <div className="scanlines" />

      <header className="london-masthead">
        <div>
          <p className="eyebrow">{motionStudyMark(edition.identity)}</p>
          <h1>{edition.identity.title}</h1>
          <p className="london-tagline">London, geographically and otherwise.</p>
        </div>
        <div className="london-study-mark">
          <span>{edition.identity.descriptor}</span>
          <small>Rail study · 06:45–08:45</small>
        </div>
      </header>

      <section className="london-layout-switch" aria-label="Spatial layout">
        {edition.data.opening.layouts.map((option) => {
          const available = option.id === 'geographic' || Boolean(option.artifact)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={layout === option.id}
              disabled={!available}
              title={available ? option.label : `${option.label} layout is the next study`}
              onClick={() => available && setLayout(option.id)}
            >
              {option.label}
              {!available && <small>Next</small>}
            </button>
          )
        })}
      </section>

      <section className="london-search train-search">
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
            <span className="sr-only">Find a London station, line or service</span>
            <input
              type="search"
              value={query}
              placeholder="Find King's Cross, Victoria, or DLR"
              autoComplete="off"
              aria-controls="london-search-results"
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
          {query && (
            <button
              className="clear-search"
              type="button"
              aria-label="Clear search and selection"
              onClick={clearSelection}
            >
              ×
            </button>
          )}
        </form>
        {searchOpen && query.trim() && (
          <div
            id="london-search-results"
            className="search-results"
            role="listbox"
            aria-label="Matching stations, lines and services"
          >
            {choices.map((choice, index) => {
              const label =
                choice.kind === 'station'
                  ? choice.value.name
                  : choice.kind === 'route'
                    ? choice.value.name
                    : `${choice.value.route} ${choice.value.shortName}`.trim()
              const detail =
                choice.kind === 'station'
                  ? `${choice.value.routes.length} lines`
                  : choice.kind === 'route'
                    ? `${choice.value.trainIds.length} journeys`
                    : choice.value.headsign
              return (
                <button
                  key={`${choice.kind}:${choice.kind === 'station' ? choice.value.name : choice.value.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeSearchIndex}
                  className={index === activeSearchIndex ? 'is-active' : undefined}
                  onMouseEnter={() => setActiveSearchIndex(index)}
                  onClick={() => activateChoice(choice)}
                >
                  <span aria-hidden="true">
                    {choice.kind === 'station' ? '◎' : choice.kind === 'route' ? '━' : '●'}
                  </span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </button>
              )
            })}
            {choices.length === 0 && <p>No matching movement in this study.</p>}
          </div>
        )}
      </section>

      <section className="london-status-card" aria-live="polite">
        {loadError ? (
          <p>Opening study unavailable.</p>
        ) : network ? (
          <>
            <div>
              <strong>{activeTrainCount.toLocaleString('en-GB')}</strong>
              <span>trains in motion</span>
            </div>
            <p>{selectedStation?.name ?? selectedRoute?.name ?? (selectedTrain ? `${selectedTrain.route} ${selectedTrain.shortName}` : 'Morning lattice')}</p>
            <small>{selectedDescription ?? `${network.trains.length.toLocaleString('en-GB')} scheduled journeys`}</small>
          </>
        ) : (
          <p>Drawing London…</p>
        )}
      </section>

      {network && (
        <section
          className={`london-service-legend service-legend${selectedCategory ? ' has-filter' : ''}`}
          aria-label="Transport layers"
        >
          {availableCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={selectedCategory === category.id}
              title={category.detail}
              style={
                {
                  '--service-accent': SERVICE_COLORS[category.id],
                } as CSSProperties
              }
              onClick={() => {
                setSelectedCategory((value) =>
                  value === category.id ? undefined : category.id,
                )
                setSelectedStation(undefined)
                setSelectedRoute(undefined)
                setSelectedTrain(undefined)
              }}
            >
              <i style={{ backgroundColor: SERVICE_COLORS[category.id] }} />
              {category.label}
            </button>
          ))}
        </section>
      )}

      <aside className="london-map-tools" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onClick={() => moveCamera('zoom-in')}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => moveCamera('zoom-out')}>−</button>
        <button type="button" aria-label="Reset map" onClick={() => moveCamera('reset')}>↺</button>
        <button
          type="button"
          aria-label={`Train labels ${trainLabelMode}`}
          onClick={() => setTrainLabelMode((value) => LABEL_MODES[value])}
        >
          L·{trainLabelMode.slice(0, 1).toUpperCase()}
        </button>
      </aside>

      {network && (
        <section className="london-transport" aria-label="Playback controls">
          <div className="london-time-copy">
            <span>{formatServiceTime(network.metadata.windowStart)}</span>
            <strong>{formatServiceTime(time)}</strong>
            <span>{formatServiceTime(network.metadata.windowEnd)}</span>
          </div>
          <label>
            <span className="sr-only">Time of day</span>
            <input
              type="range"
              min={network.metadata.windowStart}
              max={network.metadata.windowEnd}
              step="10"
              value={time}
              onChange={(event) => setTime(Number(event.target.value))}
            />
          </label>
          <div className="london-playback-actions">
            <button
              type="button"
              aria-label={isPlaying ? 'Pause motion' : 'Resume motion'}
              onClick={() => setIsPlaying((value) => !value)}
            >
              {isPlaying ? 'Ⅱ' : '▶'}
            </button>
            <select
              aria-label="Playback speed"
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate.value} value={rate.value}>{rate.label}</option>
              ))}
            </select>
            {(selectedStation || selectedRoute || selectedTrain || selectedCategory) && (
              <button type="button" onClick={clearSelection}>Release</button>
            )}
          </div>
        </section>
      )}

      <footer className="london-footer">
        <span>TfL timetable study · not realtime</span>
        <span>GLA boundary + Thames · OGL v3.0</span>
      </footer>
    </main>
  )
}
