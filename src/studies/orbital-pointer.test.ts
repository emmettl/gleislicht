import { describe, expect, it } from 'vitest'
import { createOrbitalPointer } from './orbital-pointer.ts'
const touch = (id = 1, x = 100, y = 100, inside = true) => ({ id, x, y, inside, type: 'touch' })
describe('orbital touch labels', () => {
  it('keeps a short tap available after the touch pointer leaves', () => {
    const p = createOrbitalPointer()
    p.down(touch()); p.move(touch(1, 104)); p.up(touch(1, 104), 100); p.leave('touch')
    expect(p.state).toMatchObject({ tap: true, inside: true, dragging: false, x: 104, holdUntil: 2600 })
  })
  it('does not select a city after a drag, including coalesced movement or release outside', () => {
    for (const mode of ['drag', 'coalesced', 'outside']) {
      const p = createOrbitalPointer(); p.down(touch())
      if (mode === 'drag') p.move(touch(1, 140))
      p.up(mode === 'coalesced' ? touch(1, 140) : touch(1, 100, 100, mode !== 'outside'), 100)
      expect(p.state).toMatchObject({ tap: false, inside: false, dragging: false, holdUntil: 0 })
    }
  })
  it('never mistakes a two-finger pinch or pan for a city tap, in either release order', () => {
    for (const order of [[1, 2], [2, 1]]) {
      const p = createOrbitalPointer(); p.down(touch(1)); p.down(touch(2, 130))
      p.up(touch(order[0], order[0] === 1 ? 100 : 130), 100)
      expect(p.state.dragging).toBe(true)
      p.up(touch(order[1], order[1] === 1 ? 100 : 130), 110)
      expect(p.state).toMatchObject({ tap: false, dragging: false, holdUntil: 0 })
    }
  })
  it('recovers from cancelled gestures and keeps mouse hover available', () => {
    const p = createOrbitalPointer(); p.down(touch()); p.cancel(); p.up(touch(), 100)
    expect(p.state.tap).toBe(false)
    p.down(touch()); p.up(touch(), 200); expect(p.state.tap).toBe(true)
    p.move({ ...touch(), type: 'mouse' }); expect(p.state.touch).toBe(false)
    p.leave('mouse'); expect(p.state.inside).toBe(false)
  })
})
