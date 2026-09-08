import { useEffect, useState } from 'react'
import { editionDataUrl } from '../editions/data-url.ts'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import { AARGAU_STATISTIC_COPY } from './aargau-road-statistics-copy.ts'
import { defaultStatisticRecord, loadStatisticIndex, loadStatisticShard, safeReportUrl, type StatisticIndex, type StatisticMetric, type StatisticRecord, type StatisticStation } from './aargau-road-statistics.ts'
import './regional-road-volumes.css'
import './aargau-road-statistics.css'

const base = () => editionDataUrl('aargau-road-statistics/')
const dateLabel = (date: string, language: UiLanguage) => new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`))
function periodLabel(record: StatisticRecord, language: UiLanguage) {
  const copy = AARGAU_STATISTIC_COPY[language]
  if (record.period.status === 'missing') return copy.missingPeriod
  if (record.period.status === 'invalid') return copy.invalidPeriod
  return `${dateLabel(record.period.startLocal!, language)} ${copy.until} ${dateLabel(record.period.endExclusiveLocal!, language)} (${copy.exclusive})`
}
function directionLabel(record: StatisticRecord, language: UiLanguage) {
  const copy = AARGAU_STATISTIC_COPY[language]
  return record.direction.scope === 'both' ? copy.both : `${copy.direction} ${record.direction.scope}${record.direction.destination ? ` · ${record.direction.destination}` : ''}`
}

export function AargauStatisticDetail({ record, language }: { record: StatisticRecord; language: UiLanguage }) {
  const copy = AARGAU_STATISTIC_COPY[language], numbers = new Intl.NumberFormat(LANGUAGE_LOCALES[language], { maximumFractionDigits: 2 })
  const value = (key: StatisticMetric) => key !== 'DTV' && record.period.status === 'invalid' ? copy.withheld : record.metrics[key] === null ? copy.missing : numbers.format(record.metrics[key]!)
  const labels: Partial<Record<StatisticMetric, string>> = { DWV24: copy.weekday, DTVt: copy.daytime, DTVn: copy.nighttime, MSPW: copy.morning, ASPW: copy.evening }
  return <div className="aargau-statistic-detail">
    <p>{periodLabel(record, language)}</p><p>{directionLabel(record, language)}</p>
    <dl className="regional-volume-stats aargau-statistic-values"><div><dt>{copy.annual} · {record.year}</dt><dd>{value('DTV')}<span>{copy.unit}</span></dd></div><div><dt>{copy.period}</dt><dd>{value('DTV24')}<span>{copy.unit}</span></dd></div></dl>
    <p className="aargau-statistic-quality">{record.substitution ? copy.substitution.replace('{date}', dateLabel(record.substitution.date, language)).replace('{replacement}', dateLabel(record.substitution.replacement, language)) : copy.unreviewed}</p>
    {record.latestPlausible && <p className="aargau-statistic-meta">{copy.latest}</p>}
    <details><summary>{copy.details}</summary><div className="regional-volume-table-scroll"><table><thead><tr><th>{copy.metric}</th><th>{copy.value}</th></tr></thead><tbody>{(Object.keys(labels) as StatisticMetric[]).map(key => <tr key={key}><th scope="row">{labels[key]}</th><td>{value(key)}</td></tr>)}</tbody></table></div></details>
    {safeReportUrl(record.reportUrl) && <p className="regional-volume-source"><a href={record.reportUrl} target="_blank" rel="noreferrer">{copy.report} ↗</a></p>}
  </div>
}

function SurveySelection({ records, language }: { records: StatisticRecord[]; language: UiLanguage }) {
  const copy = AARGAU_STATISTIC_COPY[language]
  const [year, setYear] = useState(defaultStatisticRecord(records).year), [selected, setSelected] = useState('')
  const years = [...new Set(records.map(r => r.year))].sort((a, b) => b - a)
  const surveys = records.filter(record => record.year === year)
  const record = surveys.find(r => r.id === selected) ?? defaultStatisticRecord(surveys)
  return <>
    <div className="regional-volume-controls"><label>{copy.year}<select value={year} onChange={event => { setYear(Number(event.target.value)); setSelected('') }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
    <label className="regional-volume-counter-select">{copy.survey}<select value={record.id} onChange={event => setSelected(event.target.value)}>{surveys.map(r => <option key={r.id} value={r.id}>{periodLabel(r, language)} · {directionLabel(r, language)}</option>)}</select></label></div>
    <AargauStatisticDetail record={record} language={language} />
  </>
}

function StationSurveys({ station, index, language }: { station: StatisticStation; index: StatisticIndex; language: UiLanguage }) {
  const [records, setRecords] = useState<StatisticRecord[]>(), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const copy = AARGAU_STATISTIC_COPY[language]
  useEffect(() => {
    const controller = new AbortController()
    loadStatisticShard(base(), station, index, controller.signal).then(value => { if (!controller.signal.aborted) setRecords(value) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [station, index, attempt])
  if (error) return <p role="alert">{copy.error} <button className="regional-volume-action" type="button" onClick={() => { setError(false); setAttempt(n => n + 1) }}>{copy.retry}</button></p>
  return records ? <SurveySelection records={records} language={language} /> : <p role="status">{copy.loading}</p>
}

function StationSelection({ index, language }: { index: StatisticIndex; language: UiLanguage }) {
  const [selected, setSelected] = useState(index.stations.find(s => s.id === 'AG1000')?.id ?? index.stations[0].id)
  const copy = AARGAU_STATISTIC_COPY[language], station = index.stations.find(s => s.id === selected)!
  const sorted = [...index.stations].sort((a, b) => a.municipality.localeCompare(b.municipality, LANGUAGE_LOCALES[language]) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return <>
    <div className="regional-volume-controls"><label className="regional-volume-counter-select">{copy.station}<select autoFocus value={selected} onChange={event => setSelected(event.target.value)}>{sorted.map(s => <option value={s.id} key={s.id}>{s.municipality} · {s.name} · {s.id}</option>)}</select></label></div>
    <h3>{station.name}</h3><p className="aargau-statistic-meta">{station.road} · {station.id} · {copy.owner}: {station.owner}</p>
    <StationSurveys key={station.id} station={station} index={index} language={language} />
    <p className="regional-volume-source">{copy.source}: <a href={index.sourceUrl} target="_blank" rel="noreferrer">{index.attribution}</a> · {copy.acquired}: {dateLabel(index.acquiredDate, language)}</p>
  </>
}

export default function AargauRoadStatistics({ language }: { language: UiLanguage }) {
  const [index, setIndex] = useState<StatisticIndex>(), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const copy = AARGAU_STATISTIC_COPY[language]
  useEffect(() => {
    const controller = new AbortController()
    loadStatisticIndex(base(), controller.signal).then(value => { if (!controller.signal.aborted) setIndex(value) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [attempt])
  return <section className="regional-road-volumes aargau-road-statistics" aria-label={copy.title}>
    <p>{copy.note}</p>
    {error ? <p role="alert">{copy.error} <button className="regional-volume-action" type="button" onClick={() => { setError(false); setAttempt(n => n + 1) }}>{copy.retry}</button></p> : index ? <StationSelection index={index} language={language} /> : <p role="status">{copy.loading}</p>}
  </section>
}
