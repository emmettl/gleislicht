import { editionDataUrl } from '../editions/data-url.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { jungfrauAscents, ascentPhase, ascentFocus } from './jungfrau-ascent.ts'
import { JUNGFRAU_JOURNEY_COPY } from './jungfrau-journey-copy.ts'
import { bindJungfrauTerrain, jungfrauTerrainPosition, railPoint, railSamples, type JungfrauTerrainBinding } from './jungfrau-terrain.ts'
import { JUNGFRAU_TERRAIN_COPY } from './jungfrau-terrain-copy.ts'
import './jungfrau-journey.css'
type Props = { network: NetworkSnapshot; language: UiLanguage; time: number; onSeek: (time: number) => void; onFollow: (trainId: string | undefined, station: string | undefined) => void; onFinish: () => void; onExit: () => void; onTerrain: (binding: JungfrauTerrainBinding | undefined) => void }
export default function JungfrauAscent({ network, language, time, onSeek, onFollow, onFinish, onExit, onTerrain }: Props) {
  const copy = JUNGFRAU_JOURNEY_COPY[language], stages = useRef<HTMLElement>(null)
  const choices = useMemo(() => jungfrauAscents(network), [network]), [id, setId] = useState<string>()
  const selected = choices.find(s => s.id === id) ?? choices.reduce((best, s) => Math.abs(s.start-43200) < Math.abs(best.start-43200) ? s : best, choices[0])
  const [itineraryOpen, setItineraryOpen] = useState(false)
  const terrainCopy = JUNGFRAU_TERRAIN_COPY[language]
  const [terrainWanted, setTerrainWanted] = useState(false), [terrainData, setTerrainData] = useState<{ value: unknown }>(), [terrainError, setTerrainError] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!terrainWanted || terrainData) return
    const controller = new AbortController()
    fetch(editionDataUrl('jungfrau-ascent-terrain.json'), { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Terrain unavailable')
      return response.json()
    }).then(value => setTerrainData({ value })).catch(error => { if (error.name !== 'AbortError') setTerrainError(true) })
    return () => controller.abort()
  }, [terrainWanted, terrainData, attempt])
  const terrain = useMemo(() => selected && terrainData ? bindJungfrauTerrain(terrainData.value, network, selected) : undefined, [terrainData, network, selected])
  useEffect(() => { onTerrain(terrainWanted ? terrain : undefined); return () => onTerrain(undefined) }, [terrain, terrainWanted, onTerrain])
  const terrainPosition = terrainWanted && terrain ? jungfrauTerrainPosition(terrain,time) : undefined
  const terrainVisible = terrainWanted && terrain?.windows.some(w => time >= w.start && time < w.end)
  const railHeight = terrainPosition ? Math.round(railPoint(terrainPosition.route.points,railSamples(terrainPosition.route.points),terrainPosition.progress)[2]) : undefined
  const failed = terrainError || Boolean(terrainData && !terrain)
  const phase = selected ? ascentPhase(selected, time) : undefined
  useEffect(() => { if (selected) onSeek(selected.start) }, [selected, onSeek])
  useEffect(() => {
    if (!selected || !phase) { onFollow(undefined, undefined); return }
    const focus = ascentFocus(selected, phase); onFollow(focus.trainId, focus.station)
    if (phase === 'complete') onFinish()
  }, [selected, phase, onFollow, onFinish])
  useEffect(() => {
    const current = stages.current?.querySelector<HTMLElement>('[aria-current="step"]')
    if (current && stages.current) stages.current.scrollLeft = current.offsetLeft-stages.current.offsetLeft-(stages.current.clientWidth-current.clientWidth)/2
  }, [phase])
  return <section className="journey-card jungfrau-ascent" aria-label={copy.title} data-phase={phase} data-compact={terrainWanted && !itineraryOpen}>
    <header><h2>{copy.title}</h2>{terrainWanted && <button type="button" aria-label={terrainCopy.details} aria-expanded={itineraryOpen} onClick={() => setItineraryOpen(value => !value)}>≡</button>}<button type="button" onClick={onExit} aria-label={copy.exit}>×</button></header>
    {!selected ? <p role="status">{copy.unavailable}</p> : <>
      <label>{copy.departure}<select value={selected.id} onChange={event => setId(event.target.value)}>{choices.map(s => <option key={s.id} value={s.id}>{formatServiceTime(s.start)} → {formatServiceTime(s.end)}</option>)}</select></label>
      <p className="ascent-date">{network.metadata.serviceDate} · {copy.scheduled}</p>
      <nav ref={stages} className="jungfrau-ascent-stages" aria-label={copy.title}>{selected.legs.flatMap((leg,i) => [
        <button key={`leg-${i}`} type="button" data-stage={`leg-${i}`} aria-current={phase === `leg-${i}` ? 'step' : undefined} onClick={() => onSeek(leg.departure)}><span>{leg.train.route} · {leg.train.shortName}</span><strong>{formatServiceTime(leg.departure)} → {formatServiceTime(leg.arrival)}</strong><small>{leg.from} → {leg.to}</small></button>,
        ...(selected.waits[i] ? [<button key={`wait-${i}`} type="button" data-stage={`wait-${i}`} aria-current={phase === `wait-${i}` ? 'step' : undefined} onClick={() => onSeek(leg.arrival)}><span>{copy.change} {leg.to}</span><strong>{(selected.waits[i].end-selected.waits[i].start)/60} {copy.minutes}</strong></button>] : []),
      ])}</nav>
      <p className="ascent-status" role="status">{phase === 'before' ? copy.before : phase === 'complete' ? copy.complete : phase?.startsWith('wait-') ? `${copy.change} ${selected.legs[Number(phase.slice(5))].to}` : selected.legs[Number(phase?.slice(4))]?.operator}</p>
      <div className="jungfrau-terrain-control">
        <button className="jungfrau-start" type="button" aria-pressed={terrainWanted} onClick={() => { setTerrainError(false); setTerrainWanted(value => !value) }}>{terrainWanted ? terrainCopy.hide : terrainCopy.show}</button>
        {terrainPosition && <p className="terrain-leg-label">{terrainPosition.from}{terrainPosition.from !== terrainPosition.to ? ` → ${terrainPosition.to}` : ''}</p>}
        {terrainWanted && <p role="status" data-terrain-status={failed ? 'error' : !terrain ? 'loading' : terrainVisible ? 'outdoor' : terrainPosition?.mask?.reason ?? 'wait'}>{failed ? terrainCopy.error : !terrain ? terrainCopy.loading : terrainVisible ? terrainCopy.outdoor : terrainCopy[terrainPosition?.mask?.reason ?? 'wait']}</p>}
        {terrainWanted && failed && <button className="jungfrau-start" onClick={() => { setTerrainError(false); setTerrainData(undefined); setAttempt(n => n+1) }}>{terrainCopy.retry}</button>}
        {terrainWanted && terrain && <details><summary>{terrainCopy.sources}{railHeight !== undefined ? ` · ${railHeight.toLocaleString(language)} m` : ''}</summary><p>{terrainCopy.model}</p>{railHeight !== undefined && <p>{terrainCopy.elevation}: {railHeight.toLocaleString(language)} m (LN02)</p>}<p>© swisstopo · swissALTIRegio {terrain.data.metadata.terrainRelease} · swissTLM3D 2026-02</p><a href="./methodology.html#jungfrau-terrain" target="_blank" rel="noreferrer">{terrainCopy.sources} ↗</a></details>}
      </div>
      <p>{copy.note}</p>
      <details><summary>{copy.sources}</summary><p>{copy.lauterbrunnen}</p><p>{copy.scheidegg}</p><p>{copy.booking}</p><p>{terrainWanted && terrain ? terrainCopy.model : copy.model}</p><a href="./methodology.html#jungfrau-ascent" target="_blank" rel="noreferrer">{copy.sources} ↗</a> · <a href="https://www.jungfrau.ch/en-gb/arriving/" target="_blank" rel="noreferrer">{copy.operator} ↗</a></details>
      {phase === 'complete' && <button type="button" className="jungfrau-start" onClick={() => onSeek(selected.start)}>{copy.replay} ↻</button>}
    </>}
  </section>
}
