import { useRef, useState, type ReactNode } from 'react'

/** Inline on roomy screens; an explicit, keyboard-accessible popover on laptops. */
export function PlaybackOptions({ label, rate, children }: { label: string; rate: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return <div className="playback-options" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    // Let focused controls handle Space without also toggling map playback.
    if (event.key === ' ') event.stopPropagation()
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
  }}>
    <button ref={trigger} className="playback-options__trigger" type="button" aria-expanded={open}
      aria-controls="playback-options-panel" onClick={() => setOpen(value => !value)}>
      {label} <span>{rate}</span><span aria-hidden="true">{open ? '▾' : '▴'}</span>
    </button>
    <div id="playback-options-panel" className="playback-options__panel" data-open={open}>{children}</div>
  </div>
}
