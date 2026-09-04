import type { ServiceCategory } from '../domain/network.ts'
import {
  homeMapDistanceScale,
  type MapCameraFraming,
} from './map-camera.ts'

export function regionalCameraHeight(
  cameraHeight: number,
  framing: MapCameraFraming,
): number {
  return framing === 'zvv'
    ? cameraHeight / homeMapDistanceScale(framing)
    : cameraHeight
}

export function vehicleIsVisibleAtZoom(
  category: ServiceCategory,
  cameraHeight: number,
  framing: MapCameraFraming,
  focused = false,
): boolean {
  if (focused || framing !== 'zvv') return true
  const relativeHeight = regionalCameraHeight(cameraHeight, framing)
  if (category === 'bus') return relativeHeight < 22
  if (category === 'tram') return relativeHeight < 30
  return true
}

export function localNetworkDetailAtZoom(
  cameraHeight: number,
  framing: MapCameraFraming,
): number {
  if (framing !== 'zvv') return 1
  const relativeHeight = regionalCameraHeight(cameraHeight, framing)
  return Math.min(1, Math.max(0, (32 - relativeHeight) / 12))
}
