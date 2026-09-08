import { useUiText } from './use-ui-text.ts'
import { useNowClock } from '@motionstudies/web/use-now-clock'
import { useBrowserLocation } from '@motionstudies/web/use-browser-location'
import { REGIONAL_DAYS, isRegionalDayStudy, readStudyLink, withinStudy } from './studies/explore.ts'
import { EXPLORE_EN, type ExploreUiCopy } from './studies/explore-ui-en.ts'
import { networkWithRailVisibility } from './studies/network-layers.ts'
import { COGWHEEL_ROUTE_COLORS, cogwheelNetwork } from './studies/cogwheel.ts'
import { useCogwheelCatalogue } from './studies/use-cogwheel-catalogue.ts'
import type { JungfrauTerrainBinding } from './studies/jungfrau-terrain.ts'
import type { RigiTerrainBinding } from './studies/rigi-timetable-terrain.ts'
import { rigiOperator } from './studies/rigi.ts'
import { rigiTerrainCopy as terrainCopyForRigi } from './studies/rigi-terrain.ts'
import { isHeadwayTrain, serviceFrequency, withFrequencyFerryPaths } from './studies/frequency.ts'
import { airTrafficSummary } from './studies/air-traffic-summary.ts'
import { createActiveTrainCounter, orderTrainSearchMatches, trainSearchResults } from './studies/network-ui-index.ts'
import { postbusRouteIndex, postbusRouteSnapshot, postbusTickFollowsSeek, POSTBUS_YELLOW, POSTBUS_ROUTE_COLORS } from './studies/postbus.ts'
import { TransportIcon } from './TransportIcon.tsx'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
} from 'react'
import type {
  GleislichtSoundtrack,
  SoundtrackMode,
} from './audio/gleislicht-soundtrack.ts'
import {
  airTrackSearchValue,
  searchAirTracks,
} from '@motionstudies/core/air-search'
import { MobilePicker } from '@motionstudies/web/components/MobilePicker'
import { searchAirports, type StudyAirport } from '@motionstudies/core/domain/airport'
import {
  activeAirTracks,
  positionForAirTrack,
  type AirSnapshot,
} from '@motionstudies/core/domain/air'
import type { HubDaySnapshot } from '@motionstudies/core/domain/hub'
import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import { positionOnJourney } from '@motionstudies/core/domain/journey'
import {
  isKientalGriesalpTrain,
  rigiCorridorForTrain,
  rigiPendingJourney,
  isRigiCorridorId,
  RIGI_ASCENTS,
  type RigiCorridorId,
  isZurichChurTrain,
  journeyForSwissCorridor,
  SWITZERLAND_PROTOTYPE_JOURNEY,
  swissCorridorProgressForTime,
} from './editions/switzerland-corridors.ts'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from '@motionstudies/core/domain/network-day'
import {
  buildRouteIndex,
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  type NetworkDayChunk,
  type NetworkDayManifest,
  type NetworkSnapshot,
  type NetworkRouteIndexEntry,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from '@motionstudies/core/domain/network'
import { editionDataUrl } from './editions/data-url.ts'
import { motionStudyMark } from './editions/catalogue.ts'
import type {
  SwitzerlandEdition,
  SwitzerlandHubId as HubId,
  SwitzerlandNetworkStudy as NetworkStudy,
  SwitzerlandTerrainCorridorId as TerrainCorridorId,
} from './editions/switzerland.ts'
import {
  SWITZERLAND_HUBS as HUBS,
  SWITZERLAND_MAP_FRAMINGS as MAP_FRAMINGS,
} from './editions/switzerland.ts'
import { SWITZERLAND_AIRPORTS } from './editions/switzerland-airports.ts'
import { SWITZERLAND_ROADS } from './editions/switzerland-roads.ts'
import {
  SERVICE_CATEGORIES,
  SERVICE_COLORS,
} from '@motionstudies/core/theme'
import {
  applyRealtimeSnapshot,
  type RealtimeApplication,
  type RealtimeSnapshot,
} from '@motionstudies/core/domain/realtime'
import type { MapBoundary } from '@motionstudies/core/domain/boundary'
import type { MapWaterBodies } from '@motionstudies/core/domain/lakes'
import {
  reconstructedVehicleCount,
  type RoadTopologyRoad,
  type RoadTopologySnapshot,
  type RoadTrafficSnapshot,
} from '@motionstudies/core/domain/road'
import { reconstructedNationalVehicleCount } from './studies/road-conditions.ts'
import { CANTONAL_RECORDING_COPY } from './studies/cantonal-recording-copy.ts'
import { PILOT_LINK_UNAVAILABLE } from './studies/cantonal-pilot-link-copy.ts'
import { cantonalPilotForRecording, cantonalPilotForRoad, cantonalPilotWindow, searchRoadsWithPilots, topologyWithPilot, type CantonalPilot } from './studies/cantonal-road-pilot.ts'
import {
  roadCorridorSearchValue,
} from '@motionstudies/core/road-search'
import {
  LANGUAGE_LOCALES,
  resolveUiLanguage,
  serviceCategoryLabel,
  UI_LANGUAGES,
  type UiLanguage,
} from './i18n.ts'
import type {
  NationalNetworkSceneProps,
  MapCameraAction,
  MapCameraCommand,
} from '@motionstudies/three/NationalNetworkScene'
import type { MapSelectionSceneExtension } from './studies/GleislichtMapSelection.tsx'
import type { TrainLabelMode } from '@motionstudies/three/train-labels'
import type { JourneyEnvironment } from './studies/GleislichtJourneyScene.tsx'
import {
  nextSearchResultIndex,
  type SearchNavigationKey,
} from '@motionstudies/core/search-navigation'
import { foldSearchText } from '@motionstudies/core/search-text'
import { useProgressiveNetworkDay } from '@motionstudies/web/use-progressive-network-day'
import { useProgressiveAirDay } from '@motionstudies/web/use-progressive-air-day'
import { useProgressiveRoadStudy } from '@motionstudies/web/use-progressive-road-study'
import { useLocalPerformance } from '@motionstudies/web/use-local-performance'

const CantonalRecordingPicker = lazy(() => import('./studies/CantonalRecordingPicker.tsx'))
const StudyBrowser = lazy(() => import('./studies/StudyBrowser.tsx'))

const CantonalPilotControls = lazy(() => import('./studies/CantonalPilotControls.tsx'))

const RoadTrafficHistory = lazy(() => import('./studies/RoadTrafficHistory.tsx').then(module => ({ default: module.RoadTrafficHistory })))

const AirportHeroCard = lazy(() => import('./studies/AirportCard.tsx'))

const AlpineQuiet = lazy(() =>
  import('./studies/AlpineQuiet.tsx').then(({ AlpineQuiet: Scene }) => ({ default: Scene })),
)

const RigiTimetableTerrain = lazy(() => import('./studies/RigiTimetableTerrain.tsx'))
const JungfrauPlaces = lazy(() => import('./studies/JungfrauPlaces.tsx'))
const JungfrauGuide = lazy(() => import('./studies/JungfrauGuide.tsx'))
const JungfrauTerrainScene = lazy(() => import('./studies/JungfrauTerrainScene.tsx'))
const GornergratAscent = lazy(() => import('./studies/GornergratAscent.tsx'))
const JungfrauAscent = lazy(() => import('./studies/JungfrauAscent.tsx'))
const RigiGuide = lazy(() => import('./studies/RigiGuide.tsx'))
const RigiDayRhythm = lazy(() => import('./studies/RigiDayRhythm.tsx'))
const RigiSequence = lazy(() => import('./studies/RigiSequence.tsx'))
const RigiTerrainProfile = lazy(() => import('./studies/RigiTerrainProfile.tsx'))
const GleislichtScene = lazy(() =>
  import('./studies/GleislichtJourneyScene.tsx').then(({ GleislichtScene: Scene }) => ({
    default: Scene,
  })),
)
const NationalNetworkScene = lazy(() =>
  import('@motionstudies/three/NationalNetworkScene').then(
    ({ NationalNetworkScene: Scene }) => ({ default: Scene as ComponentType<NationalNetworkSceneProps & MapSelectionSceneExtension> }),
  ),
)
const HubPulseScene = lazy(() =>
  import('@motionstudies/three/HubPulseScene').then(({ HubPulseScene: Scene }) => ({
    default: Scene,
  })),
)
const StationFlowScene = lazy(() =>
  import('@motionstudies/three/StationFlowScene').then(({ StationFlowScene: Scene }) => ({
    default: Scene,
  })),
)

type View = 'network' | 'hub' | 'journey'
type SoundtrackState = 'off' | 'starting' | 'on' | 'error'
type RecordingState = 'idle' | 'recording' | 'saving' | 'error'
type NationalTimeRange = 'morning' | 'day'
type HubStudy = 'pulse' | 'station'
type OperationsMode = 'scheduled' | 'demo' | 'live'
type RealtimeLoadState = 'idle' | 'loading' | 'ready' | 'error'
type AirLoadState = 'idle' | 'loading' | 'ready' | 'error'
type RoadLoadState = 'idle' | 'loading' | 'ready' | 'error'

const REALTIME_ENDPOINT = import.meta.env.VITE_GLEISLICHT_REALTIME_URL?.trim()
const REALTIME_POLL_INTERVAL_MS = 60_000
const REALTIME_STALE_AFTER_MS = 150_000

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

const PLAYBACK_RATES = [
  { label: '1:1', value: 1 },
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

function initialUiLanguage(edition: SwitzerlandEdition): UiLanguage {
  let savedLanguage: string | null = null
  try {
    savedLanguage = window.localStorage.getItem(edition.languageStorageKey)
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

function formatStudyDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
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

interface AppProps {
  readonly edition: SwitzerlandEdition
}

export function App({ edition }: AppProps) {
  const [webglAvailable] = useState(supportsWebGL)
  const [performanceEnabled] = useState(() =>
    new URLSearchParams(window.location.search).has('perf'),
  )
  const [language, setLanguage] = useState<UiLanguage>(() =>
    initialUiLanguage(edition),
  )
  const [initialLink] = useState(() => readStudyLink(window.location.search))
  const linkedPilot = cantonalPilotForRecording(initialLink.recording)
  const pilotLinkPending = useRef(Boolean(linkedPilot))
  const [pilotLinkUnavailable, setPilotLinkUnavailable] = useState(false)
  const linkPending = useRef(!linkedPilot && Boolean(initialLink.date || initialLink.time !== undefined || initialLink.station || initialLink.train))
  const [exploreOpen, setExploreOpen] = useState(false)
  const [roadRecordingsOpen, setRoadRecordingsOpen] = useState(false)
  const roadRecordingsButton = useRef<HTMLButtonElement>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const shareButton = useRef<HTMLButtonElement>(null)
  const [exploreNotice, setExploreNotice] = useState('')
  const [regionalRange, setRegionalRange] = useState<'morning' | 'day'>(initialLink.range)
  const [regionalRetry, setRegionalRetry] = useState(true)
  const [isPlaying, setIsPlaying] = useState(initialLink.time === undefined && !initialLink.invalidRecording)
  const [view, setView] = useState<View>('network')
  const [journeyProgress, setJourneyProgress] = useState(0.11)
  const [journeyEnvironment, setJourneyEnvironment] = useState<JourneyEnvironment>({
    progress: 0.11,
    tunnel: 0,
    openness: 0.7,
    speed: 0.6,
    region: 'plateau',
  })
  const [playbackTime, setNetworkTime] = useState(linkedPilot ? edition.defaultNetworkTime : initialLink.time ?? edition.defaultNetworkTime)
  const nowRequested = useRef(false)
  const nowResolver = useRef<typeof import('./studies/swiss-now.ts') | undefined>(undefined)
  const [nowDate, setNowDate] = useState('')
  const nowMetadata = useRef<NetworkSnapshot['metadata'] | undefined>(undefined)
  const { active: nowActive, time: nowTime, unavailable: nowUnavailable, start: startNowClock, stop: stopNowClock } = useNowClock(useCallback((instant: Date) => nowResolver.current?.resolveSwissNow(instant, nowMetadata.current) ?? null, []))
  const browserLocation = useBrowserLocation()
  const clearBrowserLocation = browserLocation.clear
  const networkTime = nowActive && nowTime !== null ? nowTime : playbackTime
  const stopNow = useCallback(() => {
    if (nowActive && nowTime !== null) setNetworkTime(nowTime)
    stopNowClock()
    nowRequested.current = false
  }, [nowActive, nowTime, stopNowClock])
  const togglePlayback = () => { stopNow(); setIsPlaying(value => !value) }
  const changePlaybackRate = (rate: number) => { stopNow(); setPlaybackRate(rate) }

  const [hubTime, setHubTime] = useState(edition.defaultHubTime)
  const [networkStudy, setNetworkStudy] = useState<NetworkStudy>(initialLink.study)
  const [nationalTimeRange, setNationalTimeRange] =
    useState<NationalTimeRange>(initialLink.range)
  const [nationalNetwork, setNationalNetwork] = useState<NetworkSnapshot>()
  const [nationalDayManifest, setNationalDayManifest] =
    useState<NetworkDayManifest>()
  const [nationalDayChunks, setNationalDayChunks] = useState<
    Readonly<Record<string, NetworkDayChunk>>
  >({})
  const [nationalDayLoading, setNationalDayLoading] = useState(false)
  const [nationalDayError, setNationalDayError] = useState(false)
  const [zurichCityNetwork, setZurichCityNetwork] = useState<NetworkSnapshot>()
  const [rigiNetwork, setRigiNetwork] = useState<NetworkSnapshot>()
  const [gornergratNetwork, setGornergratNetwork] = useState<NetworkSnapshot>()
  const [gornergratAttempt, setGornergratAttempt] = useState(0)
  const [gornergratAscentActive, setGornergratAscentActive] = useState(false)
  const [jungfrauNetwork, setJungfrauNetwork] = useState<NetworkSnapshot>()
  const [jungfrauAttempt, setJungfrauAttempt] = useState(0)
  const [jungfrauGuideActive, setJungfrauGuideActive] = useState(false)
  const [jungfrauAscentActive, setJungfrauAscentActive] = useState(false)
  const [rigiSequenceActive, setRigiSequenceActive] = useState(false)
  const [rigiRhythmActive, setRigiRhythmActive] = useState(false)
  const [rigiGuideActive, setRigiGuideActive] = useState(false)
  const [jungfrauTerrainBinding, setJungfrauTerrainBinding] = useState<JungfrauTerrainBinding>()
  const [rigiTerrainBinding, setRigiTerrainBinding] = useState<RigiTerrainBinding>()
  const [zvvRegionNetwork, setZvvRegionNetwork] = useState<NetworkSnapshot>()
  const [bernRegionNetwork, setBernRegionNetwork] = useState<NetworkSnapshot>()
  const [bernAttempt, setBernAttempt] = useState(0)
  const [baselCoreNetwork, setBaselCoreNetwork] = useState<NetworkSnapshot>()
  const [baselAttempt, setBaselAttempt] = useState(0)
  const [lausanneRegionNetwork, setLausanneRegionNetwork] = useState<NetworkSnapshot>()
  const [genevaTpgNetwork, setGenevaTpgNetwork] = useState<NetworkSnapshot>()
  const [regionalNetworkLoading, setRegionalNetworkLoading] = useState(initialLink.study !== 'national' && initialLink.study !== 'postbus' && initialLink.study !== 'contrast')
  const [regionalNetworkError, setRegionalNetworkError] = useState(false)
  const [boundary, setBoundary] = useState<MapBoundary>()
  const [lakes, setLakes] = useState<MapWaterBodies>()
  const [corridor, setCorridor] = useState<CorridorSnapshot>()
  const [journeyCorridorId, setJourneyCorridorId] =
    useState<TerrainCorridorId>('zurich-chur')
  const [corridorError, setCorridorError] = useState(false)
  const [hubFunctions, setHubFunctions] = useState<typeof import('@motionstudies/core/domain/hub')>()
  useEffect(() => { if (view === 'hub') { void import('@motionstudies/core/domain/hub').then(setHubFunctions); void import('./studies/hub-layout.css') } }, [view])
  const platformCodeForCall = hubFunctions?.platformCodeForCall ?? (() => '—')
  const [hubDay, setHubDay] = useState<HubDaySnapshot>()
  const [dataError, setDataError] = useState(false)
  const [operationsMode, setOperationsMode] = useState<OperationsMode>(
    REALTIME_ENDPOINT ? 'live' : 'demo',
  )
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>()
  const [realtimeLoadState, setRealtimeLoadState] =
    useState<RealtimeLoadState>('idle')
  const [realtimeClock, setRealtimeClock] = useState(() => Date.now())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [selectedTrainId, setSelectedTrainId] = useState<string>()
  const [selectedStationName, setSelectedStationName] = useState<string>()
  const [selectedRouteId, setSelectedRouteId] = useState<string>()
  const [sbbEnabled, setSbbEnabled] = useState(!linkedPilot)
  const railVisible = sbbEnabled || networkStudy !== 'national'
  const [airEnabled, setAirEnabled] = useState(false)
  const [airCategorySelected, setAirCategorySelected] = useState(false)
  const [airSnapshot, setAirSnapshot] = useState<AirSnapshot>()
  const [airLoadState, setAirLoadState] = useState<AirLoadState>('idle')
  const [selectedAirTrackId, setSelectedAirTrackId] = useState<string>()
  const [selectedAirport, setSelectedAirport] = useState<StudyAirport>()
  const [roadSummary, setRoadSummary] = useState<typeof import('./studies/road-traffic-summary.ts')>()
  const [roadEnabled, setRoadEnabled] = useState(Boolean(linkedPilot))
  useEffect(() => { if (roadEnabled) void import('./studies/road-traffic-summary.ts').then(setRoadSummary) }, [roadEnabled])
  const [roadCategorySelected, setRoadCategorySelected] = useState(false)
  const [roadSnapshot, setRoadSnapshot] = useState<RoadTrafficSnapshot>()
  const [roadTopology, setRoadTopology] = useState<RoadTopologySnapshot>()
  const [roadLoadState, setRoadLoadState] = useState<RoadLoadState>('idle')
  const [selectedRoadId, setSelectedRoadId] = useState<string | undefined>(linkedPilot?.road)
  const pilotClockBounds = useRef<{ windowStart: number; windowEnd: number } | undefined>(undefined)
  const [cantonalPilot, setCantonalPilot] = useState<CantonalPilot>()
  const selectedPilotDefinition = cantonalPilotForRoad(selectedRoadId)
  const activePilot = cantonalPilot && roadEnabled && selectedPilotDefinition?.id === cantonalPilot.metadata.recordingId && !sbbEnabled && !airEnabled && view === 'network' && networkStudy === 'national' ? cantonalPilot : undefined
  const playbackTopology = useMemo(() => roadTopology && activePilot ? topologyWithPilot(roadTopology, activePilot) : roadTopology, [roadTopology, activePilot])
  useEffect(() => {
    if (cantonalPilot && !activePilot) { pilotClockBounds.current = undefined; setCantonalPilot(undefined); setNetworkTime(edition.defaultNetworkTime); setIsPlaying(false) }
  }, [cantonalPilot, activePilot, edition.defaultNetworkTime])
  const [selectedHubId, setSelectedHubId] = useState<HubId>('zurich')
  const [hubStudy, setHubStudy] = useState<HubStudy>('pulse')
  const [showTaktOverlay, setShowTaktOverlay] = useState(true)
  const [mapCameraCommand, setMapCameraCommand] = useState<MapCameraCommand>({
    id: 0,
    action: 'reset',
  })
  const [playbackRate, setPlaybackRate] = useState(120)
  const [directorMode, setDirectorMode] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>()
  const [cogwheelEnabled, setCogwheelEnabled] = useState(false)
  const [trainLabelMode, setTrainLabelMode] = useState<TrainLabelMode>('auto')
  const [soundtrackState, setSoundtrackState] = useState<SoundtrackState>('off')
  const [soundtrackVolume, setSoundtrackVolume] = useState(0.56)
  const [recordingSupported] = useState(
    () =>
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function',
  )
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const soundtrackRef = useRef<GleislichtSoundtrack | null>(null)
  const recordingRef = useRef<{ stop: () => void; cancel: () => void } | null>(null)
  const mobileMapToolsRef = useRef<HTMLDetailsElement>(null)
  const searchInteractionRef = useRef(false)
  const timelineTimeRef = useRef(networkTime)
  const roadHistorySeekRef = useRef<{ time: number; at: number } | undefined>(undefined)
  const postbusSeekRef = useRef<{ time: number; at: number } | undefined>(undefined)
  const text = useUiText(language)
  const [exploreCopy, setExploreCopy] = useState<ExploreUiCopy>(EXPLORE_EN)
  useEffect(() => {
    let current = true
    if (language === 'en') setExploreCopy(EXPLORE_EN)
    else void import('./studies/explore-copy.ts').then(module => { if (current) setExploreCopy(module.EXPLORE_COPY[language]) })
    return () => { current = false }
  }, [language])
  const help = text.controlHelp
  const performanceSample = useLocalPerformance(performanceEnabled)
  const isRigi = networkStudy === 'rigi-lake'
  const isBern = networkStudy === 'bern-region'
  const isBasel = networkStudy === 'basel-core'
  const isLausanne = networkStudy === 'lausanne-region'
  const isGornergrat = networkStudy === 'gornergrat'
  const [gornergratLocale, setGornergratLocale] = useState<typeof import('./studies/gornergrat-copy.ts')>()
  useEffect(() => { if (isGornergrat) void import('./studies/gornergrat-copy.ts').then(setGornergratLocale) }, [isGornergrat])
  const gornergratCopy = gornergratLocale?.GORNERGRAT_COPY[language]
  const isJungfrau = networkStudy === 'jungfrau'
  const isMountainStudy = isRigi || isJungfrau || isGornergrat
  const [jungfrauLocale, setJungfrauLocale] = useState<typeof import('./studies/jungfrau-copy.ts')>()
  useEffect(() => { if (isJungfrau) void import('./studies/jungfrau-copy.ts').then(setJungfrauLocale) }, [isJungfrau])
  const jungfrauCopy = jungfrauLocale?.JUNGFRAU_COPY[language]
  const jungfrauSelect = jungfrauCopy?.select ?? { en: 'Explore the Jungfrau railways', de: 'Jungfraubahnen entdecken', fr: 'Explorer les chemins de fer de la Jungfrau', it: 'Esplora le ferrovie della Jungfrau' }[language]
  const jungfrauTerrainWindow = view === 'network' && isJungfrau && jungfrauAscentActive ? jungfrauTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const timedRigiTerrain = view === 'network' && isRigi && rigiSequenceActive && rigiTerrainBinding && networkTime >= rigiTerrainBinding.sequence.departure && networkTime <= rigiTerrainBinding.sequence.end ? rigiTerrainBinding : undefined
  const [rigiLocale, setRigiLocale] = useState<typeof import('./studies/rigi-copy.ts')>()
  useEffect(() => { if (isRigi) void import('./studies/rigi-copy.ts').then(setRigiLocale) }, [isRigi])
  const rigiSelect = { en: 'Explore Lake Lucerne and Rigi', de: 'Vierwaldstättersee und Rigi entdecken', fr: 'Explorer le lac des Quatre-Cantons et le Rigi', it: 'Esplora il Lago dei Quattro Cantoni e il Rigi' }[language]
  const rigiCopy = rigiLocale?.RIGI_COPY[language] ?? { connections: '', rhythm: 'A day on lake and mountain', sequence: '', select: rigiSelect, title: 'Rigi', placeholder: rigiSelect, modes: '', loading: text.loading, unavailable: text.loading, water: '', cable: '' }
  const isRigiTerrain = isRigiCorridorId(journeyCorridorId)
  const rigiOrigin = isRigiTerrain ? RIGI_ASCENTS[journeyCorridorId].name : 'Vitznau'
  const rigiTerrainCopy = terrainCopyForRigi(language, rigiOrigin)
  const isPostbus = networkStudy === 'postbus'
  const isContrast = networkStudy === 'contrast'
  const serviceColors = useMemo(() => isPostbus || isContrast ? { ...SERVICE_COLORS, bus: POSTBUS_YELLOW } : (isMountainStudy || cogwheelEnabled && networkStudy === 'national' && view === 'network') ? { ...SERVICE_COLORS, other: '#fff3a6' } : SERVICE_COLORS, [isPostbus, isContrast, isMountainStudy, cogwheelEnabled, networkStudy, view])
  const isRegionalDay = isRegionalDayStudy(networkStudy) && regionalRange === 'day'
  const regionalDay = useProgressiveNetworkDay(isRegionalDayStudy(networkStudy) ? REGIONAL_DAYS[networkStudy] : REGIONAL_DAYS['zvv-region'], isRegionalDay && regionalRetry, networkTime, editionDataUrl)
  const postbusDay = useProgressiveNetworkDay(edition.data.postbusDayManifest, isPostbus, networkTime, editionDataUrl)
  const isNationalDay =
    networkStudy === 'national' && nationalTimeRange === 'day'
  const airDay = useProgressiveAirDay(
    edition.data.air.dayManifest,
    airEnabled && isNationalDay,
    networkTime,
    editionDataUrl,
  )
  const federalRoad = useProgressiveRoadStudy(
    edition.data.road.nationalManifest,
    roadEnabled && Boolean(roadTopology) && !activePilot,
    networkTime,
    editionDataUrl,
  )
  const pilotWindow = activePilot ? cantonalPilotWindow(activePilot, networkTime) : undefined
  const nationalRoad = activePilot ? { snapshot: pilotWindow, chunkReady: Boolean(pilotWindow), manifest: undefined } : federalRoad
  const zurichContrast = useProgressiveNetworkDay(
    edition.data.contrast.cityDayManifest,
    isContrast,
    networkTime,
    editionDataUrl,
  )
  const kientalContrast = useProgressiveNetworkDay(
    edition.data.contrast.ruralDayManifest,
    isContrast,
    networkTime,
    editionDataUrl,
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
  const baseNetwork =
    isRegionalDay ? regionalDay.network : isBern ? bernRegionNetwork : isBasel ? baselCoreNetwork : isLausanne ? lausanneRegionNetwork : isGornergrat ? gornergratNetwork : isJungfrau ? jungfrauNetwork : isRigi ? rigiNetwork : isPostbus ? postbusDay.network : isContrast
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

  useEffect(() => { nowMetadata.current = view === 'network' && !isContrast && !airEnabled && !roadEnabled ? baseNetwork?.metadata : undefined }, [view, isContrast, airEnabled, roadEnabled, baseNetwork?.metadata])
  const validLocation = browserLocation.location && withinStudy(browserLocation.location, baseNetwork?.bounds) ? browserLocation.location : undefined
  useEffect(() => {
    if (!nowActive && nowUnavailable && nowTime !== null) { setNetworkTime(nowTime); setIsPlaying(false) }
  }, [nowActive, nowUnavailable, nowTime])
  useEffect(() => {
    if (!validLocation) return
    setMapCameraCommand(current => ({ id: current.id + 1, action: 'focus-location', focus: [validLocation.longitude, validLocation.latitude], distanceScale: 0.025 }))
  }, [validLocation])
  useEffect(() => { clearBrowserLocation() }, [networkStudy, clearBrowserLocation])

  const realtimeApplication = useMemo<RealtimeApplication | undefined>(
    () =>
      baseNetwork && networkStudy === 'national' && realtimeSnapshot && operationsMode !== 'scheduled'
        ? applyRealtimeSnapshot(baseNetwork, realtimeSnapshot)
        : undefined,
    [baseNetwork, networkStudy, operationsMode, realtimeSnapshot],
  )
  const realtimeAgeMs = realtimeSnapshot
    ? Math.max(
        0,
        realtimeClock -
          Date.parse(
            realtimeSnapshot.metadata.receivedAt ??
              realtimeSnapshot.metadata.generatedAt,
          ),
      )
    : 0
  const realtimeStale =
    realtimeSnapshot?.metadata.kind === 'live' &&
    realtimeAgeMs > REALTIME_STALE_AFTER_MS
  const realtimeActive = Boolean(
    realtimeApplication?.compatible && !realtimeStale,
  )
  const unfilteredNetwork = realtimeActive ? realtimeApplication?.network : baseNetwork
  const isCogwheel = cogwheelEnabled && networkStudy === 'national' && view === 'network'
  const cogwheel = useCogwheelCatalogue(isCogwheel, unfilteredNetwork)
  const cogwheelCatalogue = cogwheel?.catalogue
  const [cogwheelLocale, setCogwheelLocale] = useState<typeof import('./studies/cogwheel-copy.ts')>()
  useEffect(() => { if (isCogwheel) void import('./studies/cogwheel-copy.ts').then(setCogwheelLocale) }, [isCogwheel])
  const cogwheelLabel = { en: 'Cogwheel', de: 'Zahnrad', fr: 'Crémaillère', it: 'Cremagliera' }[language]
  const cogwheelCopy = cogwheelLocale?.COGWHEEL_COPY[language] ?? { label: cogwheelLabel, description: cogwheelLabel, placeholder: cogwheelLabel, loading: text.loading, unavailable: text.loading }
  const categoryLabel = useCallback((category: ServiceCategory) => isMountainStudy && category === 'other' ? cogwheelCopy.label : serviceCategoryLabel(language, category), [isMountainStudy, cogwheelCopy.label, language])
  const network = useMemo(() => unfilteredNetwork && isCogwheel
    ? cogwheelNetwork(unfilteredNetwork, cogwheelCatalogue)
    : unfilteredNetwork && withFrequencyFerryPaths(unfilteredNetwork), [unfilteredNetwork, isCogwheel, cogwheelCatalogue])
  const hasHeadwayMotion = useMemo(() => network?.trains.some(isHeadwayTrain) ?? false, [network])
  const [frequencyLocale, setFrequencyLocale] = useState<typeof import('./studies/frequency-copy.ts')>()
  useEffect(() => { if (hasHeadwayMotion) void import('./studies/frequency-copy.ts').then(setFrequencyLocale) }, [hasHeadwayMotion])
  const frequencyCopy = frequencyLocale?.FREQUENCY_COPY[language] ?? { label: '≈', mixed: '≈', arrival: '≈', note: '≈', interpolation: '≈' }
  const quietMap = view === 'network' && networkStudy === 'national' &&
    !sbbEnabled && !airEnabled && !roadEnabled && Boolean(network) && !dataError && webglAvailable
  const activeAirSnapshot = isNationalDay ? airDay.snapshot : airSnapshot
  const airOnly = view === 'network' && networkStudy === 'national' && airEnabled && !sbbEnabled && !roadEnabled
  const roadOnly = view === 'network' && networkStudy === 'national' && roadEnabled && !sbbEnabled && !airEnabled
  const activeAirLoadState: AirLoadState = !airEnabled
    ? 'idle'
    : isNationalDay
      ? airDay.error
        ? 'error'
        : airDay.chunkReady
          ? 'ready'
          : 'loading'
      : airLoadState
  const nationalRoadInWindow = Boolean(
    nationalRoad.snapshot &&
      nationalRoad.chunkReady &&
      networkTime >= nationalRoad.snapshot.metadata.windowStart &&
      networkTime <= nationalRoad.snapshot.metadata.windowEnd,
  )

  const soundtrackMode: SoundtrackMode =
    view === 'hub' ? 'hub' : view === 'journey' || selectedTrainId ? 'journey' : 'network'

  const zurichContrastCounter = useMemo(
    () => createActiveTrainCounter(zurichContrast.network?.trains.filter(train => !selectedCategory || train.category === selectedCategory) ?? []),
    [selectedCategory, zurichContrast.network],
  )
  const kientalContrastCounter = useMemo(
    () => createActiveTrainCounter(kientalContrast.network?.trains.filter(train => !selectedCategory || train.category === selectedCategory) ?? []),
    [kientalContrast.network, selectedCategory],
  )
  const zurichContrastActiveCount = zurichContrastCounter(networkTime)
  const kientalContrastActiveCount = kientalContrastCounter(networkTime)
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
  const selectedFrequency = serviceFrequency(selectedTrain)
  const selectedHeadway = selectedFrequency?.exactTimes === 0
  const selectedAirTrack = useMemo(
    () => activeAirSnapshot?.tracks.find((track) => track.id === selectedAirTrackId),
    [activeAirSnapshot, selectedAirTrackId],
  )
  const selectedAirPosition = useMemo(
    () =>
      selectedAirTrack
        ? positionForAirTrack(selectedAirTrack, networkTime)
        : undefined,
    [networkTime, selectedAirTrack],
  )
  const airSummary = useMemo(
    () =>
      airTrafficSummary(airEnabled && activeAirSnapshot
        ? activeAirTracks(activeAirSnapshot, networkTime)
        : []),
    [activeAirSnapshot, airEnabled, networkTime],
  )
  const activeAircraftCount = airSummary.aircraft
  const activeRoadVehicleCount = useMemo(
    () =>
      roadEnabled && nationalRoad.snapshot && nationalRoadInWindow
        ? reconstructedNationalVehicleCount(
            nationalRoad.snapshot,
            networkTime,
            selectedRoadId,
          )
        : roadEnabled && roadSnapshot && !activePilot
          ? reconstructedVehicleCount(roadSnapshot, networkTime)
        : 0,
    [
      activePilot,
      nationalRoadInWindow,
      nationalRoad.snapshot,
      networkTime,
      roadEnabled,
      roadSnapshot,
      selectedRoadId,
    ],
  )
  const selectedRigiCorridor = rigiCorridorForTrain(selectedTrain, network)
  const corridorTrainSelected =
    isZurichChurTrain(selectedTrain, network) ||
    isKientalGriesalpTrain(selectedTrain, network) ||
    Boolean(selectedRigiCorridor)
  const activeJourney = useMemo(
    () =>
      corridor
        ? journeyForSwissCorridor(corridor, selectedTrain, network)
        : isRigiTerrain ? rigiPendingJourney(journeyCorridorId) : SWITZERLAND_PROTOTYPE_JOURNEY,
    [corridor, isRigiTerrain, journeyCorridorId, network, selectedTrain],
  )
  const journeyPosition = useMemo(
    () => positionOnJourney(activeJourney, journeyProgress),
    [activeJourney, journeyProgress],
  )
  const stationIndex = useMemo(
    () => (network ? buildStationIndex(network) : []),
    [network],
  )
  const routeIndex = useMemo(
    () => (network ? isPostbus ? postbusRouteIndex(network) : buildRouteIndex(network) : []),
    [network, isPostbus],
  )
  const trainSearchDocuments = useMemo(
    () =>
      network?.trains.map((train) => ({
        train,
        text: trainSearchText(train, network) + ' ' + foldSearchText(rigiOperator(train)) + ' ' + foldSearchText(cogwheelCatalogue?.routes[cogwheelCatalogue.trips[train.id]]?.operator ?? ''),
      })) ?? [],
    [network, cogwheelCatalogue],
  )
  const selectedStation = useMemo(
    () => stationIndex.find((station) => station.name === selectedStationName),
    [selectedStationName, stationIndex],
  )
  const selectedRoute = useMemo(
    () => routeIndex.find((route) => route.id === selectedRouteId),
    [routeIndex, selectedRouteId],
  )
  const countableTrains = useMemo(() => {
    const stationTrainIds = selectedStationName
      ? new Set(selectedStation?.trainIds ?? [])
      : undefined
    if (!railVisible) return []
    return network?.trains.filter((train) =>
      (!selectedCategory || train.category === selectedCategory) &&
      (!stationTrainIds || stationTrainIds.has(train.id)) &&
      (!selectedRoute || (train.route === selectedRoute.name && train.category === selectedRoute.category)),
    ) ?? []
  }, [network, railVisible, selectedCategory, selectedRoute, selectedStation, selectedStationName])
  const selectionHasHeadwayMotion = useMemo(() => countableTrains.some(isHeadwayTrain), [countableTrains])
  const activeTrainCounter = useMemo(() => createActiveTrainCounter(countableTrains), [countableTrains])
  const activeTrainCount = activeTrainCounter(networkTime)
  const selectedRoad = useMemo(
    () => (roadTopology?.roads ?? SWITZERLAND_ROADS).find((road) => road.id === selectedRoadId),
    [roadTopology, selectedRoadId],
  )
  const selectedRoadLength = selectedRoad && 'lengthKm' in selectedRoad && typeof selectedRoad.lengthKm === 'number'
    ? selectedRoad.lengthKm
    : SWITZERLAND_ROADS.find(road => road.id === selectedRoadId)?.lengthKm
  const selectedRoadGeometryOnly = (selectedRoad?.id.startsWith('ZH:') ?? false) && !activePilot
  const selectedRoadTraffic = useMemo(
    () => selectedRoadId && roadEnabled
      ? roadSummary?.roadTrafficSummary(selectedRoadId, networkTime, nationalRoadInWindow ? nationalRoad.snapshot : undefined, activePilot ? undefined : roadSnapshot)
      : undefined,
    [selectedRoadId, roadEnabled, networkTime, nationalRoadInWindow, nationalRoad.snapshot, roadSnapshot, roadSummary, activePilot],
  )
  const roadMetricFormat = useMemo(() => new Intl.NumberFormat(LANGUAGE_LOCALES[language], { maximumFractionDigits: 1 }), [language])
  const roadOverview = useMemo(
    () => roadOnly
      ? roadSummary?.roadTrafficSummary(undefined, networkTime, nationalRoadInWindow ? nationalRoad.snapshot : undefined, activePilot ? undefined : roadSnapshot)
      : undefined,
    [roadOnly, networkTime, nationalRoadInWindow, nationalRoad.snapshot, roadSnapshot, roadSummary, activePilot],
  )
  const sceneNetwork = useMemo(
    () => network && (activePilot
      ? { ...networkWithRailVisibility(network, false), trains: [], metadata: { ...network.metadata, serviceDate: activePilot.metadata.serviceDate, windowStart: activePilot.metadata.windowStart, windowEnd: activePilot.metadata.windowEnd } }
      : isPostbus ? postbusRouteSnapshot(network, selectedRoute) : networkWithRailVisibility(network, railVisible)),
    [network, railVisible, isPostbus, selectedRoute, activePilot],
  )
  const selectedPosition = useMemo(
    () => (selectedTrain ? positionForTrain(selectedTrain, networkTime) : undefined),
    [networkTime, selectedTrain],
  )
  const selectedHub = HUBS.find((hub) => hub.id === selectedHubId) ?? HUBS[0]
  const hubCalls = useMemo(
    () => hubDay?.hubs[selectedHub.id] ?? (network ? hubFunctions?.callsAtHub(network, selectedHub) ?? [] : []),
    [hubDay, network, selectedHub, hubFunctions],
  )
  const nearbyHubCalls = useMemo(
    () => hubFunctions?.callsNearTime(hubCalls, hubTime) ?? [],
    [hubCalls, hubTime, hubFunctions],
  )
  const upcomingHubCall = useMemo(
    () => hubFunctions?.nextHubCall(hubCalls, hubTime),
    [hubCalls, hubTime, hubFunctions],
  )
  const hubPlatforms = useMemo(() => hubFunctions?.platformsForCalls(hubCalls) ?? [], [hubCalls, hubFunctions])
  const selectedFrom =
    network && selectedPosition
      ? network.stops[selectedPosition.fromStop]?.[2]
      : undefined
  const selectedTo =
    network && selectedPosition ? network.stops[selectedPosition.toStop]?.[2] : undefined
  const orderedSearchMatches = useMemo(() => {
    const query = foldSearchText(searchQuery)
    if (!network || query.length < 1) return []
    return orderTrainSearchMatches(trainSearchDocuments
      .filter((document) => document.text.includes(query))
      .map((document) => document.train), LANGUAGE_LOCALES[language])
  }, [language, network, searchQuery, trainSearchDocuments])
  const searchResults = useMemo(() => trainSearchResults(orderedSearchMatches, networkTime), [orderedSearchMatches, networkTime])
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
          `${categoryLabel(route.category)} ${route.category.replaceAll('-', ' ')} ${route.name} ${isPostbus ? route.headsigns.join(' ') : ''} ${isCogwheel ? route.trainIds.map(id => cogwheelCatalogue?.routes[cogwheelCatalogue.trips[id]]?.operator ?? '').join(' ') : ''}`,
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
  }, [categoryLabel, isPostbus, isCogwheel, cogwheelCatalogue, language, routeIndex, searchQuery])
  const roadSearchResults = useMemo(
    () => searchRoadsWithPilots(roadTopology?.roads ?? SWITZERLAND_ROADS, searchQuery),
    [roadTopology?.roads, searchQuery],
  )
  const airportSearchResults = useMemo(
    () => searchAirports(SWITZERLAND_AIRPORTS, searchQuery),
    [searchQuery],
  )
  const airSearchResults = useMemo(
    () =>
      airEnabled
        ? isNationalDay
          ? searchAirTracks(
              airDay.manifest?.aircraft ?? [],
              searchQuery,
              networkTime,
            )
          : searchAirTracks(
              activeAirSnapshot?.tracks ?? [],
              searchQuery,
              networkTime,
            )
        : [],
    [activeAirSnapshot, airDay.manifest, airEnabled, isNationalDay, networkTime, searchQuery],
  )
  const searchResultCount =
    stationSearchResults.length +
    routeSearchResults.length +
    roadSearchResults.length +
    airportSearchResults.length +
    airSearchResults.length +
    searchResults.length
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
      (category) => (category.id !== 'other' || isMountainStudy) && present.has(category.id),
    )
  }, [hubCalls, isMountainStudy, isContrast, kientalContrast.network, network, view, zurichContrast.network])

  const handleJourneyProgress = useCallback((nextProgress: number) => {
    setJourneyProgress(nextProgress)
  }, [])
  const handleJourneyEnvironment = useCallback((next: JourneyEnvironment) => {
    soundtrackRef.current?.setEnvironment(next)
    setJourneyEnvironment((current) =>
      current.tunnelName !== next.tunnelName ||
      current.region !== next.region ||
      Math.abs(current.openness - next.openness) > 0.08
        ? next
        : current,
    )
  }, [])
  const handleNetworkTime = useCallback(
    (nextTime: number) => {
      roadHistorySeekRef.current = undefined
      if (isPostbus || isRegionalDay) postbusSeekRef.current = { time: nextTime, at: performance.now() }
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
      isPostbus,
      isRegionalDay,
      nationalDayChunks,
      nationalDayManifest,
      nationalTimeRange,
      networkStudy,
    ],
  )
  const handleSceneNetworkTime = useCallback((nextTime: number) => {
    const pilotBounds = pilotClockBounds.current
    if (pilotBounds && (nextTime < pilotBounds.windowStart || nextTime > pilotBounds.windowEnd)) return
    const roadSeek = roadHistorySeekRef.current
    if (roadSeek && !postbusTickFollowsSeek(nextTime, roadSeek.time, (performance.now() - roadSeek.at) / 1000, playbackRate)) return
    roadHistorySeekRef.current = undefined
    if (!isPostbus && !isRegionalDay) { handleNetworkTime(nextTime); return }
    const seek = postbusSeekRef.current
    if (seek && !postbusTickFollowsSeek(nextTime, seek.time, (performance.now() - seek.at) / 1000, playbackRate)) return
    postbusSeekRef.current = undefined
    setNetworkTime(nextTime)
  }, [handleNetworkTime, isPostbus, isRegionalDay, playbackRate])
  useEffect(() => {
    // Resuming may wrap the two-hour study. The paused seek has already been
    // applied, so subsequent scene ticks can own the playback clock again.
    if (isPlaying || !selectedRoadId) roadHistorySeekRef.current = undefined
  }, [isPlaying, selectedRoadId])
  const moveMapCamera = useCallback((action: MapCameraAction) => {
    setMapCameraCommand((current) => ({ id: current.id + 1, action }))
  }, [])
  const ignoreNetworkTime = useCallback(() => {}, [])

  const releaseSelection = useCallback(() => {
    setJungfrauTerrainBinding(undefined)
    setJungfrauGuideActive(false)
    setRigiRhythmActive(false)
    setRigiSequenceActive(false)
    setGornergratAscentActive(false); setJungfrauAscentActive(false)
    setRigiTerrainBinding(undefined)
    setSelectedTrainId(undefined)
    setSelectedStationName(undefined)
    setSelectedRouteId(undefined)
    setSelectedAirTrackId(undefined)
    setSelectedAirport(undefined)
    setSelectedRoadId(undefined)
    setSearchQuery('')
    setActiveSearchIndex(-1)
  }, [setRigiSequenceActive, setJungfrauAscentActive, setJungfrauGuideActive])

  const seekMountainSequence = useCallback((time: number) => {
    setNetworkTime(time)
    setIsPlaying(false)
  }, [])
  const followMountainSequence = useCallback((trainId: string | undefined, station: string | undefined) => {
    setSelectedTrainId(trainId)
    setSelectedStationName(station)
    if (station) setMapCameraCommand(current => ({ id: current.id + 1, action: 'reveal-station' }))
  }, [])
  const finishRigiTerrain = useCallback(() => setIsPlaying(false), [])
  const startRigiSequence = () => {
    releaseSelection()
    setSelectedCategory(undefined)
    setDirectorMode(false)
    setSearchOpen(false)
    setIsPlaying(false)
    setRigiSequenceActive(true)
  }

  const startGornergratAscent = () => {
    releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setIsPlaying(false); setGornergratAscentActive(true)
  }
  const startJungfrauAscent = () => {
    releaseSelection()
    setSelectedCategory(undefined)
    setDirectorMode(false)
    setSearchOpen(false)
    setIsPlaying(false)
    setJungfrauAscentActive(true)
  }

  const toggleOperationsMode = useCallback(() => {
    setOperationsMode((current) =>
      current === 'scheduled'
        ? REALTIME_ENDPOINT
          ? 'live'
          : 'demo'
        : 'scheduled',
    )
  }, [])

  const toggleCogwheel = useCallback(() => {
    setCogwheelEnabled(current => !current)
    setSbbEnabled(true)
    setSelectedCategory(undefined)
    setAirCategorySelected(false)
    setRoadCategorySelected(false)
    releaseSelection()
  }, [releaseSelection])

  const selectStation = useCallback((station: StationIndexEntry) => {
    setRigiSequenceActive(false)
    setGornergratAscentActive(false); setJungfrauAscentActive(false)
    setSbbEnabled(true)
    setAirCategorySelected(false)
    setRoadCategorySelected(false)
    setSelectedAirTrackId(undefined)
    setSelectedAirport(undefined)
    setSelectedTrainId(undefined)
    setSelectedRouteId(undefined)
    setSelectedRoadId(undefined)
    setSelectedStationName(station.name)
    setSearchQuery(station.name)
    setSearchOpen(false)
    setActiveSearchIndex(-1)
    setView('network')
    setMapCameraCommand((current) => ({
      id: current.id + 1,
      action: 'reveal-station',
    }))
  }, [setRigiSequenceActive, setJungfrauAscentActive])

  const selectRoute = useCallback(
    (route: NetworkRouteIndexEntry) => {
      setRigiSequenceActive(false)
      setGornergratAscentActive(false); setJungfrauAscentActive(false)
      setSbbEnabled(true)
      setAirCategorySelected(false)
      setRoadCategorySelected(false)
      setSelectedTrainId(undefined)
      setSelectedAirTrackId(undefined)
      setSelectedAirport(undefined)
      setSelectedStationName(undefined)
      setSelectedRoadId(undefined)
      setSelectedRouteId(route.id)
      setSelectedCategory(undefined)
      setSearchQuery(
        `${categoryLabel(route.category)} ${route.name}`,
      )
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      setView('network')
      setIsPlaying(true)
    },
    [categoryLabel, setRigiSequenceActive, setJungfrauAscentActive],
  )

  const selectTrain = useCallback(
    (train: NetworkTrain) => {
      if (!network) return
      setRigiSequenceActive(false)
      setGornergratAscentActive(false); setJungfrauAscentActive(false)
      setSbbEnabled(true)
      setAirCategorySelected(false)
      setRoadCategorySelected(false)
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
      setSelectedAirTrackId(undefined)
      setSelectedAirport(undefined)
      setSelectedStationName(undefined)
      setSelectedRouteId(undefined)
      setSelectedRoadId(undefined)
      setSearchQuery(`${train.route} ${train.shortName} → ${train.headsign}`)
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      setView('network')
      setIsPlaying(true)
    },
    [network, networkTime, setRigiSequenceActive, setJungfrauAscentActive],
  )

  const selectAirTrack = useCallback(
    (trackId: string) => {
      setAirCategorySelected(false)
      setRoadCategorySelected(false)
      const track =
        activeAirSnapshot?.tracks.find((candidate) => candidate.id === trackId) ??
        airDay.manifest?.aircraft.find((candidate) => candidate.id === trackId)
      if (track) {
        setNetworkTime((current) =>
          current >= track.start && current <= track.end
            ? current
            : Math.min(track.end, track.start + 10),
        )
      }
      setSelectedTrainId(undefined)
      setSelectedStationName(undefined)
      setSelectedRouteId(undefined)
      setSelectedRoadId(undefined)
      setSelectedCategory(undefined)
      setSelectedAirTrackId(trackId)
      setSelectedAirport(undefined)
      setSearchQuery(track ? airTrackSearchValue(track) : '')
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      setIsPlaying(true)
    },
    [activeAirSnapshot, airDay.manifest],
  )

  const toggleSbbLayer = useCallback(() => {
    setSbbEnabled((current) => !current)
    setSelectedTrainId(undefined)
    setSelectedStationName(undefined)
    setSelectedRouteId(undefined)
    setSelectedCategory(undefined)
    setSearchQuery('')
    setSearchOpen(false)
    setActiveSearchIndex(-1)
  }, [])

  const toggleAirLayer = useCallback(() => {
    if (airEnabled) {
      setAirEnabled(false)
      setAirCategorySelected(false)
      setSelectedAirTrackId(undefined)
      setSelectedAirport(undefined)
      return
    }
    releaseSelection()
    setAirLoadState(airSnapshot ? 'ready' : 'loading')
    setAirEnabled(true)
    if (
      !isNationalDay &&
      airSnapshot &&
      (networkTime < airSnapshot.metadata.windowStart ||
        networkTime > airSnapshot.metadata.windowEnd)
    ) {
      setNetworkTime(
        (airSnapshot.metadata.windowStart + airSnapshot.metadata.windowEnd) / 2,
      )
    }
  }, [airEnabled, airSnapshot, isNationalDay, networkTime, releaseSelection])

  const toggleRoadLayer = useCallback(() => {
    if (roadEnabled) {
      setRoadEnabled(false)
      setRoadCategorySelected(false)
      setSelectedRoadId(undefined)
      return
    }
    releaseSelection()
    setRoadLoadState(roadSnapshot ? 'ready' : 'loading')
    setRoadEnabled(true)
    if (
      roadSnapshot &&
      (networkTime < roadSnapshot.metadata.windowStart ||
        networkTime > roadSnapshot.metadata.windowEnd)
    ) {
      setNetworkTime(
        (roadSnapshot.metadata.windowStart + roadSnapshot.metadata.windowEnd) / 2,
      )
    }
  }, [networkTime, releaseSelection, roadEnabled, roadSnapshot])

  const selectRoad = useCallback((road: RoadTopologyRoad) => {
    setDirectorMode(false)
    setNetworkStudy('national')
    setNationalTimeRange('morning')
    if (!roadEnabled) toggleRoadLayer()
    setSelectedTrainId(undefined)
    setSelectedStationName(undefined)
    setSelectedRouteId(undefined)
    setSelectedAirTrackId(undefined)
    setSelectedAirport(undefined)
    setSelectedCategory(undefined)
    setAirCategorySelected(false)
    setRoadCategorySelected(true)
    setSelectedRoadId(road.id)
    setSearchQuery(roadCorridorSearchValue(road))
    setSearchOpen(false)
    setActiveSearchIndex(-1)
    setView('network')
    setMapCameraCommand((current) => ({
      id: current.id + 1,
      action: 'focus-road',
      focus: road.focus,
      distanceScale: road.cameraScale,
    }))
  }, [roadEnabled, toggleRoadLayer])

  const openTerrainCorridor = useCallback(
    (nextCorridorId: TerrainCorridorId, nextProgress = 0.015) => {
      setJourneyCorridorId(nextCorridorId)
      setCorridor((current) =>
        current?.id === nextCorridorId ? current : undefined,
      )
      setJourneyProgress(nextProgress)
      setJourneyEnvironment((current) => ({
        ...current,
        progress: nextProgress,
        tunnel: 0,
        tunnelName: undefined,
        region: nextCorridorId === 'kiental-griesalp' || nextCorridorId === 'arth-goldau-rigi' ? 'alpine' : nextCorridorId === 'vitznau-rigi' ? 'lake' : 'plateau',
      }))
      setCorridorError(false)
      setSearchOpen(false)
      setRigiSequenceActive(false)
      setGornergratAscentActive(false); setJungfrauAscentActive(false)
      setView('journey')
      setIsPlaying(true)
    },
    [setRigiSequenceActive, setJungfrauAscentActive],
  )

  const enterTerrainCorridor = useCallback(() => {
    if (!selectedTrain || !network || !corridorTrainSelected) {
      return
    }
    const nextCorridorId = isKientalGriesalpTrain(selectedTrain, network)
      ? 'kiental-griesalp'
      : selectedRigiCorridor ?? 'zurich-chur'
    openTerrainCorridor(nextCorridorId, nextCorridorId === 'zurich-chur'
      ? swissCorridorProgressForTime(selectedTrain, network, networkTime)
      : 0.015)
  }, [corridorTrainSelected, network, networkTime, openTerrainCorridor, selectedTrain, selectedRigiCorridor])

  const enterKientalCorridor = useCallback(() => {
    openTerrainCorridor('kiental-griesalp')
  }, [openTerrainCorridor])

  const selectNetworkStudy = useCallback(
    (study: NetworkStudy, timeRange: NationalTimeRange = nationalTimeRange) => {
      stopNow()
      linkPending.current = false
      setExploreNotice('')
      setRegionalRetry(true)
      setDirectorMode(false)
      postbusSeekRef.current = undefined
      setNetworkStudy(study)
      if (study !== 'national') setCogwheelEnabled(false)
      setView('network')
      setSelectedCategory(undefined)
      releaseSelection()
      if (study !== 'national') setAirEnabled(false)
      if (study !== 'national') setAirCategorySelected(false)
      if (study !== 'national' || timeRange === 'day') setRoadEnabled(false)
      if (study !== 'national' || timeRange === 'day') {
        setRoadCategorySelected(false)
      }
      if (study === 'bern-region' || study === 'lausanne-region' || study === 'basel-core') setRegionalRange('day')
      if (study === 'national') setNationalTimeRange(timeRange)
      if (study === 'bern-region') setSelectedHubId('bern')
      if (study === 'basel-core') setSelectedHubId('basel')
      if (study === 'geneva-tpg') setSelectedHubId('geneva')
      if (study === 'zvv-region' || study === 'zurich-city') {
        setSelectedHubId('zurich')
      }
      const regionalSnapshot =
        study === 'bern-region' ? bernRegionNetwork : study === 'basel-core' ? baselCoreNetwork : study === 'lausanne-region' ? lausanneRegionNetwork : study === 'gornergrat' ? gornergratNetwork : study === 'jungfrau' ? jungfrauNetwork : study === 'rigi-lake' ? rigiNetwork : study === 'zurich-city'
          ? zurichCityNetwork
          : study === 'zvv-region'
            ? zvvRegionNetwork
            : study === 'geneva-tpg'
              ? genevaTpgNetwork
              : undefined
      setRegionalNetworkLoading(
        study !== 'national' && study !== 'contrast' && study !== 'postbus' && !regionalSnapshot,
      )
      if (study !== 'national' && study !== 'contrast' && study !== 'postbus') {
        setRegionalNetworkError(false)
      }
      if (study === 'contrast' || study === 'rigi-lake' || study === 'jungfrau' || study === 'gornergrat') setNetworkTime(12 * 3600)
      if (study === 'postbus') setNetworkTime(edition.defaultNetworkTime)
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
      stopNow,
      edition.defaultNetworkTime,
      nationalDayNetwork,
      bernRegionNetwork,
      baselCoreNetwork,
    lausanneRegionNetwork,
      genevaTpgNetwork,
      rigiNetwork,
      jungfrauNetwork,
      gornergratNetwork,
      nationalDayManifest,
      nationalNetwork,
      nationalTimeRange,
      releaseSelection,
      zurichCityNetwork,
      zvvRegionNetwork,
    ],
  )

  const selectAirport = useCallback((airport: StudyAirport) => {
    selectNetworkStudy('national')
    if (!airEnabled) toggleAirLayer()
    setAirCategorySelected(false)
    setRoadCategorySelected(false)
    setSelectedAirport(airport)
    setSearchQuery(airport.name)
    setSearchOpen(false)
    setActiveSearchIndex(-1)
    setMapCameraCommand(current => ({
      id: current.id + 1,
      action: 'focus-location',
      focus: [airport.longitude, airport.latitude],
      distanceScale: 0.12,
    }))
  }, [airEnabled, selectNetworkStudy, toggleAirLayer])

  const handleContextAction = useCallback(() => {
    setDirectorMode(false)
    if (
      view === 'network' &&
      (selectedTrainId ||
        selectedStationName ||
        selectedRouteId ||
        selectedAirTrackId ||
        selectedAirport ||
        selectedRoadId)
    ) {
      releaseSelection()
      return
    }
    setView((value) => (value === 'network' ? 'journey' : 'network'))
  }, [
    releaseSelection,
    selectedAirTrackId,
    selectedAirport,
    selectedRoadId,
    selectedRouteId,
    selectedStationName,
    selectedTrainId,
    view,
  ])

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

  const toggleRecording = useCallback(async () => {
    if (recordingState === 'recording') {
      setRecordingState('saving')
      recordingRef.current?.cancel()
      return
    }
    if (recordingState === 'saving') return
    const canvas = document.querySelector<HTMLCanvasElement>('.scene canvas')
    if (!canvas) return
    try {
      const { recordCanvas } = await import('@motionstudies/web/recording')
      setRecordingState('recording')
      recordingRef.current = recordCanvas(canvas, {
        duration: 12_000,
        fileNamePrefix: edition.id,
        onSaving: () => setRecordingState('saving'),
        onComplete: () => {
          recordingRef.current = null
          setRecordingState('idle')
        },
      })
    } catch (error: unknown) {
      console.warn('Unable to record the Gleislicht canvas', error)
      recordingRef.current = null
      setRecordingState('error')
    }
  }, [edition.id, recordingState])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = text.pageTitle
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', text.pageDescription)
    try {
      window.localStorage.setItem(edition.languageStorageKey, language)
    } catch {
      // Language still applies for this visit when storage is unavailable.
    }
  }, [edition.languageStorageKey, language, text.pageDescription, text.pageTitle])

  useEffect(() => {
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.nationalMorning), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GTFS snapshot returned ${response.status}`)
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        setNationalNetwork(snapshot)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setDataError(true)
      })
    fetch(editionDataUrl(edition.data.boundary), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary snapshot returned ${response.status}`)
        return response.json() as Promise<MapBoundary>
      })
      .then(setBoundary)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the Swiss national boundary', error)
      })
    fetch(editionDataUrl(edition.data.water), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Lake snapshot returned ${response.status}`)
        return response.json() as Promise<MapWaterBodies>
      })
      .then(setLakes)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the Swiss lake layer', error)
      })
    return () => controller.abort()
  }, [edition.data.boundary, edition.data.nationalMorning, edition.data.water])

  useEffect(() => {
    if (!airEnabled || isNationalDay || airSnapshot) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.air.morning), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Luftraum snapshot returned ${response.status}`)
        }
        return response.json() as Promise<AirSnapshot>
      })
      .then((snapshot) => {
        if (controller.signal.aborted) return
        setAirSnapshot(snapshot)
        setAirLoadState('ready')
        if (
          timelineTimeRef.current < snapshot.metadata.windowStart ||
          timelineTimeRef.current > snapshot.metadata.windowEnd
        ) {
          setNetworkTime(
            (snapshot.metadata.windowStart + snapshot.metadata.windowEnd) / 2,
          )
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the historical Luftraum study', error)
        setAirLoadState('error')
      })
    return () => controller.abort()
  }, [airEnabled, airSnapshot, edition.data.air.morning, isNationalDay])

  useEffect(() => {
    if (!roadEnabled || (roadSnapshot && roadTopology)) return
    const controller = new AbortController()
    Promise.all([
      fetch(editionDataUrl(edition.data.road.morning), {
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Road study returned ${response.status}`)
        }
        return response.json() as Promise<RoadTrafficSnapshot>
      }),
      fetch(editionDataUrl(edition.data.road.topology), {
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Road topology returned ${response.status}`)
        }
        return (response.json() as Promise<RoadTopologySnapshot>).then(async topology =>
          (await import('./studies/cantonal-road-topology.ts')).loadCantonalRoadGeometry(topology, editionDataUrl('zurich-cantonal-road-topology.json'), controller.signal),
        )
      }),
    ])
      .then(([snapshot, topology]) => {
        if (controller.signal.aborted) return
        setRoadSnapshot(snapshot)
        setRoadTopology(topology)
        setRoadLoadState('ready')
        if (
          timelineTimeRef.current < snapshot.metadata.windowStart ||
          timelineTimeRef.current > snapshot.metadata.windowEnd
        ) {
          setNetworkTime(
            (snapshot.metadata.windowStart + snapshot.metadata.windowEnd) / 2,
          )
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Unable to load the road study and national topology', error)
        setRoadLoadState('error')
      })
    return () => controller.abort()
  }, [
    edition.data.road.morning,
    edition.data.road.topology,
    roadEnabled,
    roadSnapshot,
    roadTopology,
  ])

  useEffect(() => {
    if (operationsMode === 'scheduled') return
    const controller = new AbortController()
    const source =
      operationsMode === 'live' && REALTIME_ENDPOINT
        ? REALTIME_ENDPOINT
        : editionDataUrl(edition.data.realtimeDemo)
    let interval: number | undefined
    const load = async () => {
      setRealtimeLoadState((current) =>
        current === 'ready' ? current : 'loading',
      )
      try {
        const response = await fetch(source, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) {
          throw new Error(`Realtime snapshot returned ${response.status}`)
        }
        const snapshot = (await response.json()) as RealtimeSnapshot
        if (!controller.signal.aborted) {
          setRealtimeSnapshot(snapshot)
          setRealtimeClock(Date.now())
          setRealtimeLoadState('ready')
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          console.warn('Unable to load realtime adjustments', error)
          setRealtimeLoadState('error')
        }
      }
    }
    void load()
    if (operationsMode === 'live') {
      interval = window.setInterval(() => void load(), REALTIME_POLL_INTERVAL_MS)
    }
    return () => {
      controller.abort()
      if (interval !== undefined) window.clearInterval(interval)
    }
  }, [edition.data.realtimeDemo, operationsMode])

  useEffect(() => {
    if (operationsMode !== 'live') return
    const interval = window.setInterval(
      () => setRealtimeClock(Date.now()),
      15_000,
    )
    return () => window.clearInterval(interval)
  }, [operationsMode])

  useEffect(() => {
    if (view !== 'hub' || hubDay) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.hubDay), {
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
  }, [edition.data.hubDay, hubDay, view])

  useEffect(() => {
    if (view !== 'journey' || corridor || corridorError) return
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.corridors[journeyCorridorId]), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Terrain corridor returned ${response.status}`)
        }
        return response.json() as Promise<CorridorSnapshot>
      })
      .then((snapshot) => {
        if (controller.signal.aborted) return
        if (snapshot.id !== journeyCorridorId || !snapshot.route?.points?.length || !snapshot.terrain?.elevations?.length) throw new Error('Incomplete or mismatched terrain corridor')
        setCorridor(snapshot)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn(`Unable to load the ${journeyCorridorId} terrain corridor`, error)
        setCorridorError(true)
      })
    return () => controller.abort()
  }, [corridor, corridorError, edition.data.corridors, journeyCorridorId, view])

  useEffect(() => {
    if (
      networkStudy !== 'national' ||
      nationalTimeRange !== 'day' ||
      nationalDayManifest
    ) {
      return
    }
    const controller = new AbortController()
    fetch(editionDataUrl(edition.data.nationalDayManifest), {
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
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNationalDayError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setNationalDayLoading(false)
    })
    return () => controller.abort()
  }, [
    edition.data.nationalDayManifest,
    nationalDayManifest,
    nationalTimeRange,
    networkStudy,
  ])

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
    if (networkStudy === 'national' || networkStudy === 'contrast' || networkStudy === 'postbus') return
    const existingNetwork =
      isBern ? bernRegionNetwork : isBasel ? baselCoreNetwork : isLausanne ? lausanneRegionNetwork : isGornergrat ? gornergratNetwork : isJungfrau ? jungfrauNetwork : isRigi ? rigiNetwork : networkStudy === 'zurich-city'
        ? zurichCityNetwork
        : networkStudy === 'zvv-region'
          ? zvvRegionNetwork
          : genevaTpgNetwork
    if (existingNetwork) return
    const controller = new AbortController()
    const isCity = networkStudy === 'zurich-city'
    const isZvv = networkStudy === 'zvv-region'
    const fileName = edition.data.regional[networkStudy]
    fetch(editionDataUrl(fileName), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          const studyName = isBern ? 'Bern' : isBasel ? 'Basel' : isLausanne ? 'Lausanne' : isGornergrat ? 'Gornergrat' : isJungfrau ? 'Jungfrau' : isRigi ? 'Lake Lucerne–Rigi' : isCity ? 'Zürich city' : isZvv ? 'ZVV' : 'Genève / TPG'
          throw new Error(`${studyName} snapshot returned ${response.status}`)
        }
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        if (isBern) setBernRegionNetwork(snapshot)
        else if (isBasel) setBaselCoreNetwork(snapshot)
        else if (isLausanne) setLausanneRegionNetwork(snapshot)
        else if (isGornergrat) setGornergratNetwork(snapshot)
        else if (isJungfrau) setJungfrauNetwork(snapshot)
        else if (isRigi) setRigiNetwork(snapshot)
        else if (isCity) setZurichCityNetwork(snapshot)
        else if (isZvv) setZvvRegionNetwork(snapshot)
        else setGenevaTpgNetwork(snapshot)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRegionalNetworkError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRegionalNetworkLoading(false)
      })
    return () => controller.abort()
  }, [
    edition.data.regional,
    isBasel,
    baselAttempt,
    isBern,
    bernAttempt,
    bernRegionNetwork,
    isLausanne,
    isRigi,
    rigiNetwork,
    isGornergrat,
    gornergratNetwork,
    gornergratAttempt,
    isJungfrau,
    jungfrauNetwork,
    jungfrauAttempt,
    baselCoreNetwork,
    lausanneRegionNetwork,
    genevaTpgNetwork,
    networkStudy,
    zurichCityNetwork,
    zvvRegionNetwork,
  ])

  useEffect(() => {
    if (!searchOpen || resolvedActiveSearchIndex < 0) return
    document
      .getElementById(`train-search-result-${resolvedActiveSearchIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [resolvedActiveSearchIndex, searchOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      ) {
        return
      }
      if (event.key === ' ' || event.key.toLowerCase() === 'p') {
        event.preventDefault()
        stopNow(); setIsPlaying((value) => !value)
      }
      if (event.key.toLowerCase() === 'c') handleContextAction()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleContextAction, stopNow])

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

  useEffect(() => {
    if (view === 'journey') return
    soundtrackRef.current?.setEnvironment({
      progress: 0,
      tunnel: 0,
      openness: 1,
      speed: 0.5,
    })
  }, [view])

  useEffect(
    () => () => {
      soundtrackRef.current?.dispose()
      soundtrackRef.current = null
      recordingRef.current?.stop()
      recordingRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (view !== 'network' || airEnabled || roadEnabled || selectedTrainId || directorMode) stopNow()
  }, [view, airEnabled, roadEnabled, selectedTrainId, directorMode, stopNow])

  const isNetwork = view === 'network'
  const isHub = view === 'hub'
  const isTimetable = isNetwork || isHub
  const operationsBadge =
    operationsMode === 'scheduled'
      ? 'PLAN'
      : realtimeLoadState === 'loading'
        ? 'SYNC'
        : realtimeLoadState === 'error'
          ? 'OFF'
          : !realtimeApplication?.compatible
            ? 'MATCH'
            : realtimeStale
              ? 'STALE'
              : realtimeSnapshot?.metadata.kind === 'live'
                ? 'LIVE'
                : 'DEMO'
  const operationsDescription =
    operationsMode === 'scheduled'
      ? text.operationsPlan
      : realtimeLoadState === 'loading'
        ? text.operationsLoading
        : realtimeLoadState === 'error'
          ? text.operationsUnavailable
          : !realtimeApplication?.compatible
            ? text.operationsMismatch
            : realtimeStale
              ? text.operationsStale
              : `${realtimeSnapshot?.metadata.kind === 'live' ? text.operationsLive : text.operationsDemo} · ${realtimeApplication.summary.adjusted} adjusted · ${realtimeApplication.summary.cancelled} cancelled`
  const timeline = activePilot?.metadata ?? (isHub ? (hubDay?.metadata ?? network?.metadata) : network?.metadata)
  const timelineServiceDate = timeline?.serviceDate
  const studyDateLabel = useMemo(
    () => timelineServiceDate ? formatStudyDate(timelineServiceDate, LANGUAGE_LOCALES[language]) : text.studyDate,
    [timelineServiceDate, language, text.studyDate],
  )
  const timelineTime = isHub ? hubTime : networkTime
  const timelineReady = isTimetable && timeline
  const hasFullDayTimeline = Boolean(
    timelineReady &&
      timeline.windowStart <= DAY_PRESETS[0].time &&
      timeline.windowEnd >= DAY_PRESETS.at(-1)!.time,
  )

  const jumpToTime = useCallback(
    (time: number) => {
      stopNow()
      setIsPlaying(true)
      if (isHub) setHubTime(time)
      else handleNetworkTime(time)
    },
    [handleNetworkTime, isHub, stopNow],
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

  useEffect(() => {
    if (nowRequested.current && ((isNationalDay && nationalDayChunkReady) || (isRegionalDay && regionalDay.chunkReady))) {
      nowRequested.current = false
      startNowClock()
    }
  }, [isNationalDay, nationalDayChunkReady, isRegionalDay, regionalDay.chunkReady, startNowClock])
  const startNow = async () => {
    const clock = await import('./studies/swiss-now.ts')
    nowResolver.current = clock
    setNowDate(clock.swissInstant(new Date()).date)
    if (networkStudy === 'national' && !isNationalDay) {
      selectNetworkStudy('national', 'day')
      nowRequested.current = true
      setNetworkTime(clock.swissInstant(new Date()).time)
    } else if (isRegionalDayStudy(networkStudy) && !isRegionalDay) {
      setRegionalRange('day')
      nowRequested.current = true
      setNetworkTime(clock.swissInstant(new Date()).time)
    }
    releaseSelection()
    setDirectorMode(false)
    setPlaybackRate(1)
    setIsPlaying(true)
    if (!nowRequested.current) startNowClock()
  }
  useEffect(() => {
    if (!pilotLinkPending.current || !linkedPilot) return
    if (!roadEnabled || selectedRoadId !== linkedPilot.road || view !== 'network' || networkStudy !== 'national' || sbbEnabled || airEnabled) {
      pilotLinkPending.current = false
    } else if (roadLoadState === 'error' || (roadLoadState === 'ready' && !selectedRoad)) {
      pilotLinkPending.current = false
      setPilotLinkUnavailable(true)
      setSelectedRoadId(undefined)
      setRoadEnabled(false)
      setSbbEnabled(true)
    }
  }, [linkedPilot, roadEnabled, selectedRoadId, view, networkStudy, sbbEnabled, airEnabled, roadLoadState, selectedRoad])
  const dismissShare = () => {
    setShareUrl('')
    shareButton.current?.focus()
  }
  const shareStudy = async () => {
    const { studyLinkUrl } = await import('./studies/share-link.ts')
    const url = studyLinkUrl(window.location.href, activePilot ? { study: 'national', range: 'morning', recording: activePilot.metadata.recordingId, date: activePilot.metadata.serviceDate, time: networkTime } : { study: networkStudy, range: isNationalDay || isRegionalDay ? 'day' : 'morning', date: network?.metadata.serviceDate, time: networkTime, station: selectedStationName, train: selectedTrainId })
    setShareUrl(url)
    setShareCopied(false)
    try { await navigator.clipboard.writeText(url); setShareCopied(true) } catch { /* The visible link can still be copied manually. */ }
  }
  useEffect(() => {
    if (!linkPending.current || !network || (isRegionalDay && !regionalDay.chunkReady) || (isNationalDay && !nationalDayChunkReady) || (isPostbus && !postbusDay.chunkReady) || (networkStudy !== 'national' && !isPostbus && !isRegionalDay && regionalNetworkLoading)) return
    linkPending.current = false
    if (initialLink.date && initialLink.date !== network.metadata.serviceDate) setExploreNotice(exploreCopy.dateMismatch)
    if (initialLink.time !== undefined) setNetworkTime(Math.max(network.metadata.windowStart, Math.min(network.metadata.windowEnd - 1, initialLink.time)))
    if (initialLink.station) {
      const station = stationIndex.find(entry => entry.name === initialLink.station)
      if (station) { setSelectedStationName(station.name); setSearchQuery(station.name) }
      else setExploreNotice(exploreCopy.focusMissing)
    }
    if (initialLink.train) {
      const train = network.trains.find(entry => entry.id === initialLink.train)
      if (train) { setSelectedTrainId(train.id); setSearchQuery(train.shortName) }
      else setExploreNotice(exploreCopy.focusMissing)
    }
  }, [network, initialLink, isRegionalDay, regionalDay.chunkReady, isNationalDay, nationalDayChunkReady, isPostbus, postbusDay.chunkReady, networkStudy, regionalNetworkLoading, stationIndex, exploreCopy])

  return (
    <main
      data-sbb-enabled={sbbEnabled}
      data-cogwheel-enabled={isCogwheel}
      data-quiet-map={quietMap}
      data-quiet-playing={quietMap ? isPlaying : undefined}
      className={`experience view-${view}${isJungfrau ? ' jungfrau-study' : ''}${isGornergrat ? ' gornergrat-study' : ''}${timedRigiTerrain || jungfrauTerrainWindow ? ' has-timed-rigi-terrain' : ''}${isContrast ? ' is-contrast' : ''}${airEnabled ? ' has-air-layer' : ''}${airCategorySelected ? ' has-air-category' : ''}${roadEnabled ? ' has-road-layer' : ''}${roadCategorySelected ? ' has-road-category' : ''}${selectedTrain || selectedStation || selectedRoute || selectedAirTrack || selectedAirport || selectedRoad ? ' has-selection' : ''}${!isTimetable ? ` corridor-${journeyCorridorId}` : ''}`}
    >
      <div className="scene" aria-hidden={webglAvailable ? true : undefined}>
        <Suspense fallback={null}>
          {!webglAvailable ? (
          <section className="no-webgl" role="status">
            <span aria-hidden="true">◎</span>
            <h2>{text.webglUnavailable}</h2>
            <p>{text.webglUnavailableDescription}</p>
            <a href="./methodology.html">{text.readMethodology}</a>
          </section>
        ) : jungfrauTerrainWindow && jungfrauTerrainBinding ? (
          <JungfrauTerrainScene binding={jungfrauTerrainBinding} window={jungfrauTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
        ) : timedRigiTerrain ? (
          <RigiTimetableTerrain binding={timedRigiTerrain} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} onEnd={finishRigiTerrain} />
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
                  onTime={handleSceneNetworkTime}
                  cameraCommand={mapCameraCommand}
                  playbackRate={playbackRate}
                  selectedCategory={selectedCategory}
                  cameraFraming={MAP_FRAMINGS.national}
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
                  routeColors={POSTBUS_ROUTE_COLORS}
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
                  cameraFraming={MAP_FRAMINGS.national}
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
        ) : isNetwork && sceneNetwork ? (
          <NationalNetworkScene
            boundary={boundary}
            lakes={lakes}
            groundStyle={quietMap ? 'quiet' : 'grid'}
            routeColors={isPostbus ? POSTBUS_ROUTE_COLORS : isCogwheel || isMountainStudy ? COGWHEEL_ROUTE_COLORS : undefined}
            snapshot={sceneNetwork}
            trafficOverviewEmphasis={isPostbus ? 0.65 : undefined}
            referenceSnapshot={nationalNetwork ?? sceneNetwork}
            contextSnapshot={
              networkStudy !== 'national' && !isPostbus && !isMountainStudy &&
              (isBern ? bernRegionNetwork : isBasel ? baselCoreNetwork : isLausanne ? lausanneRegionNetwork : networkStudy === 'zurich-city'
                ? zurichCityNetwork
                : networkStudy === 'zvv-region'
                  ? zvvRegionNetwork
                  : genevaTpgNetwork)
                ? nationalNetwork
                : undefined
            }
            stations={railVisible ? stationIndex : []}
            trainLabelMode={trainLabelMode}
            isPlaying={isPlaying && !nowActive && (!isPostbus || postbusDay.chunkReady) && (!isRegionalDay || regionalDay.chunkReady)}
            userLocation={validLocation}
            time={networkTime}
            selectedTrain={selectedTrain}
            onTime={handleSceneNetworkTime}
            cameraCommand={mapCameraCommand}
            playbackRate={playbackRate}
            selectedCategory={selectedCategory}
            selectedRoute={selectedRoute}
            selectedStation={selectedStation}
            onSelectStation={selectStation}
            onSelectTrain={selectTrain}
            onSelectRoad={id => {
              const road = roadTopology?.roads.find(road => road.id === id)
              if (road) selectRoad(road)
            }}
            airSnapshot={
              networkStudy === 'national' && airEnabled
                ? activeAirSnapshot
                : undefined
            }
            airCategorySelected={airCategorySelected}
            airports={
              networkStudy === 'national' && airEnabled
                ? SWITZERLAND_AIRPORTS
                : undefined
            }
            roadSnapshot={
              networkStudy === 'national' && roadEnabled && !isNationalDay && !activePilot
                ? roadSnapshot
                : undefined
            }
            nationalRoadSnapshot={
              networkStudy === 'national' &&
              roadEnabled &&
              nationalRoadInWindow
                ? nationalRoad.snapshot
                : undefined
            }
            roadTopology={
              networkStudy === 'national' && roadEnabled
                ? playbackTopology
                : undefined
            }
            roadCategorySelected={roadCategorySelected}
            selectedRoadId={selectedRoadId}
            selectedAirTrack={selectedAirTrack}
            selectedAirport={airEnabled ? selectedAirport : undefined}
            onSelectAirTrack={selectAirTrack}
            cameraFraming={
              isBern ? MAP_FRAMINGS.bern : isBasel ? MAP_FRAMINGS.basel : isLausanne ? MAP_FRAMINGS.lausanne : isGornergrat ? MAP_FRAMINGS.gornergrat : isJungfrau ? MAP_FRAMINGS.jungfrau : isRigi ? MAP_FRAMINGS.rigi : networkStudy === 'zurich-city' && zurichCityNetwork
                ? MAP_FRAMINGS.zurich
                : networkStudy === 'zvv-region' && zvvRegionNetwork
                  ? MAP_FRAMINGS.zvv
                  : networkStudy === 'geneva-tpg' && genevaTpgNetwork
                    ? MAP_FRAMINGS.geneva
                    : MAP_FRAMINGS.national
            }
          />
        ) : isNetwork ? (
          <div className="contrast-loader" role="status" aria-label={isPostbus ? postbusDay.error ? text.postbusUnavailable : text.loadingPostbus : text.loading} />
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
              showTaktOverlay={showTaktOverlay}
            />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            {(!isRigiTerrain || corridor) && <GleislichtScene
              corridor={corridor}
              isPlaying={isPlaying && !isNetwork}
              progress={journeyProgress}
              speedKmh={activeJourney.speedKmh}
              onProgress={handleJourneyProgress}
              onEnvironment={handleJourneyEnvironment}
            />}
          </Suspense>
          )}
        </Suspense>
      </div>

      <div className="atmosphere" />
      <div className="scanlines" />
      {quietMap && <Suspense fallback={null}><AlpineQuiet language={language} /></Suspense>}

      <header className="masthead">
        <div>
          <p className="eyebrow">
            {isNetwork && networkStudy === 'national' && airEnabled && roadEnabled
              ? 'GLEISLICHT — LUFT / AUTO'
              : isNetwork && networkStudy === 'national' && airEnabled
                ? 'GLEISLICHT — LUFTRAUM'
                : isNetwork && networkStudy === 'national' && roadEnabled
                  ? 'GLEISLICHT — AUTO'
                  : 'Gleislicht'}
          </p>
          <h1
            className={
              isNetwork && networkStudy === 'national' && !isContrast
                ? 'national-title'
                : undefined
            }
          >
            {isNetwork
              ? isBern ? text.bernSubtitle : isBasel ? text.baselSubtitle : isLausanne ? text.lausanneSubtitle : isGornergrat ? gornergratCopy?.title ?? 'Gornergrat' : isJungfrau ? jungfrauCopy?.title ?? 'Jungfrau' : isRigi ? rigiCopy.title : isPostbus ? text.postbusSubtitle : isContrast
                ? text.contrastSubtitle
                : networkStudy === 'zurich-city'
                ? text.zurichSubtitle
                : networkStudy === 'zvv-region'
                  ? text.zvvSubtitle
                  : networkStudy === 'geneva-tpg'
                    ? text.genevaSubtitle
                  : airOnly
                    ? text.airSubtitle
                  : roadOnly
                    ? text.roadSubtitle
                  : text.subtitle
              : isHub
                ? text.taktHubs
                : journeyCorridorId === 'kiental-griesalp'
                  ? 'Kiental → Griesalp'
                  : isRigiTerrain ? `${rigiOrigin} → Rigi Kulm` : text.corridorSubtitle}
          </h1>
        </div>
        <div className="masthead-meta">
          <div className="masthead-topline">
            <div className="study-meta">
              <span className="pulse" />
              <span>{motionStudyMark(edition.identity)}</span>
              <span className="coordinate">
                {isTimetable
                  ? studyDateLabel
                  : journeyCorridorId === 'kiental-griesalp'
                    ? '46.582° N · 7.730° E'
                    : isRigiTerrain ? `${rigiOrigin} · Rigi Kulm` : '47.194° N · 9.312° E'}
              </span>
            </div>
            <nav className="language-picker" aria-label={text.languagePicker}>
              {UI_LANGUAGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-tooltip={option.name}
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
              data-tooltip={soundtrackState === 'starting' ? help.soundStarting : soundtrackState === 'on' ? help.soundOff : help.soundOn}
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

      {!isTimetable && (
        <nav className="journey-picker" aria-label={text.journeyPicker}>
          <button
            type="button"
            data-tooltip={`${help.corridor} · Zürich–Chur`}
            aria-pressed={journeyCorridorId === 'zurich-chur'}
            onClick={() => openTerrainCorridor('zurich-chur')}
          >
            <span>IR35</span>
            <span className="journey-name">Zürich → Chur</span>
          </button>
          <button
            type="button"
            data-tooltip={`${help.corridor} · Kiental–Griesalp`}
            aria-pressed={journeyCorridorId === 'kiental-griesalp'}
            onClick={() => openTerrainCorridor('kiental-griesalp')}
          >
            <span>220</span>
            <span className="journey-name">Kiental → Griesalp</span>
          </button>
          {Object.entries(RIGI_ASCENTS).map(([id, approach]) => <button key={id} type="button" aria-label={terrainCopyForRigi(language, approach.name).enter} aria-pressed={journeyCorridorId === id} onClick={() => openTerrainCorridor(id as RigiCorridorId)}>
            <span>{approach.service}</span><span className="journey-name">{approach.name} → Rigi</span>
          </button>)}
        </nav>
      )}

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
              const actions = [
                ...stationSearchResults.map(station => () => selectStation(station)),
                ...routeSearchResults.map(route => () => selectRoute(route)),
                ...roadSearchResults.map(road => () => selectRoad(road)),
                ...airportSearchResults.map(airport => () => selectAirport(airport)),
                ...airSearchResults.map(track => () => selectAirTrack(track.id)),
                ...searchResults.map(train => () => selectTrain(train)),
              ]
              actions[Math.max(0, resolvedActiveSearchIndex)]?.()
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
                  isBern ? text.bernPlaceholder : isBasel ? text.baselPlaceholder : isLausanne ? text.lausannePlaceholder : isGornergrat ? gornergratCopy?.placeholder ?? 'Gornergrat' : isJungfrau ? jungfrauCopy?.placeholder ?? jungfrauSelect : isRigi ? rigiCopy.placeholder : isCogwheel ? cogwheelCopy.placeholder : isContrast
                    ? text.contrastPlaceholder
                    : isPostbus ? text.postbusPlaceholder : airEnabled
                      ? text.airSearchPlaceholder
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
                  setSelectedAirport(undefined)
                  if (!event.target.value) releaseSelection()
                  else if (event.target.value !== selectedStation?.name) {
                    setSelectedStationName(undefined)
                  }
                  const selectedRouteQuery = selectedRoute
                    ? `${categoryLabel(selectedRoute.category)} ${selectedRoute.name}`
                    : undefined
                  if (event.target.value !== selectedRouteQuery) {
                    setSelectedRouteId(undefined)
                  }
                  if (
                    selectedAirTrack &&
                    event.target.value !== airTrackSearchValue(selectedAirTrack)
                  ) {
                    setSelectedAirTrackId(undefined)
                  }
                  if (
                    selectedRoad &&
                    event.target.value !== roadCorridorSearchValue(selectedRoad)
                  ) {
                    setSelectedRoadId(undefined)
                  }
                }}
                onKeyDown={(event) => {
                  event.stopPropagation()
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
            <nav className="network-study-picker" aria-label={text.networkStudy}>
              <button type="button" aria-label={text.bernNetwork} data-tooltip={text.bernNetwork} aria-pressed={isBern} onClick={() => selectNetworkStudy('bern-region')}>BE</button>
              <button type="button" aria-label={text.baselNetwork} data-tooltip={text.baselNetwork} aria-pressed={isBasel} onClick={() => selectNetworkStudy('basel-core')}>BS</button>
              <button type="button" aria-label={text.lausanneNetwork} data-tooltip={text.lausanneNetwork} aria-pressed={isLausanne} onClick={() => selectNetworkStudy('lausanne-region')}>LS</button>
              <button type="button" aria-label={jungfrauSelect} data-tooltip={jungfrauSelect} aria-pressed={isJungfrau} onClick={() => selectNetworkStudy('jungfrau')}>JUNG</button>
              <button type="button" aria-label={rigiCopy.select} data-tooltip={rigiCopy.select} aria-pressed={isRigi} onClick={() => selectNetworkStudy('rigi-lake')}>RIGI</button>
              <button type="button" className="postbus-study-toggle" aria-label={text.postbusNetwork} data-tooltip={text.postbusNetwork} aria-pressed={isPostbus} onClick={() => selectNetworkStudy('postbus')}>PA</button>
              <span className="sr-only">{text.scale}</span>
              <button
                type="button"
                data-tooltip={text.showSwissMorningNetwork}
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
                data-tooltip={text.showSwissDayNetwork}
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
                data-tooltip={text.showContrastNetwork}
                aria-label={text.showContrastNetwork}
                aria-pressed={isContrast}
                onClick={() => selectNetworkStudy('contrast')}
              >
                ↔
              </button>
              <button
                type="button"
                data-tooltip={text.showZvvNetwork}
                aria-label={text.showZvvNetwork}
                aria-pressed={networkStudy === 'zvv-region'}
                onClick={() => selectNetworkStudy('zvv-region')}
              >
                ZVV
              </button>
              <button
                type="button"
                data-tooltip={text.showZurichNetwork}
                aria-label={text.showZurichNetwork}
                aria-pressed={networkStudy === 'zurich-city'}
                onClick={() => selectNetworkStudy('zurich-city')}
              >
                ZH
              </button>
              <button
                type="button"
                data-tooltip={text.showGenevaNetwork}
                aria-label={text.showGenevaNetwork}
                aria-pressed={networkStudy === 'geneva-tpg'}
                onClick={() => selectNetworkStudy('geneva-tpg')}
              >
                GE
              </button>
              <button
                className="sbb-toggle"
                type="button"
                data-tooltip={networkStudy !== 'national' ? text.sbbUnavailable : sbbEnabled ? text.hideSbbLayer : text.showSbbLayer}
                aria-label={sbbEnabled ? text.hideSbbLayer : text.showSbbLayer}
                aria-pressed={sbbEnabled}
                disabled={networkStudy !== 'national'}
                onClick={toggleSbbLayer}
              >
                SBB
              </button>
              <button
                className="air-toggle"
                type="button"
                data-tooltip={networkStudy !== 'national' ? help.airUnavailable : airEnabled ? text.hideAirLayer : text.showAirLayer}
                aria-label={airEnabled ? text.hideAirLayer : text.showAirLayer}
                aria-pressed={airEnabled}
                disabled={networkStudy !== 'national'}
                onClick={toggleAirLayer}
              >
                {text.luftraum}
              </button>
              <button
                className="road-toggle"
                type="button"
                data-tooltip={networkStudy !== 'national' || isNationalDay ? help.roadUnavailable : roadEnabled ? text.hideRoadLayer : text.showRoadLayer}
                aria-label={roadEnabled ? text.hideRoadLayer : text.showRoadLayer}
                aria-pressed={roadEnabled}
                disabled={networkStudy !== 'national' || isNationalDay}
                onClick={toggleRoadLayer}
              >
                {text.auto}
              </button>
            </nav>
            <div className="mobile-search-controls">
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
                  { value: 'postbus', label: 'PA', detail: text.postbusNetwork },
                  { value: 'bern-region', label: 'BE', detail: text.bernNetwork },
                  { value: 'basel-core', label: 'BS', detail: text.baselNetwork },
                  { value: 'lausanne-region', label: 'LS', detail: text.lausanneNetwork },
                  { value: 'jungfrau', label: 'JUNG', detail: jungfrauSelect },
                  { value: 'gornergrat', label: 'GGR', detail: gornergratCopy?.select ?? 'Gornergrat' },
                  { value: 'rigi-lake', label: 'RIGI', detail: rigiCopy.select },
                  { value: 'zvv-region', label: 'ZVV', detail: text.zvvNetwork },
                  { value: 'zurich-city', label: 'ZH', detail: text.zurichNetwork },
                  { value: 'geneva-tpg', label: 'GE', detail: text.genevaNetwork },
                ]}
                triggerLabel={
                  isBern ? 'BE' : isBasel ? 'BS' : isLausanne ? 'LS' : isGornergrat ? 'GGR' : isJungfrau ? 'JUNG' : isRigi ? 'RIGI' : isPostbus ? 'PA' : isContrast
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
              <button
                className="mobile-sbb-toggle"
                type="button"
                data-tooltip={networkStudy !== 'national' ? text.sbbUnavailable : sbbEnabled ? text.hideSbbLayer : text.showSbbLayer}
                aria-label={sbbEnabled ? text.hideSbbLayer : text.showSbbLayer}
                aria-pressed={sbbEnabled}
                disabled={networkStudy !== 'national'}
                onClick={toggleSbbLayer}
              >
                SBB
              </button>
              <button
                className="mobile-air-toggle"
                type="button"
                data-tooltip={networkStudy !== 'national' ? help.airUnavailable : airEnabled ? text.hideAirLayer : text.showAirLayer}
                aria-label={airEnabled ? text.hideAirLayer : text.showAirLayer}
                aria-pressed={airEnabled}
                disabled={networkStudy !== 'national'}
                onClick={toggleAirLayer}
              >
                {text.luftraum}
              </button>
              <button
                className="mobile-road-toggle"
                type="button"
                data-tooltip={networkStudy !== 'national' || isNationalDay ? help.roadUnavailable : roadEnabled ? text.hideRoadLayer : text.showRoadLayer}
                aria-label={roadEnabled ? text.hideRoadLayer : text.showRoadLayer}
                aria-pressed={roadEnabled}
                disabled={networkStudy !== 'national' || isNationalDay}
                onClick={toggleRoadLayer}
              >
                {text.auto}
              </button>
            </div>
          </form>
          {searchOpen && searchQuery.trim() && (
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
          )}
        </section>
      )}

      {isHub && (
        <nav className="hub-picker" aria-label={text.taktStation}>
          <span>{text.taktPulse}</span>
          <div className="hub-picker-tabs">
            {HUBS.map((hub) => (
              <button
                key={hub.id}
                type="button"
                data-tooltip={`${help.hubs} · ${hub.displayName}`}
                aria-pressed={hub.id === selectedHub.id}
                onClick={() => setSelectedHubId(hub.id)}
              >
                {hub.displayName}
              </button>
            ))}
          </div>
          <MobilePicker
            className="mobile-hub-picker"
            ariaLabel={text.taktStation}
            value={selectedHub.id}
            options={HUBS.map((hub) => ({
              value: hub.id,
              label: hub.displayName,
            }))}
            onChange={(hubId) => setSelectedHubId(hubId as HubId)}
          />
        </nav>
      )}

      {isNetwork && isJungfrau && jungfrauGuideActive && jungfrauNetwork && <Suspense fallback={null}><JungfrauGuide network={jungfrauNetwork} language={language} onClose={() => setJungfrauGuideActive(false)} onStart={startJungfrauAscent} onSelect={name => {
        const station = stationIndex.find(entry => entry.name === name)
        if (station) { setJungfrauGuideActive(false); setSelectedCategory(undefined); selectStation(station) }
      }} /></Suspense>}

      {isNetwork && isRigi && rigiGuideActive && rigiNetwork && <Suspense fallback={null}><RigiGuide network={rigiNetwork} language={language} onClose={() => setRigiGuideActive(false)} onSelect={name => {
        const station = stationIndex.find(entry => entry.name === name)
        if (station) { setRigiGuideActive(false); setSelectedCategory(undefined); setRigiRhythmActive(false); selectStation(station) }
      }} /></Suspense>}

      {isNetwork && isGornergrat && gornergratAscentActive && gornergratNetwork ? (
        <Suspense fallback={null}><GornergratAscent network={gornergratNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection}/></Suspense>
      ) : isNetwork && isJungfrau && jungfrauAscentActive && jungfrauNetwork ? (
        <Suspense fallback={null}><JungfrauAscent onTerrain={setJungfrauTerrainBinding} network={jungfrauNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection} /></Suspense>
      ) : isNetwork && isRigi && rigiRhythmActive && rigiNetwork && !selectedTrain && !selectedStation && !selectedRoute ? (
        <Suspense fallback={null}><RigiDayRhythm network={rigiNetwork} time={networkTime} language={language} onSeek={time => { setSelectedCategory(undefined); setDirectorMode(false); seekMountainSequence(time) }} onExit={releaseSelection} /></Suspense>
      ) : isNetwork && isRigi && rigiSequenceActive && rigiNetwork ? (
        <Suspense fallback={null}><RigiSequence network={rigiNetwork} time={networkTime} language={language} onSeek={seekMountainSequence} onFollow={followMountainSequence} onTimetableTerrain={setRigiTerrainBinding} onExit={releaseSelection} onTerrain={() => openTerrainCorridor('vitznau-rigi')} /></Suspense>
      ) : isHub ? (
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
                data-tooltip={help.pulse}
                aria-pressed={hubStudy === 'pulse'}
                onClick={() => setHubStudy('pulse')}
              >
                {text.pulse}
              </button>
              <button
                type="button"
                data-tooltip={help.tracks}
                aria-pressed={hubStudy === 'station'}
                onClick={() => setHubStudy('station')}
              >
                {text.tracks}
              </button>
              {hubStudy === 'pulse' && (
                <button
                  type="button"
                  data-tooltip={showTaktOverlay ? help.gridOff : help.gridOn}
                  aria-pressed={showTaktOverlay}
                  onClick={() => setShowTaktOverlay((value) => !value)}
                >
                  {text.quarterGrid}
                </button>
              )}
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
          <button
            className="corridor-entry contrast-corridor-entry"
            type="button"
            data-tooltip={help.corridor} onClick={enterKientalCorridor}
          >
            <span aria-hidden="true">↘</span>
            {text.enterTerrain} · Kiental–Griesalp
          </button>
        </section>
      ) : isNetwork && selectedAirport ? (
        <Suspense fallback={null}><AirportHeroCard key={selectedAirport.id} className="edition-airport-card"
          airport={selectedAirport} language={language} aircraft={isNationalDay ? airDay.manifest?.aircraft ?? [] : activeAirSnapshot?.tracks ?? []}
          study={{ time: networkTime, windowStart: Math.max(network?.metadata.windowStart ?? 0, activeAirSnapshot?.metadata.windowStart ?? 0), windowEnd: Math.min(network?.metadata.windowEnd ?? 86400, activeAirSnapshot?.metadata.windowEnd ?? 86400) }}
          maxRows={4} dateLabel="04.09.2026"
          loading={isNationalDay ? !airDay.manifest : !airSnapshot} error={activeAirLoadState === 'error' ? text.airUnavailable : undefined}
          onSelectFlight={selectAirTrack}
        /></Suspense>
      ) : isNetwork && selectedAirTrack ? (
        <section
          className="journey-card selected-card air-card"
          aria-label={text.observedAircraft}
        >
          <div className="service-row">
            <span className="air-card-mark" aria-hidden="true">
              ✦
            </span>
            <span className="service">{selectedAirTrack.callsign}</span>
            <span className="arrow">↗</span>
            <span>{text.luftraum}</span>
          </div>
          <p className="between">
            {selectedAirPosition
              ? `${text.heading} ${Math.round(selectedAirPosition.headingDegrees)
                  .toString()
                  .padStart(3, '0')}°`
              : text.signalGap}{' '}
            <span>/</span>{' '}
            {(selectedAirTrack.icaoAddress ?? selectedAirTrack.id).toUpperCase()}
          </p>
          <p className="air-compact-metrics">
            {selectedAirPosition
              ? `${numberFormat.format(
                  Math.round(selectedAirPosition.altitudeFeet / 100) * 100,
                )} ft · ${numberFormat.format(
                  Math.round(selectedAirPosition.groundSpeedKnots),
                )} kt`
              : text.signalGap}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.altitude}</span>
              <strong>
                {selectedAirPosition
                  ? numberFormat.format(
                      Math.round(selectedAirPosition.altitudeFeet / 100) * 100,
                    )
                  : '—'}
              </strong>
              <small>ft</small>
            </div>
            <div>
              <span>{text.groundSpeed}</span>
              <strong>
                {selectedAirPosition
                  ? numberFormat.format(
                      Math.round(selectedAirPosition.groundSpeedKnots),
                    )
                  : '—'}
              </strong>
              <small>kt</small>
            </div>
          </div>
        </section>
      ) : isNetwork && selectedTrain ? (
        <section className="journey-card selected-card" aria-label={text.selectedTrain}>
          <div className="service-row">
            <TransportIcon mode={isCogwheel || isMountainStudy && selectedTrain.category === 'other' ? 'cogwheel' : selectedTrain.category} color={serviceColors[selectedTrain.category]} />
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
              <small>{isCogwheel ? cogwheelCopy.label : categoryLabel(selectedTrain.category)}</small>
            </div>
            <div>
              <span>{selectedHeadway ? frequencyCopy.arrival : text.arrival}</span>
              <strong>{selectedHeadway ? '≈' : ''}{formatServiceTime(selectedTrain.end)}</strong>
              <small>{selectedHeadway ? frequencyCopy.label : text.plan}</small>
            </div>
          </div>
          {selectedHeadway && selectedFrequency && <p className="between frequency-note">{frequencyCopy.note}: <span style={{ whiteSpace: 'nowrap' }}>{numberFormat.format(selectedFrequency.headwaySeconds % 60 === 0 ? selectedFrequency.headwaySeconds / 60 : selectedFrequency.headwaySeconds)} {selectedFrequency.headwaySeconds % 60 === 0 ? 'min' : 's'}</span></p>}
          {isJungfrau && <p className="between jungfrau-model">{rigiOperator(selectedTrain)} · {selectedTrain.category === 'cableway' ? jungfrauCopy?.cable : jungfrauCopy?.model}</p>}
          {isRigi && <p className="between">{rigiOperator(selectedTrain)}{selectedTrain.category === 'ferry' ? <> · {rigiCopy.water}</> : selectedTrain.category === 'cableway' ? <> · {rigiCopy.cable}</> : null}</p>}
          {isCogwheel && cogwheelCatalogue && (
            <p className="between">{cogwheelCatalogue.routes[cogwheelCatalogue.trips[selectedTrain.id]]?.operator}</p>
          )}
          {corridorTrainSelected && (
            <button
              className="corridor-entry"
              type="button"
              data-tooltip={help.corridor} onClick={enterTerrainCorridor}
            >
              <span aria-hidden="true">{selectedRigiCorridor ? '↗' : '↘'}</span>
              {selectedRigiCorridor ? terrainCopyForRigi(language, RIGI_ASCENTS[selectedRigiCorridor].name).enter : text.enterTerrain}
            </button>
          )}
        </section>
      ) : isNetwork && selectedRoute ? (
        <section
          className="journey-card route-card"
          aria-label={`${text.selectedLine}: ${isCogwheel ? cogwheelCopy.label : categoryLabel(selectedRoute.category)} ${selectedRoute.name}`}
          style={
            {
              '--service-accent': serviceColors[selectedRoute.category],
            } as CSSProperties
          }
        >
          <div className="service-row">
            <TransportIcon mode={isCogwheel || isMountainStudy && selectedRoute.category === 'other' ? 'cogwheel' : selectedRoute.category} color={serviceColors[selectedRoute.category]} />
            <span className="service">
              {isCogwheel ? cogwheelCopy.label : categoryLabel(selectedRoute.category)}{' '}
              {selectedRoute.name}
            </span>
          </div>
          <p className="between">
            {selectedRoute.headsigns.slice(0, 2).join(' ↔ ') ||
              (isNationalDay || isRegionalDay || isMountainStudy ? text.fullDayStudy : text.morningStudy)}
          </p>
          {isCogwheel && cogwheelCatalogue && <p className="between">{[...new Set(selectedRoute.trainIds.map(id => cogwheelCatalogue.routes[cogwheelCatalogue.trips[id]]?.operator).filter(Boolean))].join(' · ')}</p>}
          {selectionHasHeadwayMotion && <p className="between frequency-note">{frequencyCopy.mixed}</p>}
          <div className="metric-grid">
            <div>
              <span>{text.trips}</span>
              <strong>{numberFormat.format(selectedRoute.trainIds.length)}</strong>
              <small>{isMountainStudy ? '24h' : isNationalDay ? '3h' : '2h'}</small>
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
          {isRigi && <button type="button" className="corridor-entry" onClick={event => { event.currentTarget.focus(); setRigiGuideActive(true) }}>{rigiCopy.connections} →</button>}
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
            {isNationalDay || isRegionalDay || isMountainStudy ? text.fullDayStudy : text.morningStudy}
            {selectionHasHeadwayMotion && <> {frequencyCopy.mixed}</>}
          </p>
          <div className="network-count-row">
            <strong>{numberFormat.format(activeTrainCount)}</strong>
            <span>{networkStudy === 'national' ? text.trainsInMotion : isJungfrau ? jungfrauCopy?.movements : text.vehiclesInMotion}</span>
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
              <small>{isMountainStudy ? '24h' : isNationalDay ? '3h' : '2h'}</small>
            </div>
          </div>
        </section>
      ) : isNetwork && selectedRoad ? (
        <section
          className={`journey-card road-corridor-card${activePilot ? ' is-pilot' : ''}`}
          aria-label={`${text.selectedRoadCorridor}: ${selectedRoad.label}`}
        >
          <div className="service-row">
            <span className="road-card-mark" aria-hidden="true">━</span>
            <span className="service">{selectedRoad.label}</span>
            <span className="arrow">/</span>
            <span>{selectedRoad.officialLabel}</span>
          </div>
          <p className="between">
            {activePilot ? null : selectedRoad.description ?? text.nationalMotorway}
          </p>
          {selectedPilotDefinition && <Suspense fallback={null}><CantonalPilotControls key={`${selectedPilotDefinition.id}:${sbbEnabled}:${airEnabled}:${roadEnabled}`} definition={selectedPilotDefinition} pilot={activePilot} time={networkTime} language={language}
            autoStartTime={pilotLinkPending.current && linkedPilot?.id === selectedPilotDefinition.id ? initialLink.time : undefined}
            onAutoStart={() => { pilotLinkPending.current = false }}
            onStart={(pilot, initialTime) => {
              pilotClockBounds.current = pilot.metadata
              roadHistorySeekRef.current = { time: initialTime, at: performance.now() }
              stopNow()
              setSbbEnabled(false)
              setAirEnabled(false)
              setDirectorMode(false)
              setCantonalPilot(pilot)
              setIsPlaying(false)
              setNetworkTime(initialTime)
              setMapCameraCommand(current => ({ id: current.id + 1, action: 'focus-location', focus: pilot.topology.sections[0].fromCoordinate, distanceScale: 0.025 }))
            }}
            onExit={() => {
              pilotClockBounds.current = undefined
              setCantonalPilot(undefined)
              setNetworkTime(edition.defaultNetworkTime)
              setIsPlaying(false)
              setSbbEnabled(true)
            }}
            onTime={time => {
              setIsPlaying(false)
              handleNetworkTime(time)
              roadHistorySeekRef.current = { time, at: performance.now() }
            }} /></Suspense>}
          {activePilot ? null : selectedRoadGeometryOnly ? <p className="road-traffic-summary">{text.cantonalGeometryOnly}</p> : <Suspense fallback={<p className="road-traffic-summary">{text.loadingRoad}</p>}>
            <RoadTrafficHistory road={selectedRoad.id} manifest={nationalRoad.manifest} fallback={roadSnapshot}
              time={networkTime} language={language} onTime={time => {
                setIsPlaying(false)
                handleNetworkTime(time)
                roadHistorySeekRef.current = { time, at: performance.now() }
              }} />
          </Suspense>}
          <div className="metric-grid">
            <div>
              <span>{text.mappedRoadLength}</span>
              <strong>{activePilot ? `≈${roadMetricFormat.format(activePilot.topology.sections[0].distanceKm)}` : selectedRoadLength === undefined ? '—' : `≈${roadMetricFormat.format(selectedRoadLength)}`}</strong>
              <small>km</small>
            </div>
            {!selectedRoadGeometryOnly && <div>
              <span>{text.estimatedVehicles}</span>
              <strong>{selectedRoadTraffic ? `≈${numberFormat.format(selectedRoadTraffic.vehicles)}` : '—'}</strong>
            </div>}
          </div>
          <p className="road-traffic-summary">
            {selectedRoadGeometryOnly || activePilot
              ? <a href="https://geolion.zh.ch/geodatensatz/3177" target="_blank" rel="noreferrer">AUTO · Kanton Zürich</a>
              : selectedRoadTraffic
              ? <>
                  <span>{text.roadDensitySummary(roadMetricFormat.format(selectedRoadTraffic.density))}</span>
                  <span>{text.roadCoverageSummary(roadMetricFormat.format(selectedRoadTraffic.carriagewayKm))}</span>
                  <span>{selectedRoadTraffic.representative ? text.representativeRoadTraffic : text.counterRoadTraffic}</span>
                </>
              : roadLoadState === 'loading' ? text.loadingRoad : text.noRoadTraffic}
          </p>
        </section>
      ) : roadOnly ? (
        <section className="journey-card network-card road-network-card" aria-label={text.estimatedVehicles}>
          <div className="network-count-row">
            <strong>{roadOverview ? `≈${numberFormat.format(roadOverview.vehicles)}` : '—'}</strong>
            <span>{text.estimatedVehicles}</span>
          </div>
          <p className="between">
            {roadOverview
              ? roadOverview.representative ? text.representativeRoadTraffic : text.counterRoadTraffic
              : roadLoadState === 'error' ? text.roadUnavailable
                : roadLoadState !== 'ready' ? text.loadingRoad : text.noRoadTraffic}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.roadDensity}</span>
              <strong>{roadOverview ? `≈${roadMetricFormat.format(roadOverview.density)}` : '—'}</strong>
              <small>{text.roadDensityUnit}</small>
            </div>
            <div>
              <span>{text.roadCoveredDistance}</span>
              <strong>{roadOverview ? roadMetricFormat.format(roadOverview.carriagewayKm) : '—'}</strong>
              <small>km</small>
            </div>
          </div>
        </section>
      ) : airOnly ? (
        <section className="journey-card network-card air-network-card" aria-label={text.aircraftInMotion}>
          <div className="network-count-row">
            <strong>{activeAirLoadState === 'ready' ? numberFormat.format(activeAircraftCount) : '—'}</strong>
            <span>{text.aircraftInMotion}</span>
          </div>
          <p className="between">
            {activeAirLoadState === 'error' ? text.airUnavailable
              : activeAirLoadState !== 'ready' ? text.loadingAir : text.airAirportSummary}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.airOrigins}</span>
              <strong>{activeAirLoadState === 'ready' ? numberFormat.format(airSummary.origins) : '—'}</strong>
            </div>
            <div>
              <span>{text.airDestinations}</span>
              <strong>{activeAirLoadState === 'ready' ? numberFormat.format(airSummary.destinations) : '—'}</strong>
            </div>
          </div>
        </section>
      ) : isNetwork ? (
        <section
          className="journey-card network-card"
          aria-label={
            isBern ? text.bernNetworkStatus : isBasel ? text.baselNetworkStatus : isLausanne ? text.lausanneNetworkStatus : isGornergrat ? gornergratCopy?.select ?? 'Gornergrat' : isJungfrau ? jungfrauSelect : isRigi ? rigiCopy.select : isPostbus ? text.postbusNetwork : networkStudy === 'national'
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
              {network && (!isCogwheel || cogwheelCatalogue) && (!isNationalDay || nationalDayChunkReady) && (!isPostbus || postbusDay.chunkReady) && (!isRegionalDay || regionalDay.chunkReady)
                ? numberFormat.format(activeTrainCount)
                : '—'}
            </strong>
            <span>
              {networkStudy === 'national'
                ? text.trainsInMotion
                : isJungfrau ? jungfrauCopy?.movements : text.vehiclesInMotion}
            </span>
            {networkStudy === 'national' && (
              <button
                type="button"
                className={`operations-badge ${realtimeActive ? 'is-active' : ''}`}
                onClick={toggleOperationsMode}
                aria-label={text.toggleOperations}
                data-tooltip={`${text.toggleOperations} · ${operationsDescription}`}
              >
                {operationsBadge}
              </button>
            )}
            {networkStudy === 'national' && airEnabled && (
              <span
                className="air-count"
                aria-live="polite"
                aria-label={
                  activeAirLoadState === 'ready'
                    ? `${numberFormat.format(activeAircraftCount)} ${text.aircraftInMotion}`
                    : undefined
                }
              >
                {activeAirLoadState === 'error'
                  ? text.airUnavailable
                  : activeAirLoadState !== 'ready'
                    ? text.loadingAir
                    : `${numberFormat.format(activeAircraftCount)} ${text.luftraum}`}
              </span>
            )}
            {networkStudy === 'national' && roadEnabled && (
              <span
                className="road-count"
                aria-live="polite"
                aria-label={
                  activePilot && !pilotWindow ? text.noRoadTraffic : roadLoadState === 'ready'
                    ? `${numberFormat.format(activeRoadVehicleCount)} ${text.estimatedRoadVehicles}`
                    : undefined
                }
              >
                {activePilot && !pilotWindow ? `— ${text.auto}` : roadLoadState === 'error'
                  ? text.roadUnavailable
                  : roadLoadState !== 'ready'
                    ? text.loadingRoad
                    : `${numberFormat.format(activeRoadVehicleCount)} ${text.auto}`}
              </span>
            )}
          </div>
          <p className="between">
              {isRegionalDay ? regionalDay.error ? exploreCopy.error : !regionalDay.chunkReady ? exploreCopy.loading : `${exploreCopy.day} · ${network?.metadata.geometry?.publisher ?? 'SBB'}` : isBern ? regionalNetworkError ? text.bernUnavailable : regionalNetworkLoading ? text.loading : text.bernModes : isBasel ? regionalNetworkError ? text.baselUnavailable : regionalNetworkLoading ? text.loading : text.baselModes : isLausanne ? regionalNetworkError ? text.lausanneUnavailable : regionalNetworkLoading ? text.loading : text.lausanneModes : isGornergrat ? regionalNetworkError ? gornergratCopy?.unavailable : regionalNetworkLoading ? gornergratCopy?.loading : gornergratCopy?.modes : isJungfrau ? regionalNetworkError ? jungfrauCopy?.unavailable : regionalNetworkLoading ? jungfrauCopy?.loading : jungfrauCopy?.modes : isRigi ? regionalNetworkError ? rigiCopy.unavailable : regionalNetworkLoading ? rigiCopy.loading : rigiCopy.modes : isCogwheel ? cogwheel?.error ? cogwheelCopy.unavailable : !cogwheelCatalogue ? cogwheelCopy.loading : cogwheelCopy.description : isPostbus
                ? postbusDay.error ? text.postbusUnavailable : postbusDay.loading ? text.loadingPostbus
                  : network?.metadata.geometry
                    ? text.postbusRoadModes.replace('{coverage}', (100 * network.metadata.geometry.matchedSegments / network.metadata.geometry.totalSegments).toFixed(1))
                    : text.postbusModes
                : networkStudy === 'national' && operationsMode !== 'scheduled'
                ? operationsDescription
                : networkStudy !== 'national'
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
              {hasHeadwayMotion && <> {frequencyCopy.mixed}</>}
          </p>
          {isGornergrat && gornergratNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startGornergratAscent}>{gornergratCopy?.start} →</button>}
          {isGornergrat && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setGornergratAttempt(n => n+1) }}>{exploreCopy.retry}</button>}
          {isJungfrau && jungfrauNetwork && !regionalNetworkError && <><button type="button" className="corridor-entry" onClick={event => { event.currentTarget.focus(); setJungfrauGuideActive(true) }}>{jungfrauCopy?.guide} →</button><button type="button" className="corridor-entry" onClick={startJungfrauAscent}>{jungfrauCopy?.ascent} →</button></>}
          {isJungfrau && jungfrauNetwork && !regionalNetworkError && <Suspense fallback={null}><JungfrauPlaces language={language} onSelect={name => { const station = stationIndex.find(s => s.name === name); if (station) { setSelectedCategory(undefined); selectStation(station) } }} /></Suspense>}
          {isJungfrau && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setJungfrauAttempt(n => n + 1) }}>{exploreCopy.retry}</button>}
          {isBern && !isRegionalDay && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setBernAttempt(n => n + 1) }}>{exploreCopy.retry}</button>}
          {isBasel && !isRegionalDay && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setBaselAttempt(n => n + 1) }}>{exploreCopy.retry}</button>}
          {isRigi && rigiNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={event => { event.currentTarget.focus(); setRigiGuideActive(true) }}>{rigiCopy.connections} →</button>}
          {isRigi && rigiNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setRigiRhythmActive(true) }}>{rigiCopy.rhythm} →</button>}
          {isRigi && network && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startRigiSequence}>{rigiCopy.sequence} →</button>}
          {isRigi && network && !regionalNetworkError && Object.entries(RIGI_ASCENTS).map(([id, approach]) => <button key={id} type="button" className="corridor-entry" onClick={() => openTerrainCorridor(id as RigiCorridorId)}>{terrainCopyForRigi(language, approach.name).enter} ↗</button>)}
          <div className="metric-grid">
            <div>
              <span>{text.trips}</span>
              <strong>
                {isRegionalDay ? regionalDay.manifest ? numberFormat.format(regionalDay.manifest.tripCount) : '—' : isCogwheel ? cogwheelCatalogue ? numberFormat.format(isNationalDay ? Object.keys(cogwheelCatalogue.trips).length : network?.trains.length ?? 0) : '—' : isPostbus ? postbusDay.manifest ? numberFormat.format(postbusDay.manifest.tripCount) : '—' : isNationalDay
                  ? nationalDayManifest
                    ? numberFormat.format(nationalDayManifest.tripCount)
                    : '—'
                  : network
                    ? numberFormat.format(network.trains.length)
                    : '—'}
              </strong>
              <small>{isNationalDay || isPostbus || isMountainStudy || isRegionalDay ? '24h' : '2h'}</small>
            </div>
            <div>
              <span>{text.feed}</span>
              <strong>{network?.metadata.feedVersion.slice(4) ?? '—'}</strong>
              <small>2026</small>
            </div>
          </div>
        </section>
      ) : isRigiTerrain && !corridor ? (
        <section className="journey-card" aria-label={text.currentJourney} role="status">
          <div className="service-row"><span className="service">RIGI</span><span>{rigiOrigin} → Rigi Kulm</span></div>
          <p className="between">{corridorError ? rigiTerrainCopy.unavailable : text.loadingTerrain}</p>
        </section>
      ) : (
        <section className="journey-card" aria-label={text.currentJourney}>
          <div className="service-row">
            <span className="service">{activeJourney.service}</span>
            <span className="arrow">→</span>
            <span>{activeJourney.destination}</span>
          </div>
          <p className="between">
            {journeyEnvironment.tunnel > 0.35 && journeyEnvironment.tunnelName ? (
              <>
                {text.tunnel} <span>/</span> {journeyEnvironment.tunnelName}
              </>
            ) : (
              <>
                {journeyPosition.previous.name} <span>/</span>{' '}
                {journeyPosition.next.name}
              </>
            )}
          </p>
          {isRigiTerrain && corridor ? <Suspense fallback={null}><RigiTerrainProfile corridor={corridor} progress={journeyProgress} language={language} /></Suspense> : <div className="metric-grid">
            <div>
              <span>{text.velocity}</span>
              <strong>{activeJourney.speedKmh}</strong>
              <small>km/h</small>
            </div>
            <div>
              <span>{text.next}</span>
              <strong>
                {Math.max(1, Math.round((1 - journeyPosition.legProgress) * 14))}
              </strong>
              <small>min</small>
            </div>
          </div>}
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
              {selectedAirTrack
                ? text.observedAircraft
                : selectedTrain
                  ? selectedHeadway ? frequencyCopy.label : text.scheduledFollow
                  : selectedRoute
                    ? text.lineRouteFocus
                    : selectedStation
                      ? text.stationRouteFocus
                      : text.gtfsSchedule}
            </span>
            <span>
              {selectedAirTrack?.callsign ??
                (selectedTrain ? isCogwheel ? cogwheelCopy.label : categoryLabel(selectedTrain.category) : undefined) ??
                (selectedRoute
                  ? `${isCogwheel ? cogwheelCopy.label : categoryLabel(selectedRoute.category)} ${selectedRoute.name}`
                  : undefined) ??
                selectedStation?.name ??
                (selectedRoad
                  ? `${selectedRoad.label} · ${text.roadSections(activePilot?.topology.sections.length ?? selectedRoad.sectionCount)}`
                  : roadCategorySelected
                  ? text.trafficReconstruction
                  : airCategorySelected
                  ? text.observedAirLayer
                  : selectedCategory
                    ? categoryLabel(selectedCategory)
                    : isCogwheel ? cogwheelCopy.label
                    : roadEnabled
                      ? text.trafficReconstruction
                    : airEnabled
                      ? text.observedAirLayer
                      : text.trafficFrequency)}
            </span>
            {roadEnabled && (
              <span>
                {activePilot ? `AUTO · Kanton Zürich · ${activePilot.metadata.completeMinutes} min` : nationalRoad.snapshot && nationalRoadInWindow
                  ? text.astraRecorded
                  : text.astraCalibration}
                {roadTopology && !activePilot
                  ? ` · ${text.astraTopology(
                      roadTopology.metadata.coverage.matchedStations,
                      roadTopology.metadata.coverage.federalStations,
                    )}`
                  : ''}
              </span>
            )}
          </>
        ) : (
          <>
            <span>{isRigiTerrain ? `${rigiOrigin} → Rigi Kulm` : text.realTerrainRoute}</span>
            <span>
              {corridor
                ? `${corridor.metadata.source} · ${corridor.metadata.releaseDate}`
                : corridorError
                  ? isRigiTerrain ? rigiTerrainCopy.unavailable : text.terrainUnavailable
                  : text.loadingTerrain}
            </span>
            <span>{text.routeRegions[journeyEnvironment.region]}</span>
          </>
        )}
      </div>

      {isNetwork && !selectedTrain && !selectedAirTrack && !selectedRoad && !isContrast && (
        <div className="north-marker">N</div>
      )}

      {isNetwork && (
        <div className="map-navigation" aria-label={text.mapControls}>
          {!selectedTrain && !selectedAirTrack && (
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
              text.vehicleLabels,
              text.labelModes[trainLabelMode],
              text.labelModes[NEXT_TRAIN_LABEL_MODE[trainLabelMode]],
            )}
            onClick={() =>
              setTrainLabelMode((current) => NEXT_TRAIN_LABEL_MODE[current])
            }
          >
            <span aria-hidden="true">▱</span>
            {text.vehicleLabels} · {text.labelModes[trainLabelMode]}
          </button>
          {roadEnabled && roadTopology && (
            <div className="road-corridor-quick" aria-label={text.roadCorridors}>
              {roadTopology.roads
                .filter((road) =>
                  ['N1', 'N2', 'N3', 'N9', 'N13'].includes(road.id),
                )
                .map((road) => (
                  <button
                    key={road.id}
                    type="button"
                    data-tooltip={road.description}
                    aria-label={`${text.selectRoadCorridor} ${road.label}`}
                    aria-pressed={selectedRoadId === road.id}
                    onClick={() =>
                      selectedRoadId === road.id
                        ? releaseSelection()
                        : selectRoad(road)
                    }
                  >
                    {road.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {isNetwork && (
        <div className="mobile-map-tools">
          <details ref={mobileMapToolsRef}>
            <summary aria-label={text.mapControls}>⌖</summary>
            <div>
              {!selectedTrain && !selectedAirTrack && (
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
                  value={
                    isCogwheel ? 'cogwheel' : roadCategorySelected
                      ? 'road'
                      : airCategorySelected
                        ? 'air'
                        : (selectedCategory ?? '')
                  }
                  options={[
                    { value: '', label: text.allServices },
                    ...(isNetwork && networkStudy === 'national' ? [{ value: 'cogwheel', label: <span className="transport-option"><TransportIcon mode="cogwheel" color="#fff3a6" />{cogwheelCopy.label}</span> }] : []),
                    ...(isNetwork && !railVisible ? [] : visibleServiceCategories).map((category) => ({
                      value: category.id,
                      label: <span className="transport-option"><TransportIcon mode={isMountainStudy && category.id === 'other' ? 'cogwheel' : category.id} color={serviceColors[category.id]} />{categoryLabel(category.id)}</span>,
                    })),
                    ...(networkStudy === 'national' && airEnabled
                      ? [{ value: 'air', label: <span className="transport-option"><TransportIcon mode="air" color="#ff5edb" />{text.luftraum}</span> }]
                      : []),
                    ...(networkStudy === 'national' && roadEnabled
                      ? [{ value: 'road', label: <span className="transport-option"><TransportIcon mode="road" color="#ffb36b" />{text.auto}</span> }]
                      : []),
                  ]}
                  onChange={(category) => {
                    if (category === 'cogwheel') { if (!isCogwheel) toggleCogwheel(); return }
                    setCogwheelEnabled(false)
                    setAirCategorySelected(category === 'air')
                    setRoadCategorySelected(category === 'road')
                    setSelectedRoadId(undefined)
                    setSelectedCategory(
                      category && category !== 'air' && category !== 'road'
                        ? (category as ServiceCategory)
                        : undefined,
                    )
                  }}
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
              {roadEnabled && roadTopology && (
                <div className="mobile-tool-field">
                  <span>{text.roadCorridors}</span>
                  <MobilePicker
                    ariaLabel={text.selectRoadCorridor}
                    value={selectedRoadId ?? ''}
                    options={[
                      { value: '', label: text.allMotorways },
                      ...roadTopology.roads.map((road) => ({
                        value: road.id,
                        label: road.label,
                        detail:
                          road.description ?? text.roadSections(road.sectionCount),
                      })),
                    ]}
                    onChange={(roadId) => {
                      const road = roadTopology.roads.find(
                        (candidate) => candidate.id === roadId,
                      )
                      if (road) selectRoad(road)
                      else releaseSelection()
                    }}
                  />
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {roadRecordingsOpen && <Suspense fallback={null}><CantonalRecordingPicker language={language} recording={activePilot?.metadata.recordingId} onClose={() => { setRoadRecordingsOpen(false); roadRecordingsButton.current?.focus() }} /></Suspense>}
      {exploreOpen && <Suspense fallback={null}><StudyBrowser language={language} study={networkStudy} onClose={() => setExploreOpen(false)} onSelect={id => { setRegionalRange('day'); selectNetworkStudy(id, 'day'); setExploreOpen(false) }} /></Suspense>}
      <section className="transport" aria-label={text.playbackControls}>
        {isBern && <a className="mobile-map-attribution" href="https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct" target="_blank" rel="noreferrer">Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern</a>}
        {(isLausanne || isBasel) && <span className="mobile-map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>{isBasel && <> · <a href="https://www.swisstopo.admin.ch">© swisstopo</a></>}</span>}
      {isTimetable && !selectedTrain && !selectedAirTrack && !selectedRoute && (
        <div
          className={`service-legend${selectedCategory || isCogwheel || airCategorySelected || roadCategorySelected ? ' has-filter' : ''}`}
          aria-label={text.filterServices}
          style={hasFullDayTimeline ? { bottom: 'clamp(230px, 27vh, 265px)' } : undefined}
        >
          {isNetwork && networkStudy === 'national' && railVisible && (
            <button type="button" aria-pressed={isCogwheel} onClick={toggleCogwheel}
              data-tooltip={cogwheelCopy.description}
              style={{ '--service-accent': '#fff3a6' } as CSSProperties}>
              <TransportIcon mode="cogwheel" />{cogwheelCopy.label}
            </button>
          )}
          {(isNetwork && !railVisible ? [] : visibleServiceCategories).map((category) => (
              <button
                key={category.id}
                type="button"
                data-tooltip={`${selectedCategory === category.id ? help.restore : help.isolate} · ${categoryLabel(category.id)}`}
                aria-pressed={selectedCategory === category.id}
                style={
                  {
                    '--service-accent': serviceColors[category.id],
                  } as CSSProperties
                }
                onClick={() => {
                  setCogwheelEnabled(false)
                  setAirCategorySelected(false)
                  setRoadCategorySelected(false)
                  setSelectedRoadId(undefined)
                  setSelectedCategory((current) =>
                    current === category.id ? undefined : category.id,
                  )
                }}
              >
                <TransportIcon mode={isMountainStudy && category.id === 'other' ? 'cogwheel' : category.id} />
                {categoryLabel(category.id)}
              </button>
          ))}
          {isNetwork && networkStudy === 'national' && airEnabled && (
            <button
              type="button"
              data-tooltip={`${airCategorySelected ? help.restore : help.isolate} · ${text.luftraum}`}
              aria-pressed={airCategorySelected}
              style={{ '--service-accent': '#ff5edb' } as CSSProperties}
              onClick={() => {
                setCogwheelEnabled(false)
                setSelectedCategory(undefined)
                setRoadCategorySelected(false)
                setSelectedRoadId(undefined)
                setAirCategorySelected((current) => !current)
              }}
            >
              <TransportIcon mode="air" />
              {text.luftraum}
            </button>
          )}
          {isNetwork && networkStudy === 'national' && roadEnabled && (
            <button
              type="button"
              data-tooltip={`${roadCategorySelected ? help.restore : help.isolate} · ${text.auto}`}
              aria-pressed={roadCategorySelected}
              style={{ '--service-accent': '#ffb36b' } as CSSProperties}
              onClick={() => {
                setCogwheelEnabled(false)
                setSelectedCategory(undefined)
                setAirCategorySelected(false)
                setSelectedRoadId(undefined)
                setRoadCategorySelected((current) => !current)
              }}
            >
              <TransportIcon mode="road" />
              {text.auto}
            </button>
          )}
        </div>
      )}


        {isNetwork && <>
          <div className="explore-actions">
            <button type="button" onClick={() => setExploreOpen(true)}>{exploreCopy.browse}</button>
            <button ref={roadRecordingsButton} type="button" onClick={() => setRoadRecordingsOpen(true)}>{CANTONAL_RECORDING_COPY[language].title}</button>
            {!isContrast && !airEnabled && !roadEnabled && <button type="button" aria-pressed={nowActive} disabled={!network || (isRegionalDay && !regionalDay.chunkReady) || (isNationalDay && !nationalDayChunkReady)} onClick={nowActive ? stopNow : startNow}>{exploreCopy.now}</button>}
            {nowActive && <button type="button" onClick={browserLocation.locate} disabled={browserLocation.status === 'locating'}>{exploreCopy.locate}</button>}
            {browserLocation.status !== 'idle' && <button type="button" onClick={clearBrowserLocation}>{exploreCopy.clear}</button>}
            {isRegionalDayStudy(networkStudy) && <button type="button" aria-pressed={isRegionalDay} onClick={() => { stopNow(); setRegionalRange(value => value === 'day' ? 'morning' : 'day'); setNetworkTime(edition.defaultNetworkTime); setRegionalRetry(true) }}>{exploreCopy.day}</button>}
            <button ref={shareButton} type="button" aria-expanded={Boolean(shareUrl)} aria-controls={shareUrl ? 'study-share' : undefined} disabled={!network && !activePilot} onClick={() => void shareStudy()}>{exploreCopy.share}</button>
          </div>
          {isBern && <p className="explore-status">{text.bernScope} · {network?.metadata.serviceDate}</p>}
          {nowActive && !isBern && <p className="explore-status">{network?.metadata.serviceDate === nowDate ? exploreCopy.today : exploreCopy.typical}</p>}
          {nowUnavailable && <p className="explore-status" role="status">{exploreCopy.unavailable}</p>}
          {browserLocation.status !== 'idle' && <p className="explore-status" role="status">{browserLocation.status === 'locating' ? exploreCopy.locating : browserLocation.status === 'denied' ? exploreCopy.denied : browserLocation.status === 'timeout' ? exploreCopy.timeout : browserLocation.status === 'unavailable' ? exploreCopy.locationError : validLocation ? `${exploreCopy.accuracy}: ±${Math.round(validLocation.accuracy)} m` : exploreCopy.outside}</p>}
          {(initialLink.invalidRecording || pilotLinkUnavailable) && <p className="explore-status" role="status">{PILOT_LINK_UNAVAILABLE[language]}</p>}
          {pilotLinkUnavailable && <button type="button" onClick={() => window.location.reload()}>{exploreCopy.retry}</button>}
          {exploreNotice && <p className="explore-status" role="status">{exploreNotice}</p>}
          {shareUrl && <div id="study-share" role="group" aria-label={exploreCopy.share} onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              dismissShare()
            }
          }}>
            <p className="explore-status" role="status">{shareCopied ? exploreCopy.copied : exploreCopy.copy}</p>
            <div className="explore-actions explore-share">
              <input autoFocus className="explore-link" aria-label={exploreCopy.copy} readOnly value={shareUrl} onFocus={event => event.target.select()} />
              <button type="button" onClick={dismissShare}>{exploreCopy.close}</button>
            </div>
          </div>}
          {isRegionalDay && regionalDay.error && <div className="explore-actions"><span role="status">{exploreCopy.error}</span><button type="button" onClick={() => { setRegionalRetry(false); window.setTimeout(() => setRegionalRetry(true), 0) }}>{exploreCopy.retry}</button></div>}
        </>}

        <div className="progress-copy">
          <span>
            {timelineReady
              ? formatServiceTime(timeline.windowStart)
              : journeyPosition.previous.departure}
          </span>
          <span className="route-id">
            {isTimetable ? formatServiceTime(timelineTime) : activeJourney.id}
          </span>
          <span>
            {timelineReady
              ? formatTimelineBoundary(timeline.windowEnd)
              : activeJourney.stops.at(-1)?.departure}
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
              stopNow()
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
                  data-tooltip={`${help.jump} · ${text.dayPresetNames[preset.id]} · ${formatServiceTime(preset.time)}`}
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
                data-tooltip={directorMode ? help.directorOff : help.directorOn} aria-pressed={directorMode}
                onClick={() => { stopNow(); setDirectorMode((value) => !value) }}
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
                  data-tooltip={`${help.speed} · ${rate.label}`} aria-pressed={playbackRate === rate.value}
                  onClick={() => changePlaybackRate(rate.value)}
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
            onClick={togglePlayback}
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
              onChange={(rate) => changePlaybackRate(Number(rate))}
            />
          )}
          <details className="mobile-more-controls">
            <summary aria-label={text.moreControls}>•••</summary>
            <div>
              <button type="button" data-tooltip={selectedAirTrack || selectedAirport || selectedTrain || selectedRoute || selectedStation ? help.release : isNetwork ? help.corridor : help.network} onClick={handleContextAction}>
                {selectedAirport ? text.clearAirport : selectedAirTrack ||
                selectedTrain ||
                selectedRoute ||
                selectedStation
                  ? selectedAirTrack
                    ? text.releaseAircraft
                    : selectedTrain
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
                      : isBern ? text.bernView : isBasel ? text.baselView : isLausanne ? text.lausanneView : isPostbus ? text.postbusNetwork : networkStudy === 'zvv-region'
                        ? text.zvvView
                        : networkStudy === 'geneva-tpg'
                          ? text.genevaView
                          : text.zurichView}
              </button>
              {isTimetable &&
                !isContrast &&
                !selectedTrain &&
                !selectedAirTrack &&
                !selectedRoute && (
                <button
                  type="button"
                  data-tooltip={isHub ? help.network : help.hubs} aria-pressed={isHub}
                  onClick={() => {
                    setSelectedCategory(undefined)
                    setAirCategorySelected(false)
                    setRigiSequenceActive(false)
                    setGornergratAscentActive(false); setJungfrauAscentActive(false)
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
                    data-tooltip={directorMode ? help.directorOff : help.directorOn} aria-pressed={directorMode}
                    onClick={() => { stopNow(); setDirectorMode((value) => !value) }}
                  >
                    {directorMode ? text.stopDirector : text.directorMode}
                  </button>
                </div>
              )}
              <a className="methodology-link" href="./methodology.html">
                {text.readMethodology}
              </a>
              {recordingSupported && (
                <button type="button" data-tooltip={recordingState === 'saving' ? help.recordSaving : recordingState === 'recording' ? help.recordStop : help.record} onClick={() => void toggleRecording()}>
                  {recordingState === 'recording'
                    ? text.stopRecording
                    : recordingState === 'saving'
                      ? text.savingRecording
                      : text.recordLoop}
                </button>
              )}
            </div>
          </details>
        </div>
        <div className="button-row">
          <button type="button" onClick={togglePlayback}>
            <span className="button-icon" aria-hidden="true">
              {isPlaying ? 'Ⅱ' : '▶'}
            </span>
            {isPlaying ? text.pauseMotion : text.resumeMotion}
            <kbd>{text.spaceKey}</kbd>
          </button>
          <button type="button" data-tooltip={selectedAirTrack || selectedAirport || selectedTrain || selectedRoute || selectedStation ? help.release : isNetwork ? help.corridor : help.network} onClick={handleContextAction}>
            <span className="button-icon camera-icon" aria-hidden="true" />
            {selectedAirport ? text.clearAirport : selectedAirTrack ||
            selectedTrain ||
            selectedRoute ||
            selectedStation
              ? selectedAirTrack
                ? text.releaseAircraft
                : selectedTrain
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
                  : isBern ? text.bernView : isBasel ? text.baselView : isLausanne ? text.lausanneView : isPostbus ? text.postbusNetwork : networkStudy === 'zvv-region'
                    ? text.zvvView
                    : networkStudy === 'geneva-tpg'
                      ? text.genevaView
                      : text.zurichView}
            <kbd>C</kbd>
          </button>
          {isTimetable &&
            !isContrast &&
            !selectedTrain &&
            !selectedAirTrack &&
            !selectedRoute && (
            <button
              type="button"
              data-tooltip={isHub ? help.network : help.hubs} aria-pressed={isHub}
              onClick={() => {
                setSelectedCategory(undefined)
                setAirCategorySelected(false)
                setRigiSequenceActive(false)
                setGornergratAscentActive(false); setJungfrauAscentActive(false)
                setView(isHub ? 'network' : 'hub')
              }}
            >
              <span className="button-icon takt-icon" aria-hidden="true">◎</span>
              {isHub
                ? networkStudy === 'national'
                  ? text.nationalView
                  : isBern ? text.bernView : isBasel ? text.baselView : isLausanne ? text.lausanneView : isPostbus ? text.postbusNetwork : networkStudy === 'zvv-region'
                    ? text.zvvView
                    : networkStudy === 'geneva-tpg'
                      ? text.genevaView
                    : text.zurichView
                : text.taktHubs}
            </button>
          )}
          {recordingSupported && (
            <button type="button" data-tooltip={recordingState === 'saving' ? help.recordSaving : recordingState === 'recording' ? help.recordStop : help.record} onClick={() => void toggleRecording()}>
              <span className="button-icon record-icon" aria-hidden="true">●</span>
              {recordingState === 'recording'
                ? text.stopRecording
                : recordingState === 'saving'
                  ? text.savingRecording
                  : text.recordLoop}
            </button>
          )}
        </div>
      </section>

      {performanceEnabled && (
        <aside className="performance-monitor" aria-label="Local performance monitor">
          <span>Local only · no analytics</span>
          <strong>{performanceSample ? `${performanceSample.fps} FPS` : 'measuring…'}</strong>
          <small>
            {performanceSample
              ? `${performanceSample.slowFramePercent}% slow frames`
              : '1 second sample'}
          </small>
        </aside>
      )}

      <footer>
        {isTimetable ? (
          <span className="source-links">
            <a
              href={network?.metadata.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {isBern ? 'opentransportdata.swiss · GTFS' : 'Swiss GTFS'} · {network?.metadata.feedVersion ?? text.loading}
            </a>
            {isNetwork && network?.metadata.geometry && (
              <a
                href={
                  isBern ? 'https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct' : isBasel ? 'https://www.openstreetmap.org/copyright' : network.metadata.geometry.productUrl ??
                  network.metadata.geometry.sourceUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                {isBern ? 'Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern' : isPostbus || isLausanne || isBasel ? '© OpenStreetMap contributors · ODbL' : <>{text.stopGeometry} ·{' '}
                {networkStudy === 'national'
                  ? 'BAV / OFT'
                  : networkStudy === 'geneva-tpg'
                    ? 'TPG / SITG'
                    : 'ZVV'}</>}
              </a>
            )}
            {isNetwork && (isLausanne || isBasel) && <a href="https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz" target="_blank" rel="noreferrer">Rail · BAV / OFT</a>}
            {isNetwork && isBern && <a href={editionDataUrl('bern-region/terms_of_use_de.pdf')} target="_blank" rel="noreferrer">{text.bernTerms} · DE</a>}
            {isNetwork && isBern && <a href={editionDataUrl('bern-region/terms_of_use_fr.pdf')} target="_blank" rel="noreferrer">{text.bernTerms} · FR</a>}
            {isNetwork && isBasel && <a href="https://wfs.geo.bs.ch/" target="_blank" rel="noreferrer">Geodaten Kanton Basel-Stadt</a>}
            {isNetwork && isBasel && <a href="https://www.swisstopo.admin.ch">© swisstopo</a>}
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
            {isNetwork && airEnabled && activeAirSnapshot && (
              <a
                href={activeAirSnapshot.metadata.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Luftraum · ADSB.lol / {activeAirSnapshot.metadata.license}
              </a>
            )}
            {isNetwork && roadEnabled && roadSnapshot && !activePilot && (
              <a
                href={roadTopology?.metadata.sourceUrl ?? roadSnapshot.metadata.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                AUTO · ASTRA / FEDRO
              </a>
            )}
            {isNetwork && roadEnabled && roadTopology?.roads.some(road => road.id.startsWith('ZH:')) && (
              <a href="https://geolion.zh.ch/geodatensatz/3177" target="_blank" rel="noreferrer">AUTO · Kanton Zürich</a>
            )}
            {isMountainStudy && <a href="https://map.geo.admin.ch/?layers=ch.bav.seilbahnen-bundeskonzession,ch.bav.schienennetz" target="_blank" rel="noreferrer">FOT · Rail / Cableway</a>}
            <a href="./methodology.html">{text.methodology}</a>
          </span>
        ) : (
          <span className="source-links">
            {corridor ? (
              <>
                <a href={corridor.metadata.productUrl} target="_blank" rel="noreferrer">
                  Terrain · © swisstopo
                </a>
                {corridor.metadata.routeProductUrl && (
                  <a
                    href={corridor.metadata.routeProductUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Route · {isRigiTerrain ? 'FOT / BAV' : '© OpenStreetMap contributors'}
                  </a>
                )}
                {isRigiTerrain && lakes && <a href={lakes.metadata.productUrl} target="_blank" rel="noreferrer">{text.lakes} · {lakes.metadata.attribution}</a>}
                {isRigiTerrain && <a href="./methodology.html">{text.methodology}</a>}
                {corridor.metadata.tunnelProductUrl && (
                  <a
                    href={corridor.metadata.tunnelProductUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Tunnels · SBB Infrastruktur
                  </a>
                )}
              </>
            ) : (
              activeJourney.operator
            )}
          </span>
        )}
        <span>
          {isHub
            ? text.arrivalsDirection
            : isNetwork
              ? isBern ? text.bernModel : isBasel ? text.baselModel : isLausanne ? text.lausanneModel : timedRigiTerrain || jungfrauTerrainWindow ? text.interpolation : isGornergrat ? gornergratCopy?.model : isJungfrau ? jungfrauCopy?.model : isRigi ? rigiCopy.water : hasHeadwayMotion ? frequencyCopy.interpolation : text.interpolation
              : text.simulation}
        </span>
      </footer>
    </main>
  )
}
