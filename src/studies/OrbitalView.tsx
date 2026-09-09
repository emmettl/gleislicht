import { useUiLanguage } from '../use-ui-language.ts'
import { useUiText } from '../use-ui-text.ts'
import { LANGUAGE_LOCALES, serviceCategoryLabel } from '../i18n.ts'
import { ORBITAL_COPY, type OrbitalCopy } from './orbital-copy.ts'
import { Component, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import OrbitalScene, { type OrbitalGeography, type OrbitalPlayback } from './OrbitalScene.tsx'
import { decodeOrbitalPayload, orbitalBlock, orbitalClock, ORBITAL_TRANSPORTS, type OrbitalChunk, type OrbitalManifest } from './orbital-data.ts'
import { editionDataUrl } from '../editions/data-url.ts'
import type { OrbitalTerrain } from './orbital-terrain.ts'
import { readTerrainDetail, saveTerrainDetail, type TerrainDetail } from './orbital-settings.ts'
import { orbitalSun } from './orbital-sun.ts'
import { decodeCloudField, validateCloudManifest, type CloudManifest, type CloudField } from './orbital-clouds.ts'
import { CLOUD_COPY } from './orbital-cloud-copy.ts'
import './orbital-clouds.css'
import './orbital.css'
import './orbital-flight.css'

class OrbitalBoundary extends Component<{ children: ReactNode; copy: OrbitalCopy; onError?: (message: string) => void }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch() { this.props.onError?.(this.props.copy.failedRestored) }
  render() { return this.state.error ? <div className="orbital-message" role="alert"><h2>{this.props.copy.failed}</h2><p>{this.props.copy.webglHelp}</p><a href="?">{this.props.copy.returnAtlas}</a></div> : this.props.children }
}
async function json<T>(file: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(editionDataUrl(file), { signal })
  if (!response.ok) throw new Error(`Could not load ${file}`)
  return response.json() as Promise<T>
}
const ORBITAL_CAMERA = { position: [0, 39, 24] as [number, number, number], fov: 43, near: 0.1, far: 400 }
const COMPACT_VIEW = '(max-width: 700px), (max-width: 1000px) and (max-height: 500px)'
const ORBITAL_GL = { antialias: true, alpha: false, powerPreference: 'high-performance' as const }
export interface OrbitalViewProps { onReady?: () => void; onLoadError?: (message: string) => void }
export default function OrbitalView({ onReady, onLoadError }: OrbitalViewProps) {
  const [language] = useUiLanguage()
  const copy = ORBITAL_COPY[language], text = useUiText(language)
  const integer = useMemo(() => new Intl.NumberFormat(LANGUAGE_LOCALES[language]), [language])
  const formatAltitude = useCallback((height: number) => copy.altitudeValue.replace('{height}', new Intl.NumberFormat(LANGUAGE_LOCALES[language], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(height)), [copy, language])
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
  const cloudCopy = CLOUD_COPY[language]
  const [cloudsEnabled, setCloudsEnabled] = useState(true)
  const [cloudDate, setCloudDate] = useState('2026-09-04')
  const [cloudOpacity, setCloudOpacity] = useState(0.65)
  const [cloudManifest, setCloudManifest] = useState<CloudManifest>()
  const [cloudField, setCloudField] = useState<CloudField>()
  const [cloudError, setCloudError] = useState(false), [cloudAttempt, setCloudAttempt] = useState(0)
  const cloudCache = useRef(new Map<string, CloudField>())
  const [sunlight, setSunlight] = useState(true)
  const [snowEnabled, setSnowEnabled] = useState(true), [snowline, setSnowline] = useState(2600)
  const cityLabels = useRef<HTMLDivElement>(null)
  const cameraAltitude = useRef<HTMLOutputElement>(null)
  const [manifest, setManifest] = useState<OrbitalManifest>()
  const [geography, setGeography] = useState<OrbitalGeography>()
  const [terrain, setTerrain] = useState<OrbitalTerrain>()
  const [chunk, setChunk] = useState<OrbitalChunk>()
  const [hiddenTransports, setHiddenTransports] = useState<string[]>([])
  const [terrainDetail, setTerrainDetail] = useState<TerrainDetail>('standard')
  const [terrainLoading, setTerrainLoading] = useState(false), [terrainError, setTerrainError] = useState(false)
  const terrainCache = useRef(new Map<string, OrbitalTerrain>())
  const terrainRequest = useRef<AbortController | null>(null)
  const [time, setTime] = useState(27900), [block, setBlock] = useState(3)
  const [playing, setPlaying] = useState(!reduced), [speed, setSpeed] = useState(60), [trail, setTrail] = useState(120)
  const [drift, setDrift] = useState(!reduced), [reset, setReset] = useState(0)
  const [stats, setStats] = useState({ active: 0, fps: 0 })
  const [error, setError] = useState<'dataError' | 'movementError' | ''>(''), [attempt, setAttempt] = useState(0), [about, setAbout] = useState(false)
  const [focused, setFocused] = useState(false)
  const focusButton = useRef<HTMLButtonElement>(null), exitFocusButton = useRef<HTMLButtonElement>(null)
  const wasFocused = useRef(false)
  const cache = useRef(new Map<number, OrbitalChunk>())
  // Keep large typed movement buffers out of React devtools prop diffs.
  const movementSource = useCallback(() => chunk, [chunk])
  const ready = Boolean(terrain && chunk && chunk.start === block * 7200)
  useEffect(() => { if (ready && stats.fps > 0) onReady?.() }, [ready, stats.fps, onReady])
  useEffect(() => { if (error) onLoadError?.(copy[error]) }, [error, copy, onLoadError])
  const rhythmPath = useMemo(() => {
    if (!manifest) return ''
    const peak = Math.max(1, ...manifest.active)
    return `M0,42 ${manifest.active.map((n, i) => `L${i},${42 - n / peak * 38}`).join(' ')} L1440,42Z`
  }, [manifest])
  const selectTerrain = useCallback(async (detail: TerrainDetail) => {
    terrainRequest.current?.abort()
    const controller = new AbortController(); terrainRequest.current = controller
    setTerrainError(false)
    const cached = terrainCache.current.get(detail)
    if (cached) { setTerrain(cached); setTerrainDetail(detail); setTerrainLoading(false); saveTerrainDetail(detail); return }
    setTerrainLoading(true)
    try {
      const result = await json<OrbitalTerrain>(`orbital-terrain${detail === 'detailed' ? '-detailed' : ''}.json`, controller.signal)
      if (result.version !== 1 || result.columns * result.rows !== result.elevations.length || !result.elevations.every(v => Number.isFinite(v) && v >= 0 && v < 6000)) throw new Error('Invalid detailed terrain')
      if (controller.signal.aborted) return
      terrainCache.current.set(detail, result); setTerrain(result); setTerrainDetail(detail); setTerrainLoading(false); saveTerrainDetail(detail)
    } catch { if (!controller.signal.aborted) { setTerrainError(true); setTerrainLoading(false) } }
  }, [])
  useEffect(() => { document.title = copy.pageTitle; document.documentElement.lang = language; document.querySelector('meta[name="description"]')?.setAttribute('content', copy.pageDescription) }, [copy, language])
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      json<OrbitalManifest>('orbital/manifest.json', controller.signal),
      json<{ rings: number[][][] }>('swiss-boundary.json', controller.signal),
      json<{ lakes: OrbitalGeography['lakes'] }>('swiss-lakes.json', controller.signal),
      json<OrbitalTerrain>('orbital-terrain.json', controller.signal),
    ]).then(([m, boundary, lakes, terrainData]) => {
      if (controller.signal.aborted) return
      if (m.version !== 1 || m.chunks.length !== 12) throw new Error('Unsupported orbital data')
      setManifest(m); setTerrain(terrainData); setTerrainDetail('standard'); terrainCache.current.set('standard', terrainData); setGeography({ rings: boundary.rings, lakes: lakes.lakes })
      // Keep standard terrain usable while restoring fine geometry. A failed
      // fine download preserves the saved preference for the next visit.
      void selectTerrain(readTerrainDetail())
    }).catch(() => { if (!controller.signal.aborted) setError('dataError') })
    return () => controller.abort()
  }, [attempt, selectTerrain])
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
    }).catch(() => { if (!controller.signal.aborted) setError('movementError') })
    return () => { controller.abort(); state.ready = false }
  }, [manifest, block, attempt])
  useEffect(() => {
    if (!cloudsEnabled) return
    const controller = new AbortController()
    async function load() {
      const m = cloudManifest ?? validateCloudManifest(await json<CloudManifest>('orbital-clouds/manifest.json', controller.signal))
      if (controller.signal.aborted) return
      setCloudManifest(m)
      const day = m.days.find(day => day.date === cloudDate)
      if (!day?.available) { setCloudField(undefined); return }
      let field = cloudCache.current.get(cloudDate)
      if (!field) {
        const response = await fetch(editionDataUrl(`orbital-clouds/${day.file}`), { signal: controller.signal })
        if (!response.ok) throw new Error('Cloud download failed')
        field = await decodeCloudField(await response.arrayBuffer(), m, day)
        if (controller.signal.aborted) return
        cloudCache.current.set(cloudDate, field)
      }
      setCloudField(field); setCloudError(false)
    }
    void load().catch(() => { if (!controller.signal.aborted) { setCloudField(undefined); setCloudError(true) } })
    return () => controller.abort()
  }, [cloudsEnabled, cloudDate, cloudManifest, cloudAttempt])
  useEffect(() => () => terrainRequest.current?.abort(), [])
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
  const cloudControls = <div className="orbital-cloud-control" role="group" aria-label={cloudCopy.clouds}>
    <button aria-pressed={cloudsEnabled} onClick={() => { setCloudsEnabled(value => !value); setCloudError(false) }}>{cloudCopy.clouds} {cloudsEnabled ? text.on : text.off}</button>
    {cloudsEnabled && <>
      <label htmlFor="orbital-cloud-date">{cloudCopy.date}</label>
      <select id="orbital-cloud-date" value={cloudDate} onChange={event => { setCloudError(false); setCloudField(undefined); setCloudDate(event.target.value) }}>
        {(cloudManifest?.days ?? [{ date: cloudDate, available: true }]).map(day => <option key={day.date} value={day.date}>{new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))}{!day.available ? ` · ${cloudCopy.unavailable}` : ''}</option>)}
      </select>
      <small>CEST · {cloudCopy.source}</small>
      {cloudManifest?.days.find(day => day.date === cloudDate)?.available === false ? <small role="status">{cloudCopy.unavailable}</small> : cloudError ? <small role="alert">{cloudCopy.error} <button onClick={() => { setCloudError(false); setCloudAttempt(value => value + 1) }}>{copy.retry}</button></small> : cloudField?.day.date !== cloudDate ? <small role="status">{cloudCopy.loading}</small> : <>
        <label htmlFor="orbital-cloud-opacity">{cloudCopy.opacity} <output>{integer.format(Math.round(cloudOpacity * 100))}%</output></label>
        <input id="orbital-cloud-opacity" type="range" min={0.15} max={0.9} step={0.05} value={cloudOpacity} onChange={event => setCloudOpacity(Number(event.target.value))} />
        <small>{cloudCopy.detail}</small>
      </>}
    </>}
  </div>
  const snowControls = <div className="orbital-snow-control" inert={focused} aria-hidden={focused} role="group" aria-label={copy.snowCover}>
      <button aria-pressed={snowEnabled} onClick={() => setSnowEnabled(value => !value)}>{copy.snow}{' '}{snowEnabled ? text.on : text.off}</button>
      <label htmlFor="orbital-snowline">{copy.snowline}{' '}<output>{integer.format(snowline)} m</output></label>
      <input id="orbital-snowline" aria-label={copy.snowlineAltitude} aria-valuetext={copy.metresAboveSea.replace('{height}', integer.format(snowline))} type="range" min={800} max={4200} step={100} value={snowline} disabled={!snowEnabled} onChange={event => setSnowline(Number(event.target.value))} />
      <small>{copy.simulatedCover}</small>
      {cloudControls}
    </div>
  const viewControls = <aside className="orbital-side" inert={focused} aria-hidden={focused} aria-label={copy.viewControls}>
      <div className="orbital-detail" role="group" aria-label={copy.mountainDetail}>
        <span>{copy.mountainDetail}</span>
        <button disabled={!terrain} aria-pressed={terrainDetail === 'standard'} onClick={() => void selectTerrain('standard')}>{copy.standard}</button>
        <button disabled={!terrain} aria-pressed={terrainDetail === 'detailed'} onClick={() => void selectTerrain('detailed')}>{terrainLoading ? copy.loadingFine : copy.fine}</button>
        {terrainError && <small role="alert">{copy.fineError}</small>}
      </div>
      <div className="orbital-sun-control">
        <button aria-pressed={sunlight} onClick={() => setSunlight(value => !value)}>{copy.sunlight}{' '}{sunlight ? text.on : text.off}</button>
        {sunPosition && <small>{new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { dateStyle: 'medium', timeZone: 'Europe/Zurich' }).format(new Date('2026-09-08T12:00:00Z'))} · CEST<br />{sunPosition.altitude > 0 ? copy.sunPosition.replace('{altitude}', integer.format(Math.round(sunPosition.altitude))).replace('{azimuth}', integer.format(Math.round(sunPosition.azimuth))) : copy.sunBelow}</small>}
      </div>
      <button aria-pressed={drift} onClick={() => { playback.current.drift = !drift; setDrift(!drift) }}>{copy.drift}{' '}{drift ? text.on : text.off}</button>
      <button onClick={() => setReset(n => n + 1)}>{copy.returnOrbit}</button>
      <button ref={compact ? undefined : focusButton} aria-pressed={focused} aria-keyshortcuts="F" title={copy.hideControls} onClick={toggleFocus}>{copy.focusView}</button>
      <button aria-expanded={about} aria-controls="orbital-notes" onClick={() => { setSettingsOpen(false); setAbout(!about) }}>{copy.about}</button>
    </aside>
  const transportControls = <div className="orbital-legend" role="group" aria-label={copy.transportTypes}>{ORBITAL_TRANSPORTS.map(mode => <button type="button" key={mode.id} aria-pressed={!hiddenTransports.includes(mode.id)} title={(hiddenTransports.includes(mode.id) ? copy.show : copy.hide).replace('{mode}', mode.id === 'rail' || mode.id === 'boat' ? copy[mode.id] : serviceCategoryLabel(language, mode.id))} style={{ '--swatch': mode.color } as CSSProperties} onClick={() => toggleTransport(mode.id)}>{mode.id === 'rail' || mode.id === 'boat' ? copy[mode.id] : serviceCategoryLabel(language, mode.id)}</button>)}</div>
  const playbackControls = <><label>{copy.speed}{' '}<select value={speed} onChange={e => { const value = Number(e.target.value); playback.current.speed = value; setSpeed(value) }}>{[1, 30, 60, 180, 600].map(n => <option key={n} value={n}>{n}×</option>)}</select></label><label className="orbital-trail">{copy.trails}{' '}<input aria-label={copy.trailDuration} type="range" min={0} max={600} step={30} value={trail} onChange={e => { const value = Number(e.target.value); playback.current.trail = value; setTrail(value) }} /><output>{trail ? `${integer.format(trail / 60)} min` : text.off}</output></label></>
  return <main className={`orbital-view${focused ? ' is-focused' : ''}`}>
    <div className="orbital-canvas" aria-label={copy.pageDescription}>
      <OrbitalBoundary copy={copy} onError={onLoadError}>{geography && terrain && <Canvas shadows={sunlight} dpr={[1, 1.5]} camera={ORBITAL_CAMERA} gl={ORBITAL_GL} fallback={<div className="orbital-message">{copy.webglRequired}{' '}<a href="?">{copy.returnAtlas}</a></div>}>
        <OrbitalScene geography={geography} terrain={terrain} movementSource={movementSource} playback={playback} reset={reset} onStats={onStats} sunlight={sunlight} cityLabels={cityLabels} cameraAltitude={cameraAltitude} snowEnabled={snowEnabled} snowline={snowline} formatAltitude={formatAltitude} cloudField={cloudsEnabled && cloudField?.day.date === cloudDate ? cloudField : undefined} cloudOpacity={cloudOpacity} />
      </Canvas>}</OrbitalBoundary>
    </div>
    <div className="orbital-city-labels" ref={cityLabels} aria-hidden="true" />
    <header className="orbital-header" inert={focused} aria-hidden={focused}>
      <div><a className="orbital-back" href="?">← Gleislicht</a><p className="orbital-eyebrow">{copy.experiment}</p><h1>{copy.country}<span>{copy.inMotion}</span></h1><p className="orbital-subtitle">{copy.subtitle}</p></div>
      <div className="orbital-live"><span className="orbital-pulse" /><strong>{ready ? integer.format(stats.active) : '—'}</strong><span>{hiddenTransports.length ? copy.visibleServices : copy.activeServices}</span><small>{ready && stats.fps ? `${stats.fps} FPS` : copy.preparing}</small><div className="orbital-altitude" title={copy.altitudeHelp}><span>{copy.cameraAltitude}</span><output ref={cameraAltitude} aria-label={copy.cameraAltitudeSea} aria-live="off">—</output></div></div>
    </header>
    {!ready && <div className="orbital-message" role={error ? 'alert' : 'status'}>{error ? <><h2>{copy.loadFailed}</h2><p>{copy[error]}</p><button onClick={() => { cache.current.clear(); setError(''); setAttempt(a => a + 1) }}>{copy.retry}</button></> : <><span className="orbital-loader" /><p>{copy.gathering}</p><small>{manifest ? `${orbitalClock(block * 7200)}–${orbitalClock((block + 1) * 7200)} · ${copy.journeysDay.replace('{count}', integer.format(manifest.journeyCount))}` : copy.networks}</small></>}</div>}
    {!compact && <>{snowControls}{viewControls}</>}
    {about && <section className="orbital-notes" id="orbital-notes"><button className="orbital-close" aria-label={copy.closeAbout} onClick={() => setAbout(false)}>×</button><h2>{copy.aboutTitle}</h2><p>{copy.aboutJourneys.replace('{journeys}', manifest ? integer.format(manifest.journeyCount) : '…').replace('{studies}', manifest ? integer.format(manifest.sources.length) : '…')}</p><p>{copy.aboutTimetable}</p><p>{copy.aboutTerrain.replace('{spacing}', terrainDetail === 'detailed' ? '170–195' : '500–585')}</p><p>{copy.aboutSnow}</p><p>{copy.aboutSun}</p><p>{cloudCopy.about} <a href="https://opendatadocs.meteoswiss.ch/c-climate-data/c4-satellite-based-climate-data" target="_blank" rel="noreferrer">{cloudCopy.credit}</a>.</p><p>{copy.dataCredit}{' '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{text.osmCredit}</a>; © swisstopo; {copy.lakeCredit}.</p><a href="methodology.html" target="_blank" rel="noreferrer">{copy.sources} ↗</a></section>}
    <footer className="orbital-console" inert={focused} aria-hidden={focused}>
      {!compact && <div className="orbital-clock-row"><div><span className="orbital-eyebrow">{copy.weekday}</span><output className="orbital-time" aria-label={copy.playbackTime}>{orbitalClock(time)}</output></div>{transportControls}</div>}
      {compact && <div className="orbital-mobile-toolbar"><output className="orbital-time" aria-label={copy.playbackTime}>{orbitalClock(time)}</output><button disabled={!ready} onClick={togglePlay} aria-label={playing ? copy.pausePlayback : copy.playPlayback}>{playing ? `Ⅱ ${copy.pause}` : `▶ ${copy.play}`}</button><button ref={focusButton} onClick={toggleFocus}>{copy.focus}</button><button aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls="orbital-settings" onClick={() => setSettingsOpen(true)}>{copy.controls}</button></div>}
      <div className="orbital-timeline">
        {manifest && <svg viewBox="0 0 1440 42" preserveAspectRatio="none" aria-hidden="true"><path d={rhythmPath} /></svg>}
        <input aria-label={text.timeOfDay} aria-valuetext={orbitalClock(time)} type="range" min={0} max={86399} step={60} value={time} onChange={e => seek(Number(e.target.value))} />
        <div className="orbital-hours"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      </div>
      {!compact && <div className="orbital-controls"><button className="orbital-play" disabled={!ready} onClick={togglePlay} aria-label={playing ? copy.pausePlayback : copy.playPlayback}>{playing ? `Ⅱ ${copy.pause}` : `▶ ${copy.play}`}</button>{playbackControls}<span className="orbital-hint">{copy.dragHint}</span></div>}
      {compact && <div className="orbital-mobile-caption">{copy.weekday}</div>}
    </footer>
    {compact && <dialog ref={settingsDialog} id="orbital-settings" className="orbital-settings" aria-labelledby="orbital-settings-title" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} onClick={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
      <div className="orbital-settings-inner">
        <div className="orbital-settings-heading"><h2 id="orbital-settings-title">{copy.viewControls}</h2><button autoFocus aria-label={copy.closeControls} onClick={() => setSettingsOpen(false)}>{copy.done}</button></div>
        <p className="orbital-touch-hint">{copy.touchOrbit}<br />{copy.touchPan}</p>
        <section className="orbital-settings-section"><h3>{copy.transport}</h3>{transportControls}</section>
        <section className="orbital-settings-section orbital-settings-playback"><h3>{copy.playback}</h3>{playbackControls}</section>
        {snowControls}{viewControls}
      </div>
    </dialog>}
    {focused && <button ref={exitFocusButton} className="orbital-exit-focus" aria-label={copy.exitFocus} aria-keyshortcuts="Escape F" title={copy.showControlsHint} onClick={toggleFocus}>{copy.showControls}</button>}
  </main>
}
