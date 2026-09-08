import { useUiText } from '../use-ui-text.ts'
import { useEffect, useMemo, useState } from 'react'
import type { NationalRoadMinuteChunk, NationalRoadStudyManifest, NationalRoadStudySnapshot } from '@motionstudies/core/domain/road-day'
import type { RoadTrafficSnapshot } from '@motionstudies/core/domain/road'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { editionDataUrl } from '../editions/data-url.ts'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import { roadTrafficSummary } from './road-traffic-summary.ts'
import { roadHistoryPath, roadTrafficHistory } from './road-traffic-history.ts'
import './road-traffic-history.css'

const COPY = {
  en: { title: 'Traffic over time', unit: 'vehicles/km · one direction', peak: 'Recorded peak', quiet: 'Quiet', busy: 'Busier', relative: 'of this recording’s peak', seek: 'Choose traffic time', note: 'Estimated density across measured sections. Coverage may vary; this is not a congestion rating.', error: 'Traffic history could not be loaded.', retry: 'Retry', calibration: 'Illustrative profile', profilePeak: 'Profile peak', profileRelative: 'of this profile’s peak' },
  de: { title: 'Verkehr im Zeitverlauf', unit: 'Fahrzeuge/km · je Richtung', peak: 'Gemessener Höchstwert', quiet: 'Ruhig', busy: 'Stärker', relative: 'des Höchstwerts dieser Aufnahme', seek: 'Verkehrszeit wählen', note: 'Geschätzte Dichte auf gemessenen Abschnitten. Abdeckung kann variieren; keine Staubewertung.', error: 'Verkehrsverlauf konnte nicht geladen werden.', retry: 'Erneut versuchen', calibration: 'Beispielprofil', profilePeak: 'Profilhöchstwert', profileRelative: 'des Profilhöchstwerts' },
  fr: { title: 'Trafic au fil du temps', unit: 'véhicules/km · par sens', peak: 'Maximum enregistré', quiet: 'Calme', busy: 'Plus chargé', relative: 'du maximum de cet enregistrement', seek: 'Choisir l’heure du trafic', note: 'Densité estimée sur les tronçons mesurés. Couverture variable ; ce n’est pas un indice de congestion.', error: 'Impossible de charger l’historique du trafic.', retry: 'Réessayer', calibration: 'Profil illustratif', profilePeak: 'Maximum du profil', profileRelative: 'du maximum de ce profil' },
  it: { title: 'Traffico nel tempo', unit: 'veicoli/km · per direzione', peak: 'Massimo registrato', quiet: 'Tranquillo', busy: 'Più intenso', relative: 'del massimo di questa registrazione', seek: 'Scegli l’ora del traffico', note: 'Densità stimata sui tratti misurati. La copertura può variare; non è un indice di congestione.', error: 'Impossibile caricare lo storico del traffico.', retry: 'Riprova', calibration: 'Profilo illustrativo', profilePeak: 'Massimo del profilo', profileRelative: 'del massimo di questo profilo' },
}

