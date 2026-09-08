import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export const sbbSegmentKey = r => JSON.stringify([r.linienr, r.bp_anfang, r.bp_ende, r.km_agm_von, r.km_agm_bis])
const length = path => path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)

export function zugSbbRailSupplement(pages, policy) {
  const records = new Map()
  for (const page of pages) {
    assert.equal(page.results.length, page.total_count, 'Truncated SBB response')
    for (const r of page.results) {
      const key = sbbSegmentKey(r)
      assert(!records.has(key), 'Duplicate SBB segment identity')
      records.set(key, r)
    }
  }
  const corridors = policy.corridors.map(c => {
    assert.equal(new Set(c.operatingPointIds).size, 2)
    const features = c.features.map(identity => {
      const r = records.get(JSON.stringify(identity)); assert(r, 'Missing reviewed SBB segment')
      assert.equal(r.spurweite, 'N', 'Unreviewed SBB gauge')
      const g = r.geo_shape.geometry
      assert.equal(g.type, 'LineString')
      assert(g.coordinates.length > 2, 'Schematic two-point line cannot supply geometry')
      assert(g.coordinates.every(p => p.length === 2 && p.every(Number.isFinite)))
      return r
    })
    assert.equal(features[0].bp_anfang, c.sourcePointCodes[0])
    assert.equal(features.at(-1).bp_ende, c.sourcePointCodes[1])
    for (let i = 1; i < features.length; i++) {
      assert.equal(features[i - 1].bp_ende, features[i].bp_anfang, 'Broken operating-point chain')
      assert.deepEqual(features[i - 1].geo_shape.geometry.coordinates.at(-1), features[i].geo_shape.geometry.coordinates[0], 'Disconnected SBB curves')
    }
    return { ...c, coordinates: features.flatMap((r, i) => r.geo_shape.geometry.coordinates.slice(i ? 1 : 0)) }
  })
  return {
    inventory: [...records].map(([key, r]) => ({ key, line: r.linienr, from: r.bp_anf_bez, to: r.bp_end_bez, gauge: r.spurweite,
      vertices: r.geo_shape.geometry.coordinates.length, usedBy: corridors.filter(c => c.features.some(id => JSON.stringify(id) === key)).map(c => c.id) })),
    matchPair(original, route, from, to) {
      if (original.path) return original
      const candidates = corridors.filter(c => c.agencyId === route.agencyId && c.routes.some(r => r.routeId === route.routeId && r.line === route.line)
        && c.operatingPointIds.includes(from.didok) && c.operatingPointIds.includes(to.didok) && from.didok !== to.didok)
      assert(candidates.length <= 1, 'Ambiguous SBB corridor review')
      if (!candidates.length) return original
      const c = candidates[0], curve = from.didok === c.operatingPointIds[0] ? c.coordinates : [...c.coordinates].reverse()
      const a = [Number(from.stop_lon), Number(from.stop_lat)], b = [Number(to.stop_lon), Number(to.stop_lat)]
      const attachments = [distanceMetres(a, curve[0]), distanceMetres(b, curve.at(-1))]
      const evidence = { geometrySource: 'sbb-rail-inference', corridor: c.id, sourceFeatures: c.features.map(id => JSON.stringify(id)),
        fromOperatingPoint: from.didok, toOperatingPoint: to.didok, stationAttachmentsMetres: attachments, primaryFailure: original }
      if (!attachments.every(m => Number.isFinite(m) && m <= policy.limits.stationAttachmentMetres)) return { ...evidence, reason: 'sbb-rail-station-attachment' }
      const path = [a, ...curve, b].map(p => [...p]), pathMetres = length(path)
      if (pathMetres < 1 || pathMetres > Math.max(policy.limits.detourFloorMetres, distanceMetres(a, b) * policy.limits.detourRatio)) return { ...evidence, reason: 'sbb-rail-detour' }
      return { ...evidence, path, pathMetres }
    },
  }
}

export async function loadZugSbbRailSupplement(policy) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed SBB source catalogue')
  const source = JSON.parse(bytes)
  for (const item of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, item.file))), item.sha256, `Changed SBB source ${item.file}`)
  const pages = await Promise.all(['line540.json', 'foreign-review.json'].map(async f => JSON.parse(await readFile(join(policy.sourceDirectory, f)))))
  return { ...zugSbbRailSupplement(pages, policy), source }
}

export function matchZugRailWithSupplement(rail, supplement, train, stops, route) {
  return rail.matchPattern(train, stops, route).map((result, i) => supplement.matchPair(result, route, stops.get(train.calls[i].id), stops.get(train.calls[i + 1].id)))
}
