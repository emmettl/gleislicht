import { useMemo } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { rigiDayRhythm, rigiRhythmAt } from './rigi-day-rhythm.ts'
import { RHYTHM_COPY } from './rigi-day-rhythm-copy.ts'
import './rigi-day-rhythm.css'

type Props = { network: NetworkSnapshot; time: number; language: UiLanguage; onSeek: (time: number) => void; onExit: () => void }
export default function RigiDayRhythm({ network, time, language, onSeek, onExit }: Props) {
  const lanes = useMemo(() => rigiDayRhythm(network), [network])
  const copy = RHYTHM_COPY[language], { windowStart, windowEnd, serviceDate } = network.metadata
  const fraction = (t: number) => 100 * Math.max(0, Math.min(1, (t - windowStart) / (windowEnd - windowStart)))
  const first = Math.min(...lanes.flatMap(lane => lane.trains.map(t => t.start)))
  return <section className="journey-card rigi-day-rhythm" aria-label={copy.title}>
    <div className="rhythm-heading"><strong>{copy.title}</strong><button type="button" onClick={onExit} aria-label={copy.close}>×</button></div>
    <p className="rhythm-scope">{serviceDate} · {copy.scope}</p>
    <div className="rhythm-axis" aria-hidden="true"><span>{formatServiceTime(windowStart)}</span><span>{formatServiceTime((windowStart + windowEnd) / 2)}</span><span>{windowEnd === 86400 ? '24:00' : formatServiceTime(windowEnd)}</span></div>
    {lanes.map(lane => {
      const status = rigiRhythmAt(lane, time, windowEnd), next = status.next
      const origin = next && network.stops[next.stops[0][0]][2]
      return <div className="rhythm-lane" data-mode={lane.id} key={lane.id}>
        <div className="rhythm-label"><strong>{copy[lane.id]}</strong><span>{time >= windowEnd ? copy.boundary : status.active ? `${status.active} ${copy.active}` : copy.quiet}</span></div>
        <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" className="rhythm-track" />{lane.intervals.map(([start, end]) => <rect key={start} x={fraction(start)} y="2" width={fraction(end) - fraction(start)} height="4" />)}<line x1={fraction(time)} x2={fraction(time)} y1="0" y2="8" /></svg>
        {next ? <button className="rhythm-next" type="button" onClick={() => onSeek(next.start)}><span>{copy.next} · {formatServiceTime(next.start)} →</span><small>{origin} → {next.headsign}</small></button> : <p className="rhythm-ended">{lane.trains.length ? copy.ended : copy.empty}</p>}
      </div>
    })}
    {Number.isFinite(first) && time > first && <button className="rhythm-first" type="button" onClick={() => onSeek(first)}>{copy.first} · {formatServiceTime(first)} ↩</button>}
    <details><summary>{copy.source}</summary><p>{copy.note}</p><a href="./methodology.html#rigi-rhythm" target="_blank" rel="noreferrer">GTFS · {serviceDate} ↗</a></details>
  </section>
}
