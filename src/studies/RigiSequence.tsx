import { useEffect, useMemo, useState } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { rigiSequences, sequenceFocus, sequencePhase } from './rigi-sequence.ts'
import { SEQUENCE_COPY } from './rigi-sequence-copy.ts'
import './rigi-sequence.css'

type Props = {
  network: NetworkSnapshot; time: number; language: UiLanguage
  onSeek: (time: number) => void
  onFollow: (trainId: string | undefined, station: string | undefined) => void
  onExit: () => void; onTerrain: () => void
}
export default function RigiSequence({ network, time, language, onSeek, onFollow, onExit, onTerrain }: Props) {
  const choices = useMemo(() => rigiSequences(network), [network])
  const [id, setId] = useState(() => choices.reduce((best, item) => Math.abs(item.start - 43200) < Math.abs(best.start - 43200) ? item : best, choices[0])?.id)
  const selected = choices.find(item => item.id === id), copy = SEQUENCE_COPY[language]
  const phase = selected ? sequencePhase(selected, time) : undefined
  useEffect(() => { if (selected) onSeek(selected.start) }, [selected, onSeek])
  useEffect(() => {
    if (!selected || !phase) return
    const focus = sequenceFocus(selected, phase)
    onFollow(focus.trainId, focus.station)
  }, [selected, phase, onFollow])
  return <section className="journey-card rigi-sequence" aria-label={copy.title} data-phase={phase}>
    <div className="service-row"><span className="service">{copy.title}</span><button type="button" className="sequence-exit" onClick={onExit} aria-label={copy.exit}>×</button></div>
    {!selected || !phase ? <p>{copy.unavailable}</p> : <>
      <label className="sequence-departure">{copy.trip}<select value={id} onChange={event => setId(event.target.value)}>{choices.map(item => <option key={item.id} value={item.id}>{formatServiceTime(item.start)} Luzern → {formatServiceTime(item.end)} Rigi Kulm</option>)}</select></label>
      <p className="sequence-date">{copy.scheduled}</p>
      <nav className="sequence-stages" aria-label={copy.title}>
        <button type="button" aria-current={phase === 'boat' ? 'step' : undefined} onClick={() => onSeek(selected.start)}><span>{copy.boat} {selected.boat.shortName}</span><strong>{formatServiceTime(selected.start)} → {formatServiceTime(selected.arrival)}</strong><small>Luzern → Vitznau</small></button>
        <button type="button" aria-current={phase === 'interchange' ? 'step' : undefined} onClick={() => onSeek(selected.arrival)}><span>{copy.interchange}</span><strong>{(selected.departure - selected.arrival) / 60} {copy.gap}</strong></button>
        <button type="button" aria-current={phase === 'rail' ? 'step' : undefined} onClick={() => onSeek(selected.departure)}><span>{copy.rail} {selected.rail.shortName}</span><strong>{formatServiceTime(selected.departure)} → {formatServiceTime(selected.end)}</strong><small>Vitznau → Rigi Kulm</small></button>
      </nav>
      <p className="sequence-phase" aria-label={copy.phase} aria-live="polite">{copy[phase]}</p>
      <p className="sequence-context">{copy.context}</p>
      <details className="sequence-evidence"><summary>{copy.sources}</summary><p>{copy.model}</p><a href="./methodology.html#rigi-sequence" target="_blank" rel="noreferrer">{copy.sources} ↗</a><p>{copy.separate}</p><button type="button" className="corridor-entry" onClick={onTerrain}>{copy.terrain} ↗</button></details>
      {phase === 'complete' && <button type="button" className="corridor-entry" onClick={() => onSeek(selected.start)}>{copy.replay} ↻</button>}
    </>}
  </section>
}
