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
  airTrackSearchValue,
  searchAirTracks,
  type AirSearchTrack,
} from '../air-search.ts'
import {
  activeAirTracks,
  positionForAirTrack,
  type AirSnapshot,
  type AirTrack,
} from '../domain/air.ts'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  type NetworkRouteIndexEntry,
  type NetworkDayChunk,
  type NetworkDayChunkDescriptor,
  type NetworkDayManifest,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from '../domain/network.ts'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from '../domain/network-day.ts'
import {
  spatialLayoutCoverage,
  type SpatialLayoutSnapshot,
} from '../domain/spatial-layout.ts'
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
import { useProgressiveAirDay } from '../use-progressive-air-day.ts'

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

const LAYOUT_TRANSITION_DURATION_MS = 1_300
const LAYOUT_TRANSITION_STEPS = 24

type StudyWindow = 'morning' | 'day'

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
  | { readonly kind: 'air'; readonly value: AirSearchTrack }

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

async function verifiedDayChunk(
  response: Response,
  descriptor: NetworkDayChunkDescriptor,
): Promise<NetworkDayChunk> {
  const bytes = await response.arrayBuffer()
  if (descriptor.bytes !== undefined && bytes.byteLength !== descriptor.bytes) {
    throw new Error(`Day chunk ${descriptor.id} has an unexpected size`)
  }
  if (descriptor.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
    if (actual !== descriptor.sha256) {
      throw new Error(`Day chunk ${descriptor.id} failed its integrity check`)
    }
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as NetworkDayChunk
}

function searchChoices(
  query: string,
  snapshot: NetworkSnapshot,
  stations: readonly StationIndexEntry[],
  routes: readonly NetworkRouteIndexEntry[],
  aircraft: readonly AirSearchTrack[],
  time: number,
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
  const airMatches = searchAirTracks(aircraft, query, time, 5).map(
    (value): SearchChoice => ({ kind: 'air', value }),
  )

  return [...airMatches, ...stationMatches, ...routeMatches, ...trainMatches].slice(0, 9)
}

export function LondonStudyApp({ edition }: { readonly edition: LondonEdition }) {
  const [morningNetwork, setMorningNetwork] = useState<NetworkSnapshot>()
  const [studyWindow, setStudyWindow] = useState<StudyWindow>('morning')
  const [dayManifest, setDayManifest] = useState<NetworkDayManifest>()
  const [dayChunks, setDayChunks] = useState<
    Readonly<Record<string, NetworkDayChunk>>
  >({})
  const [dayError, setDayError] = useState(false)
  const [geography, setGeography] = useState<LondonGeographySnapshot>()
  const [loadError, setLoadError] = useState(false)
  const [time, setTime] = useState(edition.defaultNetworkTime)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(120)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>()
  const [selectedStation, setSelectedStation] = useState<StationIndexEntry>()
  const [selectedRoute, setSelectedRoute] = useState<NetworkRouteIndexEntry>()
  const [selectedTrain, setSelectedTrain] = useState<NetworkTrain>()
  const [airEnabled, setAirEnabled] = useState(false)
  const [airCategorySelected, setAirCategorySelected] = useState(false)
  const [morningAir, setMorningAir] = useState<AirSnapshot>()
  const [airLoadError, setAirLoadError] = useState(false)
  const [selectedAirTrackId, setSelectedAirTrackId] = useState<string>()
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [layout, setLayout] = useState<SpatialLayoutId>('geographic')
  const [spatialLayout, setSpatialLayout] = useState<SpatialLayoutSnapshot>()
  const [layoutLoading, setLayoutLoading] = useState(false)
  const [layoutError, setLayoutError] = useState(false)
  const [layoutMix, setLayoutMix] = useState(0)
  const [layoutTransitioning, setLayoutTransitioning] = useState(false)
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand>()
  const cameraCommandId = useRef(0)
  const layoutMixRef = useRef(0)
  const layoutFrameRef = useRef(0)
  const desiredLayoutRef = useRef<SpatialLayoutId>('geographic')
  const webglAvailable = useMemo(() => supportsWebGL(), [])
  const airDay = useProgressiveAirDay(
    edition.data.air.dayManifest,
    airEnabled && studyWindow === 'day',
    time,
  )

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
        setMorningNetwork(nextNetwork)
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

  const dayChunkDescriptor = useMemo(
    () => (dayManifest ? dayChunkForTime(dayManifest, time) : undefined),
    [dayManifest, time],
  )
  const activeDayChunk = dayChunkDescriptor
    ? dayChunks[dayChunkDescriptor.id]
    : undefined
  const dayLoading = studyWindow === 'day' && !dayError && !activeDayChunk
  const network = useMemo(
    () =>
      studyWindow === 'day' && dayManifest
        ? networkSnapshotForDayChunk(dayManifest, activeDayChunk)
        : morningNetwork,
    [activeDayChunk, dayManifest, morningNetwork, studyWindow],
  )

  useEffect(() => {
    if (studyWindow !== 'day' || dayManifest) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.opening.dayManifest), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Day manifest returned ${response.status}`)
        return response.json() as Promise<NetworkDayManifest>
      })
      .then(setDayManifest)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load the All Change day manifest', error)
        setDayError(true)
      })
    return () => controller.abort()
  }, [dayManifest, edition.data.opening.dayManifest, studyWindow])

  useEffect(() => {
    if (
      studyWindow !== 'day' ||
      !dayManifest ||
      !dayChunkDescriptor
    ) {
      return
    }
    const currentMissing = !dayChunks[dayChunkDescriptor.id]
    const targets = currentMissing
      ? [dayChunkDescriptor]
      : adjacentDayChunks(dayManifest, dayChunkDescriptor).filter(
          (descriptor) => !dayChunks[descriptor.id],
        )
    if (!targets.length) return
    const controller = new AbortController()
    Promise.all(
      targets.map(async (descriptor) => {
        const response = await fetch(editionDataUrl(descriptor.path), {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Day chunk returned ${response.status}`)
        return [descriptor.id, await verifiedDayChunk(response, descriptor)] as const
      }),
    )
      .then((entries) => {
        setDayChunks((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load an All Change day chunk', error)
        if (currentMissing) setDayError(true)
      })
    return () => controller.abort()
  }, [dayChunkDescriptor, dayChunks, dayManifest, studyWindow])

  useEffect(() => {
    if (!airEnabled || studyWindow === 'day' || morningAir) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.air.morning), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Air study returned ${response.status}`)
        return response.json() as Promise<AirSnapshot>
      })
      .then(setMorningAir)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load the All Change air study', error)
        setAirLoadError(true)
      })
    return () => controller.abort()
  }, [airEnabled, edition.data.air.morning, morningAir, studyWindow])

  const animateLayout = useCallback((target: number) => {
    cancelAnimationFrame(layoutFrameRef.current)
    const startMix = layoutMixRef.current
    if (target === startMix) {
      setLayoutTransitioning(false)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      layoutMixRef.current = target
      setLayoutMix(target)
      setLayoutTransitioning(false)
      if (selectedStation) {
        cameraCommandId.current += 1
        setCameraCommand({
          id: cameraCommandId.current,
          action: 'reveal-station',
        })
      }
      return
    }

    const startedAt = performance.now()
    setLayoutTransitioning(true)
    const animate = (now: number) => {
      const linear = Math.min(1, (now - startedAt) / LAYOUT_TRANSITION_DURATION_MS)
      const eased = linear * linear * (3 - 2 * linear)
      const stepped =
        Math.round(eased * LAYOUT_TRANSITION_STEPS) / LAYOUT_TRANSITION_STEPS
      const next = startMix + (target - startMix) * stepped
      if (next !== layoutMixRef.current) {
        layoutMixRef.current = next
        setLayoutMix(next)
      }
      if (linear < 1) {
        layoutFrameRef.current = requestAnimationFrame(animate)
      } else {
        layoutMixRef.current = target
        setLayoutMix(target)
        setLayoutTransitioning(false)
        if (selectedStation) {
          cameraCommandId.current += 1
          setCameraCommand({
            id: cameraCommandId.current,
            action: 'reveal-station',
          })
        }
      }
    }
    layoutFrameRef.current = requestAnimationFrame(animate)
  }, [selectedStation])

  useEffect(
    () => () => cancelAnimationFrame(layoutFrameRef.current),
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
  const activeAirSnapshot = studyWindow === 'day' ? airDay.snapshot : morningAir
  const searchableAircraft = useMemo<readonly AirSearchTrack[]>(
    () =>
      studyWindow === 'day'
        ? (airDay.manifest?.aircraft ?? [])
        : (activeAirSnapshot?.tracks ?? []),
    [activeAirSnapshot, airDay.manifest, studyWindow],
  )
  const choices = useMemo(
    () =>
      network
        ? searchChoices(
            query,
            network,
            stations,
            routes,
            airEnabled ? searchableAircraft : [],
            time,
          )
        : [],
    [airEnabled, network, query, routes, searchableAircraft, stations, time],
  )
  const selectedAirTrack = useMemo<AirTrack | undefined>(
    () =>
      activeAirSnapshot?.tracks.find(
        (track) => track.id === selectedAirTrackId,
      ),
    [activeAirSnapshot, selectedAirTrackId],
  )
  const selectedAirIndexEntry = useMemo<AirSearchTrack | undefined>(
    () =>
      searchableAircraft.find((track) => track.id === selectedAirTrackId),
    [searchableAircraft, selectedAirTrackId],
  )
  const selectedAirPosition = useMemo(
    () =>
      selectedAirTrack
        ? positionForAirTrack(selectedAirTrack, time)
        : undefined,
    [selectedAirTrack, time],
  )
  const activeAircraftCount = useMemo(
    () =>
      airEnabled && activeAirSnapshot
        ? activeAirTracks(activeAirSnapshot, time).length
        : 0,
    [activeAirSnapshot, airEnabled, time],
  )
  const airLoading =
    airEnabled &&
    !airLoadError &&
    !airDay.error &&
    (studyWindow === 'day' ? airDay.loading : !morningAir)

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

  const loadLayout = useCallback(async (artifact: string) => {
    setLayoutLoading(true)
    setLayoutError(false)
    try {
      const response = await fetch(editionDataUrl(artifact))
      if (!response.ok) throw new Error(`Layout returned ${response.status}`)
      const nextLayout = (await response.json()) as SpatialLayoutSnapshot
      if (!network) throw new Error('Opening network is not ready')
      const coverage = spatialLayoutCoverage(network, nextLayout)
      if (
        coverage.matchedStops !== coverage.totalStops ||
        coverage.matchedPaths !== coverage.totalPaths
      ) {
        throw new Error(
          `Diagram coverage ${coverage.matchedStops}/${coverage.totalStops} stops, ${coverage.matchedPaths}/${coverage.totalPaths} paths`,
        )
      }
      setSpatialLayout(nextLayout)
      if (desiredLayoutRef.current === 'diagram') animateLayout(1)
    } catch (error: unknown) {
      console.error('Unable to load the All Change diagram', error)
      setLayoutError(true)
      desiredLayoutRef.current = 'geographic'
      setLayout('geographic')
      animateLayout(0)
    } finally {
      setLayoutLoading(false)
    }
  }, [animateLayout, network])

  const activateLayout = useCallback((
    nextLayout: SpatialLayoutId,
    artifact?: string,
  ) => {
    desiredLayoutRef.current = nextLayout
    setLayout(nextLayout)
    if (nextLayout === 'geographic') {
      animateLayout(0)
    } else if (spatialLayout) {
      animateLayout(1)
    } else if (artifact && !layoutLoading) {
      void loadLayout(artifact)
    }
  }, [animateLayout, layoutLoading, loadLayout, spatialLayout])

  const clearSelection = useCallback(() => {
    setSelectedCategory(undefined)
    setSelectedStation(undefined)
    setSelectedRoute(undefined)
    setSelectedTrain(undefined)
    setSelectedAirTrackId(undefined)
    setAirCategorySelected(false)
    setQuery('')
    setSearchOpen(false)
  }, [])

  const activateStudyWindow = useCallback(
    (nextWindow: StudyWindow) => {
      if (nextWindow === studyWindow) return
      clearSelection()
      setDayError(false)
      setStudyWindow(nextWindow)
      if (nextWindow === 'morning') {
        setTime(edition.defaultNetworkTime)
      }
    },
    [clearSelection, edition.defaultNetworkTime, studyWindow],
  )

  const selectStation = useCallback(
    (station: StationIndexEntry) => {
      setSelectedStation(station)
      setSelectedRoute(undefined)
      setSelectedTrain(undefined)
      setSelectedAirTrackId(undefined)
      setAirCategorySelected(false)
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
        setSelectedAirTrackId(undefined)
        setAirCategorySelected(false)
        setQuery(choice.value.name)
        setSearchOpen(false)
      } else if (choice.kind === 'train') {
        setSelectedTrain(choice.value)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setSelectedAirTrackId(undefined)
        setAirCategorySelected(false)
        setQuery(`${choice.value.route} ${choice.value.shortName}`.trim())
        setSearchOpen(false)
      } else {
        const track = choice.value
        setTime((current) =>
          current >= track.start && current <= track.end
            ? current
            : Math.min(track.end, track.start + 10),
        )
        setSelectedAirTrackId(track.id)
        setSelectedTrain(undefined)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setAirCategorySelected(false)
        setQuery(airTrackSearchValue(track))
        setSearchOpen(false)
        setIsPlaying(true)
      }
    },
    [selectStation],
  )

  const toggleAirLayer = useCallback(() => {
    if (airEnabled) {
      setAirEnabled(false)
      setAirCategorySelected(false)
      setSelectedAirTrackId(undefined)
      return
    }
    clearSelection()
    setAirLoadError(false)
    setAirEnabled(true)
    activateLayout('geographic')
  }, [activateLayout, airEnabled, clearSelection])

  const selectAirTrack = useCallback(
    (trackId: string) => {
      const track =
        activeAirSnapshot?.tracks.find((candidate) => candidate.id === trackId) ??
        searchableAircraft.find((candidate) => candidate.id === trackId)
      if (!track) return
      setTime((current) =>
        current >= track.start && current <= track.end
          ? current
          : Math.min(track.end, track.start + 10),
      )
      setSelectedAirTrackId(track.id)
      setSelectedTrain(undefined)
      setSelectedRoute(undefined)
      setSelectedStation(undefined)
      setSelectedCategory(undefined)
      setAirCategorySelected(false)
      setQuery(airTrackSearchValue(track))
      setSearchOpen(false)
      setIsPlaying(true)
    },
    [activeAirSnapshot, searchableAircraft],
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
      } else if (event.key.toLowerCase() === 'd') {
        const diagram = edition.data.opening.layouts.find(
          (option) => option.id === 'diagram',
        )
        activateLayout(
          'diagram',
          diagram && 'artifact' in diagram ? diagram.artifact : undefined,
        )
      } else if (event.key.toLowerCase() === 'g') {
        activateLayout('geographic')
      } else if (event.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateLayout, clearSelection, edition.data.opening.layouts])

  const selectedDescription = selectedStation
    ? `${selectedStation.routes.length} lines · ${selectedStation.trainIds.length} calls`
    : selectedRoute
      ? `${selectedRoute.trainIds.length} journeys · ${selectedRoute.stopIndexes.length} stops`
      : selectedTrain
        ? `${formatServiceTime(selectedTrain.start)}–${formatServiceTime(selectedTrain.end)} · ${selectedTrain.headsign}`
        : selectedAirIndexEntry
          ? `${formatServiceTime(selectedAirIndexEntry.start)}–${formatServiceTime(selectedAirIndexEntry.end)} · ${(selectedAirIndexEntry.icaoAddress ?? selectedAirIndexEntry.id).toUpperCase()}`
        : undefined
  const scheduledJourneyCount =
    studyWindow === 'day' && dayManifest
      ? dayManifest.tripCount
      : network?.trains.length

  return (
    <main
      className={`experience view-network london-experience${airEnabled ? ' has-air-layer' : ''}${airCategorySelected ? ' has-air-category' : ''}${selectedStation || selectedRoute || selectedTrain || selectedAirTrackId || selectedCategory || airCategorySelected ? ' has-selection' : ''}`}
      data-spatial-layout={layout}
      data-study-window={studyWindow}
      data-day-loading={dayLoading}
      data-layout-mix={layoutMix.toFixed(3)}
      data-layout-transitioning={layoutTransitioning}
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
              airSnapshot={airEnabled ? activeAirSnapshot : undefined}
              airCategorySelected={airCategorySelected}
              selectedAirTrack={selectedAirTrack}
              onSelectAirTrack={selectAirTrack}
              cameraFraming={edition.mapFraming}
              spatialLayout={spatialLayout}
              spatialLayoutMix={layoutMix}
              layoutTransitioning={layoutTransitioning}
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
          <small>
            Rail study · {studyWindow === 'day' ? '24-hour Friday' : '06:45–08:45'}
          </small>
        </div>
      </header>

      <section className="london-layout-switch" aria-label="Spatial layout">
        {edition.data.opening.layouts.map((option) => {
          const artifact = 'artifact' in option ? option.artifact : undefined
          const available = option.id === 'geographic' || Boolean(artifact)
          const loading = option.id === 'diagram' && layoutLoading
          return (
            <button
              key={option.id}
              type="button"
              aria-label={`${option.label} layout`}
              aria-pressed={layout === option.id}
              aria-keyshortcuts={option.id === 'diagram' ? 'D' : 'G'}
              aria-busy={loading}
              disabled={!available || loading || !network}
              title={available ? option.label : `${option.label} layout is unavailable`}
              onClick={() => available && activateLayout(option.id, artifact)}
            >
              <span className="london-wide-label">{option.label}</span>
              <span className="london-mobile-label">
                {option.id === 'geographic' ? 'Geo' : 'Map'}
              </span>
              {loading && <small>Loading</small>}
            </button>
          )
        })}
        <span className="london-switch-divider" aria-hidden="true" />
        <button
          type="button"
          aria-label="Morning study"
          aria-pressed={studyWindow === 'morning'}
          onClick={() => activateStudyWindow('morning')}
        >
          <span className="london-wide-label">Morning</span>
          <span className="london-mobile-label">2H</span>
        </button>
        <button
          type="button"
          aria-label="24-hour study"
          aria-pressed={studyWindow === 'day'}
          aria-busy={studyWindow === 'day' && dayLoading}
          onClick={() => activateStudyWindow('day')}
        >
          <span className="london-wide-label">24 hours</span>
          <span className="london-mobile-label">24H</span>
          {studyWindow === 'day' && dayLoading && <small>Loading</small>}
        </button>
        <span className="london-switch-divider" aria-hidden="true" />
        <button
          className="london-air-toggle"
          type="button"
          aria-label={airEnabled ? 'Hide observed aircraft' : 'Show observed aircraft'}
          aria-pressed={airEnabled}
          aria-busy={airLoading}
          onClick={toggleAirLayer}
        >
          <span className="london-wide-label">Air</span>
          <span className="london-mobile-label">✦</span>
          {airLoading && <small>Loading</small>}
        </button>
        {layoutError && (
          <span className="london-layout-status" role="status">
            Diagram unavailable
          </span>
        )}
        {dayError && (
          <span className="london-day-status" role="status">
            Full day unavailable
          </span>
        )}
        {(airLoadError || airDay.error) && (
          <span className="london-air-status" role="status">
            Air study unavailable
          </span>
        )}
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
            <span className="sr-only">Find a London station, line, service or flight</span>
            <input
              type="search"
              value={query}
              placeholder={airEnabled ? "Find King's Cross, DLR, or flight" : "Find King's Cross, Victoria, or DLR"}
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
            aria-label="Matching stations, lines, services and flights"
          >
            {choices.map((choice, index) => {
              const label =
                choice.kind === 'air'
                  ? choice.value.callsign
                  : choice.kind === 'station'
                  ? choice.value.name
                  : choice.kind === 'route'
                    ? choice.value.name
                    : `${choice.value.route} ${choice.value.shortName}`.trim()
              const detail =
                choice.kind === 'air'
                  ? `AIR · ${(choice.value.icaoAddress ?? choice.value.id).toUpperCase()}`
                  : choice.kind === 'station'
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
                    {choice.kind === 'air' ? '◆' : choice.kind === 'station' ? '◎' : choice.kind === 'route' ? '━' : '●'}
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

      <section
        className={`london-status-card${selectedAirIndexEntry || airCategorySelected ? ' is-air-selection' : ''}`}
        aria-live="polite"
      >
        {loadError ? (
          <p>Opening study unavailable.</p>
        ) : network ? (
          <>
            <div>
              <strong>
                {selectedAirIndexEntry
                  ? selectedAirIndexEntry.callsign
                  : airCategorySelected
                    ? activeAircraftCount.toLocaleString('en-GB')
                    : activeTrainCount.toLocaleString('en-GB')}
              </strong>
              <span>{selectedAirIndexEntry || airCategorySelected ? 'aircraft observed' : 'trains in motion'}</span>
            </div>
            <p>
              {selectedAirPosition
                ? `Heading ${Math.round(selectedAirPosition.headingDegrees).toString().padStart(3, '0')}°`
                : selectedStation?.name ?? selectedRoute?.name ?? (selectedTrain ? `${selectedTrain.route} ${selectedTrain.shortName}` : airCategorySelected ? 'Observed London airspace' : studyWindow === 'day' ? '24-hour lattice' : 'Morning lattice')}
            </p>
            <small>
              {selectedAirPosition
                ? `${Math.round(selectedAirPosition.altitudeFeet / 100) * 100} ft · ${Math.round(selectedAirPosition.groundSpeedKnots)} kt · ${selectedDescription}`
                : selectedDescription ?? (airCategorySelected ? `${activeAircraftCount.toLocaleString('en-GB')} active at ${formatServiceTime(time)}` : `${scheduledJourneyCount?.toLocaleString('en-GB')} scheduled journeys`)}
            </small>
          </>
        ) : (
          <p>Drawing London…</p>
        )}
      </section>

      {network && (
        <section
          className={`london-service-legend service-legend${selectedCategory || airCategorySelected ? ' has-filter' : ''}`}
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
                setSelectedAirTrackId(undefined)
                setAirCategorySelected(false)
              }}
            >
              <i style={{ backgroundColor: SERVICE_COLORS[category.id] }} />
              {category.label}
            </button>
          ))}
          {airEnabled && (
            <button
              className="london-air-category"
              type="button"
              aria-pressed={airCategorySelected}
              title="Observed aircraft and ephemeral trails"
              style={{ '--service-accent': edition.theme.air } as CSSProperties}
              onClick={() => {
                setAirCategorySelected((value) => !value)
                setSelectedCategory(undefined)
                setSelectedStation(undefined)
                setSelectedRoute(undefined)
                setSelectedTrain(undefined)
                setSelectedAirTrackId(undefined)
              }}
            >
              <i style={{ backgroundColor: edition.theme.air }} />
              AIR
            </button>
          )}
        </section>
      )}

      <aside className="london-map-tools" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onClick={() => moveCamera('zoom-in')}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => moveCamera('zoom-out')}>−</button>
        <button type="button" aria-label="Reset map" onClick={() => moveCamera('reset')}>↺</button>
        <button
          type="button"
              aria-label={`Vehicle labels ${trainLabelMode}`}
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
            <span>
              {network.metadata.windowEnd === 86_400
                ? '24:00'
                : formatServiceTime(network.metadata.windowEnd)}
            </span>
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
            {(selectedStation || selectedRoute || selectedTrain || selectedAirTrackId || selectedCategory || airCategorySelected) && (
              <button type="button" onClick={clearSelection}>Release</button>
            )}
          </div>
        </section>
      )}

      <footer className="london-footer">
        <span>TfL timetable + ADS-B observation · not realtime</span>
        <span>GLA boundary + Thames · OGL v3.0</span>
      </footer>
    </main>
  )
}
