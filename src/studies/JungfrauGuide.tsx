import { useEffect, useMemo, useRef } from 'react'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { jungfrauGuide } from './jungfrau-guide.ts'
import { JUNGFRAU_JOURNEY_COPY } from './jungfrau-journey-copy.ts'
import './jungfrau-journey.css'
export default function JungfrauGuide({ network, language, onSelect, onStart, onClose }: { network: NetworkSnapshot; language: UiLanguage; onSelect: (name: string) => void; onStart: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), copy = JUNGFRAU_JOURNEY_COPY[language]
  const approaches = useMemo(() => jungfrauGuide(network), [network])
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const close = () => { dialog.current?.close(); onClose() }
  return <dialog ref={dialog} className="jungfrau-guide" aria-labelledby="jungfrau-guide-title" onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => event.stopPropagation()}>
    <header><h2 id="jungfrau-guide-title">{copy.guide}</h2><button type="button" aria-label={copy.close} onClick={close}>×</button></header>
    <p>{copy.intro}</p><small>{network.metadata.serviceDate} · {copy.schematic}</small>
    <div className="jungfrau-approaches">{approaches.map(approach => <section key={approach.id} data-approach={approach.id}>
      <h3>{copy[approach.id]}</h3><p>{approach.id === 'eiger' ? copy.cable : copy.rail}</p>
      {!approach.available ? <p role="status">{copy.guideUnavailable}</p> : <ol>{approach.stops.map(stop => <li key={stop.id}><button type="button" onClick={() => { dialog.current?.close(); onSelect(stop.name!) }}>{stop.name} ↗</button></li>)}</ol>}
    </section>)}</div>
    <p>{copy.guideNote}</p><button type="button" className="jungfrau-start" onClick={() => { dialog.current?.close(); onStart() }}>{copy.start} →</button>
    <p>{copy.booking} <a href="https://www.jungfrau.ch/en-gb/arriving/" target="_blank" rel="noreferrer">{copy.operator} ↗</a></p>
  </dialog>
}
