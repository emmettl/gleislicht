export type FlightPhase = 'atlas' | 'loading' | 'departing' | 'orbital' | 'returning'
export type Point3 = [number, number, number]
export interface FlightPose { position: Point3; target: Point3; fov: number }
export interface MapProjection { centreLongitude: number; centreLatitude: number; longitudeScale: number; scale: number }
export interface FlightCamera { capture: () => FlightPose; restore: () => void; destination?: () => FlightPose | undefined }

const longitudeScale = Math.cos(46.8 * Math.PI / 180)
export function toOrbit(point: Point3, projection: MapProjection): Point3 {
  return [
    (point[0] / projection.scale / projection.longitudeScale + projection.centreLongitude - 8.23) * longitudeScale * 12,
    point[1] * 12 / projection.scale,
    (point[2] / projection.scale - projection.centreLatitude + 46.8) * 12,
  ]
}
export function fromOrbit(point: Point3, projection: MapProjection): Point3 {
  return [
    (point[0] / 12 / longitudeScale + 8.23 - projection.centreLongitude) * projection.longitudeScale * projection.scale,
    point[1] * projection.scale / 12,
    (point[2] / 12 - 46.8 + projection.centreLatitude) * projection.scale,
  ]
}
// A small shared camera channel, independent of either renderer's large data
// props. Both canvases sample the same pose before drawing each frame.
const listeners = new Set<() => void>()
export const orbitalFlight = {
  phase: 'atlas' as FlightPhase,
  pose: null as FlightPose | null,
  atlas: new Set<FlightCamera>(),
  orbit: null as FlightCamera | null,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot: (): FlightPhase => orbitalFlight.phase,
  setPhase(phase: FlightPhase) { orbitalFlight.phase = phase; listeners.forEach(listener => listener()) },
}
