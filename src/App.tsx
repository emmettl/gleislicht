import { useUiLanguage } from './use-ui-language.ts'
import { ADDITIONAL_REGION_IDS, ADDITIONAL_REGIONS, additionalRegionDate, additionalRegionKey, isAdditionalRegion } from './studies/additional-regions.ts'
import { useUiText } from './use-ui-text.ts'
import { useNowClock } from '@motionstudies/web/use-now-clock'
import { useBrowserLocation } from '@motionstudies/web/use-browser-location'
import { REGIONAL_DAYS, isRegionalDayStudy, readStudyLink, withinStudy } from './studies/explore.ts'
import { EXPLORE_EN, type ExploreUiCopy } from './studies/explore-ui-en.ts'
import { networkWithRailVisibility } from './studies/network-layers.ts'
import { COGWHEEL_ROUTE_COLORS, cogwheelNetwork } from './studies/cogwheel.ts'
import { useCogwheelCatalogue } from './studies/use-cogwheel-catalogue.ts'
import type { MeasuredTerrainBinding } from './studies/measured-terrain.ts'
import type { RigiTerrainBinding } from './studies/rigi-timetable-terrain.ts'
import { rigiOperator } from './studies/rigi.ts'
import { isHeadwayTrain, serviceFrequency, withFrequencyFerryPaths } from './studies/frequency.ts'
import { createActiveTrainCounter, orderTrainSearchMatches, trainSearchResults } from './studies/network-ui-index.ts'
import { postbusRouteIndex, postbusRouteSnapshot, postbusTickFollowsSeek, POSTBUS_YELLOW, POSTBUS_ROUTE_COLORS } from './studies/postbus.ts'
import { TransportIcon } from './TransportIcon.tsx'
import { observeMasthead } from './studies/masthead-layout.ts'
import { studyOrder } from './studies/study-order.ts'
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
import { cantonalPilotForRecording, cantonalPilotForRoad, cantonalPilotWindow, searchRoadsWithPilots, topologyWithPilot, type CantonalPilot } from './studies/cantonal-road-pilot.ts'
import {
  roadCorridorSearchValue,
} from '@motionstudies/core/road-search'
import {
  LANGUAGE_LOCALES,
  serviceCategoryLabel,
  sourceCredit,
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

const CantonalRecordingPicker = lazy(() => import('./studies/CantonalRecordingPicker.tsx'))
const DetailCard = lazy(() => import('./studies/DetailCard.tsx'))
const StudyBrowser = lazy(() => import('./studies/StudyBrowser.tsx'))

const CantonalPilotControls = lazy(() => import('./studies/CantonalPilotControls.tsx'))

const RoadTrafficHistory = lazy(() => import('./studies/RoadTrafficHistory.tsx').then(module => ({ default: module.RoadTrafficHistory })))

const TicinoDatePicker = lazy(() => import('./studies/TicinoDatePicker.tsx').then(module => ({ default: module.TicinoDatePicker })))
const RegionalStudyDetails = lazy(() => import('./studies/RegionalStudyDetails.tsx').then(module => ({ default: module.RegionalStudyDetails })))
const AirportHeroCard = lazy(() => import('./studies/AirportCard.tsx'))

const AlpineQuiet = lazy(() =>
  import('./studies/AlpineQuiet.tsx').then(({ AlpineQuiet: Scene }) => ({ default: Scene })),
)

const RigiTimetableTerrain = lazy(() => import('./studies/RigiTimetableTerrain.tsx'))
const JungfrauPlaces = lazy(() => import('./studies/JungfrauPlaces.tsx'))
const JungfrauGuide = lazy(() => import('./studies/JungfrauGuide.tsx'))
const MeasuredTerrainScene = lazy(() => import('./studies/MeasuredTerrainScene.tsx'))
const PilatusJourney = lazy(() => import('./studies/PilatusJourney.tsx'))
const RochersJourney = lazy(() => import('./studies/RochersJourney.tsx'))
const GlionJourney = lazy(() => import('./studies/GlionJourney.tsx'))
const TerritetJourney = lazy(() => import('./studies/TerritetJourney.tsx'))
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
  readonly suspended?: boolean
}

