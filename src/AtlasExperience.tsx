import { useUiLanguage } from './use-ui-language.ts'
import { useUiText } from './use-ui-text.ts'
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type MouseEvent } from 'react'
import { App } from './App.tsx'
import { SWITZERLAND_EDITION } from './editions/switzerland.ts'
import { orbitalFlight } from './studies/orbital-flight.ts'
import type { OrbitalTransitionProps } from './studies/OrbitalTransition.tsx'

const Atlas = memo(App)
const isOrbitUrl = () => new URLSearchParams(window.location.search).get('view') === 'orbital'
const atlasUrl = () => { const url = new URL(window.location.href); url.searchParams.delete('view'); return url.pathname + url.search + url.hash }

export default function AtlasExperience() {
  const [language] = useUiLanguage()
  const text = useUiText(language)
  const [directOrbit] = useState(isOrbitUrl)
  const [wanted, setWanted] = useState(directOrbit)
  const [atlasMounted, setAtlasMounted] = useState(!directOrbit)
  const [Transition, setTransition] = useState<ComponentType<OrbitalTransitionProps>>()
  const [error, setError] = useState(false)
  const phase = useSyncExternalStore(orbitalFlight.subscribe, orbitalFlight.snapshot)
  const atlas = useRef<HTMLDivElement>(null), returnUrl = useRef(atlasUrl())
  const returnFocus = useRef<HTMLElement | null>(null)
  const hasOrbit = phase !== 'atlas'
  const cancel = useCallback(() => {
    history.replaceState(null, '', returnUrl.current)
    setAtlasMounted(true); setWanted(false)
  }, [])

  useEffect(() => {
    const pop = () => setWanted(isOrbitUrl())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])

  useEffect(() => {
    if (!wanted || Transition) return
    let current = true
    void import('./studies/OrbitalTransition.tsx').then(module => {
      if (current) setTransition(() => module.default)
    }).catch(() => {
      if (!current) return
      setError(true)
      cancel()
    })
    return () => { current = false }
  }, [wanted, Transition, cancel])

  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
    if (!link || link.target || link.hasAttribute('download')) return
    const url = new URL(link.href)
    if (url.origin !== location.origin || url.pathname !== location.pathname) return
    const entering = url.searchParams.get('view') === 'orbital'
    if (!entering && !link.closest('.flight-orbit')) return
    event.preventDefault()
    if (entering) {
      if (phase !== 'atlas') return
      returnUrl.current = location.pathname + location.search + location.hash
      returnFocus.current = link
      atlas.current?.querySelectorAll('dialog[open]').forEach(dialog => (dialog as HTMLDialogElement).close())
      history.pushState({ orbitalFlight: true }, '', url.pathname + url.search + url.hash)
      setError(false); setWanted(true)
    } else {
      if (history.state?.orbitalFlight) history.back()
      else { history.pushState(null, '', returnUrl.current); setWanted(false) }
    }
  }
  return <div className={`atlas-experience flight-${phase}`} onClickCapture={navigate}>
    {atlasMounted && <div ref={atlas} className="flight-atlas" inert={hasOrbit} aria-hidden={hasOrbit}><Atlas edition={SWITZERLAND_EDITION} suspended={hasOrbit} /></div>}
    {Transition && <Transition wanted={wanted} setWanted={setWanted} directOrbit={directOrbit} atlasMounted={atlasMounted} setAtlasMounted={setAtlasMounted} atlas={atlas} returnUrl={returnUrl} returnFocus={returnFocus} />}
    {wanted && !Transition && <div className="flight-shield" aria-busy="true"><div className="flight-status" role="status">{text.orbitLoading}<button onClick={cancel}>{text.cancel}</button></div></div>}
    {error && <div className="flight-error" role="alert">{text.orbitLoadError}<button onClick={() => setError(false)} aria-label={text.dismissMessage}>×</button></div>}
  </div>
}
