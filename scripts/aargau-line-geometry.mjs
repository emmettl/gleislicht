import assert from 'node:assert/strict'
import { distanceMetres, simplifyRoad } from './enrich-postbus-roads.mjs'

export const AARGAU_LIMITS = { snapMetres: 120, detourRatio: 4.5, detourFloorMetres: 1200, simplifyMetres: 5, projectionCandidates: 'local distance minima within snap limit', closedLoopMaximumLaps: 1 }
export const sourceMode = name => ({ Bus: 'bus', Zug: 'rail', Tram: 'tram', Schiff: 'ferry' })[name]
export const identityKey = (agencyId, mode, line) => `${agencyId}:${mode}:${line}`

export function pointInCanton(point, geometry) {
  assert.equal(geometry.type, 'MultiPolygon')
  const ringContains = ring => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j]
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
    }
    return inside
  }
  return geometry.coordinates.some(polygon => ringContains(polygon[0]) && !polygon.slice(1).some(ringContains))
}

export function lineIndex(collection, crosswalk = []) {
  const index = new Map()
  for (const feature of collection.features) {
    const p = feature.properties, mode = sourceMode(p.VM_NAME)
    assert(mode && p.GO_NR && p.NR, 'Missing AGIS identity')
    assert.equal(feature.geometry.type, 'MultiLineString')
    const mapped = crosswalk.filter(row => row.go === p.GO_NR && row.sourceLine === p.NR && row.mode === mode)
    const keys = mapped.length ? mapped.map(row => identityKey(row.agencyId, mode, row.line)) : [identityKey(p.GO_NR, mode, p.NR)]
    for (const key of keys) {
      const entries = index.get(key) ?? []
      feature.geometry.coordinates.forEach((points, part) => {
        assert(points.length >= 2 && points.every(p => p.length === 2 && p.every(Number.isFinite) && p[0] > 6 && p[0] < 10 && p[1] > 46 && p[1] < 49))
        const distances = [0]
        for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + distanceMetres(points[i - 1], points[i]))
        entries.push({ featureId: feature.id, part, sourceDirection: p.RICHTUNG || 'unspecified', points, distances, length: distances.at(-1) })
      })
      index.set(key, entries)
    }
  }
  return index
}

function projections(point, line, limits) {
  const candidates = [], scale = Math.cos(point[1] * Math.PI / 180)
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1], b = line.points[i]
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1]
    if (!dx && !dy) continue
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    const coordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    const gap = distanceMetres(point, coordinate)
    candidates.push({ coordinate, gap, position: line.distances[i - 1] + t * (line.distances[i] - line.distances[i - 1]) })
  }
  // Preserve distinct positions at loops and repeated vertices. Do not collapse
  // projections merely because their coordinates coincide.
  const seen = new Set()
  return candidates.filter((p, i) => p.gap <= limits.snapMetres && p.gap <= (candidates[i - 1]?.gap ?? Infinity) && p.gap <= (candidates[i + 1]?.gap ?? Infinity)).sort((a, b) => a.gap - b.gap).filter(p => {
    const key = p.position.toFixed(2)
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}

function assess(from, to, a, b, limits) {
  if (!a || !b) return { reason: 'endpoint-gap' }
  const length = b.progress - a.progress, direct = distanceMetres(from, to)
  if (length < -0.01) return { reason: 'wrong-order' }
  if (length < 1 || (direct > 30 && length < direct * 0.5)) return { reason: 'collapsed-path' }
  if (length > Math.max(limits.detourFloorMetres, direct * limits.detourRatio)) return { reason: 'implausible-detour' }
  return { accepted: true, pathMetres: length, maximumSnapMetres: Math.max(a.gap, b.gap) }
}

function slice(line, from, to, a, b, reverse, tolerance) {
  const low = Math.min(a.position, b.position), high = Math.max(a.position, b.position)
  const middle = line.points.filter((_, i) => line.distances[i] > low && line.distances[i] < high)
  if (reverse) middle.reverse()
  return [from.slice(0, 2), ...simplifyRoad([a.coordinate, ...middle, b.coordinate], tolerance).map(p => p.map(n => Number(n.toFixed(7)))), to.slice(0, 2)]
    .filter((p, i, points) => !i || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1])
}