export function App({ edition, suspended = false }: AppProps) {
  const [webglAvailable] = useState(supportsWebGL)
  const [performanceEnabled] = useState(() =>
    new URLSearchParams(window.location.search).has('perf'),
  )
  const [language, setLanguage] = useUiLanguage(edition.languageStorageKey)
  const [initialLink] = useState(() => readStudyLink(window.location.search))
  const linkedPilot = cantonalPilotForRecording(initialLink.recording)
  const [pilotLinkPending, setPilotLinkPending] = useState(Boolean(linkedPilot))
  const [pilotLinkUnavailable, setPilotLinkUnavailable] = useState(false)
  const [linkPending, setLinkPending] = useState(!linkedPilot && Boolean(initialLink.date || initialLink.time !== undefined || initialLink.station || initialLink.train))
  const [exploreOpen, setExploreOpen] = useState(false)
  const [roadRecordingsOpen, setRoadRecordingsOpen] = useState(false)
  const roadRecordingsButton = useRef<HTMLButtonElement>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const shareButton = useRef<HTMLButtonElement>(null)
  const [exploreNotice, setExploreNotice] = useState<'dateMismatch' | 'focusMissing' | ''>('')
  const [regionalRange, setRegionalRange] = useState<'morning' | 'day'>(initialLink.range)
  const [regionalRetry, setRegionalRetry] = useState(true)
  const [playbackEnabled, setIsPlaying] = useState(initialLink.time === undefined && !initialLink.invalidRecording)
  const isPlaying = playbackEnabled && !suspended
  const [view, setView] = useState<View>('network')
  const [journeyProgress, setJourneyProgress] = useState(0.11)
  const [journeyEnvironment, setJourneyEnvironment] = useState<JourneyEnvironment>({
    progress: 0.11,
    tunnel: 0,
    openness: 0.7,
    speed: 0.6,
    region: 'plateau',
  })
  const [playbackTime, setNetworkTime] = useState(linkedPilot ? edition.defaultNetworkTime : initialLink.time ?? (initialLink.study === 'territet' ? 43440 : (initialLink.study === 'pilatus' || initialLink.study === 'rochers') ? 43200 : edition.defaultNetworkTime))
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
  const [pilatusNetwork, setPilatusNetwork] = useState<NetworkSnapshot>()
  const [pilatusAttempt, setPilatusAttempt] = useState(0)
  const [pilatusJourneyActive, setPilatusJourneyActive] = useState(false)
  const [rochersNetwork, setRochersNetwork] = useState<NetworkSnapshot>()
  const [rochersAttempt, setRochersAttempt] = useState(0)
  const [rochersJourneyActive, setRochersJourneyActive] = useState(false)
  const [territetNetwork, setTerritetNetwork] = useState<NetworkSnapshot>()
  const [territetAttempt, setTerritetAttempt] = useState(0)
  const [territetJourneyActive, setTerritetJourneyActive] = useState(false)
  const [glionJourneyActive, setGlionJourneyActive] = useState(Boolean(initialLink.glion))
  const [glionLink, setGlionLink] = useState<typeof initialLink | undefined>(initialLink.glion ? initialLink : undefined)
  const [glionNetwork, setGlionNetwork] = useState<NetworkSnapshot>()
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
  const [rochersTerrainBinding, setRochersTerrainBinding] = useState<MeasuredTerrainBinding>()
  const [glionTerrainBinding, setGlionTerrainBinding] = useState<MeasuredTerrainBinding>()
  const [territetTerrainBinding, setTerritetTerrainBinding] = useState<MeasuredTerrainBinding>()
  const [pilatusTerrainBinding, setPilatusTerrainBinding] = useState<MeasuredTerrainBinding>()
  const [gornergratTerrainBinding, setGornergratTerrainBinding] = useState<MeasuredTerrainBinding>()
  const [jungfrauTerrainBinding, setJungfrauTerrainBinding] = useState<MeasuredTerrainBinding>()
  const [rigiTerrainBinding, setRigiTerrainBinding] = useState<RigiTerrainBinding>()
  const [zvvRegionNetwork, setZvvRegionNetwork] = useState<NetworkSnapshot>()
  const [additionalSnapshot, setAdditionalSnapshot] = useState<{ key: string; network: NetworkSnapshot }>()
  const [additionalDates, setAdditionalDates] = useState<Record<string, string>>(() => Object.fromEntries(ADDITIONAL_REGION_IDS.map(id => [id, additionalRegionDate(initialLink.study === id ? initialLink.date : undefined)])))
  const [additionalAttempt, setAdditionalAttempt] = useState(0)
  const [valaisRegionNetwork, setValaisRegionNetwork] = useState<NetworkSnapshot>()
  const [ticinoRegionNetwork, setTicinoRegionNetwork] = useState<NetworkSnapshot>()
  const [valaisAttempt, setValaisAttempt] = useState(0)
  const [ticinoAttempt, setTicinoAttempt] = useState(0)
  const [valaisDate, setValaisDate] = useState(initialLink.study === 'valais-region' && initialLink.date === '2026-09-06' ? '2026-09-06' : '2026-09-04')
  const [ticinoDate, setTicinoDate] = useState(initialLink.study === 'ticino-region' && initialLink.date === '2026-09-06' ? '2026-09-06' : '2026-09-04')
  const [graubuendenDate, setGraubuendenDate] = useState(initialLink.study === 'graubuenden-region' && initialLink.date === '2026-09-06' ? '2026-09-06' : '2026-09-04')
  const [graubuendenRegionNetwork, setGraubuendenRegionNetwork] = useState<NetworkSnapshot>()
  const [graubuendenAttempt, setGraubuendenAttempt] = useState(0)
  const [solothurnRegionNetwork, setSolothurnRegionNetwork] = useState<NetworkSnapshot>()
  const [solothurnAttempt, setSolothurnAttempt] = useState(0)
  const [bernRegionNetwork, setBernRegionNetwork] = useState<NetworkSnapshot>()
  const [bernAttempt, setBernAttempt] = useState(0)
  const [rivieraRegionNetwork, setRivieraRegionNetwork] = useState<NetworkSnapshot>()
  const [rivieraAttempt, setRivieraAttempt] = useState(0)
  const [nyonRegionNetwork, setNyonRegionNetwork] = useState<NetworkSnapshot>()
  const [nyonAttempt, setNyonAttempt] = useState(0)
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
  const [roadCatalogue, setRoadCatalogue] = useState<typeof import('./editions/switzerland-roads.ts')>()
  useEffect(() => {
    if (roadEnabled || searchQuery.trim()) void import('./editions/switzerland-roads.ts').then(setRoadCatalogue)
  }, [roadEnabled, searchQuery])
  const [roadCategorySelected, setRoadCategorySelected] = useState(false)
  const [roadSnapshot, setRoadSnapshot] = useState<RoadTrafficSnapshot>()
  const [roadTopology, setRoadTopology] = useState<RoadTopologySnapshot>()
  const [roadLoadState, setRoadLoadState] = useState<RoadLoadState>('idle')
  const [selectedRoadId, setSelectedRoadId] = useState<string | undefined>(linkedPilot?.road)
  const pilotClockBounds = useRef<{ windowStart: number; windowEnd: number } | undefined>(undefined)
  const [cantonalPilot, setCantonalPilot] = useState<CantonalPilot>()
  const selectedPilotDefinition = cantonalPilotForRoad(selectedRoadId, cantonalPilot?.metadata.recordingId ?? linkedPilot?.id)
  const activePilot = cantonalPilot && roadEnabled && selectedPilotDefinition?.id === cantonalPilot.metadata.recordingId && !sbbEnabled && !airEnabled && view === 'network' && networkStudy === 'national' ? cantonalPilot : undefined
  const playbackTopology = useMemo(() => roadTopology && activePilot ? topologyWithPilot(roadTopology, activePilot) : roadTopology, [roadTopology, activePilot])
  if (cantonalPilot && !activePilot) {
    setCantonalPilot(undefined)
    setNetworkTime(edition.defaultNetworkTime)
    setIsPlaying(false)
  }
  useEffect(() => { if (!activePilot) pilotClockBounds.current = undefined }, [activePilot])
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
  const [mobileMapToolsOpen, setMobileMapToolsOpen] = useState(false)
  const mobileMapToolsRef = useRef<HTMLDetailsElement>(null)
  const searchInteractionRef = useRef(false)
  const timelineTimeRef = useRef(networkTime)
  const roadHistorySeekRef = useRef<{ time: number; at: number } | undefined>(undefined)
  const postbusSeekRef = useRef<{ time: number; at: number } | undefined>(undefined)
  const text = useUiText(language)
  const [translatedExploreCopy, setTranslatedExploreCopy] = useState<{ language: UiLanguage; copy: ExploreUiCopy }>({ language: 'en', copy: EXPLORE_EN })
  const exploreCopy = translatedExploreCopy.language === language ? translatedExploreCopy.copy : EXPLORE_EN
  useEffect(() => {
    let current = true
    if (language !== 'en') void import('./studies/explore-copy.ts').then(module => { if (current) setTranslatedExploreCopy({ language, copy: module.EXPLORE_COPY[language] }) }).catch(() => { /* Retain English if the translation cannot load. */ })
    return () => { current = false }
  }, [language])
  const help = text.controlHelp
  const additionalId = isAdditionalRegion(networkStudy) ? networkStudy : undefined
  const additionalKey = additionalId ? additionalRegionKey(additionalId, additionalDates[additionalId]) : undefined
  const additionalNetwork = additionalSnapshot?.key === additionalKey ? additionalSnapshot?.network : undefined
  const [additionalLocale, setAdditionalLocale] = useState<typeof import('./studies/additional-regions-copy.ts')>()
  useEffect(() => { if (additionalId) void import('./studies/additional-regions-copy.ts').then(setAdditionalLocale) }, [additionalId])
  const additionalRegion = additionalId ? additionalLocale?.ADDITIONAL_REGION_DETAILS[additionalId] : undefined
  const additionalCopy = additionalId ? additionalLocale?.additionalRegionCopy(language, additionalId) : undefined
  const additionalLabel = additionalCopy?.name.split(' · ')[0] ?? (additionalId ? ADDITIONAL_REGIONS[additionalId].name : undefined)
  const isRigi = networkStudy === 'rigi-lake'
  const isValais = networkStudy === 'valais-region'
  const [valaisLocale, setValaisLocale] = useState<typeof import('./studies/valais-copy.ts')>()
  useEffect(() => { if (isValais) void import('./studies/valais-copy.ts').then(setValaisLocale) }, [isValais])
  const valaisCopy = valaisLocale?.VALAIS_COPY[language]
  const valaisLabel = valaisCopy?.valaisNetwork ?? 'Valais'
  const isTicino = networkStudy === 'ticino-region'
  const [ticinoLocale, setTicinoLocale] = useState<typeof import('./studies/ticino-copy.ts')>()
  useEffect(() => { if (isTicino) void import('./studies/ticino-copy.ts').then(setTicinoLocale) }, [isTicino])
  const ticinoCopy = ticinoLocale?.TICINO_COPY[language]
  const isGraubuenden = networkStudy === 'graubuenden-region'
  const [graubuendenLocale, setGraubuendenLocale] = useState<typeof import('./studies/graubuenden-copy.ts')>()
  useEffect(() => { if (isGraubuenden) void import('./studies/graubuenden-copy.ts').then(setGraubuendenLocale) }, [isGraubuenden])
  const graubuendenCopy = graubuendenLocale?.GRAUBUENDEN_COPY[language]
  const isSolothurn = networkStudy === 'solothurn-region'
  const isBern = networkStudy === 'bern-region'
  const isRiviera = networkStudy === 'riviera-region'
  const [rivieraLocale, setRivieraLocale] = useState<typeof import('./studies/riviera-copy.ts')>()
  useEffect(() => { if (isRiviera) void import('./studies/riviera-copy.ts').then(setRivieraLocale) }, [isRiviera])
  const rivieraCopy = rivieraLocale?.RIVIERA_COPY[language]
  const rivieraLabel = rivieraCopy?.network ?? 'Riviera'
  const isNyon = networkStudy === 'nyon-region'
  const isBasel = networkStudy === 'basel-core'
  const isLausanne = networkStudy === 'lausanne-region'
  const isPilatus = networkStudy === 'pilatus'
  const [pilatusLocale, setPilatusLocale] = useState<typeof import('./studies/pilatus-copy.ts')>()
  useEffect(() => { if (isPilatus) void import('./studies/pilatus-copy.ts').then(setPilatusLocale) }, [isPilatus])
  const pilatusCopy = pilatusLocale?.PILATUS_COPY[language]
  const isRochers = networkStudy === 'rochers'
  const [rochersLocale, setRochersLocale] = useState<typeof import('./studies/rochers-copy.ts')>()
  useEffect(() => { if (isRochers) void import('./studies/rochers-copy.ts').then(setRochersLocale) }, [isRochers])
  const rochersCopy = rochersLocale?.ROCHERS_COPY[language]
  const isTerritet = networkStudy === 'territet'
  const [territetLocale, setTerritetLocale] = useState<typeof import('./studies/territet-copy.ts')>()
  useEffect(() => { if (isTerritet) void import('./studies/territet-copy.ts').then(setTerritetLocale) }, [isTerritet])
  const territetCopy = territetLocale?.TERRITET_COPY[language]
  const isGornergrat = networkStudy === 'gornergrat'
  const [gornergratLocale, setGornergratLocale] = useState<typeof import('./studies/gornergrat-copy.ts')>()
  useEffect(() => { if (isGornergrat) void import('./studies/gornergrat-copy.ts').then(setGornergratLocale) }, [isGornergrat])
  const gornergratCopy = gornergratLocale?.GORNERGRAT_COPY[language]
  const isJungfrau = networkStudy === 'jungfrau'
  const isMountainStudy = isRigi || isJungfrau || isGornergrat || isTerritet || isRochers || isPilatus
  const [jungfrauLocale, setJungfrauLocale] = useState<typeof import('./studies/jungfrau-copy.ts')>()
  useEffect(() => { if (isJungfrau) void import('./studies/jungfrau-copy.ts').then(setJungfrauLocale) }, [isJungfrau])
  const jungfrauCopy = jungfrauLocale?.JUNGFRAU_COPY[language]
  const jungfrauSelect = jungfrauCopy?.select ?? { en: 'Explore the Jungfrau railways', de: 'Jungfraubahnen entdecken', fr: 'Explorer les chemins de fer de la Jungfrau', it: 'Esplora le ferrovie della Jungfrau' }[language]
  const territetTerrainWindow = view === 'network' && isTerritet && territetJourneyActive ? territetTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const glionTerrainWindow = view === 'network' && isTerritet && glionJourneyActive ? glionTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const rochersTerrainWindow = view === 'network' && isRochers && rochersJourneyActive ? rochersTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const pilatusTerrainWindow = view === 'network' && isPilatus && pilatusJourneyActive ? pilatusTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const gornergratTerrainWindow = view === 'network' && isGornergrat && gornergratAscentActive ? gornergratTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const jungfrauTerrainWindow = view === 'network' && isJungfrau && jungfrauAscentActive ? jungfrauTerrainBinding?.windows.find(w => networkTime >= w.start && networkTime < w.end) : undefined
  const timedRigiTerrain = view === 'network' && isRigi && rigiSequenceActive && rigiTerrainBinding && networkTime >= rigiTerrainBinding.sequence.departure && networkTime <= rigiTerrainBinding.sequence.end ? rigiTerrainBinding : undefined
  const [rigiLocale, setRigiLocale] = useState<typeof import('./studies/rigi-copy.ts')>()
  useEffect(() => { if (isRigi) void import('./studies/rigi-copy.ts').then(setRigiLocale) }, [isRigi])
  const rigiSelect = { en: 'Explore Lake Lucerne and Rigi', de: 'Vierwaldstättersee und Rigi entdecken', fr: 'Explorer le lac des Quatre-Cantons et le Rigi', it: 'Esplora il Lago dei Quattro Cantoni e il Rigi' }[language]
  const rigiCopy = rigiLocale?.RIGI_COPY[language] ?? { connections: '', rhythm: text.loading, sequence: '', select: rigiSelect, title: 'Rigi', placeholder: rigiSelect, modes: '', loading: text.loading, unavailable: text.loading, water: '', cable: '' }
  const isRigiTerrain = isRigiCorridorId(journeyCorridorId)
  const rigiOrigin = isRigiTerrain ? RIGI_ASCENTS[journeyCorridorId].name : 'Vitznau'
  const rigiTerrainCopy = { enter: text.rigiTerrainEnter.replace('{origin}', rigiOrigin), unavailable: text.rigiTerrainUnavailable }
  const isPostbus = networkStudy === 'postbus'
  const isContrast = networkStudy === 'contrast'
  const serviceColors = useMemo(() => isPostbus || isContrast ? { ...SERVICE_COLORS, bus: POSTBUS_YELLOW } : (isMountainStudy || cogwheelEnabled && networkStudy === 'national' && view === 'network') ? { ...SERVICE_COLORS, other: '#fff3a6' } : SERVICE_COLORS, [isPostbus, isContrast, isMountainStudy, cogwheelEnabled, networkStudy, view])
  const isRegionalDay = isRegionalDayStudy(networkStudy) && regionalRange === 'day'
  const regionalDate = additionalId ? additionalDates[additionalId] : isValais ? valaisDate : isTicino ? ticinoDate : isGraubuenden ? graubuendenDate : undefined
  const regionalPrefix = additionalKey ? `${additionalKey}/` : regionalDate ? `${networkStudy}/${regionalDate}/` : ''
  const regionalAssetUrl = useCallback((path: string) => editionDataUrl(regionalPrefix && !path.startsWith(`${networkStudy}/`) ? `${regionalPrefix}${path}` : path), [regionalPrefix, networkStudy])
  const regionalDay = useProgressiveNetworkDay(regionalPrefix ? `${regionalPrefix}${networkStudy}-day-manifest.json` : isRegionalDayStudy(networkStudy) ? REGIONAL_DAYS[networkStudy] : REGIONAL_DAYS['zvv-region'], isRegionalDay && regionalRetry, networkTime, regionalAssetUrl)
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
    isRegionalDay ? regionalDay.network : additionalId ? additionalNetwork : isValais ? valaisRegionNetwork : isTicino ? ticinoRegionNetwork : isGraubuenden ? graubuendenRegionNetwork : isSolothurn ? solothurnRegionNetwork : isBern ? bernRegionNetwork : isRiviera ? rivieraRegionNetwork : isNyon ? nyonRegionNetwork : isBasel ? baselCoreNetwork : isLausanne ? lausanneRegionNetwork : isPilatus ? pilatusNetwork : isRochers ? rochersNetwork : isTerritet ? (glionNetwork ?? territetNetwork) : isGornergrat ? gornergratNetwork : isJungfrau ? jungfrauNetwork : isRigi ? rigiNetwork : isPostbus ? postbusDay.network : isContrast
      ? (zurichContrast.network ?? nationalNetwork)
      : networkStudy === 'zurich-city'
      ? zurichCityNetwork
      : networkStudy === 'zvv-region'
        ? zvvRegionNetwork
        : networkStudy === 'geneva-tpg'
          ? genevaTpgNetwork
          : nationalTimeRange === 'day'
            ? (nationalDayNetwork ?? nationalNetwork)
            : nationalNetwork

  useEffect(() => { nowMetadata.current = view === 'network' && !isContrast && !airEnabled && !roadEnabled ? baseNetwork?.metadata : undefined }, [view, isContrast, airEnabled, roadEnabled, baseNetwork?.metadata])
  const validLocation = browserLocation.location && withinStudy(browserLocation.location, baseNetwork?.bounds) ? browserLocation.location : undefined
  const unavailableNowTime = !nowActive && nowUnavailable ? nowTime : null
  const [lastUnavailableNowTime, setLastUnavailableNowTime] = useState(unavailableNowTime)
  if (unavailableNowTime !== lastUnavailableNowTime) {
    setLastUnavailableNowTime(unavailableNowTime)
    if (unavailableNowTime !== null) { setNetworkTime(unavailableNowTime); setIsPlaying(false) }
  }
  const [focusedLocation, setFocusedLocation] = useState(validLocation)
  if (validLocation !== focusedLocation) {
    setFocusedLocation(validLocation)
    if (validLocation) setMapCameraCommand(current => ({ id: current.id + 1, action: 'focus-location', focus: [validLocation.longitude, validLocation.latitude], distanceScale: 0.025 }))
  }
  useEffect(() => { clearBrowserLocation() }, [networkStudy, clearBrowserLocation])

  const regionalViewLabel = additionalId ? additionalLabel : isValais ? valaisLabel : isTicino ? ticinoCopy?.view : isGraubuenden ? graubuendenCopy?.view : isSolothurn ? text.solothurnView : isBern ? text.bernView : isRiviera ? (rivieraCopy?.view ?? rivieraLabel) : isNyon ? text.nyonView : isBasel ? text.baselView : isLausanne ? text.lausanneView : isPostbus ? text.postbusNetwork : networkStudy === 'zvv-region'
                        ? text.zvvView
                        : networkStudy === 'geneva-tpg'
                          ? text.genevaView
                          : text.zurichView

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
  const visibleAirTracks = useMemo(
    () =>
      airEnabled && activeAirSnapshot
        ? activeAirTracks(activeAirSnapshot, networkTime)
        : [],
    [activeAirSnapshot, airEnabled, networkTime],
  )
  const activeAircraftCount = visibleAirTracks.length
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
    () => (roadTopology?.roads ?? roadCatalogue?.SWITZERLAND_ROADS ?? []).find((road) => road.id === selectedRoadId),
    [roadTopology, roadCatalogue, selectedRoadId],
  )
  const selectedRoadLength = selectedRoad && 'lengthKm' in selectedRoad && typeof selectedRoad.lengthKm === 'number'
    ? selectedRoad.lengthKm
    : roadCatalogue?.SWITZERLAND_ROADS.find(road => road.id === selectedRoadId)?.lengthKm
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
      : isTerritet && glionJourneyActive ? { ...network, trains: glionNetwork ? network.trains : [] } : (isPilatus || isRochers || isTerritet) && selectedTrain ? { ...network, trains: [selectedTrain] } : isPostbus ? postbusRouteSnapshot(network, selectedRoute) : additionalRegion ? { ...networkWithRailVisibility(network, railVisible), bounds: additionalRegion.bounds } : isTicino ? { ...networkWithRailVisibility(network, railVisible), bounds: ticinoLocale?.TICINO_FOCUS_BOUNDS ?? network.bounds } : networkWithRailVisibility(network, railVisible)),
    [additionalRegion, network, railVisible, glionNetwork, glionJourneyActive, isTerritet, isRochers, isPilatus, selectedTrain, isPostbus, isTicino, ticinoLocale, selectedRoute, activePilot],
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
    () => searchRoadsWithPilots(roadTopology?.roads ?? roadCatalogue?.SWITZERLAND_ROADS ?? [], searchQuery),
    [roadTopology?.roads, roadCatalogue, searchQuery],
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
    // Filters describe the whole study, even while the cogwheel lens is loading
    // or showing a subset. Otherwise users lose the options for switching modes.
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
          : (unfilteredNetwork?.trains.map((train) => train.category) ?? []),
    )
    return SERVICE_CATEGORIES.filter(
      (category) => (category.id !== 'other' || isMountainStudy || Boolean(additionalId)) && present.has(category.id),
    )
  }, [additionalId, hubCalls, isMountainStudy, isContrast, kientalContrast.network, unfilteredNetwork, view, zurichContrast.network])

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
    setGlionNetwork(undefined); setGlionLink(undefined)
    setGornergratTerrainBinding(undefined); setJungfrauTerrainBinding(undefined)
    setJungfrauGuideActive(false)
    setRigiRhythmActive(false)
    setRigiSequenceActive(false)
    setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
    setRigiTerrainBinding(undefined)
    setSelectedTrainId(undefined)
    setSelectedStationName(undefined)
    setSelectedRouteId(undefined)
    setSelectedAirTrackId(undefined)
    setSelectedAirport(undefined)
    setSelectedRoadId(undefined)
    setSearchQuery('')
    setActiveSearchIndex(-1)
  }, [setPilatusJourneyActive, setRochersJourneyActive, setGlionJourneyActive, setTerritetJourneyActive, setGornergratAscentActive, setRigiSequenceActive, setJungfrauAscentActive, setJungfrauGuideActive])

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

  const startPilatusJourney = () => {
    releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setIsPlaying(false); setPilatusJourneyActive(true)
  }
  const startRochersJourney = () => {
    releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setIsPlaying(false); setRochersJourneyActive(true)
  }
  const startGlionJourney = () => {
    releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setIsPlaying(false); setGlionJourneyActive(true)
  }
  const startTerritetJourney = () => {
    releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setIsPlaying(false); setTerritetJourneyActive(true)
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
  }, [setSelectedCategory, setAirCategorySelected, releaseSelection])

  const selectStation = useCallback((station: StationIndexEntry) => {
    setRigiSequenceActive(false)
    setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
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
  }, [setPilatusJourneyActive, setRochersJourneyActive, setGlionJourneyActive, setTerritetJourneyActive, setGornergratAscentActive, setAirCategorySelected, setRigiSequenceActive, setJungfrauAscentActive])

  const selectRoute = useCallback(
    (route: NetworkRouteIndexEntry) => {
      setRigiSequenceActive(false)
      setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
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
    [setPilatusJourneyActive, setRochersJourneyActive, setGlionJourneyActive, setTerritetJourneyActive, setGornergratAscentActive, setAirCategorySelected, setSelectedCategory, categoryLabel, setRigiSequenceActive, setJungfrauAscentActive],
  )

  const selectTrain = useCallback(
    (train: NetworkTrain) => {
      if (!network) return
      setRigiSequenceActive(false)
      setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
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
    [setPilatusJourneyActive, setRochersJourneyActive, setGlionJourneyActive, setTerritetJourneyActive, setGornergratAscentActive, setAirCategorySelected, network, networkTime, setRigiSequenceActive, setJungfrauAscentActive],
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
    [setAirCategorySelected, setSelectedCategory, activeAirSnapshot, airDay.manifest],
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
  }, [setSelectedCategory])

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
  }, [setAirCategorySelected, airEnabled, airSnapshot, isNationalDay, networkTime, releaseSelection])

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
  }, [setDirectorMode, setSelectedCategory, setAirCategorySelected, roadEnabled, toggleRoadLayer])

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
      setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
      setView('journey')
      setIsPlaying(true)
    },
    [setPilatusJourneyActive, setRochersJourneyActive, setGlionJourneyActive, setTerritetJourneyActive, setGornergratAscentActive, setRigiSequenceActive, setJungfrauAscentActive],
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
      setLinkPending(false)
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
      if (isAdditionalRegion(study) || study === 'graubuenden-region' || study === 'valais-region' || study === 'ticino-region' || study === 'solothurn-region' || study === 'bern-region' || study === 'lausanne-region' || study === 'basel-core' || study === 'nyon-region' || study === 'riviera-region') setRegionalRange('day')
      if (study === 'national') setNationalTimeRange(timeRange)
      if (study === 'bern-region') setSelectedHubId('bern')
      if (study === 'basel-core') setSelectedHubId('basel')
      if (study === 'geneva-tpg') setSelectedHubId('geneva')
      if (study === 'zvv-region' || study === 'zurich-city') {
        setSelectedHubId('zurich')
      }
      const regionalSnapshot =
        isAdditionalRegion(study) ? (additionalSnapshot?.key === additionalRegionKey(study, additionalDates[study]) ? additionalSnapshot.network : undefined) : study === 'valais-region' ? valaisRegionNetwork : study === 'ticino-region' ? ticinoRegionNetwork : study === 'graubuenden-region' ? graubuendenRegionNetwork : study === 'solothurn-region' ? solothurnRegionNetwork : study === 'bern-region' ? bernRegionNetwork : study === 'riviera-region' ? rivieraRegionNetwork : study === 'nyon-region' ? nyonRegionNetwork : study === 'basel-core' ? baselCoreNetwork : study === 'lausanne-region' ? lausanneRegionNetwork : study === 'pilatus' ? pilatusNetwork : study === 'rochers' ? rochersNetwork : study === 'territet' ? territetNetwork : study === 'gornergrat' ? gornergratNetwork : study === 'jungfrau' ? jungfrauNetwork : study === 'rigi-lake' ? rigiNetwork : study === 'zurich-city'
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
      if (study === 'contrast' || study === 'rigi-lake' || study === 'jungfrau' || study === 'gornergrat' || study === 'pilatus' || study === 'rochers') setNetworkTime(12 * 3600)
      if (study === 'territet') setNetworkTime(43440)
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
      setDirectorMode,
      setSelectedCategory,
      setAirCategorySelected,
      stopNow,
      additionalSnapshot,
      additionalDates,
      edition.defaultNetworkTime,
      nationalDayNetwork,
      valaisRegionNetwork,
      ticinoRegionNetwork,
    graubuendenRegionNetwork,
    solothurnRegionNetwork,
    bernRegionNetwork,
      rivieraRegionNetwork,
      nyonRegionNetwork,
      baselCoreNetwork,
    lausanneRegionNetwork,
      genevaTpgNetwork,
      rigiNetwork,
      jungfrauNetwork,
      pilatusNetwork,
      rochersNetwork,
      territetNetwork,
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
  }, [setAirCategorySelected, airEnabled, selectNetworkStudy, toggleAirLayer])

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
    setDirectorMode,
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
    if (suspended) return
    document.documentElement.lang = language
    document.title = text.pageTitle
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', text.pageDescription)
  }, [suspended, language, text.pageDescription, text.pageTitle])

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
    if (networkStudy === 'national' || networkStudy === 'contrast' || networkStudy === 'postbus' || (additionalId && isRegionalDay)) return
    const existingNetwork =
      additionalId ? additionalNetwork : isValais ? valaisRegionNetwork : isTicino ? ticinoRegionNetwork : isGraubuenden ? graubuendenRegionNetwork : isSolothurn ? solothurnRegionNetwork : isBern ? bernRegionNetwork : isRiviera ? rivieraRegionNetwork : isNyon ? nyonRegionNetwork : isBasel ? baselCoreNetwork : isLausanne ? lausanneRegionNetwork : isPilatus ? pilatusNetwork : isRochers ? rochersNetwork : isTerritet ? territetNetwork : isGornergrat ? gornergratNetwork : isJungfrau ? jungfrauNetwork : isRigi ? rigiNetwork : networkStudy === 'zurich-city'
        ? zurichCityNetwork
        : networkStudy === 'zvv-region'
          ? zvvRegionNetwork
          : genevaTpgNetwork
    if (existingNetwork) return
    const controller = new AbortController()
    const isCity = networkStudy === 'zurich-city'
    const isZvv = networkStudy === 'zvv-region'
    const fileName = regionalPrefix ? `${regionalPrefix}${networkStudy}-morning.json` : edition.data.regional[networkStudy]
    fetch(editionDataUrl(fileName), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${networkStudy} snapshot returned ${response.status}`)
        }
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        if (controller.signal.aborted) return
        if (additionalKey) setAdditionalSnapshot({ key: additionalKey, network: snapshot })
        else if (isGraubuenden) setGraubuendenRegionNetwork(snapshot)
        else if (isValais) setValaisRegionNetwork(snapshot)
        else if (isTicino) setTicinoRegionNetwork(snapshot)
        else if (isSolothurn) setSolothurnRegionNetwork(snapshot)
        else if (isBern) setBernRegionNetwork(snapshot)
        else if (isRiviera) setRivieraRegionNetwork(snapshot)
        else if (isNyon) setNyonRegionNetwork(snapshot)
        else if (isBasel) setBaselCoreNetwork(snapshot)
        else if (isLausanne) setLausanneRegionNetwork(snapshot)
        else if (isPilatus) setPilatusNetwork(snapshot)
        else if (isRochers) setRochersNetwork(snapshot)
        else if (isTerritet) setTerritetNetwork(snapshot)
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
    additionalId,
    additionalKey,
    additionalNetwork,
    additionalAttempt,
    isRegionalDay,
    isRiviera,
    rivieraAttempt,
    isNyon,
    nyonAttempt,
    isBasel,
    baselAttempt,
    isValais,
    isTicino,
    valaisAttempt,
    ticinoAttempt,
    regionalPrefix,
    valaisDate,
    ticinoDate,
    isGraubuenden,
    graubuendenDate,
    graubuendenAttempt,
    isSolothurn,
    solothurnAttempt,
    isBern,
    bernAttempt,
    valaisRegionNetwork,
    ticinoRegionNetwork,
    graubuendenRegionNetwork,
    solothurnRegionNetwork,
    bernRegionNetwork,
    isLausanne,
    isRigi,
    rigiNetwork,
    isPilatus,
    pilatusNetwork,
    pilatusAttempt,
    isRochers,
    rochersNetwork,
    rochersAttempt,
    isTerritet,
    territetNetwork,
    territetAttempt,
    isGornergrat,
    gornergratNetwork,
    gornergratAttempt,
    isJungfrau,
    jungfrauNetwork,
    jungfrauAttempt,
    rivieraRegionNetwork,
    nyonRegionNetwork,
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
      if (suspended) return
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
  }, [handleContextAction, stopNow, suspended])

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

  const nowViewSupported = view === 'network' && !airEnabled && !roadEnabled && !selectedTrainId && !directorMode
  if (!nowViewSupported && nowActive && nowTime !== null && playbackTime !== nowTime) {
    setNetworkTime(nowTime)
  }
  // Preserve the displayed time above, then stop the external clock loop.
  useEffect(() => {
    if (!nowViewSupported) { stopNowClock(); nowRequested.current = false }
  }, [nowViewSupported, nowActive, stopNowClock])

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
    if (suspended || !directorMode || !hasFullDayTimeline) return
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
    suspended,
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
  if (pilotLinkPending && linkedPilot) {
    if (!roadEnabled || selectedRoadId !== linkedPilot.road || view !== 'network' || networkStudy !== 'national' || sbbEnabled || airEnabled) {
      setPilotLinkPending(false)
    } else if (roadLoadState === 'error' || (roadLoadState === 'ready' && !selectedRoad)) {
      setPilotLinkPending(false)
      setPilotLinkUnavailable(true)
      setSelectedRoadId(undefined)
      setRoadEnabled(false)
      setSbbEnabled(true)
    }
  }
  const dismissShare = () => {
    setShareUrl('')
    shareButton.current?.focus()
  }
  const shareStudy = async () => {
    const { studyLinkUrl } = await import('./studies/share-link.ts')
    const url = studyLinkUrl(window.location.href, activePilot ? { study: 'national', range: 'morning', recording: activePilot.metadata.recordingId, date: activePilot.metadata.serviceDate, time: networkTime } : { study: networkStudy, range: isNationalDay || isRegionalDay ? 'day' : 'morning', date: network?.metadata.serviceDate, time: networkTime, glion: isTerritet && glionNetwork ? glionNetwork?.trains.find(t => t.route === 'R37')?.id : undefined, station: glionJourneyActive ? undefined : selectedStationName, train: glionJourneyActive ? undefined : selectedTrainId })
    setShareUrl(url)
    setShareCopied(false)
    try { await navigator.clipboard.writeText(url); setShareCopied(true) } catch { /* The visible link can still be copied manually. */ }
  }
  const studyPickerValue = networkStudy === 'national' ? `national-${nationalTimeRange}` : networkStudy
  const selectStudyOption = (value: string) => {
    if (value === 'national-morning' || value === 'national-day') {
      selectNetworkStudy('national', value === 'national-day' ? 'day' : 'morning')
    } else selectNetworkStudy(value as NetworkStudy)
  }
  const studyOptions: { value: NetworkStudy | 'national-morning' | 'national-day'; label: string; detail?: string; ariaLabel?: string; desktop?: boolean }[] = [
    {
      value: 'national-morning', ariaLabel: text.showSwissMorningNetwork,
      label: 'CH',
      detail: text.swissMorningNetwork,
    },
    {
      value: 'national-day', ariaLabel: text.showSwissDayNetwork,
      label: '24H',
      detail: text.swissDayNetwork,
    },
    {
      value: 'contrast', ariaLabel: text.showContrastNetwork,
      label: '↔',
      detail: text.contrastNetwork,
    },
    { value: 'postbus', label: 'PA', detail: text.postbusNetwork },
    ...ADDITIONAL_REGION_IDS.map(id => ({ value: id, label: ADDITIONAL_REGIONS[id].code, detail: additionalLocale?.additionalRegionCopy(language, id).name ?? ADDITIONAL_REGIONS[id].name })),
    { value: 'valais-region', desktop: false, label: 'VS', detail: valaisLabel },
    { value: 'ticino-region', label: 'TI', detail: (ticinoCopy?.network ?? 'Ticino') },
    { value: 'graubuenden-region', label: 'GR', detail: graubuendenCopy?.network ?? 'Graubünden' },
    { value: 'solothurn-region', label: 'SO', detail: text.solothurnNetwork },
    { value: 'bern-region', label: 'BE', detail: text.bernNetwork },
    { value: 'riviera-region', label: 'RV', detail: rivieraLabel },
    { value: 'nyon-region', label: 'NY', detail: text.nyonNetwork },
    { value: 'basel-core', label: 'BS', detail: text.baselNetwork },
    { value: 'lausanne-region', label: 'LS', detail: text.lausanneNetwork },
    { value: 'jungfrau', label: 'JUNG', detail: jungfrauSelect },
    { value: 'pilatus', desktop: false, label: 'PIL', detail: pilatusCopy?.select ?? 'Pilatus' },
    { value: 'rochers', desktop: false, label: 'RDN', detail: rochersCopy?.select ?? 'Rochers' },
    { value: 'territet', desktop: false, label: 'TGL', detail: territetCopy?.select ?? 'Territet' },
    { value: 'gornergrat', desktop: false, label: 'GGR', detail: gornergratCopy?.select ?? 'Gornergrat' },
    { value: 'rigi-lake', label: 'RIGI', detail: rigiCopy.select },
    { value: 'zvv-region', ariaLabel: text.showZvvNetwork, label: 'ZVV', detail: text.zvvNetwork },
    { value: 'zurich-city', ariaLabel: text.showZurichNetwork, label: 'ZH', detail: text.zurichNetwork },
    { value: 'geneva-tpg', ariaLabel: text.showGenevaNetwork, label: 'GE', detail: text.genevaNetwork },
  ]
  studyOptions.sort((a, b) => studyOrder(a.value) - studyOrder(b.value))

  const linkedNetworkReady = network && (!isRegionalDay || regionalDay.chunkReady) && (!isNationalDay || nationalDayChunkReady) && (!isPostbus || postbusDay.chunkReady) && (networkStudy === 'national' || isPostbus || isRegionalDay || !regionalNetworkLoading)
  if (linkPending && linkedNetworkReady && network) {
    setLinkPending(false)
    if (initialLink.date && initialLink.date !== network.metadata.serviceDate) setExploreNotice('dateMismatch')
    if (initialLink.time !== undefined) setNetworkTime(Math.max(network.metadata.windowStart, Math.min(network.metadata.windowEnd - 1, initialLink.time)))
    if (initialLink.station) {
      const station = stationIndex.find(entry => entry.name === initialLink.station)
      if (station) { setSelectedStationName(station.name); setSearchQuery(station.name) }
      else setExploreNotice('focusMissing')
    }
    if (initialLink.train) {
      const train = network.trains.find(entry => entry.id === initialLink.train)
      if (train) { setSelectedTrainId(train.id); setSearchQuery(train.shortName) }
      else setExploreNotice('focusMissing')
    }
  }

  return (
    <main
      data-sbb-enabled={sbbEnabled}
      data-cogwheel-enabled={isCogwheel}
      data-quiet-map={quietMap}
      data-quiet-playing={quietMap ? isPlaying : undefined}
      className={`experience view-${view}${isJungfrau ? ' jungfrau-study' : ''}${isGornergrat ? ' gornergrat-study' : ''}${isTerritet ? ' territet-study' : ''}${isRochers ? ' rochers-study' : ''}${isPilatus ? ' pilatus-study' : ''}${timedRigiTerrain || jungfrauTerrainWindow || gornergratTerrainWindow || pilatusTerrainWindow || rochersTerrainWindow || glionTerrainWindow || territetTerrainWindow ? ' has-timed-rigi-terrain' : ''}${isContrast ? ' is-contrast' : ''}${airEnabled ? ' has-air-layer' : ''}${airCategorySelected ? ' has-air-category' : ''}${roadEnabled ? ' has-road-layer' : ''}${roadCategorySelected ? ' has-road-category' : ''}${selectedTrain || selectedStation || selectedRoute || selectedAirTrack || selectedAirport || selectedRoad ? ' has-selection' : ''}${!isTimetable ? ` corridor-${journeyCorridorId}` : ''}`}
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
        ) : territetTerrainWindow && territetTerrainBinding ? (
          <MeasuredTerrainScene binding={territetTerrainBinding} window={territetTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
        ) : glionTerrainWindow && glionTerrainBinding ? (
          <MeasuredTerrainScene binding={glionTerrainBinding} window={glionTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
        ) : rochersTerrainWindow && rochersTerrainBinding ? (
          <MeasuredTerrainScene binding={rochersTerrainBinding} window={rochersTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
        ) : pilatusTerrainWindow && pilatusTerrainBinding ? (
          <MeasuredTerrainScene binding={pilatusTerrainBinding} window={pilatusTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
        ) : gornergratTerrainWindow && gornergratTerrainBinding ? (
          <MeasuredTerrainScene binding={gornergratTerrainBinding} window={gornergratTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
        ) : jungfrauTerrainWindow && jungfrauTerrainBinding ? (
          <MeasuredTerrainScene binding={jungfrauTerrainBinding} window={jungfrauTerrainWindow} time={networkTime} isPlaying={isPlaying} rate={playbackRate} onTime={handleNetworkTime} />
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
        ) : isNetwork && sceneNetwork && nationalNetwork ? (
          <NationalNetworkScene
            boundary={boundary}
            lakes={lakes}
            groundStyle={quietMap ? 'quiet' : 'grid'}
            routeColors={isPostbus ? POSTBUS_ROUTE_COLORS : isCogwheel || isMountainStudy ? COGWHEEL_ROUTE_COLORS : undefined}
            snapshot={sceneNetwork}
            trafficOverviewEmphasis={isPostbus ? 0.65 : undefined}
            referenceSnapshot={nationalNetwork}
            contextSnapshot={
              networkStudy !== 'national' && !isPostbus && !isMountainStudy &&
              (additionalId ? baseNetwork : isValais ? valaisRegionNetwork : isTicino ? ticinoRegionNetwork : isGraubuenden ? graubuendenRegionNetwork : isSolothurn ? solothurnRegionNetwork : isBern ? bernRegionNetwork : isRiviera ? rivieraRegionNetwork : isNyon ? nyonRegionNetwork : isBasel ? baselCoreNetwork : isLausanne ? lausanneRegionNetwork : networkStudy === 'zurich-city'
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
            selectedTrain={isPilatus || isRochers || isTerritet ? undefined : selectedTrain}
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
            onSelectAirport={networkStudy === 'national' && airEnabled ? selectAirport : undefined}
            onSelectAirTrack={selectAirTrack}
            cameraFraming={
              additionalRegion ? { homeDistanceScale: additionalRegion.scale, minimumDistanceScale: 0.006, portraitMinimumDistanceScale: 0.004, localDetailHierarchy: true } : isValais ? MAP_FRAMINGS.valais : isTicino ? MAP_FRAMINGS.ticino : isGraubuenden ? MAP_FRAMINGS.graubuenden : isSolothurn ? MAP_FRAMINGS.solothurn : isBern ? MAP_FRAMINGS.bern : isRiviera ? MAP_FRAMINGS.riviera : isNyon ? MAP_FRAMINGS.nyon : isBasel ? MAP_FRAMINGS.basel : isLausanne ? MAP_FRAMINGS.lausanne : isPilatus ? MAP_FRAMINGS.pilatus : isRochers ? MAP_FRAMINGS.rochers : isTerritet ? glionJourneyActive || glionNetwork ? { ...MAP_FRAMINGS.rochers, homeDistanceScale: 0.055 } : MAP_FRAMINGS.territet : isGornergrat ? MAP_FRAMINGS.gornergrat : isJungfrau ? MAP_FRAMINGS.jungfrau : isRigi ? MAP_FRAMINGS.rigi : networkStudy === 'zurich-city'
                ? MAP_FRAMINGS.zurich
                : networkStudy === 'zvv-region'
                  ? MAP_FRAMINGS.zvv
                  : networkStudy === 'geneva-tpg'
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

      <header className="masthead" ref={observeMasthead}>
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
              ? additionalId ? additionalLabel : isValais ? valaisLabel : isTicino ? (ticinoCopy?.subtitle ?? 'Ticino') : isGraubuenden ? graubuendenCopy?.subtitle : isSolothurn ? text.solothurnSubtitle : isBern ? text.bernSubtitle : isRiviera ? (rivieraCopy?.subtitle ?? rivieraLabel) : isNyon ? text.nyonSubtitle : isBasel ? text.baselSubtitle : isLausanne ? text.lausanneSubtitle : isPilatus ? pilatusCopy?.title ?? 'Pilatus' : isRochers ? rochersCopy?.title ?? 'Rochers' : isTerritet ? territetCopy?.title ?? 'Territet' : isGornergrat ? gornergratCopy?.title ?? 'Gornergrat' : isJungfrau ? jungfrauCopy?.title ?? 'Jungfrau' : isRigi ? rigiCopy.title : isPostbus ? text.postbusSubtitle : isContrast
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
          <a className="masthead-orbital" href="?view=orbital" data-tooltip={exploreCopy.orbitalDescription}>{exploreCopy.orbital}<span aria-hidden="true">↗</span></a>
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
          {Object.entries(RIGI_ASCENTS).map(([id, approach]) => <button key={id} type="button" aria-label={text.rigiTerrainEnter.replace('{origin}', approach.name)} aria-pressed={journeyCorridorId === id} onClick={() => openTerrainCorridor(id as RigiCorridorId)}>
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
                  additionalId ? additionalCopy?.search : isValais ? (valaisCopy?.valaisPlaceholder ?? 'Valais') : isTicino ? ticinoCopy?.placeholder : isGraubuenden ? graubuendenCopy?.placeholder : isSolothurn ? text.solothurnPlaceholder : isBern ? text.bernPlaceholder : isRiviera ? (rivieraCopy?.placeholder ?? rivieraLabel) : isNyon ? text.nyonPlaceholder : isBasel ? text.baselPlaceholder : isLausanne ? text.lausannePlaceholder : isPilatus ? pilatusCopy?.placeholder ?? 'Pilatus' : isRochers ? rochersCopy?.placeholder ?? 'Rochers' : isTerritet ? territetCopy?.placeholder ?? 'Territet' : isGornergrat ? gornergratCopy?.placeholder ?? 'Gornergrat' : isJungfrau ? jungfrauCopy?.placeholder ?? jungfrauSelect : isRigi ? rigiCopy.placeholder : isCogwheel ? cogwheelCopy.placeholder : isContrast
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
              <span className="sr-only">{text.scale}</span>
              {studyOptions.filter(option => option.desktop !== false).map(option => <button
                key={option.value}
                type="button"
                className={option.value === 'postbus' ? 'postbus-study-toggle' : undefined}
                aria-label={option.ariaLabel ?? option.detail}
                data-tooltip={option.ariaLabel ?? option.detail}
                aria-pressed={studyPickerValue === option.value}
                onClick={() => selectStudyOption(option.value)}
              >{option.label}</button>)}
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
                value={studyPickerValue}
                options={studyOptions}
                triggerLabel={
                  additionalRegion ? additionalRegion.code : isValais ? 'VS' : isTicino ? 'TI' : isGraubuenden ? 'GR' : isSolothurn ? 'SO' : isBern ? 'BE' : isRiviera ? 'RV' : isNyon ? 'NY' : isBasel ? 'BS' : isLausanne ? 'LS' : isPilatus ? 'PIL' : isRochers ? 'RDN' : isTerritet ? 'TGL' : isGornergrat ? 'GGR' : isJungfrau ? 'JUNG' : isRigi ? 'RIGI' : isPostbus ? 'PA' : isContrast
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
                onChange={selectStudyOption}
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

      {isNetwork && isTerritet && glionJourneyActive && territetNetwork ? (
        <Suspense fallback={null}><GlionJourney funicularTerrainUrl={editionDataUrl('territet-ascent-terrain.json')} onTerrain={setGlionTerrainBinding} terrainUrl={editionDataUrl('rochers-ascent-terrain.json')} initialLink={glionLink} funicular={territetNetwork} railwayUrl={editionDataUrl(edition.data.regional.rochers)} language={language} time={networkTime} onNetwork={setGlionNetwork} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection}/></Suspense>
      ) : isNetwork && isTerritet && territetJourneyActive && territetNetwork ? (
        <Suspense fallback={null}><TerritetJourney onTerrain={setTerritetTerrainBinding} terrainUrl={editionDataUrl('territet-ascent-terrain.json')} network={territetNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection}/></Suspense>
      ) : isNetwork && isRochers && rochersJourneyActive && rochersNetwork ? (
        <Suspense fallback={null}><RochersJourney onTerrain={setRochersTerrainBinding} network={rochersNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection}/></Suspense>
      ) : isNetwork && isPilatus && pilatusJourneyActive && pilatusNetwork ? (
        <Suspense fallback={null}><PilatusJourney onTerrain={setPilatusTerrainBinding} network={pilatusNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection}/></Suspense>
      ) : isNetwork && isGornergrat && gornergratAscentActive && gornergratNetwork ? (
        <Suspense fallback={null}><GornergratAscent onTerrain={setGornergratTerrainBinding} network={gornergratNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection}/></Suspense>
      ) : isNetwork && isJungfrau && jungfrauAscentActive && jungfrauNetwork ? (
        <Suspense fallback={null}><JungfrauAscent onTerrain={setJungfrauTerrainBinding} network={jungfrauNetwork} language={language} time={networkTime} onSeek={seekMountainSequence} onFollow={followMountainSequence} onFinish={finishRigiTerrain} onExit={releaseSelection} /></Suspense>
      ) : isNetwork && isRigi && rigiRhythmActive && rigiNetwork && !selectedTrain && !selectedStation && !selectedRoute ? (
        <Suspense fallback={null}><RigiDayRhythm network={rigiNetwork} time={networkTime} language={language} onSeek={time => { setSelectedCategory(undefined); setDirectorMode(false); seekMountainSequence(time) }} onExit={releaseSelection} /></Suspense>
      ) : isNetwork && isRigi && rigiSequenceActive && rigiNetwork ? (
        <Suspense fallback={null}><RigiSequence network={rigiNetwork} time={networkTime} language={language} onSeek={seekMountainSequence} onFollow={followMountainSequence} onTimetableTerrain={setRigiTerrainBinding} onExit={releaseSelection} onTerrain={() => openTerrainCorridor('vitznau-rigi')} /></Suspense>
      ) : isHub ? (
        <Suspense fallback={null}><DetailCard kind="HubCard" selectedHub={selectedHub} hubStudy={hubStudy} setHubStudy={setHubStudy} showTaktOverlay={showTaktOverlay} onToggleGrid={() => setShowTaktOverlay(value => !value)} nearbyCallCount={nearbyHubCalls.length} platformCount={hubPlatforms.length} callCount={hubCalls.length} upcomingHubCall={upcomingHubCall} numberFormat={numberFormat} text={text} /></Suspense>
      ) : isNetwork && isContrast ? (
        <Suspense fallback={null}><DetailCard kind="ContrastCard" zurichReady={zurichContrast.chunkReady} kientalReady={kientalContrast.chunkReady} zurichContrastActiveCount={zurichContrastActiveCount} kientalContrastActiveCount={kientalContrastActiveCount} error={Boolean(zurichContrast.error || kientalContrast.error)} loading={zurichContrast.loading || kientalContrast.loading} enterKientalCorridor={enterKientalCorridor} numberFormat={numberFormat} language={language} text={text} /></Suspense>
      ) : isNetwork && selectedAirport ? (
        <Suspense fallback={null}><AirportHeroCard key={selectedAirport.id} className="edition-airport-card"
          airport={selectedAirport} language={language} aircraft={isNationalDay ? airDay.manifest?.aircraft ?? [] : activeAirSnapshot?.tracks ?? []}
          study={{ time: networkTime, windowStart: Math.max(network?.metadata.windowStart ?? 0, activeAirSnapshot?.metadata.windowStart ?? 0), windowEnd: Math.min(network?.metadata.windowEnd ?? 86400, activeAirSnapshot?.metadata.windowEnd ?? 86400) }}
          maxRows={4} dateLabel="04.09.2026"
          loading={isNationalDay ? !airDay.manifest : !airSnapshot} error={activeAirLoadState === 'error' ? text.airUnavailable : undefined}
          onSelectFlight={selectAirTrack}
        /></Suspense>
      ) : isNetwork && selectedAirTrack ? (
        <Suspense fallback={null}><DetailCard kind="AircraftCard" selectedAirTrack={selectedAirTrack} selectedAirPosition={selectedAirPosition} numberFormat={numberFormat} text={text} /></Suspense>
      ) : isNetwork && selectedTrain ? (
        <Suspense fallback={null}><DetailCard kind="TrainCard" selectedTrain={selectedTrain} selectedFrom={selectedFrom} selectedTo={selectedTo} selectedHeadway={Boolean(selectedHeadway)} selectedFrequency={selectedFrequency} frequency={frequencyCopy} cogwheel={isCogwheel || isMountainStudy && selectedTrain.category === 'other'} color={serviceColors[selectedTrain.category]} categoryName={isCogwheel ? cogwheelCopy.label : categoryLabel(selectedTrain.category)} numberFormat={numberFormat} text={text}>
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
              {selectedRigiCorridor ? text.rigiTerrainEnter.replace('{origin}', RIGI_ASCENTS[selectedRigiCorridor].name) : text.enterTerrain}
            </button>
          )}
        </DetailCard></Suspense>
      ) : isNetwork && selectedRoute ? (
        <Suspense fallback={null}><DetailCard kind="RouteCard" selectedRoute={selectedRoute} serviceColors={serviceColors} categoryName={isCogwheel ? cogwheelCopy.label : categoryLabel(selectedRoute.category)} cogwheel={isCogwheel || isMountainStudy && selectedRoute.category === 'other'} studyLabel={isNationalDay || isRegionalDay || isMountainStudy ? text.fullDayStudy : text.morningStudy} catalogue={isCogwheel ? cogwheelCatalogue : undefined} frequencyNote={selectionHasHeadwayMotion ? frequencyCopy.mixed : undefined} callWindow={isMountainStudy ? '24h' : isNationalDay ? '3h' : '2h'} numberFormat={numberFormat} text={text} /></Suspense>
      ) : isNetwork && selectedStation ? (
        <Suspense fallback={null}><DetailCard kind="StationCard" selectedStation={selectedStation} serviceColors={serviceColors} onConnections={isRigi ? () => setRigiGuideActive(true) : undefined} connectionsLabel={rigiCopy.connections} fullDay={isNationalDay || isRegionalDay || isMountainStudy} frequencyNote={selectionHasHeadwayMotion ? frequencyCopy.mixed : undefined} activeTrainCount={activeTrainCount} movementsLabel={networkStudy === 'national' ? text.trainsInMotion : isJungfrau ? jungfrauCopy?.movements : text.vehiclesInMotion} callWindow={isMountainStudy ? '24h' : isNationalDay ? '3h' : '2h'} numberFormat={numberFormat} text={text} /></Suspense>
      ) : isNetwork && selectedRoad ? (
        <Suspense fallback={null}><DetailCard kind="RoadCard" selectedRoad={selectedRoad} activePilot={activePilot} selectedRoadGeometryOnly={selectedRoadGeometryOnly} selectedRoadLength={selectedRoadLength} selectedRoadTraffic={selectedRoadTraffic} roadLoadState={roadLoadState} roadMetricFormat={roadMetricFormat} numberFormat={numberFormat} text={text}>
          {selectedPilotDefinition && <Suspense fallback={null}><CantonalPilotControls key={`${selectedPilotDefinition.id}:${sbbEnabled}:${airEnabled}:${roadEnabled}`} definition={selectedPilotDefinition} pilot={activePilot} time={networkTime} language={language}
            autoStartTime={pilotLinkPending && linkedPilot?.id === selectedPilotDefinition.id ? initialLink.time : undefined}
            onAutoStart={() => { setPilotLinkPending(false) }}
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
        </DetailCard></Suspense>
      ) : roadOnly ? (
        <Suspense fallback={null}><DetailCard kind="RoadOverviewCard" roadOverview={roadOverview} roadLoadState={roadLoadState} roadMetricFormat={roadMetricFormat} numberFormat={numberFormat} text={text} /></Suspense>
      ) : airOnly ? (
        <Suspense fallback={null}><DetailCard kind="AirOverviewCard" activeAirLoadState={activeAirLoadState} tracks={visibleAirTracks} numberFormat={numberFormat} text={text} /></Suspense>
      ) : isNetwork ? (
        <section
          className="journey-card network-card"
          aria-label={
            additionalId ? additionalLabel : isValais ? valaisLabel : isTicino ? ticinoCopy?.networkStatus : isGraubuenden ? graubuendenCopy?.networkStatus : isSolothurn ? text.solothurnNetworkStatus : isBern ? text.bernNetworkStatus : isRiviera ? (rivieraCopy?.networkStatus ?? rivieraLabel) : isNyon ? text.nyonNetworkStatus : isBasel ? text.baselNetworkStatus : isLausanne ? text.lausanneNetworkStatus : isPilatus ? pilatusCopy?.select ?? 'Pilatus' : isRochers ? rochersCopy?.select ?? 'Rochers' : isTerritet ? territetCopy?.select ?? 'Territet' : isGornergrat ? gornergratCopy?.select ?? 'Gornergrat' : isJungfrau ? jungfrauSelect : isRigi ? rigiCopy.select : isPostbus ? text.postbusNetwork : networkStudy === 'national'
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
              {isRegionalDay ? regionalDay.error ? exploreCopy.error : !regionalDay.chunkReady ? exploreCopy.loading : `${exploreCopy.day} · ${sourceCredit(language, network?.metadata.geometry?.publisher ?? 'SBB')}` : additionalId ? regionalNetworkError ? exploreCopy.error : regionalNetworkLoading ? text.loading : additionalCopy?.modes : isGraubuenden ? regionalNetworkError ? graubuendenCopy?.unavailable : regionalNetworkLoading ? text.loading : graubuendenCopy?.modes : isValais ? regionalNetworkError ? exploreCopy.error : regionalNetworkLoading ? text.loading : valaisLabel : isTicino ? regionalNetworkError ? ticinoCopy?.unavailable : regionalNetworkLoading ? text.loading : ticinoCopy?.modes : isSolothurn ? regionalNetworkError ? text.solothurnUnavailable : regionalNetworkLoading ? text.loading : text.solothurnModes : isBern ? regionalNetworkError ? text.bernUnavailable : regionalNetworkLoading ? text.loading : text.bernModes : isRiviera ? regionalNetworkError ? (rivieraCopy?.unavailable ?? exploreCopy.error) : regionalNetworkLoading ? text.loading : rivieraCopy?.modes : isNyon ? regionalNetworkError ? text.nyonUnavailable : regionalNetworkLoading ? text.loading : text.nyonModes : isBasel ? regionalNetworkError ? text.baselUnavailable : regionalNetworkLoading ? text.loading : text.baselModes : isLausanne ? regionalNetworkError ? text.lausanneUnavailable : regionalNetworkLoading ? text.loading : text.lausanneModes : isPilatus ? regionalNetworkError ? pilatusCopy?.unavailable : regionalNetworkLoading ? pilatusCopy?.loading : pilatusCopy?.modes : isRochers ? regionalNetworkError ? rochersCopy?.unavailable : regionalNetworkLoading ? rochersCopy?.loading : rochersCopy?.modes : isTerritet ? regionalNetworkError ? territetCopy?.unavailable : regionalNetworkLoading ? territetCopy?.loading : territetCopy?.modes : isGornergrat ? regionalNetworkError ? gornergratCopy?.unavailable : regionalNetworkLoading ? gornergratCopy?.loading : gornergratCopy?.modes : isJungfrau ? regionalNetworkError ? jungfrauCopy?.unavailable : regionalNetworkLoading ? jungfrauCopy?.loading : jungfrauCopy?.modes : isRigi ? regionalNetworkError ? rigiCopy.unavailable : regionalNetworkLoading ? rigiCopy.loading : rigiCopy.modes : isCogwheel ? cogwheel?.error ? cogwheelCopy.unavailable : !cogwheelCatalogue ? cogwheelCopy.loading : cogwheelCopy.description : isPostbus
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
          {isPilatus && pilatusNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startPilatusJourney}>{pilatusCopy?.start} →</button>}
          {isPilatus && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setPilatusAttempt(n => n+1) }}>{exploreCopy.retry}</button>}
          {isRochers && rochersNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startRochersJourney}>{rochersCopy?.start} →</button>}
          {isRochers && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setRochersAttempt(n => n+1) }}>{exploreCopy.retry}</button>}
          {isTerritet && territetNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startGlionJourney}>{territetCopy?.combined} →</button>}
          {isTerritet && territetNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startTerritetJourney}>{territetCopy?.start} →</button>}
          {isTerritet && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setTerritetAttempt(n => n+1) }}>{exploreCopy.retry}</button>}
          {isGornergrat && gornergratNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startGornergratAscent}>{gornergratCopy?.start} →</button>}
          {isGornergrat && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setGornergratAttempt(n => n+1) }}>{exploreCopy.retry}</button>}
          {isJungfrau && jungfrauNetwork && !regionalNetworkError && <><button type="button" className="corridor-entry" onClick={event => { event.currentTarget.focus(); setJungfrauGuideActive(true) }}>{jungfrauCopy?.guide} →</button><button type="button" className="corridor-entry" onClick={startJungfrauAscent}>{jungfrauCopy?.ascent} →</button></>}
          {isJungfrau && jungfrauNetwork && !regionalNetworkError && <Suspense fallback={null}><JungfrauPlaces language={language} onSelect={name => { const station = stationIndex.find(s => s.name === name); if (station) { setSelectedCategory(undefined); selectStation(station) } }} /></Suspense>}
          {isJungfrau && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setJungfrauAttempt(n => n + 1) }}>{exploreCopy.retry}</button>}
          {additionalId && !isRegionalDay && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setAdditionalAttempt(n => n + 1) }}>{exploreCopy.retry}</button>}
          {(isValais || isTicino || isSolothurn || isBern || isNyon || isRiviera || isBasel) && !isRegionalDay && regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); (isValais ? setValaisAttempt : isTicino ? setTicinoAttempt : isSolothurn ? setSolothurnAttempt : isBern ? setBernAttempt : isRiviera ? setRivieraAttempt : isNyon ? setNyonAttempt : setBaselAttempt)(n => n + 1) }}>{exploreCopy.retry}</button>}
          {isRigi && rigiNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={event => { event.currentTarget.focus(); setRigiGuideActive(true) }}>{rigiCopy.connections} →</button>}
          {isRigi && rigiNetwork && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={() => { releaseSelection(); setSelectedCategory(undefined); setDirectorMode(false); setRigiRhythmActive(true) }}>{rigiCopy.rhythm} →</button>}
          {isRigi && network && !regionalNetworkError && <button type="button" className="corridor-entry" onClick={startRigiSequence}>{rigiCopy.sequence} →</button>}
          {isRigi && network && !regionalNetworkError && Object.entries(RIGI_ASCENTS).map(([id, approach]) => <button key={id} type="button" className="corridor-entry" onClick={() => openTerrainCorridor(id as RigiCorridorId)}>{text.rigiTerrainEnter.replace('{origin}', approach.name)} ↗</button>)}
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
          <details ref={mobileMapToolsRef} onToggle={event => setMobileMapToolsOpen(event.currentTarget.open)}>
            <summary aria-label={text.mapControls}>⌖</summary>
            {mobileMapToolsOpen && <Suspense fallback={null}><DetailCard kind="map-tools" hasSelection={Boolean(selectedTrain || selectedAirTrack)} moveMapCamera={moveMapCamera}
              isCogwheel={isCogwheel} roadCategorySelected={roadCategorySelected} airCategorySelected={airCategorySelected} selectedCategory={selectedCategory}
              isNational={networkStudy === 'national'} railVisible={railVisible} visibleServiceCategories={visibleServiceCategories} categoryLabel={categoryLabel} serviceColors={serviceColors}
              isMountainStudy={isMountainStudy} cogwheelLabel={cogwheelCopy.label} airEnabled={airEnabled} roadEnabled={roadEnabled} trainLabelMode={trainLabelMode}
              selectedRoadId={selectedRoadId} roads={roadEnabled ? roadTopology?.roads : undefined} onLabelChange={setTrainLabelMode} text={text}
                  onCategoryChange={(category) => {
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
                    onRoadChange={(roadId) => {
                      const road = roadTopology?.roads.find(
                        (candidate) => candidate.id === roadId,
                      )
                      if (road) selectRoad(road)
                      else releaseSelection()
                    }} /></Suspense>}
          </details>
        </div>
      )}

      {roadRecordingsOpen && <Suspense fallback={null}><CantonalRecordingPicker language={language} recording={activePilot?.metadata.recordingId} onClose={() => { setRoadRecordingsOpen(false); roadRecordingsButton.current?.focus() }} /></Suspense>}
      {exploreOpen && <Suspense fallback={null}><StudyBrowser language={language} study={networkStudy} onClose={() => setExploreOpen(false)} onSelect={id => { setRegionalRange('day'); selectNetworkStudy(id, 'day'); setExploreOpen(false) }} /></Suspense>}
      <section className="transport" aria-label={text.playbackControls}>
        {(isValais || isTicino || isGraubuenden) && <a className="mobile-map-attribution" href={editionDataUrl(`${networkStudy}/sources.json`)} target="_blank" rel="noreferrer">{text.mapCredit}</a>}
        {isSolothurn && <a className="mobile-map-attribution" href={editionDataUrl('solothurn-region/sources.json')} target="_blank" rel="noreferrer">{text.solothurnCredit}</a>}
        {isBern && <span className="mobile-map-attribution"><a href="https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct" target="_blank" rel="noreferrer">{text.bernCredit}</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{text.osmCredit}</a> · <a href={editionDataUrl('bern-region/sources.json')} target="_blank" rel="noreferrer">© FOT / BAV</a></span>}
        {(isLausanne || isBasel || isNyon || isRiviera) && <span className="mobile-map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{text.osmCredit} · ODbL</a>{isBasel && <> · <a href="https://www.swisstopo.admin.ch">© swisstopo</a></>}</span>}
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
            <button ref={roadRecordingsButton} type="button" onClick={() => setRoadRecordingsOpen(true)}>{text.roadRecordingsTitle}</button>
            {!isContrast && !airEnabled && !roadEnabled && <button type="button" aria-pressed={nowActive} disabled={!network || (isRegionalDay && !regionalDay.chunkReady) || (isNationalDay && !nationalDayChunkReady)} onClick={nowActive ? stopNow : startNow}>{exploreCopy.now}</button>}
            {nowActive && <button type="button" onClick={browserLocation.locate} disabled={browserLocation.status === 'locating'}>{exploreCopy.locate}</button>}
            {browserLocation.status !== 'idle' && <button type="button" onClick={clearBrowserLocation}>{exploreCopy.clear}</button>}
            {isRegionalDayStudy(networkStudy) && <button type="button" aria-pressed={isRegionalDay} onClick={() => { stopNow(); setRegionalRange(value => value === 'day' ? 'morning' : 'day'); setNetworkTime(edition.defaultNetworkTime); setRegionalRetry(true) }}>{exploreCopy.day}</button>}
            {isValais && valaisLocale && <valaisLocale.ValaisDateSelect label={valaisLocale.VALAIS_COPY[language].valaisDate} value={valaisDate} onChange={date => { stopNow(); setLinkPending(false); setValaisDate(date); setValaisRegionNetwork(undefined); setRegionalNetworkError(false); setRegionalNetworkLoading(true); setRegionalRetry(true); releaseSelection() }} />}
            {isTicino && ticinoLocale && <Suspense fallback={null}><TicinoDatePicker language={language} date={ticinoDate} onDate={date => { stopNow(); setLinkPending(false); setTicinoDate(date); setTicinoRegionNetwork(undefined); setRegionalNetworkError(false); setRegionalNetworkLoading(true); setRegionalRetry(true); releaseSelection() }} /></Suspense>}
            <button ref={shareButton} type="button" aria-expanded={Boolean(shareUrl)} aria-controls={shareUrl ? 'study-share' : undefined} disabled={!network && !activePilot} onClick={() => void shareStudy()}>{exploreCopy.share}</button>
          </div>
          {additionalId && additionalLocale && <Suspense fallback={null}><RegionalStudyDetails id={additionalId} language={language} date={additionalDates[additionalId]} serviceDate={network?.metadata.serviceDate} headway={hasHeadwayMotion} sourcesUrl={editionDataUrl(`${additionalId}/study-sources.json`)} onDate={date => { stopNow(); setLinkPending(false); setAdditionalDates(values => ({ ...values, [additionalId]: date })); setRegionalNetworkError(false); setRegionalNetworkLoading(true); setRegionalRetry(true); releaseSelection() }} /></Suspense>}
          {isValais && <p className="explore-status">{(valaisCopy?.valaisScope ?? '')} · {network?.metadata.serviceDate}</p>}
          {isTicino && <p className="explore-status">{ticinoCopy?.scope} · {network?.metadata.serviceDate}</p>}
          {isGraubuenden && <>
            <p className="explore-status">{graubuendenCopy?.scope} · {network?.metadata.serviceDate}</p>
            <div className="explore-actions">{['2026-09-04', '2026-09-06'].map(date => <button key={date} type="button" aria-pressed={graubuendenDate === date} onClick={() => { stopNow(); releaseSelection(); setGraubuendenRegionNetwork(undefined); setGraubuendenDate(date); setRegionalNetworkError(false); setRegionalNetworkLoading(true); setRegionalRetry(true); setLinkPending(false) }}>{date}</button>)}
              {regionalNetworkError && <button type="button" onClick={() => { setRegionalNetworkError(false); setRegionalNetworkLoading(true); setGraubuendenAttempt(n => n + 1) }}>{exploreCopy.retry}</button>}
            </div>
          </>}
          {isSolothurn && <p className="explore-status">{text.solothurnScope} · {network?.metadata.serviceDate}</p>}
          {isRiviera && <p className="explore-status">{rivieraCopy?.scope ?? rivieraLabel} · {network?.metadata.serviceDate}</p>}
          {isNyon && <p className="explore-status">{text.nyonScope} · {network?.metadata.serviceDate}</p>}
          {isBern && <p className="explore-status">{text.bernScope} · {network?.metadata.serviceDate}</p>}
          {nowActive && !isTicino && !isValais && !isBern && !isSolothurn && <p className="explore-status">{network?.metadata.serviceDate === nowDate ? exploreCopy.today : exploreCopy.typical}</p>}
          {nowUnavailable && <p className="explore-status" role="status">{exploreCopy.unavailable}</p>}
          {browserLocation.status !== 'idle' && <p className="explore-status" role="status">{browserLocation.status === 'locating' ? exploreCopy.locating : browserLocation.status === 'denied' ? exploreCopy.denied : browserLocation.status === 'timeout' ? exploreCopy.timeout : browserLocation.status === 'unavailable' ? exploreCopy.locationError : validLocation ? `${exploreCopy.accuracy}: ±${Math.round(validLocation.accuracy)} m` : exploreCopy.outside}</p>}
          {(initialLink.invalidRecording || pilotLinkUnavailable) && <p className="explore-status" role="status">{text.pilotLinkUnavailable}</p>}
          {pilotLinkUnavailable && <button type="button" onClick={() => window.location.reload()}>{exploreCopy.retry}</button>}
          {exploreNotice && <p className="explore-status" role="status">{exploreCopy[exploreNotice]}</p>}
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
                      : regionalViewLabel}
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
                    setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
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
                  : regionalViewLabel}
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
                setPilatusJourneyActive(false); setRochersJourneyActive(false); setGlionJourneyActive(false); setTerritetJourneyActive(false); setGornergratAscentActive(false); setJungfrauAscentActive(false)
                setView(isHub ? 'network' : 'hub')
              }}
            >
              <span className="button-icon takt-icon" aria-hidden="true">◎</span>
              {isHub
                ? networkStudy === 'national'
                  ? text.nationalView
                  : regionalViewLabel
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
        <Suspense fallback={null}><DetailCard kind="performance" /></Suspense>
      )}

      <footer>
        {isTimetable ? (
          <span className="source-links">
            <a
              href={network?.metadata.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {isBern || isSolothurn ? 'opentransportdata.swiss · GTFS' : text.swissGtfs} · {network?.metadata.feedVersion ?? text.loading}
            </a>
            {isNetwork && network?.metadata.geometry && (
              <a
                href={
                  additionalId ? editionDataUrl(`${additionalId}/study-sources.json`) : isValais || isTicino || isGraubuenden || isSolothurn ? editionDataUrl(`${networkStudy}/sources.json`) : isBern ? 'https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct' : isBasel || isNyon || isRiviera ? 'https://www.openstreetmap.org/copyright' : network.metadata.geometry.productUrl ??
                  network.metadata.geometry.sourceUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                {additionalRegion ? sourceCredit(language, additionalRegion.credit) : isValais || isTicino ? text.mapCredit : isSolothurn ? text.solothurnCredit : isBern ? text.bernCredit : isPostbus || isLausanne || isBasel || isNyon || isRiviera ? `${text.osmCredit} · ODbL` : <>{text.stopGeometry} ·{' '}
                {networkStudy === 'national'
                  ? 'BAV / OFT'
                  : networkStudy === 'geneva-tpg'
                    ? 'TPG / SITG'
                    : 'ZVV'}</>}
              </a>
            )}
            {isNetwork && isRiviera && <a href="https://map.geo.admin.ch/?layers=ch.bav.seilbahnen-bundeskonzession" target="_blank" rel="noreferrer">{text.funicularSource}</a>}
            {isNetwork && (isLausanne || isBasel || isNyon || isRiviera) && <a href="https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz" target="_blank" rel="noreferrer">{text.railSource}</a>}
            {isNetwork && isValais && <a href={editionDataUrl('valais-region/road-paths.json')} target="_blank" rel="noreferrer">{text.osmCredit} · ODbL · {valaisLabel}</a>}
            {isNetwork && isGraubuenden && <a href={editionDataUrl('graubuenden-region/road-paths.json')} target="_blank" rel="noreferrer">{text.osmCredit} · ODbL · {graubuendenCopy?.view}</a>}
            {isNetwork && isSolothurn && <a href={editionDataUrl('solothurn-region/terms.html')} target="_blank" rel="noreferrer">{text.bernTerms} · SO</a>}
            {isNetwork && isSolothurn && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{text.osmCredit} · ODbL</a>}
            {isNetwork && isBern && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{text.osmCredit} · ODbL</a>}
            {isNetwork && isBern && <a href={editionDataUrl('bern-region/sources.json')} target="_blank" rel="noreferrer">{text.fotCredit}</a>}
            {isNetwork && isBern && <a href={editionDataUrl('bern-region/terms_of_use_de.pdf')} target="_blank" rel="noreferrer">{text.bernTerms} · DE</a>}
            {isNetwork && isBern && <a href={editionDataUrl('bern-region/terms_of_use_fr.pdf')} target="_blank" rel="noreferrer">{text.bernTerms} · FR</a>}
            {isNetwork && isBasel && <a href="https://wfs.geo.bs.ch/" target="_blank" rel="noreferrer">{text.baselGeoCredit}</a>}
            {isNetwork && isBasel && <a href="https://www.swisstopo.admin.ch">© swisstopo</a>}
            {isNetwork && networkStudy === 'national' && boundary && (
              <a href={boundary.metadata.productUrl} target="_blank" rel="noreferrer">
                {text.border} · {sourceCredit(language, boundary.metadata.attribution)}
              </a>
            )}
            {isNetwork && lakes && (
              <a href={lakes.metadata.productUrl} target="_blank" rel="noreferrer">
                {text.lakes} · {sourceCredit(language, lakes.metadata.attribution)}
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
              <a href="https://geolion.zh.ch/geodatensatz/3177" target="_blank" rel="noreferrer">{text.zurichRoadCredit}</a>
            )}
            {isMountainStudy && <a href="https://map.geo.admin.ch/?layers=ch.bav.seilbahnen-bundeskonzession,ch.bav.schienennetz" target="_blank" rel="noreferrer">{text.mountainSource}</a>}
            <a href="./methodology.html">{text.methodology}</a>
          </span>
        ) : (
          <span className="source-links">
            {corridor ? (
              <>
                <a href={corridor.metadata.productUrl} target="_blank" rel="noreferrer">
                  {text.groundSource}
                </a>
                {corridor.metadata.routeProductUrl && (
                  <a
                    href={corridor.metadata.routeProductUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {text.routeSource} · {isRigiTerrain ? 'FOT / BAV' : text.osmCredit}
                  </a>
                )}
                {isRigiTerrain && lakes && <a href={lakes.metadata.productUrl} target="_blank" rel="noreferrer">{text.lakes} · {sourceCredit(language, lakes.metadata.attribution)}</a>}
                {isRigiTerrain && <a href="./methodology.html">{text.methodology}</a>}
                {corridor.metadata.tunnelProductUrl && (
                  <a
                    href={corridor.metadata.tunnelProductUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {text.communityTunnels}
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
              ? additionalId ? additionalCopy?.model : isValais ? (valaisCopy?.valaisScope ?? '') : isTicino ? ticinoCopy?.model : isGraubuenden ? graubuendenCopy?.model : isSolothurn ? text.solothurnModel : isBern ? text.bernModel : isRiviera ? (rivieraCopy?.model ?? rivieraLabel) : isNyon ? text.nyonModel : isBasel ? text.baselModel : isLausanne ? text.lausanneModel : timedRigiTerrain || jungfrauTerrainWindow || gornergratTerrainWindow || pilatusTerrainWindow || rochersTerrainWindow || glionTerrainWindow || territetTerrainWindow ? text.interpolation : isPilatus ? pilatusCopy?.model : isRochers ? rochersCopy?.model : isTerritet ? glionJourneyActive || glionNetwork ? territetCopy?.combinedModel : territetCopy?.model : isGornergrat ? gornergratCopy?.model : isJungfrau ? jungfrauCopy?.model : isRigi ? rigiCopy.water : hasHeadwayMotion ? frequencyCopy.interpolation : text.interpolation
              : text.simulation}
        </span>
      </footer>
    </main>
  )
}
