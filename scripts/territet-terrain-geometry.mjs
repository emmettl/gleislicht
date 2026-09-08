import assert from 'node:assert/strict'
import { auditTerritetTerrain } from './audit-territet-terrain.mjs'

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]))
export function maskTerritetGroundDisagreements(route, ground) {
  const lengths = [0]
  route.points.slice(1).forEach((p, i) => lengths.push(lengths[i] + distance(p, route.points[i])))
  const total = lengths.at(-1), samples = [], ranges = [...route.maskedRanges]
  for (let d = 0; d <= total; d += 1) {
    const i = Math.max(1, lengths.findIndex(v => v >= d)), t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1])
    const p = route.points[i - 1].map((v, j) => v + (route.points[i][j] - v) * t), height = ground(p)
    samples.push({ progress: d / total, railHeight: p[2], groundHeight: height })
    if (height - p[2] > 2.5) ranges.push({ start: Math.max(0, (d - 3) / total), end: Math.min(1, (d + 3) / total), names: ['Rail and ground height disagreement'], kinds: ['Ground clearance'], reason: 'alignment' })
  }
  const merged = []
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
      last.names = [...new Set([...last.names, ...range.names])]; last.kinds = [...new Set([...last.kinds, ...range.kinds])]
    } else merged.push({...range})
  }
  return { maskedRanges: merged, samples }
}

export function territetGridHeight(grid, point) {
  const x = (point[0] / grid.widthMetres + .5) * (grid.columns - 1), y = (point[1] / grid.depthMetres + .5) * (grid.rows - 1)
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  assert(ix >= 0 && ix < grid.columns - 1 && iy >= 0 && iy < grid.rows - 1, 'Rail outside rendered terrain grid')
  const h = (dx, dy) => grid.elevations[(iy + dy) * grid.columns + ix + dx]
  // Match the actual NW/SW/NE and NE/SW/SE triangles drawn by the scene.
  return fx + fy <= 1 ? h(0, 0) * (1 - fx - fy) + h(1, 0) * fx + h(0, 1) * fy : h(1, 1) * (fx + fy - 1) + h(1, 0) * (1 - fy) + h(0, 1) * (1 - fx)
}
export function territetTerrainRoutes(source, network, evidence, fot, origin) {
  const audit = auditTerritetTerrain(source, network, evidence, fot)
  const local = p => [Number((p[0] - origin.easting).toFixed(3)), Number((origin.northing - p[1]).toFixed(3)), Number(p[2].toFixed(3))]
  const alternatives = audit.alternatives.map(a => {
    let d = 0
    const vertices = a.xyz.map((p, i) => {
      if (i) d += Math.hypot(p[0] - a.xyz[i - 1][0], p[1] - a.xyz[i - 1][1])
      return { p, d }
    })
    const points = [...vertices.filter(v => v.d > a.stops[0].distanceMetres && v.d < a.stops.at(-1).distanceMetres), ...a.stops.map(s => ({ p: s.xyz, d: s.distanceMetres }))].sort((a, b) => a.d - b.d).map(v => local(v.p))
    const distances = [0]
    points.slice(1).forEach((p, i) => distances.push(distances[i] + distance(p, points[i])))
    const progress = p => {
      const i = points.findIndex(v => distance(v, local(p)) < .0001)
      assert(i >= 0, 'Missing exact XYZ anchor')
      return distances[i] / distances.at(-1)
    }
    return { points, stops: a.stops.map(s => ({ id: s.id, name: s.name, progress: progress(s.xyz) })), loop: audit.junctions.map(progress), lengthMetres: distances.at(-1) }
  })
  const primary = alternatives[0], mid = primary.stops[1].progress
  // The two branch lengths differ. Cover the union of their fractions within
  // the Collonge–Glion timed segment, in either direction, with a 1 m margin.
  const fractions = alternatives.map(a => a.loop.map(p => (p - a.stops[1].progress) / (1 - a.stops[1].progress)))
  const start = mid + (1 - mid) * Math.min(...fractions.map(f => f[0])) - 1 / primary.lengthMetres
  const end = mid + (1 - mid) * Math.max(...fractions.map(f => f[1])) + 1 / primary.lengthMetres
  const trips = direction => network.trains.filter(t => network.stops[t.stops[0][0]][4] === (direction === 'ascent' ? 'ch:1:sloid:30673' : 'ch:1:sloid:30031')).map(t => t.id)
  const contextTracks = audit.alternatives.map(a => a.branchFeatureIds.flatMap((id, i) => {
    const p = source.features.find(f => f.id === id).paths[0]
    return (i ? p.slice(1) : p).map(local)
  }))
  return {
    route: { routeId: '93-TG-j26-1', legIndex: 0, vehicle: 'funicular', forwardTripIds: trips('ascent'), reverseTripIds: trips('descent'), points: primary.points, stops: primary.stops, maskedRanges: [{ start, end, names: ['Territet–Glion passing loop'], kinds: ['Unassigned passing-loop branches'], reason: 'alignment' }] },
    contextTracks, alternatives, fractions,
  }
}
