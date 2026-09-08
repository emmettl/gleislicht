import { useEffect, useState } from 'react'
import { editionDataUrl } from '../editions/data-url.ts'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import { REGIONAL_VOLUME_COPY, volumeQuality } from './regional-road-volume-copy.ts'
import { defaultVolumeCounter, loadVolumeDay, loadVolumeIndex, VOLUME_REGIONS, type VolumeCounter, type VolumeDay, type VolumeFile, type VolumeHour, type VolumeIndex, type VolumeRegion, type VolumeSeries } from './regional-road-volumes.ts'
import './regional-road-volumes.css'

const base = () => editionDataUrl('regional-road-volumes/')
type Copy = typeof REGIONAL_VOLUME_COPY[UiLanguage]
function validationLabel(hour: VolumeHour, copy: Copy) {
  return ({ unapproved: copy.unapproved, approved: copy.approved, 'raw-current-year': copy.raw } as Record<string, string>)[hour.quality.validation] ?? copy.unspecified
}
function timeLabel(slot: VolumeDay['slots'][number]) { return `${slot.localStart.slice(11, 16)} UTC${slot.localStart.slice(-6)}` }

export function RegionalVolumeDetail({ counter, day, values, language }: { counter: VolumeCounter; day: VolumeDay; values: VolumeSeries; language: UiLanguage }) {
  const copy = REGIONAL_VOLUME_COPY[language], numbers = new Intl.NumberFormat(LANGUAGE_LOCALES[language])
  const [selected, setSelected] = useState(Math.min(12, day.slots.length - 1))
  const current = values.hours[selected], slot = day.slots[selected]
  const maximum = Math.max(1, ...values.hours.map(h => h.value ?? 0))
  return <div className="regional-volume-detail">
    <div className="regional-volume-counter"><div><h3>{counter.name}</h3><p>{counter.directionLabel}</p><p>{counter.measurementBasis === 'sum-of-published-classes' ? copy.classes : copy.reported}</p></div>
      <div className="regional-volume-direction">{counter.orientation ? <><svg viewBox="0 0 72 84" aria-hidden="true"><text x="36" y="12" textAnchor="middle">N</text><circle cx="36" cy="48" r="28" /><path transform={`rotate(${counter.orientation.bearingDegrees} 36 48)`} d="M36 68V27M24 40L36 27L48 40" /></svg><span>{copy.inferred} · {numbers.format(counter.orientation.bearingDegrees)}°</span></> : <span>{copy.unresolved}</span>}</div>
    </div>
    {counter.geometryStatus !== 'axis-candidate' && <p className="regional-volume-caution">{counter.geometryStatus.startsWith('excluded-') ? copy.excluded : copy.location}</p>}
    <dl className="regional-volume-stats"><div><dt>{copy.measuredHours}</dt><dd>{values.coverage.measuredHours} / {values.coverage.expectedHours}</dd></div><div><dt>{values.dayTotal !== null ? copy.total : copy.subtotal}</dt><dd>{values.dayTotal !== null || values.measuredSubtotal !== null ? numbers.format(values.dayTotal ?? values.measuredSubtotal!) : '—'}</dd></div></dl>
    <h4>{copy.chart}</h4>
    <div className="regional-volume-chart-scroll"><div className="regional-volume-chart" role="group" aria-label={copy.chart}>
      {values.hours.map((hour, i) => <button type="button" key={day.slots[i].start} className={`regional-volume-hour${hour.value === null ? ' is-missing' : hour.value === 0 ? ' is-zero' : ''}`} aria-pressed={i === selected} tabIndex={i === selected ? 0 : -1}
        aria-label={`${timeLabel(day.slots[i])}: ${hour.value === null ? volumeQuality(hour, copy) : `${numbers.format(hour.value)} ${copy.vehicles}`}`} title={`${timeLabel(day.slots[i])}: ${hour.value ?? '—'}`} onFocus={() => setSelected(i)} onClick={() => setSelected(i)}
        onKeyDown={event => { const next = event.key === 'ArrowRight' ? Math.min(i + 1, values.hours.length - 1) : event.key === 'ArrowLeft' ? Math.max(i - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? values.hours.length - 1 : undefined; if (next !== undefined) { event.preventDefault(); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus() } }}>
        <span className="regional-volume-bar-space"><span className="regional-volume-bar" style={{ height: hour.value === null || hour.value === 0 ? '0' : `${Math.max(1.5, hour.value / maximum * 100)}%` }} />{hour.value === null && <span className="regional-volume-gap">×</span>}</span>
        <span className="regional-volume-tick">{day.slots[i].localStart.slice(11, 13)}</span>
      </button>)}
    </div></div>
    <div className="regional-volume-reading" aria-live="polite"><strong>{timeLabel(slot)} · {current.value === null ? copy.noValue : `${numbers.format(current.value)} ${copy.vehicles}`}</strong><span>{volumeQuality(current, copy)}{current.quality.status !== 'absent' && ` · ${validationLabel(current, copy)}`}</span>{current.value === null && current.reportedValue !== null && <span>{copy.sourceValue}: {numbers.format(current.reportedValue)}</span>}</div>
    <details><summary>{copy.details}</summary><div className="regional-volume-table-scroll"><table><thead><tr><th>{copy.hour}</th><th>{copy.vehicles}</th><th>{copy.quality}</th></tr></thead><tbody>{values.hours.map((hour, i) => <tr key={day.slots[i].start}><th scope="row">{timeLabel(day.slots[i])}</th><td>{hour.value === null ? '—' : numbers.format(hour.value)}</td><td>{volumeQuality(hour, copy)}{hour.quality.status !== 'absent' && ` · ${validationLabel(hour, copy)}`}</td></tr>)}</tbody></table></div></details>
  </div>
}

function HourlyCounts({ index, file, counter, language }: { index: VolumeIndex; file: VolumeFile; counter: VolumeCounter; language: UiLanguage }) {
  const [loaded, setLoaded] = useState<VolumeDay>(), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const copy = REGIONAL_VOLUME_COPY[language]
  useEffect(() => {
    const controller = new AbortController()
    loadVolumeDay(base(), file, index, controller.signal).then(day => { if (!controller.signal.aborted) setLoaded(day) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [file, index, attempt])
  if (error) return <p role="alert">{copy.error} <button type="button" className="regional-volume-action" onClick={() => { setError(false); setAttempt(n => n + 1) }}>{copy.retry}</button></p>
  if (!loaded) return <p role="status">{copy.loading}</p>
  const values = loaded.series.find(s => s.detectorId === counter.id)!
  return <RegionalVolumeDetail key={counter.id} counter={counter} day={loaded} values={values} language={language} />
}

function VolumeSelection({ index, language }: { index: VolumeIndex; language: UiLanguage }) {
  const [region, setRegion] = useState<VolumeRegion>('basel'), [date, setDate] = useState(index.metadata.dates[0]), [selected, setSelected] = useState('')
  const copy = REGIONAL_VOLUME_COPY[language]
  const counters = index.series.filter(s => s.source === region).sort((a, b) => a.name.localeCompare(b.name) || a.directionLabel.localeCompare(b.directionLabel))
  const counter = counters.find(s => s.id === selected) ?? counters.find(s => s.id === defaultVolumeCounter(counters))
  const file = index.files.find(f => f.source === region && f.serviceDate === date)!
  const dateFormat = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { dateStyle: 'long', timeZone: 'Europe/Zurich' })
  if (!counter) return <p>{copy.empty}</p>
  const source = index.metadata.sources[counter.measurementBasis === 'sum-of-published-classes' ? 'thurgau-classes' : region]
  const sourceUrl = source.sourceUrl ?? source.metadataUrl
  return <>
    <div className="regional-volume-controls"><label>{copy.region}<select autoFocus value={region} onChange={event => { setRegion(event.target.value as VolumeRegion); setSelected('') }}>{VOLUME_REGIONS.map(id => <option value={id} key={id}>{copy.regions[id]}</option>)}</select></label><label>{copy.date}<select value={date} onChange={event => setDate(event.target.value)}>{index.metadata.dates.map(day => <option key={day} value={day}>{dateFormat.format(new Date(`${day}T12:00:00Z`))}</option>)}</select></label>
    <label className="regional-volume-counter-select">{copy.counter}<select value={counter.id} onChange={event => setSelected(event.target.value)}>{counters.map(c => <option key={c.id} value={c.id}>{c.name} · {c.directionLabel}{c.measurementBasis === 'sum-of-published-classes' ? ` · ${copy.classes}` : ''}</option>)}</select></label></div>
    <HourlyCounts key={`${region}/${date}`} index={index} file={file} counter={counter} language={language} />
    <p className="regional-volume-source">{copy.source}: {sourceUrl?.startsWith('https://') ? <a href={sourceUrl} target="_blank" rel="noreferrer">{source.publisher}</a> : source.publisher} · {source.license}</p>
  </>
}

export default function RegionalRoadVolumes({ language }: { language: UiLanguage }) {
  const [index, setIndex] = useState<VolumeIndex>(), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const copy = REGIONAL_VOLUME_COPY[language]
  useEffect(() => {
    const controller = new AbortController()
    loadVolumeIndex(base(), controller.signal).then(value => { if (!controller.signal.aborted) setIndex(value) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [attempt])
  return <section className="regional-road-volumes" aria-label={copy.title}>
    <p>{copy.note}</p>
    {error ? <p role="alert">{copy.error} <button type="button" className="regional-volume-action" onClick={() => { setError(false); setAttempt(n => n + 1) }}>{copy.retry}</button></p> : index ? <VolumeSelection index={index} language={language} /> : <p role="status">{copy.loading}</p>}
  </section>
}
