import { useEffect, useMemo, useRef } from 'react'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { rigiGuide } from './rigi-guide.ts'
import { RIGI_GUIDE_COPY } from './rigi-guide-copy.ts'
import './rigi-guide.css'

type Props = { network: NetworkSnapshot; language: UiLanguage; onSelect: (name: string) => void; onClose: () => void }
export default function RigiGuide({ network, language, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), copy = RIGI_GUIDE_COPY[language]
  const guide = useMemo(() => rigiGuide(network), [network])
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const close = () => { dialog.current?.close(); onClose() }
  return <dialog ref={dialog} className="rigi-guide" onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => event.stopPropagation()} aria-labelledby="rigi-guide-title">
    <header><h2 id="rigi-guide-title">{copy.title}</h2><button type="button" onClick={close} aria-label={copy.close}>×</button></header>
    <p className="rigi-guide-intro">{copy.intro}</p>
    <p className="rigi-guide-date">{network.metadata.serviceDate} · {copy.schematic}</p>
    <div className="rigi-guide-legend">{(['vitznau', 'arth', 'boats', 'cable', 'walk'] as const).map(mode => <span data-mode={mode} key={mode}>{copy[mode]}</span>)}</div>
    <div className="rigi-guide-diagram">
      <svg viewBox="0 0 400 455" preserveAspectRatio="none" aria-hidden="true">{guide.links.map(link => <path key={`${link.mode}-${link.from}-${link.to}`} data-mode={link.mode} d={link.path} />)}</svg>
      {guide.nodes.map(node => {
        const detail = node.id === 'weggisPier' || node.id === 'luzern' ? copy.pier : node.id === 'weggisCable' ? copy.valley : node.id === 'kaltbadCable' ? copy.cableTop : node.id === 'vitznau' ? `${copy.pier} / ${copy.rail}` : copy.rail
        return <button key={node.id} type="button" className="rigi-guide-stop" data-stop={node.id} style={{ left: `${node.x / 4}%`, top: `${node.y / 4.55}%` }} onClick={() => { dialog.current?.close(); onSelect(node.name) }} aria-label={`${node.name} · ${detail} · ${node.calls} ${copy.calls}`}><strong>{node.name.replace(' (Luftseilbahn)', '')}</strong><small>{detail}</small></button>
      })}
    </div>
    {guide.nodes.length < 11 || guide.links.length < 12 ? <p role="status">{copy.unavailable}</p> : null}
    <details><summary>{copy.source}</summary><p>{copy.note}</p><a href="./methodology.html#rigi-connections" target="_blank" rel="noreferrer">GTFS · {network.metadata.serviceDate} ↗</a></details>
  </dialog>
}
