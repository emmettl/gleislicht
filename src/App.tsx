import { useCallback, useEffect, useMemo, useState } from 'react'
import { positionOnJourney, prototypeJourney } from './domain/journey.ts'
import { GleislichtScene } from './scene/GleislichtScene.tsx'

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function App() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>('follow')
  const [progress, setProgress] = useState(0.11)
  const position = useMemo(
    () => positionOnJourney(prototypeJourney, progress),
    [progress],
  )
  const handleProgress = useCallback((nextProgress: number) => {
    setProgress(nextProgress)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setIsPlaying((value) => !value)
      }
      if (event.key.toLowerCase() === 'c') {
        setCameraMode((value) => (value === 'follow' ? 'overview' : 'follow'))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main className="experience">
      <div className="scene" aria-hidden="true">
        <GleislichtScene
          cameraMode={cameraMode}
          isPlaying={isPlaying}
          progress={progress}
          onProgress={handleProgress}
        />
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
          <span>motion study 001</span>
          <span className="coordinate">47.194° N · 9.312° E</span>
        </div>
      </header>

      <section className="journey-card" aria-label="Current simulated journey">
        <div className="service-row">
          <span className="service">{prototypeJourney.service}</span>
          <span className="arrow">→</span>
          <span>{prototypeJourney.destination}</span>
        </div>
        <p className="between">
          {position.previous.name} <span>/</span> {position.next.name}
        </p>
        <div className="metric-grid">
          <div>
            <span>velocity</span>
            <strong>{prototypeJourney.speedKmh}</strong>
            <small>km/h</small>
          </div>
          <div>
            <span>next</span>
            <strong>{Math.max(1, Math.round((1 - position.legProgress) * 14))}</strong>
            <small>min</small>
          </div>
        </div>
      </section>

      <div className="prototype-note">
        <span>prototype route</span>
        <span>synthetic terrain</span>
      </div>

      <section className="transport" aria-label="Playback controls">
        <div className="progress-copy">
          <span>{position.previous.departure}</span>
          <span className="route-id">{prototypeJourney.id}</span>
          <span>{prototypeJourney.stops.at(-1)?.departure}</span>
        </div>
        <label className="scrubber">
          <span className="sr-only">Journey progress</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
          <span className="progress-value">{formatPercent(progress)}</span>
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
              setCameraMode((value) => (value === 'follow' ? 'overview' : 'follow'))
            }
          >
            <span className="button-icon camera-icon" aria-hidden="true" />
            {cameraMode === 'follow' ? 'Network view' : 'Follow train'}
            <kbd>C</kbd>
          </button>
        </div>
      </section>

      <footer>
        <span>{prototypeJourney.operator}</span>
        <span>simulation / no live data</span>
      </footer>
    </main>
  )
}

