import { Component, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import OrbitalScene, { type OrbitalGeography, type OrbitalPlayback } from './OrbitalScene.tsx'
import { decodeOrbitalPayload, orbitalBlock, orbitalClock, ORBITAL_TRANSPORTS, type OrbitalChunk, type OrbitalManifest } from './orbital-data.ts'
import { editionDataUrl } from '../editions/data-url.ts'
import type { OrbitalTerrain } from './orbital-terrain.ts'
import { orbitalSun } from './orbital-sun.ts'
import './orbital.css'
import './orbital-flight.css'

class OrbitalBoundary extends Component<{ children: ReactNode; onError?: (message: string) => void }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch() { this.props.onError?.('The orbital renderer couldn’t start. Your atlas has been restored.') }
  render() { return this.state.error ? <div className="orbital-message" role="alert"><h2>The orbital view couldn’t start</h2><p>Try reloading in a browser with WebGL enabled.</p><a href="?">Return to the atlas</a></div> : this.props.children }
}
async function json<T>(file: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(editionDataUrl(file), { signal })
  if (!response.ok) throw new Error(`Could not load ${file}`)
  return response.json() as Promise<T>
}
const integer = new Intl.NumberFormat('en-CH')
const ORBITAL_CAMERA = { position: [0, 39, 24] as [number, number, number], fov: 43, near: 0.1, far: 400 }
const COMPACT_VIEW = '(max-width: 700px), (max-width: 1000px) and (max-height: 500px)'
const ORBITAL_GL = { antialias: true, alpha: false, powerPreference: 'high-performance' as const }
export interface OrbitalViewProps { onReady?: () => void; onLoadError?: (message: string) => void }
export default function OrbitalView({ onReady, onLoadError }: OrbitalViewProps) {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_VIEW).matches)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const query = window.matchMedia(COMPACT_VIEW)
    const change = () => { setCompact(query.matches); setSettingsOpen(false) }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const dialog = settingsDialog.current
    if (compact && settingsOpen) dialog?.showModal()
    else dialog?.close()
  }, [compact, settingsOpen])
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const playback = useRef<OrbitalPlayback>({ time: 27900, speed: 60, playing: !reduced, trail: 120, drift: !reduced, ready: false, categories: Array(13).fill(true) })
  const [sunlight, setSunlight] = useState(false)
  const [snowEnabled, setSnowEnabled] = useState(true), [snowline, setSnowline] = useState(2600)
  const cityLabels = useRef<HTMLDivElement>(null)
  const cameraAltitude = useRef<HTMLOutputElement>(null)
  const [manifest, setManifest] = useState<OrbitalManifest>()
  const [geography, setGeography] = useState<OrbitalGeography>()
  const [terrain, setTerrain] = useState<OrbitalTerrain>()
  const [chunk, setChunk] = useState<OrbitalChunk>()
  const [hiddenTransports, setHiddenTransports] = useState<string[]>([])
  const [terrainDetail, setTerrainDetail] = useState<'standard' | 'detailed'>('standard')
  const [terrainLoading, setTerrainLoading] = useState(false), [terrainError, setTerrainError] = useState('')
  const terrainCache = useRef(new Map<string, OrbitalTerrain>())
  const terrainRequest = useRef<AbortController | null>(null)
  const [time, setTime] = useState(27900), [block, setBlock] = useState(3)
  const [playing, setPlaying] = useState(!reduced), [speed, setSpeed] = useState(60), [trail, setTrail] = useState(120)
  const [drift, setDrift] = useState(!reduced), [reset, setReset] = useState(0)
  const [stats, setStats] = useState({ active: 0, fps: 0 })
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [about, setAbout] = useState(false)
  const [focused, setFocused] = useState(false)
  const focusButton = useRef<HTMLButtonElement>(null), exitFocusButton = useRef<HTMLButtonElement>(null)
  const wasFocused = useRef(false)
  const cache = useRef(new Map<number, OrbitalChunk>())
  // Keep large typed movement buffers out of React devtools prop diffs.
  const movementSource = useCallback(() => chunk, [chunk])
  const ready = Boolean(terrain && chunk && chunk.start === block * 7200)
  useEffect(() => { if (ready && stats.fps > 0) onReady?.() }, [ready, stats.fps, onReady])
  useEffect(() => { if (error) onLoadError?.(error) }, [error, onLoadError])
  const rhythmPath = useMemo(() => {
    if (!manifest) return ''
    const peak = Math.max(1, ...manifest.active)
    return `M0,42 ${manifest.active.map((n, i) => `L${i},${42 - n / peak * 38}`).join(' ')} L1440,42Z`
  }, [manifest])
  useEffect(() => { document.title = 'All Switzerland · Gleislicht' }, [])
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      json<OrbitalManifest>('orbital/manifest.json', controller.signal),
      json<{ rings: number[][][] }>('swiss-boundary.json', controller.signal),
      json<{ lakes: OrbitalGeography['lakes'] }>('swiss-lakes.json', controller.signal),
      json<OrbitalTerrain>('orbital-terrain.json', controller.signal),
    ]).then(([m, boundary, lakes, terrainData]) => {
      if (m.version !== 1 || m.chunks.length !== 12) throw new Error('Unsupported orbital data')
      setManifest(m); setTerrain(terrainData); terrainCache.current.set('standard', terrainData); setGeography({ rings: boundary.rings, lakes: lakes.lakes })
    }).catch(e => { if (!controller.signal.aborted) setError(String(e.message)) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    if (!manifest) return
    const controller = new AbortController()
    const state = playback.current
    state.ready = false
    async function load(index: number) {
      if (cache.current.has(index)) return cache.current.get(index)!
      const descriptor = manifest!.chunks[index]
      const response = await fetch(editionDataUrl(`orbital/${descriptor.file}`), { signal: controller.signal })
      if (!response.ok) throw new Error('The movement block could not be loaded.')
      const bytes = await response.arrayBuffer()
      const result = await decodeOrbitalPayload(bytes, descriptor)
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      cache.current.set(index, result)
      for (const key of cache.current.keys()) if (![block, (block + 1) % 12, (block + 11) % 12].includes(key)) cache.current.delete(key)
      return result
    }
    void load(block).then(result => {
      if (controller.signal.aborted) return
      setChunk(result); playback.current.ready = true
      // One adjacent block, never the full day, is prefetched.
      void load((block + 1) % 12).catch(() => {})
    }).catch(e => { if (!controller.signal.aborted) setError(String(e.message)) })
    return () => { controller.abort(); state.ready = false }
  }, [manifest, block, attempt])
  useEffect(() => () => terrainRequest.current?.abort(), [])
  async function selectTerrain(detail: 'standard' | 'detailed') {
    terrainRequest.current?.abort()
    const controller = new AbortController(); terrainRequest.current = controller
    setTerrainError('')
    const cached = terrainCache.current.get(detail)
    if (cached) { setTerrain(cached); setTerrainDetail(detail); setTerrainLoading(false); return }
    setTerrainLoading(true)
    try {
      const result = await json<OrbitalTerrain>(`orbital-terrain${detail === 'detailed' ? '-detailed' : ''}.json`, controller.signal)
      if (result.version !== 1 || result.columns * result.rows !== result.elevations.length || !result.elevations.every(v => Number.isFinite(v) && v >= 0 && v < 6000)) throw new Error('Invalid detailed terrain')
      if (controller.signal.aborted) return
      terrainCache.current.set(detail, result); setTerrain(result); setTerrainDetail(detail); setTerrainLoading(false)
    } catch { if (!controller.signal.aborted) { setTerrainError('Fine terrain couldn’t load. Try again.'); setTerrainLoading(false) } }
  }
  function toggleTransport(id: string) {
    const hidden = hiddenTransports.includes(id) ? hiddenTransports.filter(value => value !== id) : [...hiddenTransports, id]
    setHiddenTransports(hidden)
    for (const mode of ORBITAL_TRANSPORTS) for (const category of mode.categories) playback.current.categories[category] = !hidden.includes(mode.id)
  }
  const seek = useCallback((value: number) => {
    setError('')
    playback.current.time = value
    if (orbitalBlock(value) !== block) playback.current.ready = false
    setTime(value); setBlock(orbitalBlock(value))
  }, [block])
  const togglePlay = useCallback(() => {
    playback.current.playing = !playback.current.playing; setPlaying(playback.current.playing)
  }, [])
  const toggleFocus = useCallback(() => { setAbout(false); setSettingsOpen(false); setFocused(value => !value) }, [])
  useEffect(() => {
    const restore = wasFocused.current
    // Let the hidden chrome become visible before restoring keyboard focus.
    let nextFrame = 0
    const frame = requestAnimationFrame(() => {
      if (focused) exitFocusButton.current?.focus({ preventScroll: true })
      else if (restore) nextFrame = requestAnimationFrame(() => focusButton.current?.focus({ preventScroll: true }))
    })
    wasFocused.current = focused
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame) }
  }, [focused])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFocused(false); setAbout(false); setSettingsOpen(false); return }
      const target = e.target as HTMLElement
      if (target.closest('input,select,textarea,[contenteditable="true"]')) return
      if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) { e.preventDefault(); toggleFocus(); return }
      if (target.closest('button,a')) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [togglePlay, toggleFocus])
  const onStats = useCallback((active: number, fps: number, value: number) => {
    if (value >= 86400) { value = 0; playback.current.time = 0; playback.current.ready = false }
    setStats({ active, fps }); setTime(value); setBlock(orbitalBlock(value)); setDrift(playback.current.drift)
  }, [])
  const sunPosition = sunlight ? orbitalSun(time) : null
  const snowControls = <div className="orbital-snow-control" inert={focused} aria-hidden={focused} role="group" aria-label="Simulated snow cover">
      <button aria-pressed={snowEnabled} onClick={() => setSnowEnabled(value => !value)}>Snow {snowEnabled ? 'on' : 'off'}</button>
      <label htmlFor="orbital-snowline">Snowline <output>{integer.format(snowline)} m</output></label>
      <input id="orbital-snowline" aria-label="Snowline altitude" aria-valuetext={`${snowline} metres above sea level`} type="range" min={800} max={4200} step={100} value={snowline} disabled={!snowEnabled} onChange={event => setSnowline(Number(event.target.value))} />
      <small>Simulated cover</small>
    </div>
  const viewControls = <aside className="orbital-side" inert={focused} aria-hidden={focused} aria-label="View controls">
      <div className="orbital-detail" role="group" aria-label="Mountain detail">
        <span>Mountain detail</span>
        <button aria-pressed={terrainDetail === 'standard'} onClick={() => void selectTerrain('standard')}>Standard · ~500 m</button>
        <button aria-pressed={terrainDetail === 'detailed'} onClick={() => void selectTerrain('detailed')}>{terrainLoading ? 'Loading fine terrain…' : 'Fine · ~170 m'}</button>
        {terrainError && <small role="alert">{terrainError}</small>}
      </div>
      <div className="orbital-sun-control">
        <button aria-pressed={sunlight} onClick={() => setSunlight(value => !value)}>Sunlight {sunlight ? 'on' : 'off'}</button>
        {sunPosition && <small>8 Sep 2026 · CEST<br />{sunPosition.altitude > 0 ? `${Math.round(sunPosition.altitude)}° above horizon · ${Math.round(sunPosition.azimuth)}° bearing` : 'Sun below horizon'}</small>}
      </div>
      <button aria-pressed={drift} onClick={() => { playback.current.drift = !drift; setDrift(!drift) }}>Drift {drift ? 'on' : 'off'}</button>
      <button onClick={() => setReset(n => n + 1)}>Return to orbit</button>
      <button ref={compact ? undefined : focusButton} aria-pressed={focused} aria-keyshortcuts="F" title="Hide controls (F)" onClick={toggleFocus}>Focus view</button>
      <button aria-expanded={about} aria-controls="orbital-notes" onClick={() => { setSettingsOpen(false); setAbout(!about) }}>About this view</button>
    </aside>
  const transportControls = <div className="orbital-legend" role="group" aria-label="Transport types">{ORBITAL_TRANSPORTS.map(mode => <button type="button" key={mode.id} aria-pressed={!hiddenTransports.includes(mode.id)} title={`${hiddenTransports.includes(mode.id) ? 'Show' : 'Hide'} ${mode.label.toLowerCase()}`} style={{ '--swatch': mode.color } as CSSProperties} onClick={() => toggleTransport(mode.id)}>{mode.label}</button>)}</div>
  const playbackControls = <><label>Speed <select value={speed} onChange={e => { const value = Number(e.target.value); playback.current.speed = value; setSpeed(value) }}>{[1, 30, 60, 180, 600].map(n => <option key={n} value={n}>{n}×</option>)}</select></label><label className="orbital-trail">Trails <input aria-label="Trail duration" type="range" min={0} max={600} step={30} value={trail} onChange={e => { const value = Number(e.target.value); playback.current.trail = value; setTrail(value) }} /><output>{trail ? `${trail / 60} min` : 'Off'}</output></label></>
  return <main className={`orbital-view${focused ? ' is-focused' : ''}`}>
    <div className="orbital-canvas" aria-label="An orbital map of Switzerland showing moving public transport services">
      <OrbitalBoundary onError={onLoadError}>{geography && terrain && <Canvas shadows={sunlight} dpr={[1, 1.5]} camera={ORBITAL_CAMERA} gl={ORBITAL_GL} fallback={<div className="orbital-message">This experiment needs WebGL. <a href="?">Return to the atlas</a></div>}>
        <OrbitalScene geography={geography} terrain={terrain} movementSource={movementSource} playback={playback} reset={reset} onStats={onStats} sunlight={sunlight} cityLabels={cityLabels} cameraAltitude={cameraAltitude} snowEnabled={snowEnabled} snowline={snowline} />
      </Canvas>}</OrbitalBoundary>
    </div>
    <div className="orbital-city-labels" ref={cityLabels} aria-hidden="true" />
    <header className="orbital-header" inert={focused} aria-hidden={focused}>
      <div><a className="orbital-back" href="?">← Gleislicht</a><p className="orbital-eyebrow">ORBITAL EXPERIMENT / 01</p><h1>All Switzerland<span>in motion.</span></h1><p className="orbital-subtitle">One country. Every available connection.</p></div>
      <div className="orbital-live"><span className="orbital-pulse" /><strong>{ready ? integer.format(stats.active) : '—'}</strong><span>{hiddenTransports.length ? 'visible services' : 'active services'}</span><small>{ready && stats.fps ? `${stats.fps} FPS` : 'PREPARING ORBIT'}</small><div className="orbital-altitude" title="Approximate height above sea level, calculated from the scene’s vertical scale with the 4.5× terrain exaggeration removed."><span>Camera altitude</span><output ref={cameraAltitude} aria-label="Camera altitude above sea level" aria-live="off">—</output></div></div>
    </header>
    {!ready && <div className="orbital-message" role={error ? 'alert' : 'status'}>{error ? <><h2>We couldn’t load this part of the day.</h2><p>{error}</p><button onClick={() => { cache.current.clear(); setError(''); setAttempt(a => a + 1) }}>Try again</button></> : <><span className="orbital-loader" /><p>Gathering the country’s movements…</p><small>{manifest ? `${orbitalClock(block * 7200)}–${orbitalClock((block + 1) * 7200)} · ${integer.format(manifest.journeyCount)} journeys across the day` : 'National rail, PostBus and regional networks'}</small></>}</div>}
    {!compact && <>{snowControls}{viewControls}</>}
    {about && <section className="orbital-notes" id="orbital-notes"><button className="orbital-close" aria-label="Close about this view" onClick={() => setAbout(false)}>×</button><h2>A country made of journeys</h2><p>{manifest ? integer.format(manifest.journeyCount) : '…'} distinct journey representations from {manifest?.sources.length ?? '…'} public studies. Shared services appear once, using their longest available journey.</p><p>A composite weekday from 4 and 8 September 2026. These are timetable movements, not live positions. Cableways and other frequency services include representative departures.</p><p>Real swisstopo terrain at {terrainDetail === 'detailed' ? 'roughly 170–195' : 'roughly 500–585'}-metre spacing, shown with 4.5× vertical exaggeration. Lake surfaces use approximate terrain-derived levels and stylised moonlight. Lights follow the ground surface, fading out through mapped rail tunnels and back in at their exits. Tunnel passages are approximate matches to OpenStreetMap; coarse Simplon and Gotthard summit paths use projected portal positions. Bridge and cable heights are not surveyed here. Paths follow the source study’s geometry, simplified for this distant view. Unmatched sections retain timetable interpolation. Coverage includes only the available public feeds.</p><p>The adjustable snowline is simulated cover, using ground elevation with a soft boundary and less accumulation on steep slopes. It does not represent observed snow, glaciers or a weather forecast.</p><p>Optional sunlight follows an approximate astronomical sun position for 8 September 2026, using Swiss local time (CEST) at the centre of Switzerland. Warmth and twilight are illustrative clear-sky lighting. Terrain shadows inherit the 4.5× exaggerated relief; weather, atmospheric refraction and local horizon corrections are not modelled.</p><p>Data: opentransportdata.swiss, FOT, ZVV, TPG/SITG and regional publishers; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>; © swisstopo; FOEN lakes.</p><a href="methodology.html" target="_blank" rel="noreferrer">Sources and methodology ↗</a></section>}
    <footer className="orbital-console" inert={focused} aria-hidden={focused}>
      {!compact && <div className="orbital-clock-row"><div><span className="orbital-eyebrow">COMPOSITE WEEKDAY · SWISS LOCAL TIME</span><output className="orbital-time" aria-label="Playback time">{orbitalClock(time)}</output></div>{transportControls}</div>}
      {compact && <div className="orbital-mobile-toolbar"><output className="orbital-time" aria-label="Playback time">{orbitalClock(time)}</output><button disabled={!ready} onClick={togglePlay} aria-label={playing ? 'Pause playback' : 'Play playback'}>{playing ? 'Ⅱ Pause' : '▶ Play'}</button><button ref={focusButton} onClick={toggleFocus}>Focus</button><button aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls="orbital-settings" onClick={() => setSettingsOpen(true)}>Controls</button></div>}
      <div className="orbital-timeline">
        {manifest && <svg viewBox="0 0 1440 42" preserveAspectRatio="none" aria-hidden="true"><path d={rhythmPath} /></svg>}
        <input aria-label="Time of day" aria-valuetext={orbitalClock(time)} type="range" min={0} max={86399} step={60} value={time} onChange={e => seek(Number(e.target.value))} />
        <div className="orbital-hours"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      </div>
      {!compact && <div className="orbital-controls"><button className="orbital-play" disabled={!ready} onClick={togglePlay} aria-label={playing ? 'Pause playback' : 'Play playback'}>{playing ? 'Ⅱ Pause' : '▶ Play'}</button>{playbackControls}<span className="orbital-hint">Drag to explore · scroll to descend</span></div>}
      {compact && <div className="orbital-mobile-caption">Composite weekday · Swiss local time</div>}
    </footer>
    {compact && <dialog ref={settingsDialog} id="orbital-settings" className="orbital-settings" aria-labelledby="orbital-settings-title" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} onClick={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
      <div className="orbital-settings-inner">
        <div className="orbital-settings-heading"><h2 id="orbital-settings-title">View controls</h2><button autoFocus aria-label="Close controls" onClick={() => setSettingsOpen(false)}>Done</button></div>
        <p className="orbital-touch-hint">One finger to orbit · pinch to zoom<br />Two fingers to pan · tap a city to name it</p>
        <section className="orbital-settings-section"><h3>Transport</h3>{transportControls}</section>
        <section className="orbital-settings-section orbital-settings-playback"><h3>Playback</h3>{playbackControls}</section>
        {snowControls}{viewControls}
      </div>
    </dialog>}
    {focused && <button ref={exitFocusButton} className="orbital-exit-focus" aria-label="Exit focus mode" aria-keyshortcuts="Escape F" title="Show controls (Esc)" onClick={toggleFocus}>Show controls</button>}
  </main>
}
