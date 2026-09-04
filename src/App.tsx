import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  GleislichtSoundtrack,
  SoundtrackMode,
} from './audio/gleislicht-soundtrack.ts'
import {
  callsAtHub,
  callsNearTime,
  HUBS,
  nextHubCall,
  type HubDaySnapshot,
  type HubId,
} from './domain/hub.ts'
import { positionOnJourney, prototypeJourney } from './domain/journey.ts'
import {
  buildStationIndex,
  formatServiceTime,
  positionForTrain,
  SERVICE_CATEGORIES,
  SERVICE_COLORS,
  type NetworkSnapshot,
  type NetworkTrain,
  type ServiceCategory,
  type StationIndexEntry,
} from './domain/network.ts'
import { GleislichtScene } from './scene/GleislichtScene.tsx'
import { HubPulseScene } from './scene/HubPulseScene.tsx'
import {
  NationalNetworkScene,
  type MapCameraAction,
  type MapCameraCommand,
} from './scene/NationalNetworkScene.tsx'

type View = 'network' | 'hub' | 'journey'
type SoundtrackState = 'off' | 'starting' | 'on' | 'error'

const SOUNDTRACK_TITLES: Record<SoundtrackMode, string> = {
  network: 'Night Grid',
  hub: 'Taktwerk',
  journey: 'Valley Signal',
}

const numberFormat = new Intl.NumberFormat('de-CH')
const PLAYBACK_RATES = [
  { label: '1×', value: 30 },
  { label: '4×', value: 120 },
  { label: '16×', value: 480 },
  { label: '64×', value: 1920 },
] as const

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatTimelineBoundary(value: number): string {
  return value === 24 * 3600 ? '24:00' : formatServiceTime(value)
}

function matchesTrain(
  train: NetworkTrain,
  query: string,
  network: NetworkSnapshot,
): boolean {
  const stopNames = train.stops.map(
    ([stopIndex]) => network.stops[stopIndex]?.[2] ?? '',
  )
  return [train.route, train.shortName, train.headsign, ...stopNames]
    .join(' ')
    .toLocaleLowerCase('de-CH')
    .includes(query)
}

