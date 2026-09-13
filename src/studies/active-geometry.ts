import { updateActiveGeometry } from '@motionstudies/three/render-performance'
export { updateActiveGeometry } from '@motionstudies/three/render-performance'
import type { BufferGeometry } from 'three'
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

