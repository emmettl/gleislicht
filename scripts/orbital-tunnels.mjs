// A plan-view visibility mask, not a tunnel elevation or engineering model.
// The corridor is narrow and direction-sensitive so crossing surface tracks
// are not mistaken for underground railway. Results are cached by route edge.
export function createOrbitalTunnelMatcher(tunnels, project, coarsePassages = []) {
  const metre = 12 / 111320, width = 100 * metre, cell = 1000 * metre
  const grid = new Map(), cache = new Map(), matched = new Set(), coarseMatched = new Set()
  const passages = coarsePassages.map(p => ({ ...p, portals: p.portals.map(project) }))
  for (const tunnel of tunnels) {
    const points = tunnel.coordinates.map(project)
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i - 1], dx = points[i][0] - x, dz = points[i][1] - z
      const length = Math.hypot(dx, dz)
      if (length < metre) continue
      const segment = { x, z, ux: dx / length, uz: dz / length, length, id: tunnel.id }
      for (let gx = Math.floor((Math.min(x, x + dx) - width) / cell); gx <= Math.floor((Math.max(x, x + dx) + width) / cell); gx++) {
        for (let gz = Math.floor((Math.min(z, z + dz) - width) / cell); gz <= Math.floor((Math.max(z, z + dz) + width) / cell); gz++) {
          const key = `${gx},${gz}`
          if (!grid.has(key)) grid.set(key, [])
          grid.get(key).push(segment)
        }
      }
    }
  }
  function edge(ax, az, bx, bz) {
    const key = [ax, az, bx, bz].map(v => v.toFixed(6)).join(',')
    if (cache.has(key)) return cache.get(key)
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), ranges = []
    if (length > metre) {
      for (const passage of passages) {
        const projections = passage.portals.map(([x, z]) => ({
          u: ((x - ax) * dx + (z - az) * dz) / (length * length),
          distance: Math.abs((x - ax) * dz - (z - az) * dx) / length,
        }))
        const portalLength = Math.hypot(passage.portals[1][0] - passage.portals[0][0], passage.portals[1][1] - passage.portals[0][1])
        if (length < portalLength * 0.9 || length > portalLength + 12000 * metre) continue
        if (projections.some(p => p.u < -0.02 || p.u > 1.02 || p.distance > 1500 * metre)) continue
        const lo = Math.min(...projections.map(p => p.u)), hi = Math.max(...projections.map(p => p.u))
        if ((hi - lo) * length / portalLength < 0.98) continue
        ranges.push([Math.max(0, lo), Math.min(1, hi)]); coarseMatched.add(passage.name)
      }
      const candidates = new Set()
      // Walking the edge avoids visiting a huge rectangular area for a long diagonal.
      const steps = Math.ceil(length / (cell / 2))
      for (let i = 0; i <= steps; i++) {
        const gx = Math.floor((ax + dx * i / steps) / cell), gz = Math.floor((az + dz * i / steps) / cell)
        for (let x = gx - 1; x <= gx + 1; x++) for (let z = gz - 1; z <= gz + 1; z++) {
          for (const segment of grid.get(`${x},${z}`) ?? []) candidates.add(segment)
        }
      }
      for (const s of candidates) {
        const along = dx * s.ux + dz * s.uz
        if (Math.abs(along) / length < 0.85) continue
        let lo = 0, hi = 1
        const clip = (origin, direction, min, max) => {
          if (Math.abs(direction) < 1e-12) return origin >= min && origin <= max
          const a = (min - origin) / direction, b = (max - origin) / direction
          lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b))
          return hi > lo
        }
        const x = ax - s.x, z = az - s.z
        if (!clip(x * s.ux + z * s.uz, along, 0, s.length)) continue
        if (!clip(-x * s.uz + z * s.ux, -dx * s.uz + dz * s.ux, -width, width)) continue
        ranges.push([lo, hi]); matched.add(s.id)
      }
    }
    ranges.sort((a, b) => a[0] - b[0])
    const merged = []
    for (const range of ranges) {
      const last = merged.at(-1)
      if (last && range[0] <= last[1] + 1e-7) last[1] = Math.max(last[1], range[1])
      else merged.push([...range])
    }
    cache.set(key, merged)
    return merged
  }
  return {
    matched, coarseMatched,
    intervals(knots, category, journeyStart = knots[0], journeyEnd = knots.at(-3)) {
      if (!(category >= 0 && category <= 5 || category === 7 || category === 11)) return []
      const ranges = []
      for (let i = 3; i < knots.length; i += 3) {
        const start = knots[i - 3], end = knots[i]
        let parts = edge(knots[i - 2], knots[i - 1], knots[i + 1], knots[i + 2])
        if (Math.hypot(knots[i + 1] - knots[i - 2], knots[i + 2] - knots[i - 1]) < metre) {
          const before = ranges.at(-1)?.[1] >= start - 0.01
          const after = i + 3 < knots.length && edge(knots[i + 1], knots[i + 2], knots[i + 4], knots[i + 5])[0]?.[0] === 0
          if (before || after) parts = [[0, 1]]
        }
        for (const [a, b] of parts) {
          const range = [start + (end - start) * a, start + (end - start) * b], last = ranges.at(-1)
          if (last && range[0] <= last[1] + 0.01) last[1] = Math.max(last[1], range[1])
          else ranges.push(range)
        }
      }
      const rounded = []
      for (const [a, b] of ranges) {
        const entry = Math.fround(Math.max(journeyStart, a)), exit = Math.fround(Math.min(journeyEnd, b)), last = rounded.at(-1)
        if (exit <= entry) continue
        if (last && entry <= last[1]) last[1] = Math.max(last[1], exit)
        else rounded.push([entry, exit])
      }
      return rounded.flat()
    },
  }
}
