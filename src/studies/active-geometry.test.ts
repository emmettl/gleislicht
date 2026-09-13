import { expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry } from 'three'
import { applyTrailBuffers } from './active-geometry'

it('applies transferred trail data and removes old geometry when a selection clears', () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(60), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(60), 3))
  const positions = new Float32Array([1, 2, 3, 4, 5, 6, 99, 99, 99])
  applyTrailBuffers([geometry], { positions: [positions], colors: [positions], counts: [1] })
  expect([...geometry.getAttribute('position').array.slice(0, 9)]).toEqual([1, 2, 3, 4, 5, 6, 0, 0, 0])
  expect(geometry.drawRange.count).toBe(2)
  applyTrailBuffers([geometry], { positions: [], colors: [], counts: [0] })
  expect(geometry.drawRange.count).toBe(0)
  geometry.dispose()
})
