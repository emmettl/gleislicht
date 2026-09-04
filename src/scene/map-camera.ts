export const MIN_MAP_DISTANCE_SCALE = 0.02
export const MAX_MAP_DISTANCE_SCALE = 1.18
export type MapCameraFraming = 'switzerland' | 'zvv' | 'geneva' | 'zurich'

export function homeMapDistanceScale(framing: MapCameraFraming): number {
  if (framing === 'zurich') return 0.06
  if (framing === 'geneva') return 0.13
  if (framing === 'zvv') return 0.24
  return 1
}

const EDGE_EASING = 0.42

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
