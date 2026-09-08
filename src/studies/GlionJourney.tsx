import {useEffect, useMemo, useRef, useState} from 'react'
import {formatServiceTime, type NetworkSnapshot} from '@motionstudies/core/domain/network'
import type {UiLanguage} from '../i18n.ts'
import {glionDirection, glionJourneys, glionPhase} from './glion.ts'
import type {StudyLink} from './explore.ts'
import {TERRITET_COPY} from './territet-copy.ts'
import {GLION_COPY} from './glion-copy.ts'
import type {TerritetDirection} from './territet.ts'

export default function GlionJourney({initialLink, funicular, railwayUrl, language, time, onNetwork, onSeek, onFollow, onFinish, onExit}: {
 initialLink?: StudyLink;
 funicular: NetworkSnapshot; railwayUrl: string; language: UiLanguage; time: number;
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
 return <section className="journey-card territet-journey glion-journey" aria-label={copy[direction]} data-phase={phase} data-direction={direction} data-expanded={expanded}>
  <header><h2>{copy[direction]}</h2><button className="territet-details-toggle" aria-label={common.details} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>≡</button><button onClick={onExit} aria-label={common.exit}>×</button></header>
  <label>{common.direction}<select value={direction} onChange={e => {setDirection(e.target.value as TerritetDirection); setId(undefined)}}><option value="ascent">{copy.ascent}</option><option value="descent">{copy.descent}</option></select></label>
  {!c || !network ? <><p role="status">{phase === 'loading' ? copy.loading : copy.unavailable}</p>{phase === 'unavailable' && <button className="corridor-entry" onClick={() => {setRailway(undefined); setFailed(false); setAttempt(n => n + 1)}}>{copy.retry}</button>}</> : <>
   <label>{common.departure}<select value={c.railwayTripId} onChange={e => setId(e.target.value)}>{choices.map(j => <option key={j.connection.railwayTripId} value={j.connection.railwayTripId}>{formatServiceTime(j.connection.start)} → {formatServiceTime(j.connection.end)}</option>)}</select></label>
   <p>{network.metadata.serviceDate} · MVR · {network.trains.map(t => t.shortName).join(' → ')}</p>
   <nav ref={nav} aria-label={common.guide}>{calls.map((call, i) => <button key={`${i}-${call.id}`} aria-current={active === i ? 'step' : undefined} onClick={() => {onSeek(call.seek); setExpanded(false)}}><strong>{call.name}</strong><span>{formatServiceTime(call.arrival)}{call.arrival !== call.departure ? ` → ${formatServiceTime(call.departure)}` : ''}</span></button>)}</nav>
   <p role="status">{phase === 'complete' ? `${common.arrived} · ${calls.at(-1)?.name}` : phase === 'before' ? common.before : phase === 'interchange' ? `${copy.interchange} · ${copy.remaining} ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : `${phase === 'first-leg' ? copy.first : copy.second} · ${network.trains[phase === 'first-leg' ? 0 : 1].route}`}</p>
   <div className="glion-transfer"><button onClick={() => {onSeek(c.transfer.arrival); setExpanded(false)}}>{copy.interchange} · {formatServiceTime(c.transfer.arrival)} → {formatServiceTime(c.transfer.departure)}</button><span>{copy.minimum} · {copy.scheduled}</span></div>
   <details><summary>{copy.evidence}</summary><p>{copy.path}</p><p>{copy.access}</p><a href="./methodology.html#glion" target="_blank" rel="noreferrer">{copy.evidence} ↗</a> · <a href="https://support.mob.ch/hc/en-ch/articles/15555078258845-Access-information-for-our-funiculars" target="_blank" rel="noreferrer">MOB ↗</a></details>
   {phase === 'complete' && <button className="corridor-entry" onClick={() => onSeek(c.start)}>{common.replay} ↻</button>}
  </>}
 </section>
}