// One source feature/part and one orientation per full ordered GTFS pattern.
// Missing endpoint geometry is explicit; it never resets the progress cursor.
// The source direction label is not assumed to equal GTFS direction_id.
export function matchAargauPattern(lines, stops, limits = AARGAU_LIMITS) {
  if (!lines?.length) return { segments: stops.slice(1).map(() => ({ reason: 'missing-operator-mode-line' })) }
  let best
  for (const original of lines) {
    // An exactly closed source part can start at an arbitrary digitising vertex.
    // Unroll it once; constrain every candidate to no more than one full lap.
    const closed = original.points[0][0] === original.points.at(-1)[0] && original.points[0][1] === original.points.at(-1)[1]
    const line = closed ? { ...original, points: [...original.points, ...original.points.slice(1)], distances: [...original.distances, ...original.distances.slice(1).map(d => d + original.length)], length: original.length * 2 } : original
    const projected = stops.map(stop => projections(stop, line, limits))
    for (const reverse of [false, true]) {
      let states = [{ firstProgress: null, lastProgress: -Infinity, previous: null, chain: [], matched: 0, gap: 0 }]
      for (let i = 0; i < stops.length && states.length; i++) {
        const candidates = projected[i].map(p => ({ ...p, progress: reverse ? line.length - p.position : p.position }))
        const next = new Map()
        for (const state of states) for (const candidate of [...candidates, null]) {
          if (candidate && candidate.progress < state.lastProgress - 0.01) continue
          if (closed && candidate && (state.firstProgress === null ? candidate.progress > original.length : candidate.progress - state.firstProgress > original.length + 0.01)) continue
          const accepted = i && assess(stops[i - 1], stops[i], state.previous, candidate, limits).accepted
          const result = { firstProgress: state.firstProgress ?? candidate?.progress ?? null, lastProgress: candidate?.progress ?? state.lastProgress, previous: candidate, chain: [...state.chain, candidate], matched: state.matched + (accepted ? 1 : 0), gap: state.gap + (candidate?.gap ?? limits.snapMetres) }
          const key = `${closed ? result.firstProgress : ''}:${result.lastProgress.toFixed(2)}:${candidate ? 1 : 0}`
          const existing = next.get(key)
          if (!existing || result.matched > existing.matched || (result.matched === existing.matched && result.gap < existing.gap)) next.set(key, result)
        }
        states = [...next.values()]
      }
      for (const state of states) {
        if (best && (state.matched < best.matched || (state.matched === best.matched && state.gap >= best.gap))) continue
        best = { ...state, line, reverse, projected, closed }
      }
    }
  }
  if (!best) return { segments: stops.slice(1).map(() => ({ reason: 'no-monotone-source-pattern' })) }
  const { line, reverse, chain } = best
  const segments = stops.slice(1).map((to, i) => {
    const result = assess(stops[i], to, chain[i], chain[i + 1], limits)
    if (result.reason === 'endpoint-gap' && ((!chain[i] && best.projected[i].length) || (!chain[i + 1] && best.projected[i + 1].length))) result.reason = 'pattern-order-gap'
    return result.accepted ? { ...result, path: slice(line, stops[i], to, chain[i], chain[i + 1], reverse, limits.simplifyMetres ?? 5) } : result
  })
  return { featureId: line.featureId, part: line.part, sourceDirection: line.sourceDirection, coordinateOrder: reverse ? 'reversed' : 'forward', closedLoop: best.closed, stopProgressMetres: chain.map(p => p?.progress ?? null), segments }
}
