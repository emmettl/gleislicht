import { CANTONAL_RECORDING_COPY } from './cantonal-recording-copy.ts'
import { studyLinkUrl } from './share-link.ts'
import { validateCantonalPilot } from './validate-cantonal-pilot.ts'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import { editionDataUrl } from '../editions/data-url.ts'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { cantonalPilotsForRoad, type CantonalPilot, type CantonalPilotDefinition } from './cantonal-road-pilot.ts'
import './cantonal-road-pilot.css'
const COPY = {
  en: { open: (name: string) => `Play ${name} recording`, close: 'Return to morning roads', error: 'Pilot could not be loaded. Try again.', loading: 'Loading pilot…', note: 'Recorded reconstruction · both directions. Junction turn flows are not measured.', available: 'Recorded windows', gaps: 'Missing observations', gap: 'No complete observations here. Traffic is hidden.', complete: (n: number) => `${n} complete recorded minutes · no gaps`, junctions: (n: number) => `Mapped junction areas: ${n}` },
  de: { open: (name: string) => `Aufzeichnung ${name} abspielen`, close: 'Zurück zu den Morgenstrassen', error: 'Pilot konnte nicht geladen werden. Erneut versuchen.', loading: 'Pilot wird geladen…', note: 'Rekonstruktion aus Messungen · beide Richtungen. Abbiegeströme sind nicht gemessen.', available: 'Aufgezeichnete Zeitfenster', gaps: 'Fehlende Messungen', gap: 'Hier fehlen vollständige Messungen. Verkehr ausgeblendet.', complete: (n: number) => `${n} vollständige Messminuten · keine Lücken`, junctions: (n: number) => `Kartierte Knotenbereiche: ${n}` },
  fr: { open: (name: string) => `Lire l’enregistrement de ${name}`, close: 'Revenir aux routes du matin', error: 'Chargement du pilote impossible. Réessayez.', loading: 'Chargement du pilote…', note: 'Reconstitution des mesures · deux sens. Les mouvements aux carrefours ne sont pas mesurés.', available: 'Périodes enregistrées', gaps: 'Mesures manquantes', gap: 'Mesures incomplètes ici. Trafic masqué.', complete: (n: number) => `${n} minutes complètes · aucune lacune`, junctions: (n: number) => `Zones de carrefour cartographiées : ${n}` },
  it: { open: (name: string) => `Riproduci la registrazione di ${name}`, close: 'Torna alle strade del mattino', error: 'Caricamento del pilota fallito. Riprova.', loading: 'Caricamento del pilota…', note: 'Ricostruzione dalle misure · entrambe le direzioni. Le svolte agli incroci non sono misurate.', available: 'Periodi registrati', gaps: 'Misure mancanti', gap: 'Misure incomplete. Traffico nascosto.', complete: (n: number) => `${n} minuti completi · nessuna lacuna`, junctions: (n: number) => `Aree di incrocio mappate: ${n}` },
}
export default function CantonalPilotControls({ definition, pilot, time, language, autoStartTime, onAutoStart, onStart, onExit, onTime }: { definition: CantonalPilotDefinition; pilot?: CantonalPilot; time: number; language: UiLanguage; autoStartTime?: number; onAutoStart?: () => void; onStart: (pilot: CantonalPilot, time: number) => void; onExit: () => void; onTime: (time: number) => void }) {
  const [state, setState] = useState<'idle'|'loading'|'error'>('idle')
  const controller = useRef<AbortController | undefined>(undefined)
  const [linkedTime] = useState(autoStartTime)
  const requestedTime = useRef(linkedTime)
  const startFromLink = useEffectEvent(() => { onAutoStart?.(); void open() })
  useEffect(() => {
    if (linkedTime !== undefined) startFromLink()
    return () => controller.current?.abort()
  }, [linkedTime])
  const copy = COPY[language]
  async function open() {
    controller.current?.abort()
    const request = new AbortController(); controller.current = request
    setState('loading')
    try {
      const response = await fetch(editionDataUrl(definition.file), { signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]) })
      if (!response.ok) throw new Error('Pilot unavailable')
      const result = validateCantonalPilot(await response.json(), definition)
      if (!request.signal.aborted) { setState('idle'); onStart(result, requestedTime.current ?? definition.initialTime); requestedTime.current = undefined }
    } catch { if (!request.signal.aborted) setState('error') }
  }
  const recordings = cantonalPilotsForRoad(definition.road)
  const picker = recordings.length > 1 ? <select className="pilot-recording-select" aria-label={CANTONAL_RECORDING_COPY[language].title} value={definition.id} onChange={event => {
    window.location.assign(studyLinkUrl(window.location.href, { study: 'national', range: 'morning', recording: event.target.value }))
  }}>{recordings.map(recording => <option key={recording.id} value={recording.id}>{recording.label} · {recording.serviceDate} · {formatServiceTime(recording.windowStart)}–{formatServiceTime(recording.windowEnd)}</option>)}</select> : null
  if (!pilot) return <div className="cantonal-pilot">{picker}<button disabled={state === 'loading'} onClick={() => { void open() }}>{state === 'loading' ? copy.loading : copy.open(definition.label)}</button>{state === 'error' && <p role="status">{copy.error}</p>}</div>
  const available = pilot.windows.some(w => time >= w.metadata.windowStart && time <= w.metadata.windowEnd)
  const date = new Date(`${pilot.metadata.serviceDate}T12:00:00Z`)
  const dateLabel = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' }).format(date)
  const zone = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { timeZone: 'Europe/Zurich', timeZoneName: 'short' }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value
  const length = new Intl.NumberFormat(LANGUAGE_LOCALES[language], { maximumFractionDigits: 1 }).format(pilot.topology.sections[0].distanceKm)
  return <div className="cantonal-pilot">
    {picker}
    {!available && <p className="pilot-gap-status" role="status">{copy.gap}</p>}
    <strong>{definition.name} · {length} km</strong><p>{dateLabel} · {zone}</p><p>{copy.note}</p>
    <p>{copy.junctions(definition.junctionAreas)}</p>
    <span>{copy.available}</span><div className="pilot-windows">{pilot.windows.map(w => <button key={w.metadata.windowStart} aria-pressed={time >= w.metadata.windowStart && time <= w.metadata.windowEnd} onClick={() => onTime(w.metadata.windowStart)}>{formatServiceTime(w.metadata.windowStart)}–{formatServiceTime(w.metadata.windowEnd)}</button>)}</div>
    {pilot.gaps.length ? <><span>{copy.gaps}</span><div className="pilot-gaps">{pilot.gaps.map(g => <button key={g.start} onClick={() => onTime(g.start)}>{formatServiceTime(g.start)}–{formatServiceTime(g.end)}</button>)}</div></> : <p className="pilot-complete">{copy.complete(pilot.metadata.completeMinutes)}</p>}
    <button onClick={onExit}>{copy.close}</button>
  </div>
}
