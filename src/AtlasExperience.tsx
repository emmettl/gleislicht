/* oxlint-disable react/set-state-in-effect -- Synchronize URL intent and asynchronous scene readiness with the external camera flight channel. */
import { memo, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type MouseEvent } from 'react'
import { App } from './App.tsx'
import { SWITZERLAND_EDITION } from './editions/switzerland.ts'
import { orbitalFlight, type FlightPose } from './studies/orbital-flight.ts'
import type { OrbitalViewProps } from './studies/OrbitalView.tsx'

const Atlas = memo(App)
const isOrbitUrl = () => new URLSearchParams(window.location.search).get('view') === 'orbital'
const atlasUrl = () => { const url = new URL(window.location.href); url.searchParams.delete('view'); return url.pathname + url.search + url.hash }

export default function AtlasExperience() {
  const [directOrbit] = useState(isOrbitUrl)
  const [wanted, setWanted] = useState(directOrbit)
  const [atlasMounted, setAtlasMounted] = useState(!directOrbit)
  const [Orbit, setOrbit] = useState<ComponentType<OrbitalViewProps>>()
  const [ready, setReady] = useState(false), [error, setError] = useState('')
  const phase = useSyncExternalStore(orbitalFlight.subscribe, orbitalFlight.snapshot)
  const atlas = useRef<HTMLDivElement>(null), orbit = useRef<HTMLDivElement>(null)
  const saved = useRef<FlightPose | null>(null), returnUrl = useRef(atlasUrl())
  const returnFocus = useRef<HTMLElement | null>(null), atlasTitle = useRef(document.title)
  const animate = useRef<typeof import('./studies/orbital-flight-animation.ts').animateOrbitalFlight | null>(null)
  const hasOrbit = phase !== 'atlas'

  useEffect(() => {
    const pop = () => setWanted(isOrbitUrl())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])

  useEffect(() => {
    if (!wanted && phase === 'atlas') return
    if (Orbit) return
    let cancelled = false
    Promise.all([import('./studies/OrbitalView.tsx'), import('./studies/orbital-flight-animation.ts')]).then(([module, flight]) => {
      if (!cancelled) { animate.current = flight.animateOrbitalFlight; setOrbit(() => module.default) }
    }).catch(() => { if (!cancelled) { setError('The orbital view could not load. Please try again.'); setWanted(false); history.replaceState(null, '', returnUrl.current) } })
    return () => { cancelled = true }
  }, [wanted, phase, Orbit])

  useEffect(() => {
    if (wanted && phase === 'atlas') {
      atlasTitle.current = document.title
      if (!directOrbit || atlasMounted) {
        const poses = [...orbitalFlight.atlas].map(camera => camera.capture())
        saved.current = poses[0] ?? null
      }
      setReady(false); setError(''); orbitalFlight.pose = null
      orbitalFlight.setPhase(directOrbit && !atlasMounted ? 'orbital' : 'loading')
    } else if (!wanted && phase === 'loading') {
      orbitalFlight.atlas.forEach(camera => camera.restore())
      orbitalFlight.pose = null; orbitalFlight.setPhase('atlas')
      document.title = atlasTitle.current
    } else if (wanted && phase === 'loading' && ready) {
      orbitalFlight.setPhase('departing')
    } else if (!wanted && phase === 'orbital') {
      if (!atlasMounted) {
        setAtlasMounted(true); orbitalFlight.pose = null; orbitalFlight.setPhase('atlas')
      } else orbitalFlight.setPhase('returning')
    }
  }, [wanted, phase, ready, directOrbit, atlasMounted])

  useEffect(() => {
    if (phase !== 'loading') return
    const timeout = window.setTimeout(() => {
      setError('Orbit is taking too long to prepare. Your atlas is still here; please try again.')
      history.replaceState(null, '', returnUrl.current); setWanted(false)
    }, 45000)
    return () => window.clearTimeout(timeout)
  }, [phase])

  useEffect(() => {
    if (phase !== 'departing' && phase !== 'returning') return
    return animate.current?.({
      departing: phase === 'departing', saved: saved.current,
      orbit: orbit.current, atlas: atlas.current, focus: returnFocus.current,
      title: atlasTitle.current,
    })
  }, [phase])

  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
    if (!link || link.target || link.hasAttribute('download')) return
    const url = new URL(link.href)
    if (url.origin !== location.origin || url.pathname !== location.pathname) return
    const entering = url.searchParams.get('view') === 'orbital'
    if (!entering && !orbit.current?.contains(link)) return
    event.preventDefault()
    if (entering) {
      if (phase !== 'atlas') return
      returnUrl.current = location.pathname + location.search + location.hash
      returnFocus.current = link
      atlas.current?.querySelectorAll('dialog[open]').forEach(dialog => (dialog as HTMLDialogElement).close())
      history.pushState({ orbitalFlight: true }, '', url.pathname + url.search + url.hash)
      setWanted(true)
    } else {
      if (history.state?.orbitalFlight) history.back()
      else { history.pushState(null, '', returnUrl.current); setWanted(false) }
    }
  }
  const busy = phase === 'loading' || phase === 'departing' || phase === 'returning'
  return <div className={`atlas-experience flight-${phase}`} onClickCapture={navigate}>
    {atlasMounted && <div ref={atlas} className="flight-atlas" inert={hasOrbit} aria-hidden={hasOrbit}><Atlas edition={SWITZERLAND_EDITION} suspended={hasOrbit} /></div>}
    {hasOrbit && <div ref={orbit} className="flight-orbit" inert={phase !== 'orbital'} aria-hidden={phase !== 'orbital'}>
      {Orbit && <Orbit onReady={() => setReady(true)} onLoadError={message => {
        if (orbitalFlight.phase !== 'loading') return
        setError(message); history.replaceState(null, '', returnUrl.current); setWanted(false)
      }} />}
    </div>}
    {busy && <div className="flight-shield" aria-busy="true"><div className="flight-status" role="status">{phase === 'loading' ? 'Preparing the orbital view…' : phase === 'departing' ? 'Ascending to orbit' : 'Returning to your atlas'}{phase === 'loading' && <button onClick={() => { history.replaceState(null, '', returnUrl.current); setWanted(false) }}>Cancel</button>}</div></div>}
    {error && phase === 'atlas' && <div className="flight-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss message">×</button></div>}
  </div>
}
