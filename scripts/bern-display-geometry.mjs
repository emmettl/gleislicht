import assert from 'node:assert/strict'
import { bernLv95 } from './bern-spatial.mjs'

export function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy)
}

// Display only: retain original WGS84 vertices and both projected stop endpoints.
// Admission continues to use the complete, unsimplified source graph.
export function simplifyBernPath(path, toleranceMetres) {
  assert(Number.isFinite(toleranceMetres) && toleranceMetres >= 0)
  const metric = path.map(bernLv95), keep = new Set([0, path.length - 1]), stack = [[0, path.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let maximum = toleranceMetres, farthest
    for (let i = a + 1; i < b; i++) {
      const distance = distanceToSegment(metric[i], metric[a], metric[b])
      if (distance > maximum) { maximum = distance; farthest = i }
    }
    if (farthest !== undefined) { keep.add(farthest); stack.push([a, farthest], [farthest, b]) }
  }
  return [...keep].sort((a, b) => a - b).map(i => path[i])
}

// Independently verify each original subchain against its retained chord.
// Each point on an original segment is bounded too, by convexity of distance
// to a segment. This is a positional bound, not a route-length guarantee.
export function bernDisplayDeviation(original, simplified) {
  assert.deepEqual(simplified[0], original[0])
  assert.deepEqual(simplified.at(-1), original.at(-1))
  let cursor = 0, maximum = 0
  for (let j = 1; j < simplified.length; j++) {
    const a = bernLv95(simplified[j - 1]), b = bernLv95(simplified[j])
    let next = cursor + 1
    while (next < original.length && (original[next][0] !== simplified[j][0] || original[next][1] !== simplified[j][1])) next++
    assert(next < original.length, 'Bern: display path is not an ordered source subsequence')
    for (let i = cursor; i <= next; i++) maximum = Math.max(maximum, distanceToSegment(bernLv95(original[i]), a, b))
    cursor = next
  }
  assert.equal(cursor, original.length - 1)
  return maximum
}
