import type { BufferAttribute, BufferGeometry } from 'three'
import type { TrailBuffers } from './trail-worker-data'

export function applyTrailBuffers(geometries: readonly BufferGeometry[], frame: TrailBuffers) {
  geometries.forEach((geometry, index) => {
    const count = frame.counts[index] * 2
    if (count > 0) {
      const positions = geometry.getAttribute('position').array as Float32Array
      const colors = geometry.getAttribute('color').array as Float32Array
      positions.set(frame.positions[index].subarray(0, count * 3))
      colors.set(frame.colors[index].subarray(0, count * 3))
    }
    updateActiveGeometry(geometry, count)
  })
}

/** Upload only vertices used by this frame; unused capacity stays on the GPU. */
export function updateActiveGeometry(geometry: BufferGeometry, count: number) {
  geometry.setDrawRange(0, count)
  for (const name of ['position', 'color']) {
    const attribute = geometry.getAttribute(name) as BufferAttribute | undefined
    if (!attribute) continue
    attribute.clearUpdateRanges()
    if (count === 0) continue
    attribute.addUpdateRange(0, count * attribute.itemSize)
    attribute.needsUpdate = true
  }
}
