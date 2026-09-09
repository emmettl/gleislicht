import * as THREE from 'three'
import type { NetworkTrain, StationIndexEntry } from '@motionstudies/core/domain/network'
import type { StudyAirport } from '@motionstudies/core/domain/airport'

export type MapSelection =
  | { kind: 'road'; value: string }
  | { kind: 'station'; value: StationIndexEntry }
  | { kind: 'train'; value: NetworkTrain }
  | { kind: 'airport'; value: StudyAirport }

/** Pick airport overlays before aircraft, with a 44px mouse / 56px touch
 * marker target independent of camera zoom and the full visible label. */
export function pickAirportTarget(scene: THREE.Scene, camera: THREE.Camera,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number, clientY: number, touch: boolean): StudyAirport | undefined {
  const x = clientX - rect.left, y = clientY - rect.top
  if (rect.width <= 0 || rect.height <= 0 || x < 0 || y < 0 || x > rect.width || y > rect.height) return
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2(x / rect.width * 2 - 1, 1 - y / rect.height * 2), camera)
  const point = new THREE.Vector3()
  let marker: StudyAirport | undefined, nearest = touch ? 28 : 22
  let label: { airport: StudyAirport; order: number } | undefined
  scene.traverseVisible(object => {
    const airport = object.userData.pickAirport as StudyAirport | undefined
    if (!airport) return
    if (object instanceof THREE.Sprite) {
      if (!object.material.visible || object.material.opacity < 0.1) return
      if (ray.intersectObject(object, false).length && (!label || object.renderOrder > label.order)) {
        label = { airport, order: object.renderOrder }
      }
      return
    }
    object.getWorldPosition(point).project(camera)
    if (!Number.isFinite(point.x + point.y + point.z) || point.z < -1 || point.z > 1) return
    const distance = Math.hypot((point.x * 0.5 + 0.5) * rect.width - x, (0.5 - point.y * 0.5) * rect.height - y)
    if (distance <= nearest) { nearest = distance; marker = airport }
  })
  return label?.airport ?? marker
}

/** CSS-pixel picking: Three's world-space Points threshold grows with zoom. */
export function pickMapTarget(scene: THREE.Scene, camera: THREE.Camera,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number, clientY: number, touch: boolean,
  stations: ReadonlyMap<number, StationIndexEntry>, roadsOnly = false): MapSelection | undefined {
  const x = clientX - rect.left, y = clientY - rect.top
  if (rect.width <= 0 || rect.height <= 0 || x < 0 || y < 0 || x > rect.width || y > rect.height) return
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2(x / rect.width * 2 - 1, 1 - y / rect.height * 2), camera)
  const point = new THREE.Vector3()
  let marker: { target: MapSelection; distance: number; order: number } | undefined
  let road: { target: MapSelection; distance: number } | undefined
  const endpoint = new THREE.Vector3()
  let label: { target: MapSelection; order: number } | undefined
  scene.traverseVisible(object => {
    if (object instanceof THREE.Sprite) {
      const target = object.userData.pickTarget as MapSelection | undefined
      if (!target || (roadsOnly && target.kind !== 'road') || !object.material.visible || object.material.opacity < 0.1) return
      if (ray.intersectObject(object, false).length && (!label || object.renderOrder > label.order)) {
        label = { target, order: object.renderOrder }
      }
      return
    }
    if (object instanceof THREE.LineSegments && object.geometry.userData.pickRoads) {
      if (Array.isArray(object.material) || !object.material.visible || object.material.opacity < 0.1) return
      const positions = object.geometry.getAttribute('position')
      const end = Math.min(positions.count, object.geometry.drawRange.start + object.geometry.drawRange.count)
      for (let i = object.geometry.drawRange.start; i + 1 < end; i += 2) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera)
        endpoint.fromBufferAttribute(positions, i + 1).applyMatrix4(object.matrixWorld).project(camera)
        if (![point, endpoint].every(p => Number.isFinite(p.x + p.y + p.z) && p.z >= -1 && p.z <= 1)) continue
        const ax = (point.x * 0.5 + 0.5) * rect.width, ay = (0.5 - point.y * 0.5) * rect.height
        const dx = (endpoint.x - point.x) * rect.width * 0.5, dy = (point.y - endpoint.y) * rect.height * 0.5
        const t = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
        const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy)
        if (distance <= (touch ? 12 : 6) && (!road || distance < road.distance)) {
          road = { target: { kind: 'road', value: object.geometry.userData.pickRoads[i] }, distance }
        }
      }
      return
    }
    if (roadsOnly) return
    if (!(object instanceof THREE.Points || object instanceof THREE.Mesh)) return
    const geometry = object.geometry
    const { pickTrains, pickStops } = geometry.userData
    if (!pickTrains && !pickStops) return
    const material = object.material
    if (Array.isArray(material) || !material.visible || material.opacity < 0.01) return
    // Diagram ticks are triangles; at close zoom their centres can be many
    // pixels from a vertex, so also test the rendered face itself.
    if (object instanceof THREE.Mesh && pickStops) {
      const hit = ray.intersectObject(object, false)[0]
      const station = hit?.face && stations.get(pickStops[hit.face.a])
      if (station && (!marker || marker.distance > 0.5 || object.renderOrder > marker.order)) {
        marker = { target: { kind: 'station', value: station }, distance: 0, order: object.renderOrder }
      }
    }
    const positions = geometry.getAttribute('position')
    const end = Math.min(positions.count, geometry.drawRange.start + geometry.drawRange.count)
    for (let index = geometry.drawRange.start; index < end; index++) {
      const train = pickTrains?.[index] as NetworkTrain | undefined
      const station = stations.get(pickStops?.[index])
      if (!train && !station) continue
      point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld).project(camera)
      if (!Number.isFinite(point.x + point.y + point.z) || point.z < -1 || point.z > 1) continue
      const distance = Math.hypot((point.x * 0.5 + 0.5) * rect.width - x, (0.5 - point.y * 0.5) * rect.height - y)
      const radius = touch ? 14 : train ? 6 : 5
      if (distance > radius) continue
      if (marker && (distance > marker.distance + 0.5 || (Math.abs(distance - marker.distance) <= 0.5 && object.renderOrder <= marker.order))) continue
      const target: MapSelection = train ? { kind: 'train', value: train }
        : { kind: 'station', value: station! }
      marker = { target, distance, order: object.renderOrder }
    }
  })
  // Labels render above markers. A station dot underneath a label must not
  // steal its click, even when that dot is exactly under the pointer.
  return label?.target ?? marker?.target ?? road?.target
}

/** Remember maximum travel, so a drag out and back can never become a click. */
export class MapTapGesture {
  private pointers = new Map<number, { x: number; y: number; moved: boolean }>()
  private multiple = false
  down(id: number, x: number, y: number) {
    this.pointers.set(id, { x, y, moved: false })
    if (this.pointers.size > 1) this.multiple = true
  }
  move(id: number, x: number, y: number) {
    const start = this.pointers.get(id)
    if (start && Math.hypot(x - start.x, y - start.y) > 5) start.moved = true
  }
  up(id: number, x: number, y: number, cancelled = false) {
    this.move(id, x, y)
    const start = this.pointers.get(id)
    const tapped = Boolean(start && !start.moved && !this.multiple && !cancelled)
    this.pointers.delete(id)
    if (!this.pointers.size) this.multiple = false
    return tapped
  }
}
