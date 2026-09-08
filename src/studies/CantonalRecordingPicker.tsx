import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import pilots from '../../data/cantonal-road-pilots.json'
import { studyLinkUrl } from './share-link.ts'
import { CANTONAL_RECORDING_COPY } from './cantonal-recording-copy.ts'
import { REGIONAL_VOLUME_COPY } from './regional-road-volume-copy.ts'
import { AARGAU_STATISTIC_COPY } from './aargau-road-statistics-copy.ts'
import { SUMMARY_COPY } from './geneva-luzern-statistic-copy.ts'
import './study-browser.css'
import './cantonal-recording-picker.css'
import './regional-road-volumes.css'

const RegionalRoadVolumes = lazy(() => import('./RegionalRoadVolumes.tsx'))
const AargauRoadStatistics = lazy(() => import('./AargauRoadStatistics.tsx'))
const GenevaLuzernStatistics = lazy(() => import('./GenevaLuzernStatistics.tsx'))

export default function CantonalRecordingPicker({ language, recording, onClose }: { language: UiLanguage; recording?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const entry = useRef<HTMLButtonElement>(null)
  const statisticEntry = useRef<HTMLButtonElement>(null)
  const summaryEntry = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState<'volumes' | 'statistics' | 'summaries' | null>(null)
  const copy = CANTONAL_RECORDING_COPY[language]
  const volumeCopy = REGIONAL_VOLUME_COPY[language]
  const statisticCopy = AARGAU_STATISTIC_COPY[language]
  const summaryCopy = SUMMARY_COPY[language]
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const close = () => { dialog.current?.close(); onClose() }
  const dateFormat = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' })
  const zoneFormat = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { timeZone: 'Europe/Zurich', timeZoneName: 'short' })
  return <dialog className={`study-browser cantonal-recording-picker${view ? ' has-volumes' : ''}`} ref={dialog} onCancel={event => { event.preventDefault(); close() }} aria-labelledby="road-recordings-title">
    <header><h2 id="road-recordings-title">{view === 'summaries' ? summaryCopy.title : view === 'statistics' ? statisticCopy.title : view === 'volumes' ? volumeCopy.title : copy.title}</h2><button type="button" onClick={close}>{copy.close} ×</button></header>
    {view ? <><button type="button" className="regional-volume-action" onClick={() => { const target = view === 'summaries' ? summaryEntry : view === 'statistics' ? statisticEntry : entry; setView(null); requestAnimationFrame(() => target.current?.focus()) }}>← {volumeCopy.back}</button><Suspense fallback={<p role="status">{view === 'summaries' ? summaryCopy.loading : view === 'statistics' ? statisticCopy.loading : volumeCopy.loading}</p>}>{view === 'summaries' ? <GenevaLuzernStatistics language={language} /> : view === 'statistics' ? <AargauRoadStatistics language={language} /> : <RegionalRoadVolumes language={language} />}</Suspense></> : <>
    <p className="recording-note">{copy.note}</p>
    <div className="recording-grid">{pilots.map(pilot => <a className="recording-choice" key={pilot.id} aria-current={recording === pilot.id ? 'page' : undefined}
      href={studyLinkUrl(window.location.href, { study: 'national', range: 'morning', recording: pilot.id, date: pilot.serviceDate, time: pilot.initialTime })}>
      <strong>{pilot.label}</strong>
      <span>{dateFormat.format(new Date(`${pilot.serviceDate}T12:00:00Z`))}</span>
      <span>{formatServiceTime(pilot.windowStart)}–{formatServiceTime(pilot.windowEnd)} · {zoneFormat.formatToParts(new Date(`${pilot.serviceDate}T12:00:00Z`)).find(part => part.type === 'timeZoneName')?.value}</span>
      <span>{copy.minutes(pilot.completeMinutes)}</span>
      <span>{pilot.completeMinutes < (pilot.windowEnd - pilot.windowStart) / 60 + 1 ? copy.gaps : copy.continuous}</span>
      <small>{copy.open} →</small>
    </a>)}</div>
    <button type="button" className="regional-volume-entry" ref={entry} onClick={() => setView('volumes')}><strong>{volumeCopy.open} →</strong><span>{volumeCopy.intro}</span></button>
    <button type="button" className="regional-volume-entry" ref={statisticEntry} onClick={() => setView('statistics')}><strong>{statisticCopy.title} →</strong><span>{statisticCopy.intro}</span></button>
    <button type="button" className="regional-volume-entry" ref={summaryEntry} onClick={() => setView('summaries')}><strong>{summaryCopy.title} →</strong><span>{summaryCopy.intro}</span></button>
    </>}
  </dialog>
}
