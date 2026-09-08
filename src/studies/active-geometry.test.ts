import { expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry } from 'three'
import { updateActiveGeometry } from './active-geometry'

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
