import * as THREE from 'three'

export interface RoadLabelAnchor {
  readonly id: string
  readonly road: string
  readonly position: THREE.Vector3
}

/** Sample the road once in map coordinates, independently of the camera. */
export function roadLabelAnchors(id: string, road: string, points: readonly THREE.Vector3[], spacing: number): RoadLabelAnchor[] {
  if (points.length < 2 || !Number.isFinite(spacing) || spacing <= 0) return []
  const lengths = points.slice(1).map((point, index) => point.distanceTo(points[index]))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (total === 0) return []
  const anchors: RoadLabelAnchor[] = []
  let next = Math.min(spacing, total) / 2
  let travelled = 0
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]
    if (length === 0) continue
    while (next < total && next <= travelled + length) {
      anchors.push({
        id: `${id}:${anchors.length}`, road,
        position: points[index].clone().lerp(points[index + 1], (next - travelled) / length),
      })
      next += spacing
    }
    travelled += length
  }
  return anchors
}

/** Keep existing labels first; zoom only changes visibility, never anchors. */
export function visibleRoadLabels(
  anchors: readonly RoadLabelAnchor[], camera: THREE.Camera,
  size: { width: number; height: number }, previous: ReadonlySet<string>, selectedRoadId?: string,
): RoadLabelAnchor[] {
  const occupied: { x: number; y: number; road: string; retained: boolean }[] = []
  return [...anchors].sort((a, b) =>
    Number(b.road === selectedRoadId) - Number(a.road === selectedRoadId)
    || Number(previous.has(b.id)) - Number(previous.has(a.id)),
  ).filter(anchor => {
    const projected = anchor.position.clone().project(camera)
    const x = (projected.x + 1) * size.width / 2
    const y = (1 - projected.y) * size.height / 2
    if (projected.z < -1 || projected.z > 1 || x < 24 || x > size.width - 24 || y < 16 || y > size.height - 16) return false
    const retained = previous.has(anchor.id)
    if (occupied.some(other => other.road === anchor.road
      // Hysteresis stops badges blinking at a zoom threshold.
      ? Math.hypot(x - other.x, y - other.y) < (retained && other.retained ? 130 : 180)
      : Math.abs(x - other.x) < 50 && Math.abs(y - other.y) < 31)) return false
    occupied.push({ x, y, road: anchor.road, retained })
    return true
  })
}
