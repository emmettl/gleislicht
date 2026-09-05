import * as THREE from 'three'
import type { AirPosition } from '../domain/air.ts'

export interface AirProjection {
  readonly centreLongitude: number
  readonly centreLatitude: number
  readonly longitudeScale: number
  readonly scale: number
}

export type ProjectedAirPosition = readonly [x: number, y: number, z: number]

export function airAltitudeHeight(altitudeFeet: number): number {
  return THREE.MathUtils.clamp(0.42 + altitudeFeet / 5_200, 0.42, 8.4)
}

export function projectAirPosition(
  position: Pick<AirPosition, 'longitude' | 'latitude' | 'altitudeFeet'>,
  projection: AirProjection,
): ProjectedAirPosition {
  return [
    (position.longitude - projection.centreLongitude) *
      projection.longitudeScale *
      projection.scale,
    airAltitudeHeight(position.altitudeFeet),
    -(position.latitude - projection.centreLatitude) * projection.scale,
  ]
}
