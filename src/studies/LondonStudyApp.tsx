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
  airportAirTrackIds,
  searchAirports,
  type StudyAirport,
} from '../domain/airport.ts'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  type NetworkRouteIndexEntry,
  type NetworkDayChunk,
  type NetworkDayManifest,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from '../domain/network.ts'
import {
  callsForHubFlowLens,
  callsAtHub,
  callsNearTime,
  hubFlowSummary,
  hubNightSignalMix,
  nextHubCall,
  type HubFlowLens,
} from '../domain/hub.ts'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from '../domain/network-day.ts'
import { mergeNetworkLayers } from '../domain/network-layers.ts'
import { reconstructedNationalVehicleCount } from '../domain/road-day.ts'
import type { RoadTopologySnapshot } from '../domain/road.ts'
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
import {
  ALL_CHANGE_ROUTE_COLORS,
  type LondonEdition,
} from '../editions/london.ts'
import { LONDON_AIRPORTS } from '../editions/london-airports.ts'
import {
  LONDON_HUBS,
  LONDON_PULSE_CENTRE,
  type LondonHubId,
} from '../editions/london-hubs.ts'
import {
  LONDON_MOTORWAYS,
  type LondonMotorway,
} from '../editions/london-motorways.ts'
import { motionStudyMark } from '../editions/catalogue.ts'
import { foldSearchText } from '../search-text.ts'
import {
  roadCorridorSearchValue,
  searchRoadCorridors,
} from '../road-search.ts'
import type {
  MapCameraAction,
  MapCameraCommand,
} from '../scene/NationalNetworkScene.tsx'
import type { TrainLabelMode } from '../scene/train-labels.ts'
import { SERVICE_COLORS } from '../theme/visual-language.ts'
import { useProgressiveAirDay } from '../use-progressive-air-day.ts'
import {
  useProgressiveNetworkDay,
  verifiedNetworkDayChunk,
} from '../use-progressive-network-day.ts'
import { useProgressiveRoadStudy } from '../use-progressive-road-study.ts'

const NationalNetworkScene = lazy(() =>
  import('../scene/NationalNetworkScene.tsx').then(
    ({ NationalNetworkScene: Scene }) => ({ default: Scene }),
  ),
)

const HubPulseScene = lazy(() =>
  import('../scene/HubPulseScene.tsx').then(({ HubPulseScene: Scene }) => ({
    default: Scene,
  })),
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
  { id: 'bus', label: 'Bus 26', detail: 'Route 26 and N26 night services' },
  { id: 'ferry', label: 'River', detail: 'Scheduled Thames river services' },
  { id: 'cableway', label: 'Cable', detail: 'London Cable Car cabins' },
]

type SearchChoice =
  | { readonly kind: 'airport'; readonly value: StudyAirport }
  | { readonly kind: 'road'; readonly value: LondonMotorway }
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

