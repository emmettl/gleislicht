import * as THREE from 'three'
import type { NetworkTrain, StationIndexEntry } from '@motionstudies/core/domain/network'

export type MapSelection =
  | { kind: 'station'; value: StationIndexEntry }
  | { kind: 'train'; value: NetworkTrain }

/** CSS-pixel picking: Three's world-space Points threshold grows with zoom. */
export function pickMapTarget(scene: THREE.Scene, camera: THREE.Camera,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number, clientY: number, touch: boolean,
  stations: ReadonlyMap<number, StationIndexEntry>): MapSelection | undefined {
  const x = clientX - rect.left, y = clientY - rect.top
  if (rect.width <= 0 || rect.height <= 0 || x < 0 || y < 0 || x > rect.width || y > rect.height) return
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2(x / rect.width * 2 - 1, 1 - y / rect.height * 2), camera)
  const point = new THREE.Vector3()
  let marker: { target: MapSelection; distance: number; order: number } | undefined
  let label: { target: MapSelection; order: number } | undefined
  scene.traverseVisible(object => {
    if (object instanceof THREE.Sprite) {
      const target = object.userData.pickTarget as MapSelection | undefined
      if (!target || !object.material.visible || object.material.opacity < 0.1) return
      if (ray.intersectObject(object, false).length && (!label || object.renderOrder > label.order)) {
        label = { target, order: object.renderOrder }
      }
      return
    }
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
  return label?.target ?? marker?.target
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
