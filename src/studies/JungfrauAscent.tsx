import { useEffect, useMemo, useRef, useState } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { jungfrauAscents, ascentPhase, ascentFocus } from './jungfrau-ascent.ts'
import { JUNGFRAU_JOURNEY_COPY } from './jungfrau-journey-copy.ts'
import './jungfrau-journey.css'
type Props = { network: NetworkSnapshot; language: UiLanguage; time: number; onSeek: (time: number) => void; onFollow: (trainId: string | undefined, station: string | undefined) => void; onFinish: () => void; onExit: () => void }
export default function JungfrauAscent({ network, language, time, onSeek, onFollow, onFinish, onExit }: Props) {
  const copy = JUNGFRAU_JOURNEY_COPY[language], stages = useRef<HTMLElement>(null)
  const choices = useMemo(() => jungfrauAscents(network), [network]), [id, setId] = useState<string>()
  const selected = choices.find(s => s.id === id) ?? choices.reduce((best, s) => Math.abs(s.start-43200) < Math.abs(best.start-43200) ? s : best, choices[0])
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
  return <section className="journey-card jungfrau-ascent" aria-label={copy.title} data-phase={phase}>
    <header><h2>{copy.title}</h2><button type="button" onClick={onExit} aria-label={copy.exit}>×</button></header>
    {!selected ? <p role="status">{copy.unavailable}</p> : <>
      <label>{copy.departure}<select value={selected.id} onChange={event => setId(event.target.value)}>{choices.map(s => <option key={s.id} value={s.id}>{formatServiceTime(s.start)} → {formatServiceTime(s.end)}</option>)}</select></label>
      <p className="ascent-date">{network.metadata.serviceDate} · {copy.scheduled}</p>
      <nav ref={stages} className="jungfrau-ascent-stages" aria-label={copy.title}>{selected.legs.flatMap((leg,i) => [
        <button key={`leg-${i}`} type="button" data-stage={`leg-${i}`} aria-current={phase === `leg-${i}` ? 'step' : undefined} onClick={() => onSeek(leg.departure)}><span>{leg.train.route} · {leg.train.shortName}</span><strong>{formatServiceTime(leg.departure)} → {formatServiceTime(leg.arrival)}</strong><small>{leg.from} → {leg.to}</small></button>,
        ...(selected.waits[i] ? [<button key={`wait-${i}`} type="button" data-stage={`wait-${i}`} aria-current={phase === `wait-${i}` ? 'step' : undefined} onClick={() => onSeek(leg.arrival)}><span>{copy.change} {leg.to}</span><strong>{(selected.waits[i].end-selected.waits[i].start)/60} {copy.minutes}</strong></button>] : []),
      ])}</nav>
      <p className="ascent-status" role="status">{phase === 'before' ? copy.before : phase === 'complete' ? copy.complete : phase?.startsWith('wait-') ? `${copy.change} ${selected.legs[Number(phase.slice(5))].to}` : selected.legs[Number(phase?.slice(4))]?.operator}</p>
      <p>{copy.note}</p>
      <details><summary>{copy.sources}</summary><p>{copy.lauterbrunnen}</p><p>{copy.scheidegg}</p><p>{copy.booking}</p><p>{copy.model}</p><a href="./methodology.html#jungfrau-ascent" target="_blank" rel="noreferrer">{copy.sources} ↗</a> · <a href="https://www.jungfrau.ch/en-gb/arriving/" target="_blank" rel="noreferrer">{copy.operator} ↗</a></details>
      {phase === 'complete' && <button type="button" className="jungfrau-start" onClick={() => onSeek(selected.start)}>{copy.replay} ↻</button>}
    </>}
  </section>
}
