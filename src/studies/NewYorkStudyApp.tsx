import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  type NetworkRouteIndexEntry,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServicePatternPassEvent,
  type StationIndexEntry,
} from '../domain/network.ts'
import type { SpatialLayoutSnapshot } from '../domain/spatial-layout.ts'
import { editionDataUrl, type SpatialLayoutId } from '../editions/edition.ts'
import {
  newYorkBoundary,
  newYorkWater,
  type NewYorkGeographySnapshot,
} from '../editions/new-york-geography.ts'
import {
  LOCAL_EXPRESS_ROUTE_COLORS,
  type NewYorkEdition,
} from '../editions/new-york.ts'
import { motionStudyMark } from '../editions/catalogue.ts'
import { foldSearchText } from '../search-text.ts'
import { useProgressiveNetworkDay } from '../use-progressive-network-day.ts'
import type {
  MapCameraAction,
  MapCameraCommand,
} from '../scene/NationalNetworkScene.tsx'
import type { TrainLabelMode } from '../scene/train-labels.ts'

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

const TRANSITION_MS = 1_200

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

function formatWindowBoundary(time: number): string {
  return time === 86_400 ? '24:00' : formatServiceTime(time)
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

function stationForPass(
  event: ServicePatternPassEvent,
  snapshot: NetworkSnapshot,
  stations: readonly StationIndexEntry[],
): StationIndexEntry | undefined {
  const stationWithStop = (sourceStopId: string) =>
    stations.find((station) =>
      station.stopIndexes.some(
        (index) => snapshot.stops[index]?.[4] === sourceStopId,
      ),
    )
  // Frame the downstream shared station: this is where the reversal has
  // completed, and it keeps both vehicles clear of the upper search chrome.
  return stationWithStop(event.toStopId) ?? stationWithStop(event.fromStopId)
}

export function NewYorkStudyApp({ edition }: { readonly edition: NewYorkEdition }) {
  const [openingNetwork, setOpeningNetwork] = useState<NetworkSnapshot>()
  const [geography, setGeography] = useState<NewYorkGeographySnapshot>()
  const [loadError, setLoadError] = useState(false)
  const [time, setTime] = useState(edition.defaultNetworkTime)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(120)
  const [studyWindow, setStudyWindow] = useState<'morning' | 'day'>('morning')
  const [layout, setLayout] = useState<SpatialLayoutId>('geographic')
  const [layoutMix, setLayoutMix] = useState(0)
  const [layoutSnapshot, setLayoutSnapshot] = useState<SpatialLayoutSnapshot>()
  const [layoutLoading, setLayoutLoading] = useState(false)
  const [layoutTransitioning, setLayoutTransitioning] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [selectedStation, setSelectedStation] = useState<StationIndexEntry>()
  const [selectedRoute, setSelectedRoute] = useState<NetworkRouteIndexEntry>()
  const [selectedTrain, setSelectedTrain] = useState<NetworkTrain>()
  const [selectedPass, setSelectedPass] = useState<ServicePatternPassEvent>()
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [limitedChrome, setLimitedChrome] = useState(false)
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand>()
  const transitionFrame = useRef<number | undefined>(undefined)
  const webglAvailable = useMemo(() => supportsWebGL(), [])
  const dayStudy = useProgressiveNetworkDay(
    edition.data.opening.dayManifest,
    studyWindow === 'day',
    time,
  )
  const network =
    studyWindow === 'day'
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
        return response.json() as Promise<NewYorkGeographySnapshot>
      }),
    ])
      .then(([nextNetwork, nextGeography]) => {
        if (cancelled) return
        setOpeningNetwork(nextNetwork)
        setGeography(nextGeography)
        setTime(nextNetwork.metadata.focusTime)
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [edition])

  useEffect(
    () => () => {
      if (transitionFrame.current) cancelAnimationFrame(transitionFrame.current)
    },
    [],
  )

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
  const passEvents = useMemo(
    () =>
      (network?.metadata.servicePatternStudy?.passEvents ?? []).filter(
        (event) =>
          event.time >= (network?.metadata.windowStart ?? 0) &&
          event.time <= (network?.metadata.windowEnd ?? 0),
      ),
    [network],
  )
  const selectedPassTrains = useMemo(() => {
    if (!network || !selectedPass) return undefined
    return {
      local: network.trains.find((train) => train.id === selectedPass.localTrainId),
      express: network.trains.find((train) => train.id === selectedPass.expressTrainId),
    }
  }, [network, selectedPass])
  const selectedPassComparison = useMemo(
    () =>
      [selectedPassTrains?.local, selectedPassTrains?.express].filter(
        (train): train is NetworkTrain => Boolean(train),
      ),
    [selectedPassTrains],
  )
  const activeTrainCount = useMemo(
    () => network?.trains.filter((train) => time >= train.start && time <= train.end).length ?? 0,
    [network, time],
  )

  const boundary = useMemo(
    () => (geography ? newYorkBoundary(geography) : undefined),
    [geography],
  )
  const water = useMemo(
    () => (geography ? newYorkWater(geography) : undefined),
    [geography],
  )

  const moveCamera = useCallback((action: MapCameraAction) => {
    setCameraCommand((current) => ({ id: (current?.id ?? 0) + 1, action }))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedStation(undefined)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setSelectedPass(undefined)
    setQuery('')
    setSearchOpen(false)
  }, [])

  const activateStudyWindow = useCallback((next: 'morning' | 'day') => {
    if (next === studyWindow) return
    clearSelection()
    setStudyWindow(next)
    setTime(
      next === 'day'
        ? (dayStudy.manifest?.metadata.focusTime ?? time)
        : (openingNetwork?.metadata.focusTime ?? edition.defaultNetworkTime),
    )
  }, [clearSelection, dayStudy.manifest, edition.defaultNetworkTime, openingNetwork, studyWindow, time])

  const animateLayout = useCallback((target: number) => {
    if (transitionFrame.current) cancelAnimationFrame(transitionFrame.current)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLayoutMix(target)
      setLayoutTransitioning(false)
      return
    }
    setLayoutTransitioning(true)
    const start = performance.now()
    const from = layoutMix
    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / TRANSITION_MS)
      const eased = 0.5 - Math.cos(progress * Math.PI) / 2
      setLayoutMix(from + (target - from) * eased)
      if (progress < 1) transitionFrame.current = requestAnimationFrame(frame)
      else setLayoutTransitioning(false)
    }
    transitionFrame.current = requestAnimationFrame(frame)
  }, [layoutMix])

  const activateLayout = useCallback(async (next: SpatialLayoutId) => {
    if (next === layout && !layoutTransitioning) return
    if (next === 'diagram' && !layoutSnapshot) {
      setLayoutLoading(true)
      try {
        const option = edition.data.opening.layouts.find((candidate) => candidate.id === 'diagram')
        const artifact = option && 'artifact' in option ? option.artifact : undefined
        if (!artifact) throw new Error('Diagram unavailable')
        const response = await fetch(editionDataUrl(artifact))
        if (!response.ok) throw new Error('Diagram unavailable')
        setLayoutSnapshot(await response.json() as SpatialLayoutSnapshot)
      } finally {
        setLayoutLoading(false)
      }
    }
    setLayout(next)
    animateLayout(next === 'diagram' ? 1 : 0)
  }, [animateLayout, edition.data.opening.layouts, layout, layoutSnapshot, layoutTransitioning])

  const selectStation = useCallback((station: StationIndexEntry) => {
    setSelectedStation(station)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setSelectedPass(undefined)
    setQuery(station.name)
    setSearchOpen(false)
    moveCamera('reveal-station')
  }, [moveCamera])

  const activateChoice = useCallback((choice: SearchChoice) => {
    setSelectedPass(undefined)
    if (choice.kind === 'station') selectStation(choice.value)
    else if (choice.kind === 'route') {
      setSelectedRoute(choice.value)
      setSelectedStation(undefined)
      setSelectedTrain(undefined)
      setQuery(choice.value.name)
      setSearchOpen(false)
    } else {
      setSelectedTrain(choice.value)
      setSelectedStation(undefined)
      setSelectedRoute(undefined)
      setTime(Math.max(choice.value.start, Math.min(time, choice.value.end)))
      setQuery(`${choice.value.shortName} → ${choice.value.headsign}`)
      setSearchOpen(false)
    }
  }, [selectStation, time])

  const selectPattern = useCallback((pattern: 'local' | 'express') => {
    const route = routes.find((candidate) =>
      candidate.name.toLowerCase().endsWith(pattern),
    )
    setSelectedRoute((current) => current?.id === route?.id ? undefined : route)
    setSelectedStation(undefined)
    setSelectedTrain(undefined)
    setSelectedPass(undefined)
    setQuery('')
  }, [routes])

  const showNextPass = useCallback(() => {
    if (!network || passEvents.length === 0) return
    const event = passEvents.find((candidate) => candidate.time > time + 15) ?? passEvents[0]
    const station = stationForPass(event, network, stations)
    setSelectedPass(event)
    setSelectedStation(station)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setQuery('')
    setTime(event.time)
    setIsPlaying(false)
    setCameraCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      action: 'reveal-station',
      distanceScale: 0.42,
    }))
  }, [network, passEvents, stations, time])

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
      } else if (event.key.toLowerCase() === 'g') void activateLayout('geographic')
      else if (event.key.toLowerCase() === 'd') void activateLayout('diagram')
      else if (event.key.toLowerCase() === 'o') showNextPass()
      else if (event.key.toLowerCase() === 'f') setLimitedChrome((value) => !value)
      else if (event.key === 'Escape') {
        if (limitedChrome) setLimitedChrome(false)
        else clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateLayout, clearSelection, limitedChrome, showNextPass])

  const hasSelection = Boolean(selectedStation || selectedRoute || selectedTrain || selectedPass)
  const pattern = selectedRoute?.name.endsWith('Local')
    ? 'local'
    : selectedRoute?.name.endsWith('Express')
      ? 'express'
      : undefined

  return (
    <main
      className={`experience view-network new-york-experience${hasSelection ? ' has-selection' : ''}${limitedChrome ? ' is-limited-chrome' : ''}`}
      data-spatial-layout={layout}
      data-layout-mix={layoutMix.toFixed(3)}
      data-layout-transitioning={layoutTransitioning}
      data-limited-chrome={limitedChrome}
      data-comparison-count={selectedPassComparison.length}
      data-study-window={studyWindow}
      data-day-loading={dayStudy.loading}
    >
      <div className="scene" aria-hidden={webglAvailable ? true : undefined}>
        <Suspense fallback={null}>
          {!webglAvailable ? (
            <section className="no-webgl" role="status">
              <span aria-hidden="true">◉</span>
              <h2>This study needs WebGL</h2>
              <p>Open Local / Express in a browser with hardware-accelerated graphics.</p>
            </section>
          ) : network ? (
            <NationalNetworkScene
              boundary={boundary}
              lakes={water}
              snapshot={network}
              referenceSnapshot={openingNetwork ?? network}
              stations={stations}
              trainLabelMode={trainLabelMode}
              isPlaying={isPlaying}
              time={time}
              onTime={setTime}
              selectedTrain={selectedTrain}
              comparisonTrains={selectedPassComparison}
              comparisonColors={[
                LOCAL_EXPRESS_ROUTE_COLORS['Lexington Avenue Local'],
                LOCAL_EXPRESS_ROUTE_COLORS['Lexington Avenue Express'],
              ]}
              selectedRoute={selectedRoute}
              selectedStation={selectedStation}
              onSelectStation={selectStation}
              cameraCommand={cameraCommand}
              playbackRate={playbackRate}
              cameraFraming={edition.mapFraming}
              spatialLayout={layoutSnapshot}
              spatialLayoutMix={layoutMix}
              layoutTransitioning={layoutTransitioning}
              routeColors={LOCAL_EXPRESS_ROUTE_COLORS}
              routeColorMix={1}
            />
          ) : null}
        </Suspense>
      </div>
      <div className="atmosphere" />
      <div className="scanlines" />

      <header className="ny-masthead">
        <div>
          <p>{motionStudyMark(edition.identity)}</p>
          <h1><span>Local</span><i>/</i><span>Express</span></h1>
          <small>The same city, stopping differently.</small>
        </div>
        <aside>
          <span>A New York motion study</span>
          <small>Lexington Avenue · 07:00–09:00</small>
        </aside>
      </header>

      <nav className="ny-layout-switch" aria-label="Spatial layout">
        <button type="button" aria-pressed={layout === 'geographic'} onClick={() => void activateLayout('geographic')}>Geography</button>
        <button type="button" aria-pressed={layout === 'diagram'} aria-busy={layoutLoading} onClick={() => void activateLayout('diagram')}>{layoutLoading ? 'Drawing…' : 'Diagram'}</button>
      </nav>

      <nav className="ny-time-switch" aria-label="Study duration">
        <button type="button" aria-label="2-hour morning study" aria-pressed={studyWindow === 'morning'} onClick={() => activateStudyWindow('morning')}>2H</button>
        <button type="button" aria-label="24-hour study" aria-pressed={studyWindow === 'day'} aria-busy={dayStudy.loading} onClick={() => activateStudyWindow('day')}>{dayStudy.loading ? '…' : '24H'}</button>
      </nav>

      <section className="ny-search" aria-label="Find movement">
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
            <span className="sr-only">Find a station, pattern or train</span>
            <input
              type="search"
              value={query}
              placeholder="Find 86 St, local, or train 4"
              autoComplete="off"
              aria-controls="ny-search-results"
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
          {query && <button type="button" aria-label="Clear search" onClick={clearSelection}>×</button>}
        </form>
        {searchOpen && query.trim() && (
          <div id="ny-search-results" className="ny-search-results" role="listbox">
            {choices.map((choice, index) => {
              const label = choice.kind === 'station'
                ? choice.value.name
                : choice.kind === 'route'
                  ? choice.value.name
                  : `${choice.value.shortName} → ${choice.value.headsign}`
              const detail = choice.kind === 'station'
                ? 'STATION'
                : choice.kind === 'route'
                  ? `${choice.value.trainIds.length} SCHEDULED JOURNEYS`
                  : choice.value.servicePattern?.toUpperCase() ?? 'TRAIN'
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
            {choices.length === 0 && <p>No matching movement in this corridor.</p>}
          </div>
        )}
      </section>

      <section className={`ny-status${selectedPass ? ' is-pass' : ''}`} aria-live="polite">
        {loadError || dayStudy.error ? <p>Study unavailable.</p> : network ? (
          <>
            <div><strong>{activeTrainCount}</strong><span>trains in corridor</span></div>
            <p>{selectedPass
              ? `${selectedPassTrains?.express?.shortName ?? 'Express'} passes ${selectedPassTrains?.local?.shortName ?? '6'} local`
              : selectedStation?.name ?? selectedRoute?.name ?? (selectedTrain ? `${selectedTrain.shortName} → ${selectedTrain.headsign}` : 'Lexington Avenue')}</p>
            <small>{selectedPass
              ? `${network.stops.find((stop) => stop[4] === selectedPass.fromStopId)?.[2]} → ${network.stops.find((stop) => stop[4] === selectedPass.toStopId)?.[2]} · scheduled order reversal`
              : selectedStation
                ? `${selectedStation.trainIds.length} scheduled calls in study`
                : selectedRoute
                  ? `${selectedRoute.trainIds.length} journeys · ${selectedRoute.stopIndexes.length / 2} stations`
                  : selectedTrain
                    ? `${selectedTrain.servicePattern} · ${formatServiceTime(selectedTrain.start)}–${formatServiceTime(selectedTrain.end)}`
                    : `${studyWindow === 'day' ? (dayStudy.manifest?.tripCount ?? network.trains.length) : network.trains.length} scheduled journeys · not realtime`}</small>
          </>
        ) : <p>Drawing Manhattan…</p>}
      </section>

      <section className="ny-patterns" aria-label="Service pattern">
        <button type="button" aria-label="Local 6 — every stop" aria-pressed={pattern === 'local'} onClick={() => selectPattern('local')}><i /> Local <small>6 · every stop</small></button>
        <button type="button" aria-label="Express 4 and 5 — fewer stops" aria-pressed={pattern === 'express'} onClick={() => selectPattern('express')}><i /> Express <small>4 / 5 · fewer stops</small></button>
        <button className="ny-pass-button" type="button" aria-keyshortcuts="O" onClick={showNextPass}><i /> Next overtake <small>{passEvents.length} scheduled comparisons</small></button>
      </section>

      <aside className="ny-map-tools" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onClick={() => moveCamera('zoom-in')}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => moveCamera('zoom-out')}>−</button>
        <button type="button" aria-label="Reset map" onClick={() => moveCamera('reset')}>↺</button>
        <button type="button" aria-label={`Vehicle labels ${trainLabelMode}`} onClick={() => setTrainLabelMode((value) => value === 'off' ? 'auto' : 'off')}>L·{trainLabelMode === 'off' ? '0' : 'A'}</button>
      </aside>

      {network && (
        <section className="ny-transport" aria-label="Playback controls">
          <div><span>{formatWindowBoundary(network.metadata.windowStart)}</span><strong>{formatServiceTime(time)}</strong><span>{formatWindowBoundary(network.metadata.windowEnd)}</span></div>
          <label><span className="sr-only">Time of day</span><input type="range" min={network.metadata.windowStart} max={network.metadata.windowEnd} step="10" value={time} onChange={(event) => setTime(Number(event.target.value))} /></label>
          <aside>
            <button type="button" aria-label={isPlaying ? 'Pause motion' : 'Resume motion'} onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? 'Ⅱ' : '▶'}</button>
            <select aria-label="Playback speed" value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))}>{PLAYBACK_RATES.map((rate) => <option key={rate.value} value={rate.value}>{rate.label}</option>)}</select>
            <button type="button" aria-label={limitedChrome ? 'Exit limited chrome' : 'Enter limited chrome'} aria-pressed={limitedChrome} onClick={() => setLimitedChrome((value) => !value)}>{limitedChrome ? '×' : '⛶'}</button>
            {hasSelection && <button type="button" onClick={clearSelection}>Release</button>}
          </aside>
        </section>
      )}

      <footer className="ny-footer">
        <span>MTA scheduled GTFS · 04 Sep 2026 · {studyWindow === 'day' ? 'progressive 24H' : '07:00–09:00'} · not realtime</span>
        <span>Service-pattern comparison · no physical track claim</span>
      </footer>
    </main>
  )
}