function formatStudyDate(serviceDate?: string): string {
  if (!serviceDate) return 'historical Friday'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${serviceDate}T12:00:00Z`))
}

function searchChoices(
  query: string,
  snapshot: NetworkSnapshot,
  stations: readonly StationIndexEntry[],
  routes: readonly NetworkRouteIndexEntry[],
  airports: readonly StudyAirport[],
  roads: readonly LondonMotorway[],
  aircraft: readonly AirSearchTrack[],
  time: number,
): readonly SearchChoice[] {
  const folded = foldSearchText(query.trim())
  if (!folded) return []
  const serviceQuery = folded.replace(/^(?:route|line)\s+/, '')

  const airportMatches = searchAirports(airports, query, 4).map(
    (value): SearchChoice => ({ kind: 'airport', value }),
  )
  const roadMatches = searchRoadCorridors(roads, query, 4).map(
    (value): SearchChoice => ({ kind: 'road', value }),
  )
  const stationMatches = stations
    .filter((station) => foldSearchText(station.name).includes(folded))
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'station', value }))
  const routeMatches = routes
    .filter((route) =>
      foldSearchText(`${route.name} ${route.headsigns.join(' ')}`).includes(
        serviceQuery,
      ),
    )
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'route', value }))
  const trainMatches = snapshot.trains
    .filter((train) => trainSearchText(train, snapshot).includes(serviceQuery))
    .slice(0, 5)
    .map((value): SearchChoice => ({ kind: 'train', value }))
  const airMatches = searchAirTracks(aircraft, query, time, 5).map(
    (value): SearchChoice => ({ kind: 'air', value }),
  )

  return [
    ...airportMatches,
    ...roadMatches,
    ...airMatches,
    ...stationMatches,
    ...routeMatches,
    ...trainMatches,
  ].slice(0, 9)
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
  const [selectedAirport, setSelectedAirport] = useState<StudyAirport>()
  const [roadEnabled, setRoadEnabled] = useState(false)
  const [roadCategorySelected, setRoadCategorySelected] = useState(false)
  const [selectedRoad, setSelectedRoad] = useState<LondonMotorway>()
  const [roadTopology, setRoadTopology] = useState<RoadTopologySnapshot>()
  const [roadLoadError, setRoadLoadError] = useState(false)
  const [surfaceEnabled, setSurfaceEnabled] = useState(false)
  const [surfaceNetwork, setSurfaceNetwork] = useState<NetworkSnapshot>()
  const [surfaceLoadError, setSurfaceLoadError] = useState(false)
  const [busEnabled, setBusEnabled] = useState(false)
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [limitedChrome, setLimitedChrome] = useState(false)
  const [pulseHubId, setPulseHubId] = useState<LondonHubId>()
  const [pulseLens, setPulseLens] = useState<HubFlowLens>('all')
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
  const roadDay = useProgressiveRoadStudy(
    edition.data.road.dayManifest,
    roadEnabled,
    time,
  )
  const busDay = useProgressiveNetworkDay(
    edition.data.bus.dayManifest,
    busEnabled,
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
  const baseNetwork = useMemo(
    () =>
      studyWindow === 'day' && dayManifest
        ? networkSnapshotForDayChunk(dayManifest, activeDayChunk)
        : morningNetwork,
    [activeDayChunk, dayManifest, morningNetwork, studyWindow],
  )
  const network = useMemo(() => {
    if (!baseNetwork) return undefined
    const layers = [baseNetwork]
    if (
      surfaceEnabled &&
      surfaceNetwork &&
      baseNetwork.metadata.windowStart === surfaceNetwork.metadata.windowStart &&
      baseNetwork.metadata.windowEnd === surfaceNetwork.metadata.windowEnd
    ) {
      layers.push(surfaceNetwork)
    }
    if (
      busEnabled &&
      busDay.chunkReady &&
      busDay.network &&
      baseNetwork.metadata.windowStart === busDay.network.metadata.windowStart &&
      baseNetwork.metadata.windowEnd === busDay.network.metadata.windowEnd
    ) {
      layers.push(busDay.network)
    }
    return layers.length === 1 ? baseNetwork : mergeNetworkLayers(layers)
  }, [
    baseNetwork,
    busDay.chunkReady,
    busDay.network,
    busEnabled,
    surfaceEnabled,
    surfaceNetwork,
  ])
  const pulseHub = pulseHubId
    ? LONDON_HUBS.find((hub) => hub.id === pulseHubId)
    : undefined
  const allPulseCalls = useMemo(
    () => (network && pulseHub ? callsAtHub(network, pulseHub) : []),
    [network, pulseHub],
  )
  const pulseSummary = useMemo(
    () => hubFlowSummary(allPulseCalls, LONDON_PULSE_CENTRE),
    [allPulseCalls],
  )
  const pulseCalls = useMemo(
    () => callsForHubFlowLens(allPulseCalls, pulseLens, LONDON_PULSE_CENTRE),
    [allPulseCalls, pulseLens],
  )
  const pulseNightMix = hubNightSignalMix(time)
  const nearbyPulseCalls = useMemo(
    () => callsNearTime(pulseCalls, time),
    [pulseCalls, time],
  )
  const upcomingPulseCall = useMemo(
    () => nextHubCall(pulseCalls, time),
    [pulseCalls, time],
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
        return [
          descriptor.id,
          await verifiedNetworkDayChunk(response, descriptor),
        ] as const
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

  useEffect(() => {
    if (!roadEnabled || roadTopology) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.road.topology), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Road topology returned ${response.status}`)
        return response.json() as Promise<RoadTopologySnapshot>
      })
      .then(setRoadTopology)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load the All Change road topology', error)
        setRoadLoadError(true)
      })
    return () => controller.abort()
  }, [edition.data.road.topology, roadEnabled, roadTopology])

  useEffect(() => {
    if (!surfaceEnabled || surfaceNetwork) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.surface.day), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Surface study returned ${response.status}`)
        return response.json() as Promise<NetworkSnapshot>
      })
      .then(setSurfaceNetwork)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load the All Change surface study', error)
        setSurfaceLoadError(true)
      })
    return () => controller.abort()
  }, [edition.data.surface.day, surfaceEnabled, surfaceNetwork])

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
  const displayedSelectedRoute = useMemo(
    () =>
      selectedRoute
        ? (routes.find(
            (route) =>
              route.name === selectedRoute.name &&
              route.category === selectedRoute.category,
          ) ?? selectedRoute)
        : undefined,
    [routes, selectedRoute],
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
        (category.id === 'bus' && busEnabled) ||
        network?.trains.some((train) => train.category === category.id),
      ),
    [busEnabled, network],
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
            LONDON_AIRPORTS,
            LONDON_MOTORWAYS,
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
  const selectedAirTelemetry = useMemo(
    () =>
      selectedAirTrack
        ? selectedAirPosition ??
          positionForAirTrack(
            selectedAirTrack,
            Math.max(selectedAirTrack.start, Math.min(selectedAirTrack.end, time)),
          )
        : undefined,
    [selectedAirPosition, selectedAirTrack, time],
  )
  const activeAircraftCount = useMemo(
    () =>
      airEnabled && activeAirSnapshot
        ? activeAirTracks(activeAirSnapshot, time).length
        : 0,
    [activeAirSnapshot, airEnabled, time],
  )
  const selectedAirportTrackIds = useMemo(
    () =>
      selectedAirport && activeAirSnapshot
        ? airportAirTrackIds(activeAirSnapshot.tracks, selectedAirport)
        : undefined,
    [activeAirSnapshot, selectedAirport],
  )
  const activeAirportAircraftCount = useMemo(
    () =>
      selectedAirportTrackIds && activeAirSnapshot
        ? activeAirTracks(activeAirSnapshot, time).reduce(
            (count, track) =>
              count + Number(selectedAirportTrackIds.has(track.id)),
            0,
          )
        : 0,
    [activeAirSnapshot, selectedAirportTrackIds, time],
  )
  const airLoading =
    airEnabled &&
    !airLoadError &&
    !airDay.error &&
    (studyWindow === 'day' ? airDay.loading : !morningAir)
  const reconstructedRoadVehicleCount = useMemo(
    () =>
      roadEnabled && roadDay.snapshot
        ? reconstructedNationalVehicleCount(
            roadDay.snapshot,
            time,
            selectedRoad?.id,
          )
        : 0,
    [roadDay.snapshot, roadEnabled, selectedRoad?.id, time],
  )
  const roadLoading =
    roadEnabled &&
    !roadLoadError &&
    !roadDay.error &&
    !roadDay.unavailable &&
    (!roadTopology || roadDay.loading)
  const surfaceLoading =
    surfaceEnabled &&
    !surfaceLoadError &&
    (!surfaceNetwork || studyWindow !== 'day' || !dayManifest || !activeDayChunk)
  const busLoading = busEnabled && busDay.loading
  const roadObservationDate = formatStudyDate(
    roadDay.manifest?.metadata.serviceDate,
  )

  const moveCamera = useCallback(
    (
      action: MapCameraAction,
      focus?: readonly [longitude: number, latitude: number],
      distanceScale?: number,
    ) => {
      cameraCommandId.current += 1
      setCameraCommand({
        id: cameraCommandId.current,
        action,
        focus,
        distanceScale,
      })
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
    setPulseHubId(undefined)
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
    setSelectedAirport(undefined)
    setSelectedRoad(undefined)
    setAirCategorySelected(false)
    setRoadCategorySelected(false)
    setPulseHubId(undefined)
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
        setSurfaceEnabled(false)
        setBusEnabled(false)
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
      setSelectedAirport(undefined)
      setSelectedRoad(undefined)
      setAirCategorySelected(false)
      setRoadCategorySelected(false)
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
      setPulseHubId(undefined)
      if (choice.kind === 'airport') {
        const airport = choice.value
        setSelectedAirport(airport)
        setAirEnabled(true)
        setAirLoadError(false)
        setAirCategorySelected(true)
        setSelectedAirTrackId(undefined)
        setSelectedTrain(undefined)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setSelectedRoad(undefined)
        setRoadCategorySelected(false)
        setQuery(`${airport.name} · ${airport.iata}`)
        setSearchOpen(false)
        activateLayout('geographic')
        moveCamera(
          'focus-location',
          [airport.longitude, airport.latitude],
          0.3,
        )
      } else if (choice.kind === 'station') {
        selectStation(choice.value)
      } else if (choice.kind === 'road') {
        const road = choice.value
        setRoadEnabled(true)
        setRoadLoadError(false)
        setRoadCategorySelected(true)
        setSelectedRoad(road)
        setAirCategorySelected(false)
        setSelectedAirport(undefined)
        setSelectedAirTrackId(undefined)
        setSelectedTrain(undefined)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setQuery(roadCorridorSearchValue(road))
        setSearchOpen(false)
        activateLayout('geographic')
        moveCamera('focus-location', road.focus, road.cameraScale)
      } else if (choice.kind === 'route') {
        setSelectedRoute(choice.value)
        setSelectedStation(undefined)
        setSelectedTrain(undefined)
        setSelectedCategory(undefined)
        setSelectedAirTrackId(undefined)
        setSelectedAirport(undefined)
        setSelectedRoad(undefined)
        setAirCategorySelected(false)
        setRoadCategorySelected(false)
        setQuery(choice.value.name)
        setSearchOpen(false)
      } else if (choice.kind === 'train') {
        setSelectedTrain(choice.value)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setSelectedAirTrackId(undefined)
        setSelectedAirport(undefined)
        setSelectedRoad(undefined)
        setAirCategorySelected(false)
        setRoadCategorySelected(false)
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
        setSelectedAirport(undefined)
        setSelectedRoad(undefined)
        setSelectedTrain(undefined)
        setSelectedRoute(undefined)
        setSelectedStation(undefined)
        setSelectedCategory(undefined)
        setAirCategorySelected(false)
        setRoadCategorySelected(false)
        setQuery(airTrackSearchValue(track))
        setSearchOpen(false)
        setIsPlaying(true)
      }
    },
    [activateLayout, moveCamera, selectStation],
  )

  const toggleAirLayer = useCallback(() => {
    if (airEnabled) {
      setAirEnabled(false)
      setAirCategorySelected(false)
      setSelectedAirTrackId(undefined)
      setSelectedAirport(undefined)
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
      setSelectedAirport(undefined)
      setSelectedRoad(undefined)
      setSelectedTrain(undefined)
      setSelectedRoute(undefined)
      setSelectedStation(undefined)
      setSelectedCategory(undefined)
      setAirCategorySelected(false)
      setRoadCategorySelected(false)
      setQuery(airTrackSearchValue(track))
      setSearchOpen(false)
      setIsPlaying(true)
    },
    [activeAirSnapshot, searchableAircraft],
  )

  const toggleRoadLayer = useCallback(() => {
    if (roadEnabled) {
      setRoadEnabled(false)
      setRoadCategorySelected(false)
      setSelectedRoad(undefined)
      return
    }
    clearSelection()
    setRoadLoadError(false)
    setRoadEnabled(true)
    activateLayout('geographic')
  }, [activateLayout, clearSelection, roadEnabled])

  const toggleSurfaceLayer = useCallback(() => {
    clearSelection()
    if (surfaceEnabled) {
      setSurfaceEnabled(false)
      return
    }
    setSurfaceLoadError(false)
    setDayError(false)
    setStudyWindow('day')
    setSurfaceEnabled(true)
    activateLayout('geographic')
  }, [activateLayout, clearSelection, surfaceEnabled])

  const toggleBusLayer = useCallback(() => {
    clearSelection()
    if (busEnabled) {
      setBusEnabled(false)
      return
    }
    setDayError(false)
    setStudyWindow('day')
    setBusEnabled(true)
    activateLayout('geographic')
    moveCamera(
      'focus-location',
      edition.data.bus.focus,
      edition.data.bus.cameraScale,
    )
  }, [
    activateLayout,
    busEnabled,
    clearSelection,
    edition.data.bus.cameraScale,
    edition.data.bus.focus,
    moveCamera,
  ])

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
        if (surfaceEnabled || busEnabled) return
        const diagram = edition.data.opening.layouts.find(
          (option) => option.id === 'diagram',
        )
        activateLayout(
          'diagram',
          diagram && 'artifact' in diagram ? diagram.artifact : undefined,
        )
      } else if (event.key.toLowerCase() === 'g') {
        activateLayout('geographic')
      } else if (event.key.toLowerCase() === 'p') {
        if (pulseHubId) setPulseHubId(undefined)
        else {
          clearSelection()
          setPulseHubId('kings-cross')
        }
      } else if (event.key.toLowerCase() === 'f') {
        setLimitedChrome((value) => !value)
      } else if (event.key === 'Escape') {
        if (limitedChrome) setLimitedChrome(false)
        else clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activateLayout,
    clearSelection,
    edition.data.opening.layouts,
    limitedChrome,
    pulseHubId,
    busEnabled,
    surfaceEnabled,
  ])

  const selectedDescription = selectedStation
    ? `${selectedStation.routes.length} lines · ${selectedStation.trainIds.length} calls`
    : displayedSelectedRoute
      ? `${displayedSelectedRoute.trainIds.length} journeys · ${displayedSelectedRoute.stopIndexes.length} stops`
      : selectedTrain
        ? `${formatServiceTime(selectedTrain.start)}–${formatServiceTime(selectedTrain.end)} · ${selectedTrain.headsign}`
        : selectedAirIndexEntry
          ? `${formatServiceTime(selectedAirIndexEntry.start)}–${formatServiceTime(selectedAirIndexEntry.end)} · ${(selectedAirIndexEntry.icaoAddress ?? selectedAirIndexEntry.id).toUpperCase()}`
          : selectedAirport
            ? `${activeAirportAircraftCount.toLocaleString('en-GB')} observed approaches + departures at ${formatServiceTime(time)}`
            : selectedRoad
              ? `${reconstructedRoadVehicleCount.toLocaleString('en-GB')} vehicles reconstructed at ${formatServiceTime(time)} · observed ${roadObservationDate}`
              : undefined
  const scheduledJourneyCount =
    studyWindow === 'day' && dayManifest
      ? dayManifest.tripCount +
        (surfaceEnabled ? (surfaceNetwork?.trains.length ?? 0) : 0) +
        (busEnabled ? (busDay.manifest?.tripCount ?? 0) : 0)
      : network?.trains.length

  return (
    <main
      className={`experience view-${pulseHub ? 'hub' : 'network'} london-experience${pulseHub ? ' is-pulse-study' : ''}${pulseHub && pulseNightMix > 0.5 ? ' is-pulse-night' : ''}${limitedChrome ? ' is-limited-chrome' : ''}${airEnabled ? ' has-air-layer' : ''}${airCategorySelected ? ' has-air-category' : ''}${selectedAirport ? ' has-airport-selection' : ''}${roadEnabled ? ' has-road-layer' : ''}${roadCategorySelected ? ' has-road-category' : ''}${surfaceEnabled ? ' has-surface-layer' : ''}${busEnabled ? ' has-bus-layer' : ''}${selectedStation || selectedRoute || selectedTrain || selectedAirTrackId || selectedAirport || selectedRoad || selectedCategory || airCategorySelected || roadCategorySelected ? ' has-selection' : ''}`}
      data-limited-chrome={limitedChrome}
      data-spatial-layout={layout}
      data-study-window={studyWindow}
      data-day-loading={dayLoading}
      data-layout-mix={layoutMix.toFixed(3)}
      data-layout-transitioning={layoutTransitioning}
      data-selected-airport={selectedAirport?.id}
      data-selected-road={selectedRoad?.id}
      data-surface-enabled={surfaceEnabled}
      data-bus-enabled={busEnabled}
      data-bus-loading={busLoading}
      data-pulse-lens={pulseHub ? pulseLens : undefined}
      data-pulse-night={pulseHub ? pulseNightMix.toFixed(2) : undefined}
    >
      <div className="scene" aria-hidden={webglAvailable ? true : undefined}>
        <Suspense fallback={null}>
          {!webglAvailable ? (
            <section className="no-webgl" role="status">
              <span aria-hidden="true">◎</span>
              <h2>This study needs WebGL</h2>
              <p>Open All Change in a browser with hardware-accelerated graphics.</p>
            </section>
          ) : network && pulseHub ? (
            <HubPulseScene
              timeline={network.metadata}
              hub={pulseHub}
              calls={pulseCalls}
              isPlaying={isPlaying}
              time={time}
              onTime={setTime}
              playbackRate={playbackRate}
              selectedCategory={selectedCategory}
              showTaktOverlay
              nightMix={pulseNightMix}
            />
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
              selectedRoute={displayedSelectedRoute}
              selectedStation={selectedStation}
              onSelectStation={selectStation}
              airSnapshot={airEnabled ? activeAirSnapshot : undefined}
              airCategorySelected={airCategorySelected}
              selectedAirTrack={selectedAirTrack}
              selectedAirport={selectedAirport}
              onSelectAirTrack={selectAirTrack}
              roadTopology={roadEnabled ? roadTopology : undefined}
              nationalRoadSnapshot={
                roadEnabled ? roadDay.snapshot : undefined
              }
              roadCategorySelected={roadCategorySelected}
              selectedRoadId={selectedRoad?.id}
              cameraFraming={edition.mapFraming}
              spatialLayout={spatialLayout}
              spatialLayoutMix={layoutMix}
              layoutTransitioning={layoutTransitioning}
              routeColors={ALL_CHANGE_ROUTE_COLORS}
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
            {surfaceEnabled || busEnabled ? 'Rail + surface' : 'Rail'} study · {studyWindow === 'day' ? '24-hour Friday' : '06:45–08:45'}
          </small>
        </div>
      </header>

      <section className="london-layout-switch" aria-label="Spatial layout">
        {edition.data.opening.layouts.map((option) => {
          const artifact = 'artifact' in option ? option.artifact : undefined
          const available =
            option.id === 'geographic' ||
            (Boolean(artifact) && !surfaceEnabled && !busEnabled)
          const loading = option.id === 'diagram' && layoutLoading
          return (
            <button
              key={option.id}
              type="button"
              aria-label={`${option.label} layout`}
              aria-pressed={!pulseHub && layout === option.id}
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
        <button
          className="london-pulse-toggle"
          type="button"
          aria-label={pulseHub ? 'Exit interchange pulse' : 'Interchange pulse'}
          aria-pressed={Boolean(pulseHub)}
          aria-keyshortcuts="P"
          disabled={!network}
          onClick={() => {
            if (pulseHub) setPulseHubId(undefined)
            else {
              clearSelection()
              setPulseHubId('kings-cross')
            }
          }}
        >
          <span className="london-wide-label">Pulse</span>
          <span className="london-mobile-label">◎</span>
        </button>
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
        <button
          className="london-road-toggle"
          type="button"
          aria-label={roadEnabled ? 'Hide reconstructed motorway traffic' : 'Show reconstructed motorway traffic'}
          aria-pressed={roadEnabled}
          aria-busy={roadLoading}
          onClick={toggleRoadLayer}
        >
          <span className="london-wide-label">Road</span>
          <span className="london-mobile-label">≋</span>
          {roadLoading && <small>Loading</small>}
        </button>
        <button
          className="london-bus-toggle"
          type="button"
          aria-label={busEnabled ? 'Hide route 26 buses' : 'Show route 26 buses'}
          aria-pressed={busEnabled}
          aria-busy={busLoading}
          onClick={toggleBusLayer}
        >
          <span className="london-wide-label">Bus</span>
          <span className="london-mobile-label">26</span>
          {busLoading && <small>Loading</small>}
        </button>
        <button
          className="london-surface-toggle"
          type="button"
          aria-label={surfaceEnabled ? 'Hide River Bus and cable car' : 'Show River Bus and cable car'}
          aria-pressed={surfaceEnabled}
          aria-busy={surfaceLoading}
          onClick={toggleSurfaceLayer}
        >
          <span className="london-wide-label">Surface</span>
          <span className="london-mobile-label">≈</span>
          {surfaceLoading && <small>Loading</small>}
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
        {(roadLoadError || roadDay.error || roadDay.unavailable) && (
          <span className="london-road-status" role="status">
            Road study unavailable
          </span>
        )}
        {surfaceLoadError && (
          <span className="london-surface-status" role="status">
            Surface study unavailable
          </span>
        )}
        {busDay.error && (
          <span className="london-bus-status" role="status">
            Bus study unavailable
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
            <span className="sr-only">Find a London station, line, service, airport, flight or motorway</span>
            <input
              type="search"
              value={query}
              placeholder={busEnabled ? 'Find route 26, N26, Bank, or Victoria' : surfaceEnabled ? 'Find RB6, Canary Wharf, or cable car' : airEnabled ? "Find Heathrow, M25, DLR, or flight" : "Find King's Cross, Heathrow, M25, or DLR"}
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
            aria-label="Matching stations, lines, services, airports, flights and motorways"
          >
            {choices.map((choice, index) => {
              const label =
                choice.kind === 'airport'
                  ? choice.value.name
                  : choice.kind === 'road'
                    ? roadCorridorSearchValue(choice.value)
                  : choice.kind === 'air'
                  ? choice.value.callsign
                  : choice.kind === 'station'
                  ? choice.value.name
                  : choice.kind === 'route'
                    ? choice.value.name
                    : `${choice.value.route} ${choice.value.shortName}`.trim()
              const detail =
                choice.kind === 'airport'
                  ? `AIRPORT · ${choice.value.iata} / ${choice.value.icao}`
                  : choice.kind === 'road'
                    ? 'MOTORWAY · OBSERVED FLOW'
                  : choice.kind === 'air'
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
                    {choice.kind === 'airport' ? '✦' : choice.kind === 'road' ? '≋' : choice.kind === 'air' ? '◆' : choice.kind === 'station' ? '◎' : choice.kind === 'route' ? '━' : '●'}
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
        className={`london-status-card${pulseHub ? ' is-pulse-selection' : ''}${selectedAirIndexEntry || selectedAirport || airCategorySelected ? ' is-air-selection' : ''}${selectedRoad || roadCategorySelected ? ' is-road-selection' : ''}`}
        aria-live="polite"
      >
        {pulseHub && (
          <>
            <label className="london-pulse-picker">
              <span>{pulseNightMix > 0.5 ? 'Night signal' : 'Interchange'}</span>
              <select
                aria-label="Pulse interchange"
                value={pulseHub.id}
                onChange={(event) => {
                  setPulseLens('all')
                  setPulseHubId(event.target.value as LondonHubId)
                }}
              >
                {LONDON_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className="london-pulse-lenses" role="group" aria-label="Pulse flow lens">
              {(['all', 'radial', 'orbital'] as const).map((lens) => (
                <button
                  key={lens}
                  type="button"
                  aria-label={`${lens} movements`}
                  aria-pressed={pulseLens === lens}
                  disabled={pulseSummary[lens] === 0}
                  onClick={() => setPulseLens(lens)}
                >
                  <span>{lens}</span>
                  <small>{pulseSummary[lens].toLocaleString('en-GB')}</small>
                </button>
              ))}
            </div>
          </>
        )}
        {loadError ? (
          <p>Opening study unavailable.</p>
        ) : network ? (
          <>
            <div>
              <strong>
                {pulseHub
                  ? nearbyPulseCalls.length.toLocaleString('en-GB')
                  : selectedRoad
                  ? selectedRoad.label
                  : roadCategorySelected
                    ? reconstructedRoadVehicleCount.toLocaleString('en-GB')
                  : selectedAirport
                  ? selectedAirport.iata
                  : selectedAirIndexEntry
                  ? selectedAirIndexEntry.callsign
                  : airCategorySelected
                    ? activeAircraftCount.toLocaleString('en-GB')
                    : activeTrainCount.toLocaleString('en-GB')}
              </strong>
              <span>{pulseHub ? pulseLens === 'all' ? 'movements in orbit' : `${pulseLens} movements` : selectedRoad ? 'motorway selected' : roadCategorySelected ? 'vehicles reconstructed' : selectedAirport ? 'airport movements' : selectedAirIndexEntry || airCategorySelected ? 'aircraft observed' : surfaceEnabled || busEnabled ? 'vehicles in motion' : 'trains in motion'}</span>
            </div>
            <p>
              {pulseHub
                ? pulseHub.displayName
                : selectedRoad
                ? selectedRoad.description
                : roadCategorySelected
                  ? 'London motorway flow'
              : selectedAirport
                ? selectedAirport.name
                : selectedAirTelemetry
                ? `Heading ${Math.round(selectedAirTelemetry.headingDegrees).toString().padStart(3, '0')}°`
                : selectedStation?.name ?? displayedSelectedRoute?.name ?? (selectedTrain ? `${selectedTrain.route} ${selectedTrain.shortName}` : airCategorySelected ? 'Observed London airspace' : studyWindow === 'day' ? '24-hour lattice' : 'Morning lattice')}
            </p>
            <small>
              {pulseHub
                ? `${pulseHub.character} · ${pulseCalls.length.toLocaleString('en-GB')} ${pulseLens === 'all' ? '' : `${pulseLens} `}calls in the loaded study`
                : selectedRoad || roadCategorySelected
                ? selectedDescription ?? `${reconstructedRoadVehicleCount.toLocaleString('en-GB')} reconstructed at ${formatServiceTime(time)} · observed ${roadObservationDate}`
                : selectedAirTelemetry
                ? `${Math.round(selectedAirTelemetry.altitudeFeet / 100) * 100} ft · ${Math.round(selectedAirTelemetry.groundSpeedKnots)} kt · ${selectedDescription}`
                : selectedDescription ?? (airCategorySelected ? `${activeAircraftCount.toLocaleString('en-GB')} active at ${formatServiceTime(time)}` : `${scheduledJourneyCount?.toLocaleString('en-GB')} scheduled journeys`)}
            </small>
            {pulseHub && upcomingPulseCall && (
              <small className="london-pulse-next">
                Next {formatServiceTime(upcomingPulseCall.arrival)} ·{' '}
                {upcomingPulseCall.train.route} → {upcomingPulseCall.train.headsign}
              </small>
            )}
          </>
        ) : (
          <p>Drawing London…</p>
        )}
      </section>

      {network && (
        <section
          className={`london-service-legend service-legend${selectedCategory || airCategorySelected || roadCategorySelected ? ' has-filter' : ''}`}
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
                setSelectedAirport(undefined)
                setSelectedRoad(undefined)
                setAirCategorySelected(false)
                setRoadCategorySelected(false)
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
                setSelectedAirport(undefined)
                setSelectedRoad(undefined)
                setRoadCategorySelected(false)
              }}
            >
              <i style={{ backgroundColor: edition.theme.air }} />
              AIR
            </button>
          )}
          {roadEnabled && (
            <button
              className="london-road-category"
              type="button"
              aria-pressed={roadCategorySelected}
              title="Observed motorway flow reconstructed as synthetic traffic"
              style={{ '--service-accent': edition.theme.roadHeavy } as CSSProperties}
              onClick={() => {
                setRoadCategorySelected((value) => !value)
                setSelectedCategory(undefined)
                setSelectedStation(undefined)
                setSelectedRoute(undefined)
                setSelectedTrain(undefined)
                setSelectedAirTrackId(undefined)
                setSelectedAirport(undefined)
                setSelectedRoad(undefined)
                setAirCategorySelected(false)
              }}
            >
              <i style={{ backgroundColor: edition.theme.roadHeavy }} />
              ROAD
            </button>
          )}
        </section>
      )}

      {!pulseHub && <aside className="london-map-tools" aria-label="Map controls">
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
      </aside>}

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
            <button
              className="london-cinema-toggle"
              type="button"
              aria-label={limitedChrome ? 'Exit limited chrome' : 'Enter limited chrome'}
              aria-pressed={limitedChrome}
              aria-keyshortcuts="F"
              title={limitedChrome ? 'Restore interface (F)' : 'Limited chrome (F)'}
              onClick={() => setLimitedChrome((value) => !value)}
            >
              <span className="london-wide-label">
                {limitedChrome ? 'Exit' : 'Focus'}
              </span>
              <span className="london-mobile-label">
                {limitedChrome ? '×' : '⛶'}
              </span>
            </button>
            {(selectedStation || selectedRoute || selectedTrain || selectedAirTrackId || selectedAirport || selectedRoad || selectedCategory || airCategorySelected || roadCategorySelected) && (
              <button type="button" onClick={clearSelection}>Release</button>
            )}
          </div>
        </section>
      )}

      <footer className="london-footer">
        <span>TfL timetable · ADS-B + WebTRIS observation · not realtime</span>
        <span>GLA boundary + Thames · OGL v3.0</span>
      </footer>
    </main>
  )
}
