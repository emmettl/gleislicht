export interface OrbitalPointerSample { id: number; type: string; x: number; y: number; inside: boolean }

// Distinguish a city tap from camera gestures without preventing OrbitControls
// from receiving the same pointer events.
export function createOrbitalPointer() {
  const state = { x: 0, y: 0, inside: false, dragging: false, touch: false, tap: false, holdUntil: 0 }
  const active = new Set<number>()
  let startX = 0, startY = 0, moved = false
  const locate = (p: OrbitalPointerSample) => { state.x = p.x; state.y = p.y }
  return {
    state,
    move(p: OrbitalPointerSample) {
      locate(p)
      if (active.has(p.id) && Math.hypot(p.x - startX, p.y - startY) > 10) moved = true
      if (p.type !== 'touch') { state.touch = false; state.inside = p.inside }
    },
    leave(type: string) { if (type !== 'touch') state.inside = false },
    down(p: OrbitalPointerSample) {
      active.add(p.id)
      if (active.size === 1) { startX = p.x; startY = p.y; moved = false }
      else moved = true
      state.touch = p.type === 'touch'; state.dragging = true; state.tap = false; state.holdUntil = 0
      state.inside = !state.touch && p.inside
      locate(p)
    },
    up(p: OrbitalPointerSample, now: number) {
      if (!active.has(p.id)) return
      // Include the final displacement even if the browser coalesced moves.
      if (Math.hypot(p.x - startX, p.y - startY) > 10) moved = true
      if (p.type === 'touch' && active.size === 1 && !moved && p.inside) {
        locate(p); state.tap = true; state.inside = true; state.holdUntil = now + 2500
      }
      active.delete(p.id); state.dragging = active.size > 0
    },
    cancel() { active.clear(); state.inside = false; state.dragging = false; state.holdUntil = 0; state.tap = false },
  }
}
