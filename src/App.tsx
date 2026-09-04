import { useCallback, useEffect, useMemo, useState } from 'react'
import { positionOnJourney, prototypeJourney } from './domain/journey.ts'
import {
  formatServiceTime,
  positionForTrain,
  SERVICE_CATEGORIES,
  SERVICE_COLORS,
  type NetworkSnapshot,
  type NetworkTrain,
} from './domain/network.ts'
import { GleislichtScene } from './scene/GleislichtScene.tsx'
import { NationalNetworkScene } from './scene/NationalNetworkScene.tsx'

type View = 'network' | 'journey'

const numberFormat = new Intl.NumberFormat('de-CH')

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function matchesTrain(
  train: NetworkTrain,
  query: string,
  network: NetworkSnapshot,
): boolean {
  const firstStop = network.stops[train.stops[0]?.[0]]?.[2] ?? ''
  return [train.route, train.shortName, train.headsign, firstStop]
    .join(' ')
    .toLocaleLowerCase('de-CH')
    .includes(query)
}

export function App() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [view, setView] = useState<View>('network')
  const [journeyProgress, setJourneyProgress] = useState(0.11)
  const [networkTime, setNetworkTime] = useState(7 * 3600 + 45 * 60)
  const [network, setNetwork] = useState<NetworkSnapshot>()
  const [dataError, setDataError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedTrainId, setSelectedTrainId] = useState<string>()

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
  const selectedPosition = useMemo(
    () => (selectedTrain ? positionForTrain(selectedTrain, networkTime) : undefined),
    [networkTime, selectedTrain],
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

  const handleJourneyProgress = useCallback((nextProgress: number) => {
    setJourneyProgress(nextProgress)
  }, [])
  const handleNetworkTime = useCallback((nextTime: number) => {
    setNetworkTime(nextTime)
  }, [])

  const releaseTrain = useCallback(() => {
    setSelectedTrainId(undefined)
    setSearchQuery('')
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
      setSearchQuery(`${train.route} ${train.shortName} → ${train.headsign}`)
      setSearchOpen(false)
      setView('network')
      setIsPlaying(true)
    },
    [network, networkTime],
  )

  const handleContextAction = useCallback(() => {
    if (view === 'network' && selectedTrainId) {
      releaseTrain()
      return
    }
    setView((value) => (value === 'network' ? 'journey' : 'network'))
  }, [releaseTrain, selectedTrainId, view])

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

  const isNetwork = view === 'network'
  const networkReady = isNetwork && network

  return (
    <main className={`experience view-${view}${selectedTrain ? ' has-selection' : ''}`}>
      <div className="scene" aria-hidden="true">
        {networkReady ? (
          <NationalNetworkScene
            snapshot={network}
            isPlaying={isPlaying}
            time={networkTime}
            selectedTrain={selectedTrain}
            onTime={handleNetworkTime}
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
        <div className="study-meta">
          <span className="pulse" />
          <span>motion study 003</span>
          <span className="coordinate">
            {isNetwork ? 'Friday · 04 September 2026' : '47.194° N · 9.312° E'}
          </span>
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
              if (searchResults[0]) selectTrain(searchResults[0])
            }}
          >
            <span className="search-mark" aria-hidden="true" />
            <label>
              <span className="sr-only">Find a train, service, or destination</span>
              <input
                type="search"
                value={searchQuery}
                placeholder="Find IC 1, Zürich, train 701…"
                autoComplete="off"
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSearchOpen(true)
                  if (!event.target.value) setSelectedTrainId(undefined)
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
                aria-label="Clear train search"
                onClick={releaseTrain}
              >
                ×
              </button>
            )}
          </form>
          {searchOpen && searchQuery.trim() && (
            <div className="search-results" role="listbox" aria-label="Matching trains">
              {searchResults.length ? (
                searchResults.map((train) => {
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
                })
              ) : (
                <p>No trains found in this morning window.</p>
              )}
            </div>
          )}
        </section>
      )}

      {isNetwork && selectedTrain ? (
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
        {isNetwork ? (
          <>
            <span>{selectedTrain ? 'scheduled follow' : 'GTFS schedule'}</span>
            <span>{selectedTrain?.category ?? 'stop geometry'}</span>
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
        <div className="service-legend" aria-label="Service colour legend">
          {SERVICE_CATEGORIES.filter((category) => category.id !== 'other').map(
            (category) => (
              <span key={category.id}>
                <i style={{ backgroundColor: category.color }} />
                {category.label}
              </span>
            ),
          )}
        </div>
      )}

      <section className="transport" aria-label="Playback controls">
        <div className="progress-copy">
          <span>
            {networkReady
              ? formatServiceTime(network.metadata.windowStart)
              : journeyPosition.previous.departure}
          </span>
          <span className="route-id">
            {isNetwork ? formatServiceTime(networkTime) : prototypeJourney.id}
          </span>
          <span>
            {networkReady
              ? formatServiceTime(network.metadata.windowEnd)
              : prototypeJourney.stops.at(-1)?.departure}
          </span>
        </div>
        <label className="scrubber">
          <span className="sr-only">
            {isNetwork ? 'Time of day' : 'Journey progress'}
          </span>
          <input
            type="range"
            min={networkReady ? network.metadata.windowStart : 0}
            max={networkReady ? network.metadata.windowEnd : 1}
            step={networkReady ? 10 : 0.001}
            value={networkReady ? networkTime : journeyProgress}
            disabled={isNetwork && !network}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (networkReady) setNetworkTime(value)
              else setJourneyProgress(value)
            }}
          />
          <span className="progress-value">
            {networkReady ? formatServiceTime(networkTime) : formatPercent(journeyProgress)}
          </span>
        </label>
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
            {selectedTrain
              ? 'Release train'
              : isNetwork
                ? 'Corridor study'
                : 'National view'}
            <kbd>C</kbd>
          </button>
        </div>
      </section>

      <footer>
        {isNetwork ? (
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
          {isNetwork ? 'scheduled interpolation / no GPS' : 'simulation / no live data'}
        </span>
      </footer>
    </main>
  )
}
