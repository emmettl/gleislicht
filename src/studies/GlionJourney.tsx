import {useEffect, useMemo, useRef, useState} from 'react'
import {formatServiceTime, type NetworkSnapshot} from '@motionstudies/core/domain/network'
import type {UiLanguage} from '../i18n.ts'
import {glionDirection, glionJourneys, glionPhase} from './glion.ts'
import type {StudyLink} from './explore.ts'
import {TERRITET_COPY} from './territet-copy.ts'
import {GLION_COPY} from './glion-copy.ts'
import {bindGlionTerrain} from './glion-terrain.ts'
import {measuredTerrainPosition, railPoint, railSamples, type MeasuredTerrainBinding} from './measured-terrain.ts'
import {measuredTerrainCopy} from './measured-terrain-copy.ts'
import type {TerritetDirection} from './territet.ts'

export default function GlionJourney({initialLink, funicular, railwayUrl, terrainUrl, language, time, onNetwork, onSeek, onFollow, onFinish, onExit, onTerrain}: {
 initialLink?: StudyLink;
 onTerrain: (binding: MeasuredTerrainBinding | undefined) => void;
 funicular: NetworkSnapshot; railwayUrl: string; terrainUrl: string; language: UiLanguage; time: number;
 onNetwork: (network: NetworkSnapshot | undefined) => void; onSeek: (time: number) => void;
 onFollow: (id: string | undefined, station: string | undefined) => void; onFinish: () => void; onExit: () => void;
}) {
 const copy = GLION_COPY[language], common = TERRITET_COPY[language]
 const [railway, setRailway] = useState<NetworkSnapshot>(), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0)
 const [direction, setDirection] = useState<TerritetDirection>(glionDirection(initialLink?.glion) ?? 'ascent'), [id, setId] = useState<string | undefined>(initialLink?.glion), [expanded, setExpanded] = useState(false)
 const initialSeek = useRef(true)
 const nav = useRef<HTMLElement>(null)
 useEffect(() => {
  const controller = new AbortController()
  void fetch(railwayUrl, {signal: controller.signal}).then(response => {
   if (!response.ok) throw new Error('Summit request failed')
   return response.json() as Promise<NetworkSnapshot>
  }).then(snapshot => {if (!controller.signal.aborted) setRailway(snapshot)}).catch(() => {if (!controller.signal.aborted) setFailed(true)})
  return () => controller.abort()
 }, [railwayUrl, attempt])
 const choices = useMemo(() => railway ? glionJourneys(funicular, railway, direction) : [], [funicular, railway, direction])
 const selected = id ? choices.find(j => j.connection.railwayTripId === id) : choices.reduce<typeof choices[number] | undefined>((a, b) => !a || Math.abs(b.connection.start - 43200) < Math.abs(a.connection.start - 43200) ? b : a, undefined)
 const c = selected?.connection, network = selected?.network, phase = c ? glionPhase(c, time) : failed || railway ? 'unavailable' : 'loading'
 const terrainCopy = {...measuredTerrainCopy(language, 42), error: copy.terrainError}
 const [terrainWanted, setTerrainWanted] = useState(false), [terrainData, setTerrainData] = useState<{value: unknown}>(), [terrainError, setTerrainError] = useState(false), [terrainAttempt, setTerrainAttempt] = useState(0)
 useEffect(() => {
  if (!terrainWanted || terrainData) return
  const controller = new AbortController()
  void fetch(terrainUrl, {signal: controller.signal}).then(response => {
   if (!response.ok) throw new Error('Terrain unavailable')
   return response.json() as Promise<unknown>
  }).then(value => {if (!controller.signal.aborted) setTerrainData({value})}).catch(() => {if (!controller.signal.aborted) setTerrainError(true)})
  return () => controller.abort()
 }, [terrainWanted, terrainData, terrainUrl, terrainAttempt])
 const terrain = useMemo(() => c && railway && terrainData ? bindGlionTerrain(terrainData.value, funicular, railway, c.railwayTripId) : undefined, [c, railway, terrainData, funicular])
 useEffect(() => {onTerrain(terrainWanted ? terrain : undefined); return () => onTerrain(undefined)}, [terrain, terrainWanted, onTerrain])
 const terrainPosition = terrainWanted && terrain ? measuredTerrainPosition(terrain, time) : undefined
 const terrainVisible = terrainWanted && terrain?.windows.some(w => time >= w.start && time < w.end)
 const terrainFailed = terrainError || Boolean(terrainData && !terrain)
 const railHeight = terrainPosition ? Math.round(railPoint(terrainPosition.route.points, railSamples(terrainPosition.route.points), terrainPosition.progress)[2]) : undefined
 const terrainStatus = terrainFailed ? 'error' : !terrain ? 'loading' : phase === 'interchange' ? 'interchange' : phase === 'complete' ? 'complete' : phase === 'before' ? 'before' : !terrainPosition ? 'funicular' : terrainVisible ? 'outdoor' : terrainPosition.mask?.reason ?? 'wait'

 useEffect(() => {
  onNetwork(network)
  if (c) {
   const linkedTime = initialSeek.current && (!initialLink?.date || initialLink.date === network?.metadata.serviceDate) ? initialLink?.time : undefined
   initialSeek.current = false
   onSeek(linkedTime === undefined ? c.start : Math.max(c.start, Math.min(c.end, linkedTime)))
  }
 }, [network, c, initialLink, onNetwork, onSeek])
 useEffect(() => {
  const train = phase === 'first-leg' ? network?.trains[0] : phase === 'second-leg' ? network?.trains[1] : undefined
  // No vehicle is followed during the interchange. Both source stops remain on the map.
  onFollow(train?.id, undefined)
  if (phase === 'complete') onFinish()
 }, [network, phase, onFollow, onFinish])
 const calls = network?.trains.flatMap(t => t.stops.map(([i, a, d], index) => ({name: network.stops[i][2], id: network.stops[i][4], arrival: a, departure: d, seek: index === 0 ? d : a}))) ?? []
 const active = calls.reduce((last, call, index) => time >= call.seek ? index : last, -1)
 useEffect(() => {
  const current = nav.current?.querySelector<HTMLElement>('[aria-current="step"]')
  if (current && nav.current) nav.current.scrollLeft = current.offsetLeft - nav.current.offsetLeft - (nav.current.clientWidth - current.clientWidth) / 2
 }, [active])
 const countdown = c ? Math.max(0, Math.ceil(c.transfer.departure - time)) : 0
 return <section className="journey-card territet-journey glion-journey" aria-label={copy[direction]} data-phase={phase} data-direction={direction} data-expanded={expanded} data-terrain-wanted={terrainWanted} data-compact={terrainWanted && !expanded}>
  <header><h2>{copy[direction]}</h2><button className="territet-details-toggle" aria-label={common.details} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>≡</button><button onClick={onExit} aria-label={common.exit}>×</button></header>
  <label>{common.direction}<select value={direction} onChange={e => {setDirection(e.target.value as TerritetDirection); setId(undefined)}}><option value="ascent">{copy.ascent}</option><option value="descent">{copy.descent}</option></select></label>
  {!c || !network ? <><p role="status">{phase === 'loading' ? copy.loading : copy.unavailable}</p>{phase === 'unavailable' && <button className="corridor-entry" onClick={() => {setRailway(undefined); setFailed(false); setAttempt(n => n + 1)}}>{copy.retry}</button>}</> : <>
   <label>{common.departure}<select value={c.railwayTripId} onChange={e => setId(e.target.value)}>{choices.map(j => <option key={j.connection.railwayTripId} value={j.connection.railwayTripId}>{formatServiceTime(j.connection.start)} → {formatServiceTime(j.connection.end)}</option>)}</select></label>
   <p>{network.metadata.serviceDate} · MVR · {network.trains.map(t => t.shortName).join(' → ')}</p>
   <nav ref={nav} aria-label={common.guide}>{calls.map((call, i) => <button key={`${i}-${call.id}`} aria-current={active === i ? 'step' : undefined} onClick={() => {onSeek(call.seek); setExpanded(false)}}><strong>{call.name}</strong><span>{formatServiceTime(call.arrival)}{call.arrival !== call.departure ? ` → ${formatServiceTime(call.departure)}` : ''}</span></button>)}</nav>
   <p role="status">{phase === 'complete' ? `${common.arrived} · ${calls.at(-1)?.name}` : phase === 'before' ? common.before : phase === 'interchange' ? `${copy.interchange} · ${copy.remaining} ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : `${phase === 'first-leg' ? copy.first : copy.second} · ${network.trains[phase === 'first-leg' ? 0 : 1].route}`}</p>
   <div className="glion-terrain-control">
    <button className="glion-terrain-button" aria-pressed={terrainWanted} onClick={() => {setTerrainError(false); setTerrainWanted(v => !v)}}>{terrainWanted ? terrainCopy.hide : terrainCopy.show}</button>
    {terrainPosition && <p className="terrain-leg-label">{terrainPosition.from}{terrainPosition.from !== terrainPosition.to ? ` → ${terrainPosition.to}` : ''}</p>}
    {terrainWanted && <p role="status" data-terrain-status={terrainStatus}>{terrainStatus === 'error' ? terrainCopy.error : terrainStatus === 'loading' ? terrainCopy.loading : terrainStatus === 'interchange' ? copy.interchange : terrainStatus === 'funicular' ? copy.funicularMap : terrainStatus === 'complete' ? common.arrived : terrainStatus === 'before' ? common.before : terrainCopy[terrainStatus]}</p>}
    {terrainWanted && terrainFailed && <button className="glion-terrain-button" onClick={() => {setTerrainError(false); setTerrainData(undefined); setTerrainAttempt(n => n + 1)}}>{terrainCopy.retry}</button>}
    {terrainWanted && terrain && <details><summary>{terrainCopy.sources}{railHeight !== undefined ? ` · ${railHeight.toLocaleString(language)} m` : ''}</summary><p>{terrainCopy.model}</p>{railHeight !== undefined && <p>{terrainCopy.elevation}: {railHeight.toLocaleString(language)} m (LN02)</p>}<p>© swisstopo · swissALTIRegio {terrain.data.metadata.terrainRelease} · swissTLM3D 2026-02</p><a href="./methodology.html#glion-terrain" target="_blank" rel="noreferrer">{terrainCopy.sources} ↗</a></details>}
   </div>
   <div className="glion-transfer"><button onClick={() => {onSeek(c.transfer.arrival); setExpanded(false)}}>{copy.interchange} · {formatServiceTime(c.transfer.arrival)} → {formatServiceTime(c.transfer.departure)}</button><span>{copy.minimum} · {copy.scheduled}</span></div>
   <details><summary>{copy.evidence}</summary><p>{copy.path}</p><p>{copy.access}</p><a href="./methodology.html#glion" target="_blank" rel="noreferrer">{copy.evidence} ↗</a> · <a href="https://support.mob.ch/hc/en-ch/articles/15555078258845-Access-information-for-our-funiculars" target="_blank" rel="noreferrer">MOB ↗</a></details>
   {phase === 'complete' && <button className="corridor-entry" onClick={() => onSeek(c.start)}>{common.replay} ↻</button>}
  </>}
 </section>
}
