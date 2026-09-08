import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { rigiSequences, sequenceFocus, sequencePhase, type RigiSequenceRoute } from './rigi-sequence.ts'
import { SEQUENCE_COPY } from './rigi-sequence-copy.ts'
import './rigi-sequence.css'
import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import { editionDataUrl } from '../editions/data-url.ts'
import { bindRigiTerrain, rigiTerrainPosition, type RigiTerrainBinding } from './rigi-timetable-terrain.ts'
const TerrainProfile = lazy(() => import('./RigiTerrainProfile.tsx'))

type Props = {
  network: NetworkSnapshot; time: number; language: UiLanguage
  onSeek: (time: number) => void
  onFollow: (trainId: string | undefined, station: string | undefined) => void
  onTimetableTerrain: (binding: RigiTerrainBinding | undefined) => void
  onExit: () => void; onTerrain: () => void
}
export default function RigiSequence({ network, time, language, onSeek, onFollow, onExit, onTerrain, onTimetableTerrain }: Props) {
  const [terrainWanted, setTerrainWanted] = useState(false)
  const [terrain, setTerrain] = useState<CorridorSnapshot>()
  const [terrainError, setTerrainError] = useState(false)
  const [terrainAttempt, setTerrainAttempt] = useState(0)
  const [route, setRoute] = useState<RigiSequenceRoute>('vitznau')
  const choices = useMemo(() => rigiSequences(network, route), [network, route])
  const [id, setId] = useState<string>()
  const selected = choices.find(item => item.id === id) ?? choices.reduce((best, item) => Math.abs(item.start - 43200) < Math.abs(best.start - 43200) ? item : best, choices[0])
  const copy = SEQUENCE_COPY[language], stages = useRef<HTMLElement>(null)
  const pier = selected?.cable ? 'Weggis' : 'Vitznau'
  const railOrigin = selected?.cable ? 'Rigi Kaltbad' : 'Vitznau'
  const phase = selected ? sequencePhase(selected, time) : undefined
  useEffect(() => { if (selected) onSeek(selected.start) }, [selected, onSeek])
  const binding = useMemo(() => terrain && selected ? bindRigiTerrain(terrain, network, selected) : undefined, [terrain, network, selected])
  const inRail = phase === 'rail' || phase === 'complete' && selected && time === selected.end
  const inTerrain = terrainWanted && binding && inRail
  const terrainPosition = inTerrain ? rigiTerrainPosition(binding, time) : undefined
  useEffect(() => {
    if (!terrainWanted || terrain) return
    const controller = new AbortController()
    fetch(editionDataUrl('vitznau-rigi-corridor.json'), { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Unavailable terrain')
      return response.json() as Promise<CorridorSnapshot>
    }).then(data => { if (!data) throw new Error('Missing terrain'); if (!controller.signal.aborted) setTerrain(data) }).catch(() => { if (!controller.signal.aborted) setTerrainError(true) })
    return () => controller.abort()
  }, [terrainWanted, terrain, terrainAttempt])
  useEffect(() => { onTimetableTerrain(terrainWanted ? binding : undefined) }, [terrainWanted, binding, onTimetableTerrain])

  useEffect(() => {
    if (!selected || !phase) return
    const focus = sequenceFocus(selected, phase)
    onFollow(focus.trainId, focus.station)
  }, [selected, phase, onFollow])
  useEffect(() => {
    const current = stages.current?.querySelector<HTMLElement>('[aria-current="step"]')
    if (current && stages.current) stages.current.scrollLeft = current.offsetLeft - stages.current.offsetLeft - (stages.current.clientWidth - current.clientWidth) / 2
  }, [phase])
  return <section className="journey-card rigi-sequence" aria-label={copy.title} data-phase={phase} data-route={route} data-terrain={Boolean(inTerrain)}>
    <div className="service-row"><span className="service">{copy.title}</span><button type="button" className="sequence-exit" onClick={onExit} aria-label={copy.exit}>×</button></div>
    <label className="sequence-departure"><span>{copy.route}</span><select value={route} onChange={event => { setRoute(event.target.value as RigiSequenceRoute); setId(undefined) }}><option value="vitznau">{copy.viaVitznau}</option><option value="weggis">{copy.viaWeggis}</option></select></label>
    {!selected || !phase ? <p>{copy.unavailable}</p> : <>
      <label className="sequence-departure"><span>{copy.trip}</span><select value={selected.id} onChange={event => setId(event.target.value)}>{choices.map(item => <option key={item.id} value={item.id}>{formatServiceTime(item.start)} Luzern → {formatServiceTime(item.end)} Rigi Kulm</option>)}</select></label>
      <p className="sequence-date">{copy.scheduled}</p>
      <nav ref={stages} className="sequence-stages" aria-label={copy.title}>
        <button type="button" aria-current={phase === 'boat' ? 'step' : undefined} onClick={() => onSeek(selected.start)}><span>{copy.boat} {selected.boat.shortName}</span><strong>{formatServiceTime(selected.start)} → {formatServiceTime(selected.arrival)}</strong><small>Luzern → {pier}</small></button>
        <button type="button" aria-current={phase === 'interchange' ? 'step' : undefined} onClick={() => onSeek(selected.arrival)}><span>{selected.cable ? copy.weggisChange : copy.interchange}</span><strong>{((selected.cable?.departure ?? selected.departure) - selected.arrival) / 60} {copy.gap}</strong></button>
        {selected.cable && <>
          <button type="button" aria-current={phase === 'cable' ? 'step' : undefined} onClick={() => onSeek(selected.cable!.departure)}><span>{copy.cable} {selected.cable.train.shortName}</span><strong>{formatServiceTime(selected.cable.departure)} → {formatServiceTime(selected.cable.arrival)}</strong><small>Weggis → Rigi Kaltbad</small></button>
          <button type="button" aria-current={phase === 'kaltbad' ? 'step' : undefined} onClick={() => onSeek(selected.cable!.arrival)}><span>{copy.kaltbad}</span><strong>{(selected.departure - selected.cable.arrival) / 60} {copy.gap}</strong></button>
        </>}
        <button type="button" aria-current={phase === 'rail' ? 'step' : undefined} onClick={() => onSeek(selected.departure)}><span>{copy.rail} {selected.rail.shortName}</span><strong>{formatServiceTime(selected.departure)} → {formatServiceTime(selected.end)}</strong><small>{railOrigin} → Rigi Kulm</small></button>
      </nav>
      <p className="sequence-phase" aria-label={copy.phase} aria-live="polite">{phase === 'interchange' && selected.cable ? copy.weggisChange : copy[phase]}</p>
      <p className="sequence-context">{selected.cable ? copy.weggisContext : copy.context}</p>
      {(inRail || terrainWanted) && <button type="button" className="corridor-entry" aria-pressed={terrainWanted} onClick={() => { setTerrainWanted(value => !value); setTerrainError(false) }}>{terrainWanted ? copy.returnMap : copy.timedTerrain} {terrainWanted ? '↩' : '↗'}</button>}
      {terrainWanted && (terrainError || terrain && !binding) ? <p className="sequence-context" role="status">{copy.terrainUnavailable} <button type="button" onClick={() => { setTerrain(undefined); setTerrainError(false); setTerrainAttempt(n => n + 1) }}>{copy.retry}</button></p> : terrainWanted && !terrain ? <p className="sequence-context" role="status">{copy.terrainLoading}</p> : null}
      {inTerrain && <div className="sequence-timed-profile"><p className="sequence-context">{copy.rail} {selected.rail.shortName} · {terrainPosition?.from}{terrainPosition && !terrainPosition.stopped ? ` → ${terrainPosition.to}` : ''}</p><p className="sequence-context">{copy.timedNote}</p><Suspense fallback={null}><TerrainProfile corridor={binding.corridor} progress={terrainPosition!.progress} language={language} timed /></Suspense><a href={binding.corridor.metadata.productUrl} target="_blank" rel="noreferrer">swissALTIRegio · swisstopo ↗</a></div>}
      <details className="sequence-evidence"><summary>{copy.sources}</summary><p>{copy.model}</p>{selected.cable && <><p>{copy.weggisDetails}</p><p>{copy.weggisModel}</p></>}<a href="./methodology.html#rigi-sequence" target="_blank" rel="noreferrer">{copy.sources} ↗</a><p>{copy.separate}</p><button type="button" className="corridor-entry" onClick={onTerrain}>{copy.terrain} ↗</button></details>
      {phase === 'complete' && <button type="button" className="corridor-entry" onClick={() => onSeek(selected.start)}>{copy.replay} ↻</button>}
    </>}
  </section>
}