export function RoadTrafficHistory({ road, manifest, fallback, time, language, onTime }: {
  road: string; manifest?: NationalRoadStudyManifest; fallback?: RoadTrafficSnapshot
  time: number; language: UiLanguage; onTime: (time: number) => void
}) {
  const [loaded, setLoaded] = useState<{ manifest: NationalRoadStudyManifest; snapshot?: NationalRoadStudySnapshot; error?: boolean }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!manifest) return
    const controller = new AbortController()
    void Promise.all(manifest.chunks.map(async chunk => {
      const response = await fetch(editionDataUrl(chunk.path), { signal: controller.signal })
      if (!response.ok) throw new Error('Traffic chunk unavailable')
      return await response.json() as NationalRoadMinuteChunk
    })).then(chunks => {
      const minutes = [...new Map(chunks.flatMap(chunk => chunk.minutes).map(minute => [minute[0], minute])).values()].sort((a, b) => a[0] - b[0])
      if (!controller.signal.aborted) setLoaded({ manifest, snapshot: { metadata: manifest.metadata, siteIds: manifest.siteIds, sections: manifest.sections, minutes } })
    }).catch(() => {
      if (!controller.signal.aborted) setLoaded({ manifest, error: true })
    })
    return () => controller.abort()
  }, [manifest, attempt])
  const snapshot = loaded?.manifest === manifest ? loaded?.snapshot : undefined
  const source = manifest ? snapshot : fallback
  const points = useMemo(() => roadTrafficHistory(road, snapshot, manifest ? undefined : fallback), [road, snapshot, manifest, fallback])
  const current = useMemo(() => roadTrafficSummary(road, time, snapshot, manifest ? undefined : fallback), [road, time, snapshot, manifest, fallback])
  const copy = COPY[language], text = useUiText(language)
  const number = new Intl.NumberFormat(LANGUAGE_LOCALES[language], { maximumFractionDigits: 1 })
  const peak = points.reduce((best, point) => point.summary && point.summary.density > (best?.summary?.density ?? -1) ? point : best, undefined as typeof points[number] | undefined)
  if (!source || !peak?.summary) return <div className="road-history" role="status">
    <h3>{copy.title}</h3>
    {loaded?.manifest === manifest && loaded?.error
      ? <><p>{copy.error}</p><button onClick={() => { setLoaded(undefined); setAttempt(value => value + 1) }}>{copy.retry}</button></>
      : <p>{manifest && !snapshot ? text.loadingRoad : text.noRoadTraffic}</p>}
  </div>
  const start = source.metadata.windowStart, end = source.metadata.windowEnd
  const maximum = Math.max(5, Math.ceil(peak.summary.density / 5) * 5)
  const x = (value: number) => 30 + (value - start) / Math.max(1, end - start) * 286
  const y = (value: number) => 112 - value / maximum * 90
  const percent = current ? Math.min(100, peak.summary.density ? Math.round(current.density / peak.summary.density * 100) : 0) : undefined
  const representative = !manifest && fallback?.metadata.measurementKind === 'representative-calibration'
  const peakLabel = representative ? copy.profilePeak : copy.peak
  const relativeLabel = representative ? copy.profileRelative : copy.relative
  return <div className="road-history">
    <div className="road-history-heading"><h3>{copy.title}</h3><time>{formatServiceTime(time)}</time></div>
    <div className="road-history-current"><strong>{current ? `≈${number.format(current.density)}` : '—'}</strong><span>{copy.unit}</span></div>
    {representative && <p>{copy.calibration}</p>}
    <svg viewBox="0 0 326 136" role="img" aria-label={`${copy.title}, ${source.metadata.serviceDate}, ${formatServiceTime(start)}–${formatServiceTime(end)}. ${peakLabel}: ${number.format(peak.summary.density)} ${copy.unit}, ${formatServiceTime(peak.time)}`}>
      {[0, maximum / 2, maximum].map(value => <g key={value}>
        <line x1="30" x2="316" y1={y(value)} y2={y(value)} className="road-chart-grid" />
        <text x="24" y={y(value) + 3} textAnchor="end">{number.format(value)}</text>
      </g>)}
      <path d={roadHistoryPath(points, x, y)} className="road-chart-line" />
      {points.filter(point => point.summary).map(point => <circle key={point.time} cx={x(point.time)} cy={y(point.summary!.density)} r="1.3" className="road-chart-sample"><title>{formatServiceTime(point.time)} · {number.format(point.summary!.density)} {copy.unit}</title></circle>)}
      {time >= start && time <= end && <line x1={x(time)} x2={x(time)} y1="16" y2="112" className="road-chart-cursor" />}
      {current && time >= start && time <= end && <circle cx={x(time)} cy={y(current.density)} r="3.5" className="road-chart-current" />}
      <text x="30" y="131">{formatServiceTime(start)}</text><text x="316" y="131" textAnchor="end">{formatServiceTime(end)}</text>
    </svg>
    <input type="range" min={start} max={end} step={source.metadata.sampleIntervalSeconds} value={Math.max(start, Math.min(end, time))} aria-label={copy.seek} aria-valuetext={formatServiceTime(time)} onChange={event => onTime(Number(event.target.value))} />
    <div className="road-history-intensity" aria-hidden="true"><span>{copy.quiet}</span><div>{percent !== undefined && <i style={{ left: `${percent}%` }} />}</div><span>{copy.busy}</span></div>
    <p className="road-history-comparison">{percent === undefined ? text.noRoadTraffic : `${percent}% ${relativeLabel}`}</p>
    <p>{peakLabel}: <strong>{number.format(peak.summary.density)}</strong> · {formatServiceTime(peak.time)}<br />{source.metadata.serviceDate} · {copy.note}</p>
  </div>
}
