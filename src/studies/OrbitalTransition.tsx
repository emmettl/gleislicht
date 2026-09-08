/* oxlint-disable react/set-state-in-effect -- Synchronize asynchronous scene readiness with the external camera flight channel. */
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { orbitalFlight, type FlightPose } from './orbital-flight.ts'
import type { OrbitalViewProps } from './OrbitalView.tsx'

export interface OrbitalTransitionProps {
  wanted: boolean
  setWanted: Dispatch<SetStateAction<boolean>>
  directOrbit: boolean
  atlasMounted: boolean
  setAtlasMounted: Dispatch<SetStateAction<boolean>>
  atlas: RefObject<HTMLDivElement | null>
  returnUrl: RefObject<string>
  returnFocus: RefObject<HTMLElement | null>
}

export default function OrbitalTransition({ wanted, setWanted, directOrbit, atlasMounted, setAtlasMounted, atlas, returnUrl, returnFocus }: OrbitalTransitionProps) {
  const [Orbit, setOrbit] = useState<ComponentType<OrbitalViewProps>>()
  const [ready, setReady] = useState(false), [error, setError] = useState('')
  const phase = useSyncExternalStore(orbitalFlight.subscribe, orbitalFlight.snapshot)
  const orbit = useRef<HTMLDivElement>(null)
  const saved = useRef<FlightPose | null>(null), atlasTitle = useRef(document.title)
  const animate = useRef<typeof import('./orbital-flight-animation.ts').animateOrbitalFlight | null>(null)
  const hasOrbit = phase !== 'atlas'
  useEffect(() => {
    if (!wanted && phase === 'atlas') return
    if (Orbit) return
    let cancelled = false
    Promise.all([import('./OrbitalView.tsx'), import('./orbital-flight-animation.ts')]).then(([module, flight]) => {
      if (!cancelled) { animate.current = flight.animateOrbitalFlight; setOrbit(() => module.default) }
    }).catch(() => { if (!cancelled) { setError('The orbital view could not load. Please try again.'); setWanted(false); history.replaceState(null, '', returnUrl.current) } })
    return () => { cancelled = true }
  }, [wanted, phase, Orbit, returnUrl, setWanted])

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
  }, [wanted, phase, ready, directOrbit, atlasMounted, setAtlasMounted])

  useEffect(() => {
    if (phase !== 'loading') return
    const timeout = window.setTimeout(() => {
      setError('Orbit is taking too long to prepare. Your atlas is still here; please try again.')
      history.replaceState(null, '', returnUrl.current); setWanted(false)
    }, 45000)
    return () => window.clearTimeout(timeout)
  }, [phase, returnUrl, setWanted])

  useEffect(() => {
    if (phase !== 'departing' && phase !== 'returning') return
    return animate.current?.({
      departing: phase === 'departing', saved: saved.current,
      orbit: orbit.current, atlas: atlas.current, focus: returnFocus.current,
      title: atlasTitle.current,
    })
  }, [phase, atlas, returnFocus])

  const busy = phase === 'loading' || phase === 'departing' || phase === 'returning'
  return <>
    {hasOrbit && <div ref={orbit} className="flight-orbit" inert={phase !== 'orbital'} aria-hidden={phase !== 'orbital'}>
      {Orbit && <Orbit onReady={() => setReady(true)} onLoadError={message => {
        if (orbitalFlight.phase !== 'loading') return
        setError(message); history.replaceState(null, '', returnUrl.current); setWanted(false)
      }} />}
    </div>}
    {busy && <div className="flight-shield" aria-busy="true"><div className="flight-status" role="status">{phase === 'loading' ? 'Preparing the orbital view…' : phase === 'departing' ? 'Ascending to orbit' : 'Returning to your atlas'}{phase === 'loading' && <button onClick={() => { history.replaceState(null, '', returnUrl.current); setWanted(false) }}>Cancel</button>}</div></div>}
    {error && phase === 'atlas' && <div className="flight-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss message">×</button></div>}
  </>
}
