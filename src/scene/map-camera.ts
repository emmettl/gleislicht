export const MIN_MAP_DISTANCE_SCALE = 0.02
export const MAX_MAP_DISTANCE_SCALE = 1.18
export type MapCameraFraming = 'switzerland' | 'zvv' | 'geneva' | 'zurich'

const LANDSCAPE_MAP_FIELD_OF_VIEW = 44
const MAX_PORTRAIT_MAP_FIELD_OF_VIEW = 82

/**
 * Keeps roughly the same horizontal map coverage when the canvas becomes
 * portrait-shaped. A fixed vertical FOV makes a national map look accidentally
 * magnified on phones because the horizontal FOV collapses with the aspect ratio.
 */
export function mapCameraFieldOfView(viewportAspect: number): number {
  if (!Number.isFinite(viewportAspect) || viewportAspect >= 1) {
    return LANDSCAPE_MAP_FIELD_OF_VIEW
  }

  const safeAspect = Math.max(0.45, viewportAspect)
  const baseHalfFov = (LANDSCAPE_MAP_FIELD_OF_VIEW * Math.PI) / 360
  const fittedFieldOfView =
    (Math.atan(Math.tan(baseHalfFov) / safeAspect) * 360) / Math.PI

  return Math.min(MAX_PORTRAIT_MAP_FIELD_OF_VIEW, fittedFieldOfView)
}

export function homeMapDistanceScale(framing: MapCameraFraming): number {
  if (framing === 'zurich') return 0.06
  if (framing === 'geneva') return 0.13
  if (framing === 'zvv') return 0.24
  return 1
}

const EDGE_EASING = 0.42
const MOUSE_PAN_SCALE = 0.064
const TOUCH_PAN_SCALE = 0.078
const WHEEL_ZOOM_SENSITIVITY = 0.002

export function mapPanScale(
  distanceScale: number,
  pointerType: string,
): number {
  return (
    (pointerType === 'touch' ? TOUCH_PAN_SCALE : MOUSE_PAN_SCALE) *
    distanceScale
  )
}

export function mapCameraDampingRate(
  followingTrain: boolean,
  directTouch: boolean,
): number {
  if (followingTrain) return 1.7
  return directTouch ? 11 : 8
}

export function mapWheelZoomMultiplier(
  deltaY: number,
  deltaMode = 0,
): number {
  const normalizedDelta =
    deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 320 : 1)
  return Math.exp(normalizedDelta * WHEEL_ZOOM_SENSITIVITY)
}

/**
 * Keeps zoom direct through the useful range, then eases asymptotically toward the
 * limits. Repeated wheel or pinch input can approach an edge but never push the map
 * through the scene fog.
 */
export function applyMapZoom(current: number, multiplier: number): number {
  const safeCurrent = Math.min(
    MAX_MAP_DISTANCE_SCALE,
    Math.max(MIN_MAP_DISTANCE_SCALE, current),
  )
  const proposed = safeCurrent * multiplier
  if (proposed < MIN_MAP_DISTANCE_SCALE) {
    return safeCurrent + (MIN_MAP_DISTANCE_SCALE - safeCurrent) * EDGE_EASING
  }
  if (proposed > MAX_MAP_DISTANCE_SCALE) {
    return safeCurrent + (MAX_MAP_DISTANCE_SCALE - safeCurrent) * EDGE_EASING
  }
  return proposed
}
