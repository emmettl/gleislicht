import { useEffect, useRef, useState } from 'react'
import type { UiLanguage } from '../i18n.ts'
import { editionDataUrl } from '../editions/data-url.ts'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { validateCantonalPilot, type CantonalPilot } from './cantonal-road-pilot.ts'
import './cantonal-road-pilot.css'
const COPY = {
  en: { open: 'Play Horgen afternoon pilot', close: 'Return to morning roads', error: 'Pilot could not be loaded. Try again.', loading: 'Loading pilot…', title: 'Horgen · Seestrasse · 1.3 km', note: 'Recorded reconstruction · both directions. Junction turn flows are not measured.', available: 'Recorded windows', gaps: 'Missing observations', gap: 'No complete observations here. Traffic is hidden.', date: '8 September 2026 · CEST' },
  de: { open: 'Horgener Nachmittagspilot abspielen', close: 'Zurück zu den Morgenstrassen', error: 'Pilot konnte nicht geladen werden. Erneut versuchen.', loading: 'Pilot wird geladen…', title: 'Horgen · Seestrasse · 1,3 km', note: 'Rekonstruktion aus Messungen · beide Richtungen. Abbiegeströme sind nicht gemessen.', available: 'Aufgezeichnete Zeitfenster', gaps: 'Fehlende Messungen', gap: 'Hier fehlen vollständige Messungen. Verkehr ausgeblendet.', date: '8. September 2026 · MESZ' },
  fr: { open: 'Lire le pilote de Horgen cet après-midi', close: 'Revenir aux routes du matin', error: 'Chargement du pilote impossible. Réessayez.', loading: 'Chargement du pilote…', title: 'Horgen · Seestrasse · 1,3 km', note: 'Reconstitution des mesures · deux sens. Les mouvements aux carrefours ne sont pas mesurés.', available: 'Périodes enregistrées', gaps: 'Mesures manquantes', gap: 'Mesures incomplètes ici. Trafic masqué.', date: '8 septembre 2026 · CEST' },
  it: { open: 'Riproduci il pilota pomeridiano di Horgen', close: 'Torna alle strade del mattino', error: 'Caricamento del pilota fallito. Riprova.', loading: 'Caricamento del pilota…', title: 'Horgen · Seestrasse · 1,3 km', note: 'Ricostruzione dalle misure · entrambe le direzioni. Le svolte agli incroci non sono misurate.', available: 'Periodi registrati', gaps: 'Misure mancanti', gap: 'Misure incomplete. Traffico nascosto.', date: '8 settembre 2026 · CEST' },
}
export default function CantonalPilotControls({ pilot, time, language, onStart, onExit, onTime }: { pilot?: CantonalPilot; time: number; language: UiLanguage; onStart: (pilot: CantonalPilot) => void; onExit: () => void; onTime: (time: number) => void }) {
  const [state, setState] = useState<'idle'|'loading'|'error'>('idle')
  const controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => controller.current?.abort(), [])
  const copy = COPY[language]
  async function open() {
    controller.current?.abort()
    const request = new AbortController(); controller.current = request
    setState('loading')
    try {
      const response = await fetch(editionDataUrl('zurich-cantonal-road-pilot.json'), { signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]) })
      if (!response.ok) throw new Error('Pilot unavailable')
      const result = validateCantonalPilot(await response.json())
      if (!request.signal.aborted) { setState('idle'); onStart(result) }
    } catch { if (!request.signal.aborted) setState('error') }
  }
  if (!pilot) return <div className="cantonal-pilot"><button disabled={state === 'loading'} onClick={() => { void open() }}>{state === 'loading' ? copy.loading : copy.open}</button>{state === 'error' && <p role="status">{copy.error}</p>}</div>
  const available = pilot.windows.some(w => time >= w.metadata.windowStart && time <= w.metadata.windowEnd)
  return <div className="cantonal-pilot">
    {!available && <p className="pilot-gap-status" role="status">{copy.gap}</p>}
    <strong>{copy.title}</strong><p>{copy.date}</p><p>{copy.note}</p>
    <span>{copy.available}</span><div className="pilot-windows">{pilot.windows.map(w => <button key={w.metadata.windowStart} aria-pressed={time >= w.metadata.windowStart && time <= w.metadata.windowEnd} onClick={() => onTime(w.metadata.windowStart)}>{formatServiceTime(w.metadata.windowStart)}–{formatServiceTime(w.metadata.windowEnd)}</button>)}</div>
    <span>{copy.gaps}</span><div className="pilot-gaps">{pilot.gaps.map(g => <button key={g.start} onClick={() => onTime(g.start)}>{formatServiceTime(g.start)}–{formatServiceTime(g.end)}</button>)}</div>
    <button onClick={onExit}>{copy.close}</button>
  </div>
}
