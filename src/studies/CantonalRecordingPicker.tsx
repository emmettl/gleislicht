import { useEffect, useRef } from 'react'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import { LANGUAGE_LOCALES, type UiLanguage } from '../i18n.ts'
import pilots from '../../data/cantonal-road-pilots.json'
import { studyLinkUrl } from './share-link.ts'
import { CANTONAL_RECORDING_COPY } from './cantonal-recording-copy.ts'
import './study-browser.css'
import './cantonal-recording-picker.css'

export default function CantonalRecordingPicker({ language, recording, onClose }: { language: UiLanguage; recording?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const copy = CANTONAL_RECORDING_COPY[language]
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const close = () => { dialog.current?.close(); onClose() }
  const dateFormat = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' })
  const zoneFormat = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { timeZone: 'Europe/Zurich', timeZoneName: 'short' })
  return <dialog className="study-browser cantonal-recording-picker" ref={dialog} onCancel={event => { event.preventDefault(); close() }} aria-labelledby="road-recordings-title">
    <header><h2 id="road-recordings-title">{copy.title}</h2><button type="button" onClick={close}>{copy.close} ×</button></header>
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
  </dialog>
}
