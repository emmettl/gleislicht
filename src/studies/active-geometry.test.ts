import { expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry } from 'three'
import { applyTrailBuffers, updateActiveGeometry } from './active-geometry'

it('uploads only the drawn prefix as traffic grows, shrinks and disappears', () => {
  const geometry = new BufferGeometry()
  const positions = new BufferAttribute(new Float32Array(3000), 3)
  const colors = new BufferAttribute(new Float32Array(3000), 3)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('color', colors)
  for (const count of [10, 50, 2, 0, 25]) {
    const version = positions.version
    updateActiveGeometry(geometry, count)
    expect(geometry.drawRange).toEqual({ start: 0, count })
    expect(positions.updateRanges).toEqual(count ? [{ start: 0, count: count * 3 }] : [])
    expect(colors.updateRanges).toEqual(positions.updateRanges)
    expect(positions.version).toBe(version + Number(count > 0))
  }
  geometry.deleteAttribute('color')
  expect(() => updateActiveGeometry(geometry, 1)).not.toThrow()
  geometry.dispose()
})

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
