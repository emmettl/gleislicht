import { useCallback, useEffect, useMemo, useState } from 'react'
import { positionOnJourney, prototypeJourney } from './domain/journey.ts'
import {
  formatServiceTime,
  type NetworkSnapshot,
} from './domain/network.ts'
import { GleislichtScene } from './scene/GleislichtScene.tsx'
import { NationalNetworkScene } from './scene/NationalNetworkScene.tsx'

type View = 'network' | 'journey'

const numberFormat = new Intl.NumberFormat('de-CH')

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function App() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [view, setView] = useState<View>('network')
  const [journeyProgress, setJourneyProgress] = useState(0.11)
  const [networkTime, setNetworkTime] = useState(7 * 3600 + 45 * 60)
  const [network, setNetwork] = useState<NetworkSnapshot>()
  const [dataError, setDataError] = useState(false)
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
  const handleJourneyProgress = useCallback((nextProgress: number) => {
    setJourneyProgress(nextProgress)
  }, [])
  const handleNetworkTime = useCallback((nextTime: number) => {
    setNetworkTime(nextTime)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/data/swiss-rail-morning.json', { signal: controller.signal })
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
        event.preventDefault()
        setIsPlaying((value) => !value)
      }
      if (event.key.toLowerCase() === 'c') {
        setView((value) => (value === 'network' ? 'journey' : 'network'))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const isNetwork = view === 'network'
  const networkReady = isNetwork && network

  return (
    <main className={`experience view-${view}`}>
      <div className="scene" aria-hidden="true">
        {networkReady ? (
          <NationalNetworkScene
            snapshot={network}
            isPlaying={isPlaying}
            time={networkTime}
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
          <span>motion study 002</span>
          <span className="coordinate">
            {isNetwork ? 'Friday · 04 September 2026' : '47.194° N · 9.312° E'}
          </span>
        </div>
      </header>

      {isNetwork ? (
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
            <span>GTFS schedule</span>
            <span>stop geometry</span>
          </>
        ) : (
          <>
            <span>prototype route</span>
            <span>synthetic terrain</span>
          </>
        )}
      </div>

      {isNetwork && <div className="north-marker">N</div>}

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
          <button
            type="button"
            onClick={() =>
              setView((value) => (value === 'network' ? 'journey' : 'network'))
            }
          >
            <span className="button-icon camera-icon" aria-hidden="true" />
            {isNetwork ? 'Follow train' : 'National view'}
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
