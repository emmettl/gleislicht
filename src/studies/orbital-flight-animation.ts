import { orbitalFlight, type FlightPose } from './orbital-flight.ts'
import { flightOpacity, flightPose, initialOrbitPose } from './orbital-flight-path.ts'

// Loaded with orbit, so the atlas's first view pays only for the camera bridge.
export function animateOrbitalFlight({ departing, saved, orbit, atlas, focus, title }: {
  departing: boolean; saved: FlightPose | null; orbit: HTMLDivElement | null;
  atlas: HTMLDivElement | null; focus: HTMLElement | null; title: string;
}) {
  const home = initialOrbitPose(window.innerWidth, window.innerHeight)
  const from = departing ? saved ?? home : orbitalFlight.orbit?.capture() ?? home
  const to = departing ? home : [...orbitalFlight.atlas][0]?.destination?.() ?? saved ?? home
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1700
  const start = performance.now()
  let frame = 0
  const step = (now: number) => {
    const progress = duration ? Math.min(1, (now - start) / duration) : 1
    orbitalFlight.pose = flightPose(from, to, progress)
    if (orbit) orbit.style.opacity = String(departing ? flightOpacity(progress) : 1 - flightOpacity(progress))
    if (progress < 1) frame = requestAnimationFrame(step)
    else {
      // Render the endpoint before releasing either camera to its controls.
      frame = requestAnimationFrame(() => {
        if (!departing) orbitalFlight.atlas.forEach(camera => camera.restore())
        orbitalFlight.pose = null
        orbitalFlight.setPhase(departing ? 'orbital' : 'atlas')
        if (!departing) document.title = title
        requestAnimationFrame(() => {
          if (departing) orbit?.querySelector<HTMLAnchorElement>('.orbital-back')?.focus({ preventScroll: true })
          else (focus?.isConnected ? focus : atlas?.querySelector<HTMLElement>('.masthead-orbital'))?.focus({ preventScroll: true })
        })
      })
    }
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}