export function App() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [view, setView] = useState<View>('network')
  const [journeyProgress, setJourneyProgress] = useState(0.11)
  const [networkTime, setNetworkTime] = useState(7 * 3600 + 45 * 60)
  const [hubTime, setHubTime] = useState(7 * 3600 + 45 * 60)
  const [network, setNetwork] = useState<NetworkSnapshot>()
  const [hubDay, setHubDay] = useState<HubDaySnapshot>()
  const [dataError, setDataError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedTrainId, setSelectedTrainId] = useState<string>()
  const [selectedStationName, setSelectedStationName] = useState<string>()
  const [selectedHubId, setSelectedHubId] = useState<HubId>('zurich')
  const [mapCameraCommand, setMapCameraCommand] = useState<MapCameraCommand>({
    id: 0,
    action: 'reset',
  })
  const [playbackRate, setPlaybackRate] = useState(120)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>()
  const [soundtrackState, setSoundtrackState] = useState<SoundtrackState>('off')
  const [soundtrackVolume, setSoundtrackVolume] = useState(0.56)
  const soundtrackRef = useRef<GleislichtSoundtrack | null>(null)

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
  const selectedTrain = useMemo(
    () => network?.trains.find((train) => train.id === selectedTrainId),
    [network, selectedTrainId],
  )
  const stationIndex = useMemo(
    () => (network ? buildStationIndex(network) : []),
    [network],
  )
  const selectedStation = useMemo(
    () => stationIndex.find((station) => station.name === selectedStationName),
    [selectedStationName, stationIndex],
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
  const selectedFrom =
    network && selectedPosition
      ? network.stops[selectedPosition.fromStop]?.[2]
      : undefined
  const selectedTo =
    network && selectedPosition ? network.stops[selectedPosition.toStop]?.[2] : undefined
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('de-CH')
    if (!network || query.length < 1) return []
    return network.trains
      .filter((train) => matchesTrain(train, query, network))
      .sort((first, second) => {
        const firstActive = first.start <= networkTime && first.end >= networkTime ? 0 : 1
        const secondActive = second.start <= networkTime && second.end >= networkTime ? 0 : 1
        return (
          firstActive - secondActive ||
          first.start - second.start ||
          first.route.localeCompare(second.route, 'de-CH')
        )
      })
      .slice(0, 8)
  }, [network, networkTime, searchQuery])
  const stationSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('de-CH')
    if (!query) return []
    return stationIndex
      .filter((station) => station.name.toLocaleLowerCase('de-CH').includes(query))
      .sort((first, second) => {
        const firstName = first.name.toLocaleLowerCase('de-CH')
        const secondName = second.name.toLocaleLowerCase('de-CH')
        return (
          Number(secondName.startsWith(query)) - Number(firstName.startsWith(query)) ||
          second.trainIds.length - first.trainIds.length ||
          first.name.localeCompare(second.name, 'de-CH')
        )
      })
      .slice(0, 5)
  }, [searchQuery, stationIndex])

  const handleJourneyProgress = useCallback((nextProgress: number) => {
    setJourneyProgress(nextProgress)
  }, [])
  const handleNetworkTime = useCallback((nextTime: number) => {
    setNetworkTime(nextTime)
  }, [])
  const moveMapCamera = useCallback((action: MapCameraAction) => {
    setMapCameraCommand((current) => ({ id: current.id + 1, action }))
  }, [])

  const releaseSelection = useCallback(() => {
    setSelectedTrainId(undefined)
    setSelectedStationName(undefined)
    setSearchQuery('')
  }, [])

  const selectStation = useCallback((station: StationIndexEntry) => {
    setSelectedTrainId(undefined)
    setSelectedStationName(station.name)
    setSearchQuery(station.name)
    setSearchOpen(false)
    setView('network')
  }, [])

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
      setSearchQuery(`${train.route} ${train.shortName} → ${train.headsign}`)
      setSearchOpen(false)
      setView('network')
      setIsPlaying(true)
    },
    [network, networkTime],
  )

  const handleContextAction = useCallback(() => {
    if (view === 'network' && (selectedTrainId || selectedStationName)) {
      releaseSelection()
      return
    }
    setView((value) => (value === 'network' ? 'journey' : 'network'))
  }, [releaseSelection, selectedStationName, selectedTrainId, view])

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
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/swiss-rail-morning.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GTFS snapshot returned ${response.status}`)
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        setNetwork(snapshot)
        setNetworkTime(snapshot.metadata.focusTime)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setDataError(true)
      })
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
      })
    return () => controller.abort()
  }, [])

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
  const timeline = isHub ? (hubDay?.metadata ?? network?.metadata) : network?.metadata
  const timelineTime = isHub ? hubTime : networkTime
  const timelineReady = isTimetable && timeline

  return (
    <main
      className={`experience view-${view}${selectedTrain || selectedStation ? ' has-selection' : ''}`}
    >
      <div className="scene" aria-hidden="true">
        {isNetwork && network ? (
          <NationalNetworkScene
            snapshot={network}
            isPlaying={isPlaying}
            time={networkTime}
            selectedTrain={selectedTrain}
            onTime={handleNetworkTime}
            cameraCommand={mapCameraCommand}
            playbackRate={playbackRate}
            selectedCategory={selectedCategory}
            selectedStation={selectedStation}
          />
        ) : isHub && network ? (
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
        ) : (
          <GleislichtScene
            isPlaying={isPlaying && !isNetwork}
            progress={journeyProgress}
            onProgress={handleJourneyProgress}
          />
        )}
      </div>

      <div className="atmosphere" />
      <div className="scanlines" />

      <header className="masthead">
        <div>
          <p className="eyebrow">Gleislicht</p>
          <h1>Switzerland in motion</h1>
        </div>
        <div className="masthead-meta">
          <div className="study-meta">
            <span className="pulse" />
            <span>motion study 005</span>
            <span className="coordinate">
              {isTimetable ? 'Friday · 04 September 2026' : '47.194° N · 9.312° E'}
            </span>
          </div>
          <section
            className={`soundtrack-control is-${soundtrackState}`}
            aria-label="Adaptive soundtrack"
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
                <small>{soundtrackState === 'error' ? 'audio unavailable' : 'adaptive score'}</small>
                <strong>
                  {soundtrackState === 'starting'
                    ? 'tuning…'
                    : SOUNDTRACK_TITLES[soundtrackMode]}
                </strong>
              </span>
              <span className="sound-state">
                {soundtrackState === 'on' ? 'on' : 'off'}
              </span>
            </button>
            {soundtrackState === 'on' && (
              <label className="volume-control">
                <span>volume</span>
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
          onFocus={() => setSearchOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSearchOpen(false)
            }
          }}
        >
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              if (stationSearchResults[0]) selectStation(stationSearchResults[0])
              else if (searchResults[0]) selectTrain(searchResults[0])
            }}
          >
            <span className="search-mark" aria-hidden="true" />
            <label>
              <span className="sr-only">Find a station, train, service, or destination</span>
              <input
                type="search"
                value={searchQuery}
                placeholder="Find IC 1, Zürich, train 701…"
                autoComplete="off"
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSearchOpen(true)
                  if (!event.target.value) releaseSelection()
                  else if (event.target.value !== selectedStation?.name) {
                    setSelectedStationName(undefined)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchOpen(false)
                    event.currentTarget.blur()
                  }
                }}
              />
            </label>
            {searchQuery && (
              <button
                className="clear-search"
                type="button"
                aria-label="Clear search and selection"
                onClick={releaseSelection}
              >
                ×
              </button>
            )}
          </form>
          {searchOpen && searchQuery.trim() && (
            <div
              className="search-results"
              role="listbox"
              aria-label="Matching stations and trains"
            >
              {stationSearchResults.map((station) => (
                <button
                  className="station-result"
                  key={`station:${station.name}`}
                  type="button"
                  role="option"
                  aria-selected={station.name === selectedStationName}
                  onClick={() => selectStation(station)}
                >
                  <span className="station-result-mark" aria-hidden="true">◎</span>
                  <span className="result-service">{station.name}</span>
                  <span className="result-route">
                    {station.routes.length} routes · {station.trainIds.length} scheduled calls
                  </span>
                </button>
              ))}
              {searchResults.map((train) => {
                  const origin = network?.stops[train.stops[0]?.[0]]?.[2]
                  return (
                    <button
                      key={train.id}
                      type="button"
                      role="option"
                      aria-selected={train.id === selectedTrainId}
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
              {!stationSearchResults.length && !searchResults.length && (
                <p>No stations or trains found in this morning window.</p>
              )}
            </div>
          )}
        </section>
      )}

      {isHub && (
        <nav className="hub-picker" aria-label="Takt pulse station">
          <span>Takt pulse</span>
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
        <section className="journey-card hub-card" aria-label={`${selectedHub.name} pulse`}>
          <p className="hub-kicker">takt / 24 hour loop</p>
          <div className="network-count-row">
            <strong>{nearbyHubCalls.length}</strong>
            <span>arrivals + departures in orbit</span>
          </div>
          <p className="between">
            {selectedHub.character} <span>/</span>{' '}
            {numberFormat.format(hubCalls.length)} calls today
          </p>
          <div className="metric-grid">
            <div>
              <span>next strike</span>
              <strong>
                {upcomingHubCall ? formatServiceTime(upcomingHubCall.arrival) : '—'}
              </strong>
              <small>{upcomingHubCall?.train.route ?? 'end'}</small>
            </div>
            <div>
              <span>direction</span>
              <strong className="destination-metric">
                {upcomingHubCall?.train.headsign ?? '—'}
              </strong>
            </div>
          </div>
        </section>
      ) : isNetwork && selectedTrain ? (
        <section className="journey-card selected-card" aria-label="Selected train">
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
            {selectedFrom ?? 'Between stations'} <span>/</span>{' '}
            {selectedTo ?? selectedTrain.headsign}
          </p>
          <div className="metric-grid">
            <div>
              <span>train</span>
              <strong>{selectedTrain.shortName || '—'}</strong>
              <small>{selectedTrain.category}</small>
            </div>
            <div>
              <span>arrival</span>
              <strong>{formatServiceTime(selectedTrain.end)}</strong>
              <small>plan</small>
            </div>
          </div>
        </section>
      ) : isNetwork && selectedStation ? (
        <section className="journey-card station-card" aria-label={`Routes serving ${selectedStation.name}`}>
          <div className="service-row">
            <span className="station-card-mark" aria-hidden="true">◎</span>
            <span className="service">{selectedStation.name}</span>
          </div>
          <p className="between">
            all scheduled paths <span>/</span> morning study
          </p>
          <div className="metric-grid">
            <div>
              <span>routes</span>
              <strong>{selectedStation.routes.length}</strong>
              <small>unique</small>
            </div>
            <div>
              <span>calls</span>
              <strong>{selectedStation.trainIds.length}</strong>
              <small>2h</small>
            </div>
          </div>
        </section>
      ) : isNetwork ? (
        <section className="journey-card network-card" aria-label="Swiss network status">
          <div className="network-count-row">
            <strong>{network ? numberFormat.format(activeTrainCount) : '—'}</strong>
            <span>trains in motion</span>
          </div>
          <p className="between">
            {dataError ? 'Schedule unavailable' : 'Scheduled rail · morning window'}
          </p>
          <div className="metric-grid">
            <div>
              <span>trips</span>
              <strong>{network ? numberFormat.format(network.trains.length) : '—'}</strong>
              <small>2h</small>
            </div>
            <div>
              <span>feed</span>
              <strong>{network?.metadata.feedVersion.slice(4) ?? '—'}</strong>
              <small>2026</small>
            </div>
          </div>
        </section>
      ) : (
        <section className="journey-card" aria-label="Current simulated journey">
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
              <span>velocity</span>
              <strong>{prototypeJourney.speedKmh}</strong>
              <small>km/h</small>
            </div>
            <div>
              <span>next</span>
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
            <span>scheduled station calls</span>
            <span>15 minute orbit</span>
          </>
        ) : isNetwork ? (
          <>
            <span>
              {selectedTrain
                ? 'scheduled follow'
                : selectedStation
                  ? 'station route focus'
                  : 'GTFS schedule'}
            </span>
            <span>
              {selectedTrain?.category ??
                selectedStation?.name ??
                selectedCategory ??
                'stop geometry'}
            </span>
          </>
        ) : (
          <>
            <span>prototype route</span>
            <span>synthetic terrain</span>
          </>
        )}
      </div>

      {isNetwork && !selectedTrain && <div className="north-marker">N</div>}

      {isNetwork && !selectedTrain && (
        <div className="map-navigation" aria-label="Map navigation">
          <span>drag · wheel / pinch</span>
          <div>
            <button
              type="button"
              aria-label="Zoom map in"
              onClick={() => moveMapCamera('zoom-in')}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom map out"
              onClick={() => moveMapCamera('zoom-out')}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Reset map position and zoom"
              onClick={() => moveMapCamera('reset')}
            >
              ↺
            </button>
          </div>
        </div>
      )}

      {isTimetable && !selectedTrain && (
        <div
          className={`service-legend${selectedCategory ? ' has-filter' : ''}`}
          aria-label="Filter trains by service category"
        >
          {SERVICE_CATEGORIES.filter((category) => category.id !== 'other').map(
            (category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.id}
                onClick={() =>
                  setSelectedCategory((current) =>
                    current === category.id ? undefined : category.id,
                  )
                }
              >
                <i style={{ backgroundColor: category.color }} />
                {category.label}
              </button>
            ),
          )}
        </div>
      )}

      <section className="transport" aria-label="Playback controls">
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
            {isTimetable ? 'Time of day' : 'Journey progress'}
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
              else if (timelineReady) setNetworkTime(value)
              else setJourneyProgress(value)
            }}
          />
          <span className="progress-value">
            {timelineReady ? formatServiceTime(timelineTime) : formatPercent(journeyProgress)}
          </span>
        </label>
        {isTimetable && (
          <div className="speed-picker" aria-label="Playback speed">
            <span>tempo</span>
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
        <div className="button-row">
          <button type="button" onClick={() => setIsPlaying((value) => !value)}>
            <span className="button-icon" aria-hidden="true">
              {isPlaying ? 'Ⅱ' : '▶'}
            </span>
            {isPlaying ? 'Pause motion' : 'Resume motion'}
            <kbd>Space</kbd>
          </button>
          <button type="button" onClick={handleContextAction}>
            <span className="button-icon camera-icon" aria-hidden="true" />
            {selectedTrain || selectedStation
              ? selectedTrain
                ? 'Release train'
                : 'Clear station'
              : isNetwork
                ? 'Corridor study'
                : 'National view'}
            <kbd>C</kbd>
          </button>
          {isTimetable && !selectedTrain && (
            <button
              type="button"
              aria-pressed={isHub}
              onClick={() => setView(isHub ? 'network' : 'hub')}
            >
              <span className="button-icon takt-icon" aria-hidden="true">◎</span>
              {isHub ? 'National view' : 'Takt hubs'}
            </button>
          )}
        </div>
      </section>

      <footer>
        {isTimetable ? (
          <a
            href={network?.metadata.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Swiss GTFS · {network?.metadata.feedVersion ?? 'loading'}
          </a>
        ) : (
          <span>{prototypeJourney.operator}</span>
        )}
        <span>
          {isHub
            ? 'arrivals inward / departures outward'
            : isNetwork
              ? 'scheduled interpolation / no GPS'
              : 'simulation / no live data'}
        </span>
      </footer>
    </main>
  )
}
