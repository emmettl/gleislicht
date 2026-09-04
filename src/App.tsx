import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type {
  GleislichtSoundtrack,
  SoundtrackMode,
} from './audio/gleislicht-soundtrack.ts'
import { MobilePicker } from './components/MobilePicker.tsx'
import {
  callsAtHub,
  callsNearTime,
  HUBS,
  nextHubCall,
  platformCodeForCall,
  platformsForCalls,
  type HubDaySnapshot,
  type HubId,
} from './domain/hub.ts'
import { positionOnJourney, prototypeJourney } from './domain/journey.ts'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from './domain/network-day.ts'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  SERVICE_CATEGORIES,
  SERVICE_COLORS,
  type NetworkDayChunk,
  type NetworkDayManifest,
  type NetworkSnapshot,
  type NetworkRouteIndexEntry,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from './domain/network.ts'
import type { SwissBoundary } from './domain/boundary.ts'
import type { SwissLakes } from './domain/lakes.ts'
import {
  LANGUAGE_LOCALES,
  resolveUiLanguage,
  serviceCategoryLabel,
  UI_LANGUAGES,
  UI_TEXT,
  type UiLanguage,
} from './i18n.ts'
import {
  NationalNetworkScene,
  type MapCameraAction,
  type MapCameraCommand,
} from './scene/NationalNetworkScene.tsx'
import type { TrainLabelMode } from './scene/train-labels.ts'
import {
  nextSearchResultIndex,
  type SearchNavigationKey,
} from './search-navigation.ts'
import { foldSearchText } from './search-text.ts'
import { useProgressiveNetworkDay } from './use-progressive-network-day.ts'

const GleislichtScene = lazy(() =>
  import('./scene/GleislichtScene.tsx').then(({ GleislichtScene: Scene }) => ({
    default: Scene,
  })),
)
const HubPulseScene = lazy(() =>
  import('./scene/HubPulseScene.tsx').then(({ HubPulseScene: Scene }) => ({
    default: Scene,
  })),
)
const StationFlowScene = lazy(() =>
  import('./scene/StationFlowScene.tsx').then(({ StationFlowScene: Scene }) => ({
    default: Scene,
  })),
)

type View = 'network' | 'hub' | 'journey'
type SoundtrackState = 'off' | 'starting' | 'on' | 'error'
type NetworkStudy =
  | 'national'
  | 'zvv-region'
  | 'geneva-tpg'
  | 'zurich-city'
  | 'contrast'
type NationalTimeRange = 'morning' | 'day'
type HubStudy = 'pulse' | 'station'

const SOUNDTRACK_TITLES: Record<SoundtrackMode, string> = {
  network: 'Night Grid',
  hub: 'Taktwerk',
  journey: 'Valley Signal',
}

const NEXT_TRAIN_LABEL_MODE: Readonly<Record<TrainLabelMode, TrainLabelMode>> = {
  auto: 'on',
  on: 'off',
  off: 'auto',
}

const LANGUAGE_STORAGE_KEY = 'gleislicht-language'
const PLAYBACK_RATES = [
  { label: '1×', value: 30 },
  { label: '4×', value: 120 },
  { label: '16×', value: 480 },
  { label: '64×', value: 1920 },
] as const

const DAY_PRESETS = [
  { id: 'dawn', time: 5 * 3600 + 30 * 60 },
  { id: 'rush', time: 7 * 3600 + 45 * 60 },
  { id: 'noon', time: 12 * 3600 },
  { id: 'evening', time: 17 * 3600 + 15 * 60 },
  { id: 'night', time: 22 * 3600 + 30 * 60 },
] as const

