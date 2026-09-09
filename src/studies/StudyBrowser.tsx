import { useEffect, useRef } from 'react'
import type { UiLanguage } from '../i18n.ts'
import { STUDY_IDS } from './explore.ts'
import { STUDY_ORDER } from './study-order.ts'
import { EXPLORE_COPY } from './explore-copy.ts'
import type { SwitzerlandNetworkStudy } from '../editions/switzerland.ts'
import summaries from './study-summaries.json'
import './study-browser.css'
const patterns = ['M5 44L32 25L53 32L79 13L115 30 M32 25L40 58L92 47', 'M5 48Q25 10 48 35T115 18 M22 37L36 58', 'M15 15L100 55 M10 50L110 20 M45 6L65 66', 'M18 55Q35 25 90 12 M20 12L95 58 M48 30L110 35', 'M15 10V60 M42 10V60 M69 10V60 M96 10V60 M5 25H115 M5 48H115', 'M5 52Q20 40 42 50T75 50 M42 50L80 12L115 52 M65 50L80 12', 'M5 15H45 M5 30H45 M5 45H45 M65 55Q80 10 115 20', 'M8 58L32 38L55 20L72 9 M55 20L90 43L112 60 M32 38L90 43', 'M10 55L45 35L65 10 M45 35L90 60 M10 35L110 35']
export default function StudyBrowser({ language, study, onSelect, onClose }: { language: UiLanguage; study: SwitzerlandNetworkStudy; onSelect: (id: SwitzerlandNetworkStudy) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const copy = EXPLORE_COPY[language]
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="study-browser" ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="study-browser-title">
    <header><h2 id="study-browser-title">{copy.browse}</h2><button type="button" onClick={onClose}>{copy.close} ×</button></header>
    <a className="study-orbital-entry" href="?view=orbital"><div><strong>{copy.orbital} ↗</strong><span>{copy.orbitalDescription}</span></div><small>{copy.experiment}</small></a>
    <div className="study-browser-grid">{STUDY_ORDER.map(id => {
      // Copy and preview artwork retain their identity when display order changes.
      const index = STUDY_IDS.indexOf(id)
      return <button type="button" className="study-preview" data-study={id} aria-pressed={id === study} key={id} onClick={() => onSelect(id)}>
        <svg viewBox="0 0 120 72" aria-hidden="true"><path d={patterns[index] ?? 'M8 58L32 38L55 20L72 9 M55 20L90 43L112 60 M32 38L90 43'} /></svg>
        <strong>{copy.names[index]}</strong><span>{copy.descriptions[index]}</span><small>{summaries.find(summary => summary.id === id)?.date} · 00:00–24:00</small>
      </button>
    })}</div>
  </dialog>
}
