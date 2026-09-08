import { useEffect, useState } from 'react'
import { editionDataUrl } from '../editions/data-url.ts'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import { SUMMARY_COPY } from './geneva-luzern-statistic-copy.ts'
import { loadSummary, type GenevaData, type GenevaSummary, type LuzernData, type SummaryData, type SummaryRegion } from './geneva-luzern-statistics.ts'
import './regional-road-volumes.css'
import './aargau-road-statistics.css'
import './geneva-luzern-statistics.css'

const formatDate = (date: string, language: UiLanguage) => new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'))

export function GenevaSummaryDetail({ record, language }: { record: GenevaSummary; language: UiLanguage }) {
  const c = SUMMARY_COPY[language], numbers = new Intl.NumberFormat(LANGUAGE_LOCALES[language])
  const value = (n: number | null) => n === null ? c.missing : numbers.format(n)
  const availability: Record<string, string> = { '365 jrs/an': c.allYear, '3 semaines/an': c.threeWeeks, '1 fois tous les 5 ans': c.fiveYears, Suspendu: c.suspended, 'sur demande': c.onRequest, non: c.unavailable }
  return <>
    <h3>{record.name}</h3><p>{record.road} · {record.direction}</p>
    <p className="aargau-statistic-meta">{c.availability}: {availability[record.availability] ?? record.availability}</p>
    <dl className="regional-volume-stats aargau-statistic-values">{(['dailyMean', 'workingDayMean'] as const).map(key => <div key={key}><dt>{key === 'dailyMean' ? c.daily : c.working} · {record[key].referenceYear === null ? c.unknownYear : `${c.year} ${record[key].referenceYear}`}</dt><dd>{value(record[key].value)}<span>{c.unit}</span></dd></div>)}</dl>
    <p className="aargau-statistic-meta">{c.peakNote}</p>
    <dl className="regional-volume-stats"><div><dt>{c.morning}</dt><dd>{value(record.morningPeak)}</dd></div><div><dt>{c.evening}</dt><dd>{value(record.eveningPeak)}</dd></div></dl>
  </>
}

function GenevaSelection({ data, language }: { data: GenevaData; language: UiLanguage }) {
  const [selected, setSelected] = useState(data.records.find(r => r.dailyMean.referenceYear === 2025 && r.availability === '365 jrs/an')?.id ?? data.records[0].id)
  const record = data.records.find(r => r.id === selected)!, c = SUMMARY_COPY[language]
  const sorted = [...data.records].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return <><div className="regional-volume-controls"><label className="regional-volume-counter-select">{c.counter}<select value={selected} onChange={event => setSelected(event.target.value)}>{sorted.map(r => <option key={r.id} value={r.id}>{r.name} · {r.direction} · {r.id}</option>)}</select></label></div><GenevaSummaryDetail record={record} language={language} /></>
}

export function LuzernProfile({ data, language }: { data: LuzernData; language: UiLanguage }) {
  const [direction, setDirection] = useState<'QS' | 'R1' | 'R2'>('QS')
  const c = SUMMARY_COPY[language], numbers = new Intl.NumberFormat(LANGUAGE_LOCALES[language]), p = data.profile
  const values = p.hours[direction], maximum = Math.max(1, ...values)
  return <>
    <p className="aargau-statistic-meta">{c.scope}</p><h3>{p.name}</h3>
    <p>{c.period}: {formatDate(p.period.startDate, language)} – {formatDate(p.period.endDateInclusive, language)}</p>
    <dl className="regional-volume-stats"><div><dt>{c.daily} · {c.both}</dt><dd>{numbers.format(p.dailyMean)}</dd><dt>{c.unit}</dt></div></dl>
    {data.catalogueDiscrepancy && <p className="aargau-statistic-quality">{c.discrepancy.replace('{map}', numbers.format(data.catalogueDailyMean)).replace('{report}', numbers.format(p.dailyMean))}</p>}
    <div className="regional-volume-controls"><label>{c.direction}<select value={direction} onChange={event => setDirection(event.target.value as typeof direction)}><option value="QS">{c.both}</option><option value="R1">{c.from}</option><option value="R2">{c.to}</option></select></label></div>
    <h4>{c.profile}</h4>
    <div className="regional-volume-chart-scroll" aria-hidden="true"><div className="regional-volume-chart luzern-profile-chart">{values.map((v, hour) => <div className="regional-volume-hour" key={hour}><span className="regional-volume-bar-space"><span className="regional-volume-bar" style={{ height: `${v / maximum * 100}%` }} /></span><span className="regional-volume-tick">{hour}</span></div>)}</div></div>
    <p className="aargau-statistic-meta">{c.rounded}</p>
    <details><summary>{c.table}</summary><div className="regional-volume-table-scroll"><table><thead><tr><th>{c.hour}</th><th>{c.vehicles}</th></tr></thead><tbody>{values.map((v, hour) => <tr key={hour}><th scope="row">{String(hour).padStart(2, '0')}:00–{String(hour + 1).padStart(2, '0')}:00</th><td>{numbers.format(v)}</td></tr>)}</tbody></table></div></details>
  </>
}

function LoadedSummary({ region, language }: { region: SummaryRegion; language: UiLanguage }) {
  const [data, setData] = useState<SummaryData>(), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const c = SUMMARY_COPY[language]
  useEffect(() => {
    const controller = new AbortController()
    loadSummary(editionDataUrl('geneva-luzern-statistics/'), region, controller.signal).then(value => { if (!controller.signal.aborted) setData(value) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [region, attempt])
  if (error) return <p role="alert">{c.error} <button type="button" className="regional-volume-action" onClick={() => { setError(false); setAttempt(n => n + 1) }}>{c.retry}</button></p>
  if (!data) return <p role="status">{c.loading}</p>
  return <>{data.source === 'geneva' ? <GenevaSelection data={data} language={language} /> : <LuzernProfile data={data} language={language} />}<p className="regional-volume-source">{c.source}: <a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.attribution}</a> · {c.acquired}: {formatDate(data.acquiredDate, language)}</p></>
}

export default function GenevaLuzernStatistics({ language }: { language: UiLanguage }) {
  const [region, setRegion] = useState<SummaryRegion>('geneva'), c = SUMMARY_COPY[language]
  return <section className="regional-road-volumes aargau-road-statistics" aria-label={c.title}><p>{c.note}</p><div className="regional-volume-controls"><label>{c.region}<select autoFocus value={region} onChange={event => setRegion(event.target.value as SummaryRegion)}><option value="geneva">{c.geneva}</option><option value="luzern">{c.luzern}</option></select></label></div><LoadedSummary key={region} region={region} language={language} /></section>
}