function initialUiLanguage(): UiLanguage {
  let savedLanguage: string | null = null
  try {
    savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // A blocked storage API should not prevent the interface from loading.
  }
  return resolveUiLanguage([savedLanguage, ...navigator.languages])
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatTimelineBoundary(value: number): string {
  return value === 24 * 3600 ? '24:00' : formatServiceTime(value)
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function trainSearchText(
  train: NetworkTrain,
  network: NetworkSnapshot,
): string {
  const stopNames = train.stops.map(
    ([stopIndex]) => network.stops[stopIndex]?.[2] ?? '',
  )
  return foldSearchText(
    [train.route, train.shortName, train.headsign, ...stopNames].join(' '),
  )
}

export function App() {
  const [webglAvailable] = useState(supportsWebGL)
  const [language, setLanguage] = useState<UiLanguage>(initialUiLanguage)
  const [isPlaying, setIsPlaying] = useState(true)
  const [view, setView] = useState<View>('network')
  const [journeyProgress, setJourneyProgress] = useState(0.11)
  const [networkTime, setNetworkTime] = useState(7 * 3600 + 45 * 60)
  const [hubTime, setHubTime] = useState(7 * 3600 + 45 * 60)
  const [networkStudy, setNetworkStudy] = useState<NetworkStudy>('national')
  const [nationalTimeRange, setNationalTimeRange] =
    useState<NationalTimeRange>('morning')
  const [nationalNetwork, setNationalNetwork] = useState<NetworkSnapshot>()
  const [nationalDayManifest, setNationalDayManifest] =
    useState<NetworkDayManifest>()
  const [nationalDayChunks, setNationalDayChunks] = useState<
    Readonly<Record<string, NetworkDayChunk>>
  >({})
  const [nationalDayLoading, setNationalDayLoading] = useState(false)
  const [nationalDayError, setNationalDayError] = useState(false)
  const [zurichCityNetwork, setZurichCityNetwork] = useState<NetworkSnapshot>()
  const [zvvRegionNetwork, setZvvRegionNetwork] = useState<NetworkSnapshot>()
  const [genevaTpgNetwork, setGenevaTpgNetwork] = useState<NetworkSnapshot>()
  const [regionalNetworkLoading, setRegionalNetworkLoading] = useState(false)
  const [regionalNetworkError, setRegionalNetworkError] = useState(false)
  const [boundary, setBoundary] = useState<SwissBoundary>()
  const [lakes, setLakes] = useState<SwissLakes>()
  const [hubDay, setHubDay] = useState<HubDaySnapshot>()
  const [dataError, setDataError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [selectedTrainId, setSelectedTrainId] = useState<string>()
  const [selectedStationName, setSelectedStationName] = useState<string>()
  const [selectedRouteId, setSelectedRouteId] = useState<string>()
  const [selectedHubId, setSelectedHubId] = useState<HubId>('zurich')
  const [hubStudy, setHubStudy] = useState<HubStudy>('pulse')
  const [mapCameraCommand, setMapCameraCommand] = useState<MapCameraCommand>({
    id: 0,
    action: 'reset',
  })
  const [playbackRate, setPlaybackRate] = useState(120)
  const [directorMode, setDirectorMode] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>()
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [soundtrackState, setSoundtrackState] = useState<SoundtrackState>('off')
  const [soundtrackVolume, setSoundtrackVolume] = useState(0.56)
  const soundtrackRef = useRef<GleislichtSoundtrack | null>(null)
  const mobileMapToolsRef = useRef<HTMLDetailsElement>(null)
  const searchInteractionRef = useRef(false)
  const timelineTimeRef = useRef(networkTime)
  const text = UI_TEXT[language]
  const isContrast = networkStudy === 'contrast'
  const zurichContrast = useProgressiveNetworkDay(
    'zurich-tram-day-manifest.json',
    isContrast,
    networkTime,
  )
  const kientalContrast = useProgressiveNetworkDay(
    'kiental-postbus-day-manifest.json',
    isContrast,
    networkTime,
  )
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(LANGUAGE_LOCALES[language]),
    [language],
  )
  const nationalDayChunkDescriptor = useMemo(
    () =>
      nationalDayManifest
        ? dayChunkForTime(nationalDayManifest, networkTime)
        : undefined,
    [nationalDayManifest, networkTime],
  )
  const nationalDayNetwork = useMemo(
    () =>
      nationalDayManifest
        ? networkSnapshotForDayChunk(
            nationalDayManifest,
            nationalDayChunkDescriptor
              ? nationalDayChunks[nationalDayChunkDescriptor.id]
              : undefined,
          )
        : undefined,
    [nationalDayChunkDescriptor, nationalDayChunks, nationalDayManifest],
  )
  const nationalDayChunkReady = Boolean(
    nationalDayChunkDescriptor &&
      nationalDayChunks[nationalDayChunkDescriptor.id],
  )
  const network =
    isContrast
      ? (zurichContrast.network ?? nationalNetwork)
      : networkStudy === 'zurich-city'
      ? (zurichCityNetwork ?? nationalNetwork)
      : networkStudy === 'zvv-region'
        ? (zvvRegionNetwork ?? nationalNetwork)
        : networkStudy === 'geneva-tpg'
          ? (genevaTpgNetwork ?? nationalNetwork)
          : nationalTimeRange === 'day'
            ? (nationalDayNetwork ?? nationalNetwork)
            : nationalNetwork

  const soundtrackMode: SoundtrackMode =
    view === 'hub' ? 'hub' : view === 'journey' || selectedTrainId ? 'journey' : 'network'

  const journeyPosition = useMemo(
    () => positionOnJourney(prototypeJourney, journeyProgress),
    [journeyProgress],
  )
  const activeTrainCount = useMemo(
    () =>
      network?.trains.reduce(
        (count, train) =>
          train.start <= networkTime && train.end >= networkTime ? count + 1 : count,
        0,
      ) ?? 0,
    [network, networkTime],
  )
  const zurichContrastActiveCount = useMemo(
    () =>
      zurichContrast.network?.trains.reduce(
        (count, train) =>
          train.start <= networkTime && train.end >= networkTime
            ? count + 1
            : count,
        0,
      ) ?? 0,
    [networkTime, zurichContrast.network],
  )
  const kientalContrastActiveCount = useMemo(
    () =>
      kientalContrast.network?.trains.reduce(
        (count, train) =>
          train.start <= networkTime && train.end >= networkTime
            ? count + 1
            : count,
        0,
      ) ?? 0,
    [kientalContrast.network, networkTime],
  )
  const zurichContrastStations = useMemo(
    () =>
      zurichContrast.network ? buildStationIndex(zurichContrast.network) : [],
    [zurichContrast.network],
  )
  const kientalContrastStations = useMemo(
    () =>
      kientalContrast.network ? buildStationIndex(kientalContrast.network) : [],
    [kientalContrast.network],
  )
  const selectedTrain = useMemo(
    () => network?.trains.find((train) => train.id === selectedTrainId),
    [network, selectedTrainId],
  )
  const stationIndex = useMemo(
    () => (network ? buildStationIndex(network) : []),
    [network],
  )
  const routeIndex = useMemo(
    () => (network ? buildRouteIndex(network) : []),
    [network],
  )
  const trainSearchDocuments = useMemo(
    () =>
      network?.trains.map((train) => ({
        train,
        text: trainSearchText(train, network),
      })) ?? [],
    [network],
  )
  const selectedStation = useMemo(
    () => stationIndex.find((station) => station.name === selectedStationName),
    [selectedStationName, stationIndex],
  )
  const selectedRoute = useMemo(
    () => routeIndex.find((route) => route.id === selectedRouteId),
    [routeIndex, selectedRouteId],
  )
  const selectedPosition = useMemo(
    () => (selectedTrain ? positionForTrain(selectedTrain, networkTime) : undefined),
    [networkTime, selectedTrain],
  )
  const selectedHub = HUBS.find((hub) => hub.id === selectedHubId) ?? HUBS[0]
  const hubCalls = useMemo(
    () => hubDay?.hubs[selectedHub.id] ?? (network ? callsAtHub(network, selectedHub) : []),
    [hubDay, network, selectedHub],
  )
  const nearbyHubCalls = useMemo(
    () => callsNearTime(hubCalls, hubTime),
    [hubCalls, hubTime],
  )
  const upcomingHubCall = useMemo(
    () => nextHubCall(hubCalls, hubTime),
    [hubCalls, hubTime],
  )
  const hubPlatforms = useMemo(() => platformsForCalls(hubCalls), [hubCalls])
  const selectedFrom =
    network && selectedPosition
      ? network.stops[selectedPosition.fromStop]?.[2]
      : undefined
  const selectedTo =
    network && selectedPosition ? network.stops[selectedPosition.toStop]?.[2] : undefined
  const searchResults = useMemo(() => {
    const query = foldSearchText(searchQuery)
    if (!network || query.length < 1) return []
    return trainSearchDocuments
      .filter((document) => document.text.includes(query))
      .map((document) => document.train)
      .sort((first, second) => {
        const firstActive = first.start <= networkTime && first.end >= networkTime ? 0 : 1
        const secondActive = second.start <= networkTime && second.end >= networkTime ? 0 : 1
        return (
          firstActive - secondActive ||
          first.start - second.start ||
          first.route.localeCompare(second.route, LANGUAGE_LOCALES[language])
        )
      })
      .slice(0, 8)
  }, [language, network, networkTime, searchQuery, trainSearchDocuments])
  const stationSearchResults = useMemo(() => {
    const query = foldSearchText(searchQuery)
    if (!query) return []
    return stationIndex
      .filter((station) => foldSearchText(station.name).includes(query))
      .sort((first, second) => {
        const firstName = foldSearchText(first.name)
        const secondName = foldSearchText(second.name)
        return (
          Number(secondName.startsWith(query)) - Number(firstName.startsWith(query)) ||
          second.trainIds.length - first.trainIds.length ||
          first.name.localeCompare(second.name, LANGUAGE_LOCALES[language])
        )
      })
      .slice(0, 5)
  }, [language, searchQuery, stationIndex])
  const routeSearchResults = useMemo(() => {
    const query = foldSearchText(searchQuery)
    if (!query) return []
    return routeIndex
      .filter((route) =>
        foldSearchText(
          `${serviceCategoryLabel(language, route.category)} ${route.category.replaceAll('-', ' ')} ${route.name}`,
        ).includes(query),
      )
      .sort(
        (first, second) =>
          second.trainIds.length - first.trainIds.length ||
          first.name.localeCompare(second.name, LANGUAGE_LOCALES[language], {
            numeric: true,
          }),
      )
      .slice(0, 5)
  }, [language, routeIndex, searchQuery])
  const searchResultCount =
    stationSearchResults.length + routeSearchResults.length + searchResults.length
  const resolvedActiveSearchIndex =
    activeSearchIndex < searchResultCount ? activeSearchIndex : -1
  const visibleServiceCategories = useMemo(() => {
    const present = new Set(
      view === 'hub'
        ? hubCalls.map((call) => call.train.category)
        : isContrast
          ? [
              ...(zurichContrast.network?.trains.map(
                (train) => train.category,
              ) ?? []),
              ...(kientalContrast.network?.trains.map(
                (train) => train.category,
              ) ?? []),
            ]
          : (network?.trains.map((train) => train.category) ?? []),
    )
    return SERVICE_CATEGORIES.filter(
      (category) => category.id !== 'other' && present.has(category.id),
    )
  }, [hubCalls, isContrast, kientalContrast.network, network, view, zurichContrast.network])

  const handleJourneyProgress = useCallback((nextProgress: number) => {
    setJourneyProgress(nextProgress)
  }, [])
  const handleNetworkTime = useCallback(
    (nextTime: number) => {
      if (
        networkStudy === 'national' &&
        nationalTimeRange === 'day' &&
        nationalDayManifest
      ) {
        const descriptor = dayChunkForTime(nationalDayManifest, nextTime)
        if (!nationalDayChunks[descriptor.id]) {
          setNationalDayLoading(true)
          setNationalDayError(false)
        }
      }
      setNetworkTime(nextTime)
    },
    [
      nationalDayChunks,
      nationalDayManifest,
      nationalTimeRange,
      networkStudy,
    ],
  )
  const moveMapCamera = useCallback((action: MapCameraAction) => {
    setMapCameraCommand((current) => ({ id: current.id + 1, action }))
  }, [])
  const ignoreNetworkTime = useCallback(() => {}, [])

  const releaseSelection = useCallback(() => {
    setSelectedTrainId(undefined)
    setSelectedStationName(undefined)
    setSelectedRouteId(undefined)
    setSearchQuery('')
    setActiveSearchIndex(-1)
  }, [])

  const selectStation = useCallback((station: StationIndexEntry) => {
    setSelectedTrainId(undefined)
    setSelectedRouteId(undefined)
    setSelectedStationName(station.name)
    setSearchQuery(station.name)
    setSearchOpen(false)
    setActiveSearchIndex(-1)
    setView('network')
  }, [])

  const selectRoute = useCallback(
    (route: NetworkRouteIndexEntry) => {
      setSelectedTrainId(undefined)
      setSelectedStationName(undefined)
      setSelectedRouteId(route.id)
      setSelectedCategory(undefined)
      setSearchQuery(
        `${serviceCategoryLabel(language, route.category)} ${route.name}`,
      )
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      setView('network')
      setIsPlaying(true)
    },
    [language],
  )

  const selectTrain = useCallback(
    (train: NetworkTrain) => {
      if (!network) return
      const currentTimeIsActive = train.start <= networkTime && train.end >= networkTime
      const firstMovingMoment = Math.min(train.end, train.start + 60)
      const targetTime = currentTimeIsActive
        ? networkTime
        : Math.min(
            network.metadata.windowEnd,
            Math.max(network.metadata.windowStart, firstMovingMoment),
          )
      setNetworkTime(targetTime)
      setSelectedTrainId(train.id)
      setSelectedStationName(undefined)
      setSelectedRouteId(undefined)
      setSearchQuery(`${train.route} ${train.shortName} → ${train.headsign}`)
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      setView('network')
      setIsPlaying(true)
    },
    [network, networkTime],
  )

  const selectNetworkStudy = useCallback(
    (study: NetworkStudy, timeRange: NationalTimeRange = nationalTimeRange) => {
      setDirectorMode(false)
      setNetworkStudy(study)
      setView('network')
      setSelectedCategory(undefined)
      releaseSelection()
      if (study === 'national') setNationalTimeRange(timeRange)
      if (study === 'geneva-tpg') setSelectedHubId('geneva')
      if (study === 'zvv-region' || study === 'zurich-city') {
        setSelectedHubId('zurich')
      }
      const regionalSnapshot =
        study === 'zurich-city'
          ? zurichCityNetwork
          : study === 'zvv-region'
            ? zvvRegionNetwork
            : study === 'geneva-tpg'
              ? genevaTpgNetwork
              : undefined
      setRegionalNetworkLoading(
        study !== 'national' && study !== 'contrast' && !regionalSnapshot,
      )
      if (study !== 'national' && study !== 'contrast') {
        setRegionalNetworkError(false)
      }
      if (study === 'contrast') setNetworkTime(12 * 3600)
      if (study === 'national' && timeRange === 'day') {
        setNationalDayError(false)
        if (!nationalDayManifest) setNationalDayLoading(true)
      }
      const snapshot =
        regionalSnapshot ??
        (study === 'national' && timeRange === 'day'
            ? nationalDayNetwork
            : study === 'national'
              ? nationalNetwork
              : undefined)
      if (snapshot) setNetworkTime(snapshot.metadata.focusTime)
    },
    [
      nationalDayNetwork,
      genevaTpgNetwork,
      nationalDayManifest,
      nationalNetwork,
      nationalTimeRange,
      releaseSelection,
      zurichCityNetwork,
      zvvRegionNetwork,
    ],
  )

  const handleContextAction = useCallback(() => {
    setDirectorMode(false)
    if (
      view === 'network' &&
      (selectedTrainId || selectedStationName || selectedRouteId)
    ) {
      releaseSelection()
      return
    }
    setView((value) => (value === 'network' ? 'journey' : 'network'))
  }, [releaseSelection, selectedRouteId, selectedStationName, selectedTrainId, view])

  const toggleSoundtrack = useCallback(async () => {
    if (soundtrackState === 'starting') return
    if (soundtrackState === 'on') {
      soundtrackRef.current?.stop()
      setSoundtrackState('off')
      return
    }

    setSoundtrackState('starting')
    try {
      let soundtrack = soundtrackRef.current
      if (!soundtrack) {
        const { GleislichtSoundtrack: Soundtrack } = await import(
          './audio/gleislicht-soundtrack.ts'
        )
        soundtrack = new Soundtrack(soundtrackVolume)
        soundtrackRef.current = soundtrack
      }
      soundtrack.setVolume(soundtrackVolume)
      await soundtrack.start(soundtrackMode)
      setSoundtrackState('on')
    } catch (error: unknown) {
      console.error('Unable to start the Gleislicht soundtrack', error)
      setSoundtrackState('error')
    }
  }, [soundtrackMode, soundtrackState, soundtrackVolume])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = text.pageTitle
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', text.pageDescription)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Language still applies for this visit when storage is unavailable.
    }
  }, [language, text.pageDescription, text.pageTitle])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/swiss-rail-morning.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GTFS snapshot returned ${response.status}`)
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        setNationalNetwork(snapshot)
        setNetworkTime(snapshot.metadata.focusTime)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setDataError(true)
      })
    fetch(`${import.meta.env.BASE_URL}data/swiss-boundary.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary snapshot returned ${response.status}`)
        return response.json() as Promise<SwissBoundary>
      })
      .then(setBoundary)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the Swiss national boundary', error)
      })
    fetch(`${import.meta.env.BASE_URL}data/swiss-lakes.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Lake snapshot returned ${response.status}`)
        return response.json() as Promise<SwissLakes>
      })
      .then(setLakes)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the Swiss lake layer', error)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (view !== 'hub' || hubDay) return
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/swiss-hub-day.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Hub snapshot returned ${response.status}`)
        return response.json() as Promise<HubDaySnapshot>
      })
      .then((snapshot) => {
        setHubDay(snapshot)
        setHubTime(snapshot.metadata.focusTime)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the hub day study', error)
      })
    return () => controller.abort()
  }, [hubDay, view])

  useEffect(() => {
    if (
      networkStudy !== 'national' ||
      nationalTimeRange !== 'day' ||
      nationalDayManifest
    ) {
      return
    }
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/swiss-rail-day-manifest.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Full-day GTFS manifest returned ${response.status}`)
        }
        return response.json() as Promise<NetworkDayManifest>
      })
      .then((manifest) => {
        setNationalDayManifest(manifest)
        setNationalDayLoading(true)
        setNetworkTime(manifest.metadata.focusTime)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNationalDayError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setNationalDayLoading(false)
    })
    return () => controller.abort()
  }, [nationalDayManifest, nationalTimeRange, networkStudy])

  useEffect(() => {
    if (
      networkStudy !== 'national' ||
      nationalTimeRange !== 'day' ||
      !nationalDayManifest ||
      !nationalDayChunkDescriptor
    ) {
      return
    }
    const currentMissing = !nationalDayChunks[nationalDayChunkDescriptor.id]
    const targets = currentMissing
      ? [nationalDayChunkDescriptor]
      : adjacentDayChunks(nationalDayManifest, nationalDayChunkDescriptor).filter(
          (chunk) => !nationalDayChunks[chunk.id],
        )
    if (!targets.length) return

    const controller = new AbortController()
    Promise.all(
      targets.map(async (descriptor) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/${descriptor.path}`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Full-day GTFS chunk returned ${response.status}`)
        }
        return [descriptor.id, await response.json()] as const
      }),
    )
      .then((entries) => {
        setNationalDayChunks((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (currentMissing) setNationalDayError(true)
      })
      .finally(() => {
        if (currentMissing && !controller.signal.aborted) {
          setNationalDayLoading(false)
        }
      })
    return () => controller.abort()
  }, [
    nationalDayChunkDescriptor,
    nationalDayChunks,
    nationalDayManifest,
    nationalTimeRange,
    networkStudy,
  ])

  useEffect(() => {
    if (networkStudy === 'national' || networkStudy === 'contrast') return
    const existingNetwork =
      networkStudy === 'zurich-city'
        ? zurichCityNetwork
        : networkStudy === 'zvv-region'
          ? zvvRegionNetwork
          : genevaTpgNetwork
    if (existingNetwork) return
    const controller = new AbortController()
    const isCity = networkStudy === 'zurich-city'
    const isZvv = networkStudy === 'zvv-region'
    const fileName = isCity
      ? 'zurich-city-morning.json'
      : isZvv
        ? 'zvv-region-morning.json'
        : 'geneva-tpg-morning.json'
    fetch(`${import.meta.env.BASE_URL}data/${fileName}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          const studyName = isCity ? 'Zürich city' : isZvv ? 'ZVV' : 'Genève / TPG'
          throw new Error(`${studyName} snapshot returned ${response.status}`)
        }
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        if (isCity) setZurichCityNetwork(snapshot)
        else if (isZvv) setZvvRegionNetwork(snapshot)
        else setGenevaTpgNetwork(snapshot)
        setNetworkTime(snapshot.metadata.focusTime)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRegionalNetworkError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRegionalNetworkLoading(false)
      })
    return () => controller.abort()
  }, [genevaTpgNetwork, networkStudy, zurichCityNetwork, zvvRegionNetwork])

  useEffect(() => {
    if (!searchOpen || resolvedActiveSearchIndex < 0) return
    document
      .getElementById(`train-search-result-${resolvedActiveSearchIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [resolvedActiveSearchIndex, searchOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key.toLowerCase() === 'p') {
        const target = event.target as HTMLElement | null
        if (target?.tagName === 'INPUT') return
        event.preventDefault()
        setIsPlaying((value) => !value)
      }
      if (event.key.toLowerCase() === 'c') handleContextAction()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleContextAction])

  useEffect(() => {
    if (soundtrackState !== 'on') return
    soundtrackRef.current?.transition(soundtrackMode).catch((error: unknown) => {
      console.error('Unable to transition the Gleislicht soundtrack', error)
      setSoundtrackState('error')
    })
  }, [soundtrackMode, soundtrackState])

  useEffect(() => {
    if (soundtrackState !== 'on') return
    const resumeSoundtrack = () => {
      if (document.visibilityState === 'visible') {
        soundtrackRef.current?.resume().catch((error: unknown) => {
          console.warn('Unable to resume the Gleislicht soundtrack', error)
        })
      }
    }
    document.addEventListener('visibilitychange', resumeSoundtrack)
    window.addEventListener('pageshow', resumeSoundtrack)
    return () => {
      document.removeEventListener('visibilitychange', resumeSoundtrack)
      window.removeEventListener('pageshow', resumeSoundtrack)
    }
  }, [soundtrackState])

  useEffect(() => {
    soundtrackRef.current?.setVolume(soundtrackVolume)
  }, [soundtrackVolume])

  useEffect(
    () => () => {
      soundtrackRef.current?.dispose()
      soundtrackRef.current = null
    },
    [],
  )

  const isNetwork = view === 'network'
  const isHub = view === 'hub'
  const isTimetable = isNetwork || isHub
  const isNationalDay =
    networkStudy === 'national' && nationalTimeRange === 'day'
  const timeline = isHub ? (hubDay?.metadata ?? network?.metadata) : network?.metadata
  const timelineTime = isHub ? hubTime : networkTime
  const timelineReady = isTimetable && timeline
  const hasFullDayTimeline = Boolean(
    timelineReady &&
      timeline.windowStart <= DAY_PRESETS[0].time &&
      timeline.windowEnd >= DAY_PRESETS.at(-1)!.time,
  )

  const jumpToTime = useCallback(
    (time: number) => {
      setIsPlaying(true)
      if (isHub) setHubTime(time)
      else handleNetworkTime(time)
    },
    [handleNetworkTime, isHub],
  )

  useEffect(() => {
    timelineTimeRef.current = timelineTime
  }, [timelineTime])

  useEffect(() => {
    if (!directorMode || !hasFullDayTimeline) return
    let presetIndex = DAY_PRESETS.reduce(
      (closest, preset, index) =>
        Math.abs(preset.time - timelineTimeRef.current) <
        Math.abs(DAY_PRESETS[closest].time - timelineTimeRef.current)
          ? index
          : closest,
      0,
    )
    const interval = window.setInterval(() => {
      presetIndex = (presetIndex + 1) % DAY_PRESETS.length
      jumpToTime(DAY_PRESETS[presetIndex].time)
      if (isNetwork) moveMapCamera('reset')
    }, 9000)
    return () => window.clearInterval(interval)
  }, [
    directorMode,
    hasFullDayTimeline,
    isNetwork,
    jumpToTime,
    moveMapCamera,
  ])

  return (
    <main
      className={`experience view-${view}${isContrast ? ' is-contrast' : ''}${selectedTrain || selectedStation || selectedRoute ? ' has-selection' : ''}`}
    >
      <div className="scene" aria-hidden={webglAvailable ? true : undefined}>
        {!webglAvailable ? (
          <section className="no-webgl" role="status">
            <span aria-hidden="true">◎</span>
            <h2>{text.webglUnavailable}</h2>
            <p>{text.webglUnavailableDescription}</p>
            <a href="./methodology.html">{text.readMethodology}</a>
          </section>
        ) : isNetwork && isContrast ? (
          <div className="contrast-scenes">
            <section className="contrast-panel contrast-panel-city">
              {zurichContrast.network ? (
                <NationalNetworkScene
                  snapshot={zurichContrast.network}
                  referenceSnapshot={zurichContrast.network}
                  stations={zurichContrastStations}
                  trainLabelMode={trainLabelMode}
                  isPlaying={isPlaying}
                  time={networkTime}
                  onTime={handleNetworkTime}
                  cameraCommand={mapCameraCommand}
                  playbackRate={playbackRate}
                  selectedCategory={selectedCategory}
                  cameraFraming="switzerland"
                />
              ) : (
                <div className="contrast-loader" />
              )}
              <div className="contrast-caption">
                <span>Zürich</span>
                <strong>
                  {zurichContrast.chunkReady
                    ? numberFormat.format(zurichContrastActiveCount)
                    : '—'}
                </strong>
                <small>{text.tramsInMotion}</small>
              </div>
            </section>
            <section className="contrast-panel contrast-panel-valley">
              {kientalContrast.network ? (
                <NationalNetworkScene
                  snapshot={kientalContrast.network}
                  referenceSnapshot={kientalContrast.network}
                  stations={kientalContrastStations}
                  trainLabelMode={trainLabelMode}
                  isPlaying={false}
                  time={networkTime}
                  onTime={ignoreNetworkTime}
                  cameraCommand={mapCameraCommand}
                  playbackRate={playbackRate}
                  selectedCategory={selectedCategory}
                  cameraFraming="switzerland"
                />
              ) : (
                <div className="contrast-loader" />
              )}
              <div className="contrast-caption">
                <span>Kiental · 220</span>
                <strong>
                  {kientalContrast.chunkReady
                    ? numberFormat.format(kientalContrastActiveCount)
                    : '—'}
                </strong>
                <small>{text.vehiclesInMotion}</small>
              </div>
            </section>
          </div>
        ) : isNetwork && network ? (
          <NationalNetworkScene
            boundary={boundary}
            lakes={lakes}
            snapshot={network}
            referenceSnapshot={nationalNetwork ?? network}
            contextSnapshot={
              networkStudy !== 'national' &&
              (networkStudy === 'zurich-city'
                ? zurichCityNetwork
                : networkStudy === 'zvv-region'
                  ? zvvRegionNetwork
                  : genevaTpgNetwork)
                ? nationalNetwork
                : undefined
            }
            stations={stationIndex}
            trainLabelMode={trainLabelMode}
            isPlaying={isPlaying}
            time={networkTime}
            selectedTrain={selectedTrain}
            onTime={handleNetworkTime}
            cameraCommand={mapCameraCommand}
            playbackRate={playbackRate}
            selectedCategory={selectedCategory}
            selectedRoute={selectedRoute}
            selectedStation={selectedStation}
            onSelectStation={selectStation}
            cameraFraming={
              networkStudy === 'zurich-city' && zurichCityNetwork
                ? 'zurich'
                : networkStudy === 'zvv-region' && zvvRegionNetwork
                  ? 'zvv'
                  : networkStudy === 'geneva-tpg' && genevaTpgNetwork
                    ? 'geneva'
                    : 'switzerland'
            }
          />
        ) : isHub && network && hubStudy === 'station' ? (
          <Suspense fallback={null}>
            <StationFlowScene
              timeline={hubDay?.metadata ?? network.metadata}
              hub={selectedHub}
              calls={hubCalls}
              isPlaying={isPlaying}
              time={hubTime}
              onTime={setHubTime}
              playbackRate={playbackRate}
              selectedCategory={selectedCategory}
              platformPrefix={text.trackShort}
            />
          </Suspense>
        ) : isHub && network ? (
          <Suspense fallback={null}>
            <HubPulseScene
              timeline={hubDay?.metadata ?? network.metadata}
              hub={selectedHub}
              calls={hubCalls}
              isPlaying={isPlaying}
              time={hubTime}
              onTime={setHubTime}
              playbackRate={playbackRate}
              selectedCategory={selectedCategory}
            />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <GleislichtScene
              isPlaying={isPlaying && !isNetwork}
              progress={journeyProgress}
              onProgress={handleJourneyProgress}
            />
          </Suspense>
        )}
      </div>

      <div className="atmosphere" />
      <div className="scanlines" />

      <header className="masthead">
        <div>
          <p className="eyebrow">Gleislicht</p>
          <h1>
            {isNetwork
              ? isContrast
                ? text.contrastSubtitle
                : networkStudy === 'zurich-city'
                ? text.zurichSubtitle
                : networkStudy === 'zvv-region'
                  ? text.zvvSubtitle
                  : networkStudy === 'geneva-tpg'
                    ? text.genevaSubtitle
                  : text.subtitle
              : text.subtitle}
          </h1>
        </div>
        <div className="masthead-meta">
          <div className="masthead-topline">
            <div className="study-meta">
              <span className="pulse" />
              <span>{text.motionStudy}</span>
              <span className="coordinate">
                {isTimetable ? text.studyDate : '47.194° N · 9.312° E'}
              </span>
            </div>
            <nav className="language-picker" aria-label={text.languagePicker}>
              {UI_LANGUAGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={option.name}
                  lang={option.id}
                  aria-pressed={language === option.id}
                  onClick={() => setLanguage(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </nav>
            <MobilePicker
              className="mobile-language-picker"
              ariaLabel={text.languagePicker}
              value={language}
              options={UI_LANGUAGES.map((option) => ({
                value: option.id,
                label: option.label,
                detail: option.name,
              }))}
              onChange={(nextLanguage) =>
                setLanguage(nextLanguage as UiLanguage)
              }
            />
          </div>
          <section
            className={`soundtrack-control is-${soundtrackState}`}
            aria-label={text.adaptiveSoundtrack}
          >
            <button
              type="button"
              aria-pressed={soundtrackState === 'on'}
              disabled={soundtrackState === 'starting'}
              onClick={() => void toggleSoundtrack()}
            >
              <span className="sound-bars" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
              <span className="sound-copy">
                <small>
                  {soundtrackState === 'error'
                    ? text.audioUnavailable
                    : text.adaptiveScore}
                </small>
                <strong>
                  {soundtrackState === 'starting'
                    ? text.tuning
                    : SOUNDTRACK_TITLES[soundtrackMode]}
                </strong>
              </span>
              <span className="sound-state">
                {soundtrackState === 'on' ? text.on : text.off}
              </span>
            </button>
            {soundtrackState === 'on' && (
              <label className="volume-control">
                <span>{text.volume}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={soundtrackVolume}
                  onChange={(event) => setSoundtrackVolume(Number(event.target.value))}
                />
              </label>
            )}
          </section>
        </div>
      </header>

      {isNetwork && (
        <section
          className="train-search"
          onFocus={() => {
            setSearchOpen(true)
            if (mobileMapToolsRef.current) mobileMapToolsRef.current.open = false
          }}
          onPointerDownCapture={() => {
            searchInteractionRef.current = true
          }}
          onPointerUpCapture={() => {
            window.setTimeout(() => {
              searchInteractionRef.current = false
            }, 0)
          }}
          onPointerCancelCapture={() => {
            searchInteractionRef.current = false
          }}
          onBlur={(event) => {
            if (searchInteractionRef.current) return
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSearchOpen(false)
              setActiveSearchIndex(-1)
            }
          }}
        >
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              if (
                resolvedActiveSearchIndex >= 0 &&
                resolvedActiveSearchIndex < stationSearchResults.length
              ) {
                selectStation(stationSearchResults[resolvedActiveSearchIndex])
              } else if (
                resolvedActiveSearchIndex >= stationSearchResults.length &&
                resolvedActiveSearchIndex <
                  stationSearchResults.length + routeSearchResults.length
              ) {
                const route =
                  routeSearchResults[
                    resolvedActiveSearchIndex - stationSearchResults.length
                  ]
                if (route) selectRoute(route)
              } else if (
                resolvedActiveSearchIndex >=
                stationSearchResults.length + routeSearchResults.length
              ) {
                const train =
                  searchResults[
                    resolvedActiveSearchIndex -
                      stationSearchResults.length -
                      routeSearchResults.length
                  ]
                if (train) selectTrain(train)
              } else if (stationSearchResults[0]) {
                selectStation(stationSearchResults[0])
              } else if (routeSearchResults[0]) {
                selectRoute(routeSearchResults[0])
              } else if (searchResults[0]) {
                selectTrain(searchResults[0])
              }
            }}
          >
            <span className="search-mark" aria-hidden="true" />
            <label>
              <span className="sr-only">{text.find}</span>
              <input
                type="search"
                role="combobox"
                value={searchQuery}
                placeholder={
                  isContrast
                    ? text.contrastPlaceholder
                    : networkStudy === 'national'
                    ? text.nationalPlaceholder
                    : networkStudy === 'zvv-region'
                      ? text.regionalPlaceholder
                      : networkStudy === 'geneva-tpg'
                        ? text.genevaPlaceholder
                      : text.cityPlaceholder
                }
                autoComplete="off"
                disabled={isContrast}
                aria-autocomplete="list"
                aria-controls="train-search-results"
                aria-expanded={searchOpen && Boolean(searchQuery.trim())}
                aria-activedescendant={
                  searchOpen && resolvedActiveSearchIndex >= 0
                    ? `train-search-result-${resolvedActiveSearchIndex}`
                    : undefined
                }
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSearchOpen(true)
                  setActiveSearchIndex(-1)
                  if (!event.target.value) releaseSelection()
                  else if (event.target.value !== selectedStation?.name) {
                    setSelectedStationName(undefined)
                  }
                  const selectedRouteQuery = selectedRoute
                    ? `${serviceCategoryLabel(language, selectedRoute.category)} ${selectedRoute.name}`
                    : undefined
                  if (event.target.value !== selectedRouteQuery) {
                    setSelectedRouteId(undefined)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setSearchOpen(false)
                    setActiveSearchIndex(-1)
                    return
                  }
                  if (
                    event.key === 'ArrowDown' ||
                    event.key === 'ArrowUp' ||
                    event.key === 'Home' ||
                    event.key === 'End'
                  ) {
                    event.preventDefault()
                    setSearchOpen(true)
                    setActiveSearchIndex((current) =>
                      nextSearchResultIndex(
                        current < searchResultCount ? current : -1,
                        searchResultCount,
                        event.key as SearchNavigationKey,
                      ),
                    )
                  }
                }}
              />
            </label>
            <nav className="network-study-picker" aria-label={text.networkStudy}>
              <span className="sr-only">{text.scale}</span>
              <button
                type="button"
                title={text.swissMorningNetwork}
                aria-label={text.showSwissMorningNetwork}
                aria-pressed={
                  networkStudy === 'national' && nationalTimeRange === 'morning'
                }
                onClick={() => selectNetworkStudy('national', 'morning')}
              >
                CH
              </button>
              <button
                type="button"
                title={text.swissDayNetwork}
                aria-label={text.showSwissDayNetwork}
                aria-pressed={
                  networkStudy === 'national' && nationalTimeRange === 'day'
                }
                onClick={() => selectNetworkStudy('national', 'day')}
              >
                24H
              </button>
              <button
                type="button"
                title={text.contrastNetwork}
                aria-label={text.showContrastNetwork}
                aria-pressed={isContrast}
                onClick={() => selectNetworkStudy('contrast')}
              >
                ↔
              </button>
              <button
                type="button"
                title={text.zvvNetwork}
                aria-label={text.showZvvNetwork}
                aria-pressed={networkStudy === 'zvv-region'}
                onClick={() => selectNetworkStudy('zvv-region')}
              >
                ZVV
              </button>
              <button
                type="button"
                title={text.genevaNetwork}
                aria-label={text.showGenevaNetwork}
                aria-pressed={networkStudy === 'geneva-tpg'}
                onClick={() => selectNetworkStudy('geneva-tpg')}
              >
                GE
              </button>
              <button
                type="button"
                title={text.zurichNetwork}
                aria-label={text.showZurichNetwork}
                aria-pressed={networkStudy === 'zurich-city'}
                onClick={() => selectNetworkStudy('zurich-city')}
              >
                ZH
              </button>
            </nav>
            <MobilePicker
              className="mobile-study-picker"
              ariaLabel={text.networkStudy}
              value={
                isContrast
                  ? 'contrast'
                  : networkStudy === 'national'
                    ? `national-${nationalTimeRange}`
                    : networkStudy
              }
              options={[
                {
                  value: 'national-morning',
                  label: 'CH',
                  detail: text.swissMorningNetwork,
                },
                {
                  value: 'national-day',
                  label: '24H',
                  detail: text.swissDayNetwork,
                },
                {
                  value: 'contrast',
                  label: '↔',
                  detail: text.contrastNetwork,
                },
                { value: 'zvv-region', label: 'ZVV', detail: text.zvvNetwork },
                { value: 'geneva-tpg', label: 'GE', detail: text.genevaNetwork },
                { value: 'zurich-city', label: 'ZH', detail: text.zurichNetwork },
              ]}
              triggerLabel={
                isContrast
                  ? '↔'
                  : networkStudy === 'national' && nationalTimeRange === 'day'
                    ? '24H'
                    : networkStudy === 'national'
                      ? 'CH'
                      : networkStudy === 'zvv-region'
                        ? 'ZVV'
                        : networkStudy === 'geneva-tpg'
                          ? 'GE'
                          : 'ZH'
              }
              onChange={(study) => {
                if (study === 'national-morning') {
                  selectNetworkStudy('national', 'morning')
                } else if (study === 'national-day') {
                  selectNetworkStudy('national', 'day')
                } else if (study === 'contrast') {
                  selectNetworkStudy('contrast')
                } else {
                  selectNetworkStudy(study as NetworkStudy)
                }
              }}
            />
            {searchQuery && (
              <button
                className="clear-search"
                type="button"
                aria-label={text.clearSearch}
                onClick={releaseSelection}
              >
                ×
              </button>
            )}
          </form>
          {searchOpen && searchQuery.trim() && (
            <div
              id="train-search-results"
              className="search-results"
              role="listbox"
              aria-label={text.matchingResults}
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
                    <span
                      className="route-result-mark"
                      style={{ color: SERVICE_COLORS[route.category] }}
                      aria-hidden="true"
                    >
                      ━
                    </span>
                    <span className="result-service">
                      {serviceCategoryLabel(language, route.category)} {route.name}
                    </span>
                    <span className="result-route">
                      {numberFormat.format(route.trainIds.length)} {text.trips.toLocaleLowerCase(LANGUAGE_LOCALES[language])}
                      {' · '}
                      {numberFormat.format(route.stopIndexes.length)} {text.stops.toLocaleLowerCase(LANGUAGE_LOCALES[language])}
                    </span>
                  </button>
                )
              })}
              {searchResults.map((train, trainIndex) => {
                  const origin = network?.stops[train.stops[0]?.[0]]?.[2]
                  const index =
                    stationSearchResults.length +
                    routeSearchResults.length +
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
                      <span
                        className="result-swatch"
                        style={{ backgroundColor: SERVICE_COLORS[train.category] }}
                      />
                      <span className="result-service">
                        {train.route} <b>{train.shortName}</b>
                      </span>
                      <span className="result-route">
                        {formatServiceTime(train.start)} · {origin} → {train.headsign}
                      </span>
                    </button>
                  )
                })}
              {!stationSearchResults.length &&
                !routeSearchResults.length &&
                !searchResults.length && (
                <p>{isNationalDay ? text.noResultsDay : text.noResults}</p>
              )}
            </div>
          )}
        </section>
      )}

      {isHub && (
        <nav className="hub-picker" aria-label={text.taktStation}>
          <span>{text.taktPulse}</span>
          <div>
            {HUBS.map((hub) => (
              <button
                key={hub.id}
                type="button"
                aria-pressed={hub.id === selectedHub.id}
                onClick={() => setSelectedHubId(hub.id)}
              >
                {hub.displayName}
              </button>
            ))}
          </div>
        </nav>
      )}

      {isHub ? (
        <section
          className="journey-card hub-card"
          aria-label={`${selectedHub.name} ${hubStudy === 'pulse' ? text.pulse : text.stationFlow}`}
        >
          <div className="hub-card-header">
            <p className="hub-kicker">
              {hubStudy === 'pulse' ? text.taktLoop : text.stationPlatforms}
            </p>
            <div className="hub-study-picker" aria-label={text.taktVisualisation}>
              <button
                type="button"
                aria-pressed={hubStudy === 'pulse'}
                onClick={() => setHubStudy('pulse')}
              >
                {text.pulse}
              </button>
              <button
                type="button"
                aria-pressed={hubStudy === 'station'}
                onClick={() => setHubStudy('station')}
              >
                {text.tracks}
              </button>
            </div>
          </div>
          <div className="network-count-row">
            <strong>{nearbyHubCalls.length}</strong>
            <span>
              {hubStudy === 'pulse'
                ? text.orbitMovements
                : text.stationMovements}
            </span>
          </div>
          <p className="between">
            {text.hubCharacter[selectedHub.id]} <span>/</span>{' '}
            {hubStudy === 'station'
              ? text.scheduledTracks(hubPlatforms.length)
              : text.callsToday(numberFormat.format(hubCalls.length))}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.nextStrike}</span>
              <strong>
                {upcomingHubCall ? formatServiceTime(upcomingHubCall.arrival) : '—'}
              </strong>
              <small>
                {upcomingHubCall
                  ? `${upcomingHubCall.train.route} · ${text.trackShort} ${platformCodeForCall(upcomingHubCall)}`
                  : text.end}
              </small>
            </div>
            <div>
              <span>{text.direction}</span>
              <strong className="destination-metric">
                {upcomingHubCall?.train.headsign ?? '—'}
              </strong>
            </div>
          </div>
        </section>
      ) : isNetwork && isContrast ? (
        <section
          className="journey-card network-card contrast-card"
          aria-label={text.contrastNetworkStatus}
        >
          <p className="contrast-card-title">{text.cityValley}</p>
          <div className="metric-grid">
            <div>
              <span>Zürich</span>
              <strong>
                {zurichContrast.chunkReady
                  ? numberFormat.format(zurichContrastActiveCount)
                  : '—'}
              </strong>
              <small>{serviceCategoryLabel(language, 'tram')}</small>
            </div>
            <div>
              <span>Kiental</span>
              <strong>
                {kientalContrast.chunkReady
                  ? numberFormat.format(kientalContrastActiveCount)
                  : '—'}
              </strong>
              <small>PostBus 220</small>
            </div>
          </div>
          <p className="between">
            {zurichContrast.error || kientalContrast.error
              ? text.contrastUnavailable
              : zurichContrast.loading || kientalContrast.loading
                ? text.loadingContrast
                : text.synchronisedDay}
          </p>
        </section>
      ) : isNetwork && selectedTrain ? (
        <section className="journey-card selected-card" aria-label={text.selectedTrain}>
          <div className="service-row">
            <span
              className="service-dot"
              style={{ backgroundColor: SERVICE_COLORS[selectedTrain.category] }}
            />
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
              <small>{serviceCategoryLabel(language, selectedTrain.category)}</small>
            </div>
            <div>
              <span>{text.arrival}</span>
              <strong>{formatServiceTime(selectedTrain.end)}</strong>
              <small>{text.plan}</small>
            </div>
          </div>
        </section>
      ) : isNetwork && selectedRoute ? (
        <section
          className="journey-card route-card"
          aria-label={`${text.selectedLine}: ${serviceCategoryLabel(language, selectedRoute.category)} ${selectedRoute.name}`}
          style={
            {
              '--service-accent': SERVICE_COLORS[selectedRoute.category],
            } as CSSProperties
          }
        >
          <div className="service-row">
            <span
              className="service-dot"
              style={{ backgroundColor: SERVICE_COLORS[selectedRoute.category] }}
            />
            <span className="service">
              {serviceCategoryLabel(language, selectedRoute.category)}{' '}
              {selectedRoute.name}
            </span>
          </div>
          <p className="between">
            {selectedRoute.headsigns.slice(0, 2).join(' ↔ ') ||
              (isNationalDay ? text.fullDayStudy : text.morningStudy)}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.trips}</span>
              <strong>{numberFormat.format(selectedRoute.trainIds.length)}</strong>
              <small>{isNationalDay ? '3h' : '2h'}</small>
            </div>
            <div>
              <span>{text.stops}</span>
              <strong>{numberFormat.format(selectedRoute.stopIndexes.length)}</strong>
              <small>{text.unique}</small>
            </div>
          </div>
        </section>
      ) : isNetwork && selectedStation ? (
        <section
          className="journey-card station-card"
          aria-label={text.routesServing(selectedStation.name)}
        >
          <div className="service-row">
            <span className="station-card-mark" aria-hidden="true">◎</span>
            <span className="service">{selectedStation.name}</span>
          </div>
          <div
            className="station-route-strip"
            aria-label={text.routesServing(selectedStation.name)}
          >
            {selectedStation.routes.slice(0, 4).map((route) => (
              <span
                key={`${route.category}:${route.name}`}
                style={
                  {
                    '--route-accent': SERVICE_COLORS[route.category],
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
            {isNationalDay ? text.fullDayStudy : text.morningStudy}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.routes}</span>
              <strong>{selectedStation.routes.length}</strong>
              <small>{text.unique}</small>
            </div>
            <div>
              <span>{text.calls}</span>
              <strong>{selectedStation.trainIds.length}</strong>
              <small>{isNationalDay ? '3h' : '2h'}</small>
            </div>
          </div>
        </section>
      ) : isNetwork ? (
        <section
          className="journey-card network-card"
          aria-label={
            networkStudy === 'national'
              ? text.swissNetworkStatus
              : networkStudy === 'zvv-region'
                ? text.zvvNetworkStatus
                : networkStudy === 'geneva-tpg'
                  ? text.genevaNetworkStatus
                : text.zurichNetworkStatus
          }
        >
          <div className="network-count-row">
            <strong>
              {network && (!isNationalDay || nationalDayChunkReady)
                ? numberFormat.format(activeTrainCount)
                : '—'}
            </strong>
            <span>
              {networkStudy === 'national'
                ? text.trainsInMotion
                : text.vehiclesInMotion}
            </span>
          </div>
          <p className="between">
              {networkStudy !== 'national'
              ? regionalNetworkError
                ? networkStudy === 'zvv-region'
                  ? text.zvvUnavailable
                  : networkStudy === 'geneva-tpg'
                    ? text.genevaUnavailable
                  : text.cityUnavailable
                : regionalNetworkLoading
                  ? networkStudy === 'zvv-region'
                    ? text.loadingZvv
                    : networkStudy === 'geneva-tpg'
                      ? text.loadingGeneva
                    : text.loadingCity
                  : networkStudy === 'zvv-region'
                    ? text.zvvModes
                    : networkStudy === 'geneva-tpg'
                      ? text.genevaModes
                    : text.cityModes
              : isNationalDay
                ? nationalDayError
                  ? text.dayScheduleUnavailable
                  : nationalDayLoading
                    ? text.loadingDay
                    : text.scheduledRailDay
                : dataError
                  ? text.scheduleUnavailable
                  : text.scheduledRail}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.trips}</span>
              <strong>
                {isNationalDay
                  ? nationalDayManifest
                    ? numberFormat.format(nationalDayManifest.tripCount)
                    : '—'
                  : network
                    ? numberFormat.format(network.trains.length)
                    : '—'}
              </strong>
              <small>{isNationalDay ? '24h' : '2h'}</small>
            </div>
            <div>
              <span>{text.feed}</span>
              <strong>{network?.metadata.feedVersion.slice(4) ?? '—'}</strong>
              <small>2026</small>
            </div>
          </div>
        </section>
      ) : (
        <section className="journey-card" aria-label={text.currentJourney}>
          <div className="service-row">
            <span className="service">{prototypeJourney.service}</span>
            <span className="arrow">→</span>
            <span>{prototypeJourney.destination}</span>
          </div>
          <p className="between">
            {journeyPosition.previous.name} <span>/</span> {journeyPosition.next.name}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.velocity}</span>
              <strong>{prototypeJourney.speedKmh}</strong>
              <small>km/h</small>
            </div>
            <div>
              <span>{text.next}</span>
              <strong>
                {Math.max(1, Math.round((1 - journeyPosition.legProgress) * 14))}
              </strong>
              <small>min</small>
            </div>
          </div>
        </section>
      )}

      <div className="prototype-note">
        {isHub ? (
          <>
            <span>
              {hubStudy === 'pulse'
                ? text.scheduledStationCalls
                : text.platformAssignments}
            </span>
            <span>{hubStudy === 'pulse' ? text.orbit15 : text.schematicPlan}</span>
          </>
        ) : isNetwork ? (
          <>
            <span>
              {selectedTrain
                ? text.scheduledFollow
                : selectedRoute
                  ? text.lineRouteFocus
                : selectedStation
                  ? text.stationRouteFocus
                  : text.gtfsSchedule}
            </span>
            <span>
              {selectedTrain?.category ??
                (selectedRoute
                  ? `${serviceCategoryLabel(language, selectedRoute.category)} ${selectedRoute.name}`
                  : undefined) ??
                selectedStation?.name ??
                (selectedCategory
                  ? serviceCategoryLabel(language, selectedCategory)
                  : text.trafficFrequency)}
            </span>
          </>
        ) : (
          <>
            <span>{text.prototypeRoute}</span>
            <span>{text.syntheticTerrain}</span>
          </>
        )}
      </div>

      {isNetwork && !selectedTrain && !isContrast && <div className="north-marker">N</div>}

      {isNetwork && (
        <div className="map-navigation" aria-label={text.mapControls}>
          {!selectedTrain && (
            <>
              <span>{text.mapGesture}</span>
              <div>
                <button
                  type="button"
                  aria-label={text.zoomIn}
                  onClick={() => moveMapCamera('zoom-in')}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={text.zoomOut}
                  onClick={() => moveMapCamera('zoom-out')}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={text.resetMap}
                  onClick={() => moveMapCamera('reset')}
                >
                  ↺
                </button>
              </div>
            </>
          )}
          <button
            className="train-label-toggle"
            type="button"
            aria-label={text.labelsAction(
              networkStudy === 'national' ? text.trainLabels : text.vehicleLabels,
              text.labelModes[trainLabelMode],
              text.labelModes[NEXT_TRAIN_LABEL_MODE[trainLabelMode]],
            )}
            onClick={() =>
              setTrainLabelMode((current) => NEXT_TRAIN_LABEL_MODE[current])
            }
          >
            <span aria-hidden="true">▱</span>
            {networkStudy === 'national' ? text.trainLabels : text.vehicleLabels} ·{' '}
            {text.labelModes[trainLabelMode]}
          </button>
        </div>
      )}

      {isNetwork && (
        <div className="mobile-map-tools">
          <details ref={mobileMapToolsRef}>
            <summary aria-label={text.mapControls}>⌖</summary>
            <div>
              {!selectedTrain && (
                <div className="mobile-zoom-row">
                  <button
                    type="button"
                    aria-label={text.zoomIn}
                    onClick={() => moveMapCamera('zoom-in')}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label={text.zoomOut}
                    onClick={() => moveMapCamera('zoom-out')}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label={text.resetMap}
                    onClick={() => moveMapCamera('reset')}
                  >
                    ↺
                  </button>
                </div>
              )}
              <div className="mobile-tool-field">
                <span>{text.services}</span>
                <MobilePicker
                  ariaLabel={text.filterServices}
                  value={selectedCategory ?? ''}
                  options={[
                    { value: '', label: text.allServices },
                    ...visibleServiceCategories.map((category) => ({
                      value: category.id,
                      label: serviceCategoryLabel(language, category.id),
                    })),
                  ]}
                  onChange={(category) =>
                    setSelectedCategory(
                      (category || undefined) as
                        | ServiceCategory
                        | undefined,
                    )
                  }
                />
              </div>
              <div className="mobile-tool-field">
                <span>{text.labels}</span>
                <MobilePicker
                  ariaLabel={text.vehicleLabels}
                  value={trainLabelMode}
                  options={[
                    { value: 'auto', label: text.labelModes.auto },
                    { value: 'on', label: text.labelModes.on },
                    { value: 'off', label: text.labelModes.off },
                  ]}
                  onChange={(labelMode) =>
                    setTrainLabelMode(labelMode as TrainLabelMode)
                  }
                />
              </div>
            </div>
          </details>
        </div>
      )}

      {isTimetable && !selectedTrain && !selectedRoute && (
        <div
          className={`service-legend${selectedCategory ? ' has-filter' : ''}`}
          aria-label={text.filterServices}
        >
          {visibleServiceCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.id}
                style={
                  {
                    '--service-accent': category.color,
                  } as CSSProperties
                }
                onClick={() =>
                  setSelectedCategory((current) =>
                    current === category.id ? undefined : category.id,
                  )
                }
              >
                <i style={{ backgroundColor: category.color }} />
                {serviceCategoryLabel(language, category.id)}
              </button>
          ))}
        </div>
      )}

      <section className="transport" aria-label={text.playbackControls}>
        <div className="progress-copy">
          <span>
            {timelineReady
              ? formatServiceTime(timeline.windowStart)
              : journeyPosition.previous.departure}
          </span>
          <span className="route-id">
            {isTimetable ? formatServiceTime(timelineTime) : prototypeJourney.id}
          </span>
          <span>
            {timelineReady
              ? formatTimelineBoundary(timeline.windowEnd)
              : prototypeJourney.stops.at(-1)?.departure}
          </span>
        </div>
        <label className="scrubber">
          <span className="sr-only">
            {isTimetable ? text.timeOfDay : text.journeyProgress}
          </span>
          <input
            type="range"
            min={timelineReady ? timeline.windowStart : 0}
            max={timelineReady ? timeline.windowEnd : 1}
            step={timelineReady ? 10 : 0.001}
            value={timelineReady ? timelineTime : journeyProgress}
            disabled={isTimetable && !network}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (isHub) setHubTime(value)
              else if (timelineReady) handleNetworkTime(value)
              else setJourneyProgress(value)
            }}
          />
          <span className="progress-value">
            {timelineReady ? formatServiceTime(timelineTime) : formatPercent(journeyProgress)}
          </span>
        </label>
        {isTimetable && hasFullDayTimeline && (
          <div className="time-presets" aria-label={text.timePresets}>
            <span>{text.day}</span>
            <div>
              {DAY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={text.dayPresetNames[preset.id]}
                  aria-label={`${text.dayPresetNames[preset.id]} · ${formatServiceTime(preset.time)}`}
                  aria-pressed={Math.abs(timelineTime - preset.time) < 5 * 60}
                  onClick={() => jumpToTime(preset.time)}
                >
                  {formatServiceTime(preset.time)}
                </button>
              ))}
              <button
                className="director-toggle"
                type="button"
                aria-pressed={directorMode}
                onClick={() => setDirectorMode((value) => !value)}
              >
                {directorMode ? text.stopDirector : text.directorMode}
              </button>
            </div>
          </div>
        )}
        {isTimetable && (
          <div className="speed-picker" aria-label={text.playbackSpeed}>
            <span>{text.tempo}</span>
            <div>
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate.label}
                  type="button"
                  aria-pressed={playbackRate === rate.value}
                  onClick={() => setPlaybackRate(rate.value)}
                >
                  {rate.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mobile-transport-actions">
          <button
            className="mobile-play"
            type="button"
            aria-label={isPlaying ? text.pauseMotion : text.resumeMotion}
            onClick={() => setIsPlaying((value) => !value)}
          >
            <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
          </button>
          {isTimetable && (
            <MobilePicker
              className="mobile-speed-select"
              menuPlacement="up"
              ariaLabel={text.playbackSpeed}
              value={String(playbackRate)}
              options={PLAYBACK_RATES.map((rate) => ({
                value: String(rate.value),
                label: rate.label,
              }))}
              onChange={(rate) => setPlaybackRate(Number(rate))}
            />
          )}
          <details className="mobile-more-controls">
            <summary aria-label={text.moreControls}>•••</summary>
            <div>
              <button type="button" onClick={handleContextAction}>
                {selectedTrain || selectedRoute || selectedStation
                  ? selectedTrain
                    ? networkStudy === 'national'
                      ? text.releaseTrain
                      : text.releaseService
                    : selectedRoute
                      ? text.releaseService
                      : text.clearStation
                  : isNetwork
                    ? text.corridorStudy
                    : networkStudy === 'national'
                      ? text.nationalView
                      : networkStudy === 'zvv-region'
                        ? text.zvvView
                        : networkStudy === 'geneva-tpg'
                          ? text.genevaView
                          : text.zurichView}
              </button>
              {isTimetable && !isContrast && !selectedTrain && !selectedRoute && (
                <button
                  type="button"
                  aria-pressed={isHub}
                  onClick={() => {
                    setSelectedCategory(undefined)
                    setView(isHub ? 'network' : 'hub')
                  }}
                >
                  {isHub ? text.nationalView : text.taktHubs}
                </button>
              )}
              {hasFullDayTimeline && (
                <div className="mobile-day-presets" aria-label={text.timePresets}>
                  <span>{text.timePresets}</span>
                  {DAY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={Math.abs(timelineTime - preset.time) < 5 * 60}
                      onClick={() => jumpToTime(preset.time)}
                    >
                      {text.dayPresetNames[preset.id]}
                      <small>{formatServiceTime(preset.time)}</small>
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={directorMode}
                    onClick={() => setDirectorMode((value) => !value)}
                  >
                    {directorMode ? text.stopDirector : text.directorMode}
                  </button>
                </div>
              )}
              <a className="methodology-link" href="./methodology.html">
                {text.readMethodology}
              </a>
            </div>
          </details>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => setIsPlaying((value) => !value)}>
            <span className="button-icon" aria-hidden="true">
              {isPlaying ? 'Ⅱ' : '▶'}
            </span>
            {isPlaying ? text.pauseMotion : text.resumeMotion}
            <kbd>{text.spaceKey}</kbd>
          </button>
          <button type="button" onClick={handleContextAction}>
            <span className="button-icon camera-icon" aria-hidden="true" />
            {selectedTrain || selectedRoute || selectedStation
              ? selectedTrain
                ? networkStudy === 'national'
                  ? text.releaseTrain
                  : text.releaseService
                : selectedRoute
                  ? text.releaseService
                  : text.clearStation
              : isNetwork
                ? text.corridorStudy
                : networkStudy === 'national'
                  ? text.nationalView
                  : networkStudy === 'zvv-region'
                    ? text.zvvView
                    : networkStudy === 'geneva-tpg'
                      ? text.genevaView
                    : text.zurichView}
            <kbd>C</kbd>
          </button>
          {isTimetable && !isContrast && !selectedTrain && !selectedRoute && (
            <button
              type="button"
              aria-pressed={isHub}
              onClick={() => {
                setSelectedCategory(undefined)
                setView(isHub ? 'network' : 'hub')
              }}
            >
              <span className="button-icon takt-icon" aria-hidden="true">◎</span>
              {isHub
                ? networkStudy === 'national'
                  ? text.nationalView
                  : networkStudy === 'zvv-region'
                    ? text.zvvView
                    : networkStudy === 'geneva-tpg'
                      ? text.genevaView
                    : text.zurichView
                : text.taktHubs}
            </button>
          )}
        </div>
      </section>

      <footer>
        {isTimetable ? (
          <span className="source-links">
            <a
              href={network?.metadata.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Swiss GTFS · {network?.metadata.feedVersion ?? text.loading}
            </a>
            {isNetwork && networkStudy !== 'national' && network?.metadata.geometry && (
              <a
                href={network.metadata.geometry.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {text.stopGeometry} · {networkStudy === 'geneva-tpg' ? 'TPG / SITG' : 'ZVV'}
              </a>
            )}
            {isNetwork && networkStudy === 'national' && boundary && (
              <a href={boundary.metadata.productUrl} target="_blank" rel="noreferrer">
                {text.border} · {boundary.metadata.attribution}
              </a>
            )}
            {isNetwork && lakes && (
              <a href={lakes.metadata.productUrl} target="_blank" rel="noreferrer">
                {text.lakes} · {lakes.metadata.attribution}
              </a>
            )}
            <a href="./methodology.html">{text.methodology}</a>
          </span>
        ) : (
          <span>{prototypeJourney.operator}</span>
        )}
        <span>
          {isHub
            ? text.arrivalsDirection
            : isNetwork
              ? text.interpolation
              : text.simulation}
        </span>
      </footer>
    </main>
  )
}
