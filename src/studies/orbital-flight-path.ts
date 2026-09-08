import type { FlightPose, Point3 } from './orbital-flight.ts'

export function initialOrbitPose(width: number, height: number): FlightPose {
  const scale = Math.max(1, 1.25 * height / width)
  return { position: [0, 39 * scale, 24 * scale], target: [0, 0, 0], fov: 43 }
}
export function flightPose(from: FlightPose, to: FlightPose, progress: number): FlightPose {
  const t = Math.max(0, Math.min(1, progress)), ease = t * t * (3 - 2 * t)
  const mix = (a: number, b: number) => a + (b - a) * ease
  return {
    position: from.position.map((v, i) => mix(v, to.position[i])) as Point3,
    target: from.target.map((v, i) => mix(v, to.target[i])) as Point3,
    fov: mix(from.fov, to.fov),
  }
}
export function flightOpacity(progress: number): number {
  const t = Math.max(0, Math.min(1, (progress - 0.2) / 0.65))
  return t * t * (3 - 2 * t)
}
