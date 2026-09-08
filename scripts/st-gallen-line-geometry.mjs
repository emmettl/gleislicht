import assert from 'node:assert/strict'
import { lineGraph, directedPatternKey } from './luzern-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
export { directedPatternKey }

// IDs refer to the pinned shapefile record number within its named layer, never
// a guessed national operator code. KURSBUCHNR is not a passenger line number.
export const featureKey = (layer, feature) => `${layer}:${feature.id}`
export function featureIdentity(layer, feature, policy) {
  const p = feature.properties, key = featureKey(layer, feature)
  assert(['Tag', 'Nacht'].includes(p.ANGEBOT), 'Unreviewed source service period')
  assert(['Ja', 'Nein'].includes(p.BERECHTIGT), 'Unreviewed subsidy flag')
  assert(p.BETREIBER && p.LINIENNAME && p.KURSBUCHNR, 'Missing source identity')
  const override = policy.featureOverrides[key]
  if (override) {
    assert.equal(p.LINIENNAME, override.expectedName, 'Changed override source record')
    return { key, ...override }
  }
  const mode = layer === 'city' ? 'bus' : layer
  const agencyIds = policy.operatorCrosswalk[p.BETREIBER]?.[mode]
  // The leading designation carries N/B prefixes and compound rail numbers.
  const designation = p.LINIENNAME.split(/\s/)[0]
  const lines = mode === 'mountain' ? [p.KURSBUCHNR] : mode === 'boat' ? [] : designation.split('/')
  if (!agencyIds || !lines.length) return { key, reason: 'unresolved-source-identity' }
  assert(lines.every(line => mode === 'bus' ? /^[NB]?\d+[A-Z]?$/.test(line) : mode === 'rail' ? /^(S[N]?\d+|RE\d+|VAE)$/.test(line) : /^\d+$/.test(line)), `Unreviewed designation ${designation}`)
  return { key, mode, agencyIds, lines, reason: 'Reviewed operator mapping and exact leading passenger designation; ordered stop patterns validated independently.' }
}

const pointKey = p => p.slice(0, 2).map(n => n.toFixed(7)).join(',')
const edgeKey = (a, b) => [pointKey(a), pointKey(b)].sort().join('|')

export function validatedStGallenRepairs(collections, policy) {
  const config = policy.geometryRepairs
  if (!config) return []
  assert(config.maximumLengthMetres > 0 && config.maximumLengthMetres <= 15, 'Unreviewed repair length cap')
  assert.equal(new Set(config.repairs.map(r => r.id)).size, config.repairs.length)
  const features = new Map(collections.bus.features.map(f => [featureKey('bus', f), f]))
  const extract = ref => {
    const feature = features.get(ref.feature); assert(feature, 'Missing repair source')
    const parts = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    const part = parts[ref.partIndex]
    assert(part && [ref.partIndex, ref.startVertex, ref.endVertex].every(Number.isInteger))
    assert(ref.startVertex >= 0 && ref.endVertex > ref.startVertex && ref.endVertex < part.length, 'Invalid donor slice')
    const points = part.slice(ref.startVertex, ref.endVertex + 1)
    return { feature, points: ref.reverse ? points.reverse() : points }
  }
  return config.repairs.map(repair => {
    const target = features.get(repair.targetFeature); assert(target, 'Missing repair target')
    assert.equal(target.properties.LINIENNAME, repair.expectedTargetName, 'Changed repair target')
    assert.notEqual(repair.targetFeature, repair.donorFeature)
    const { feature: donor, points } = extract({ ...repair, feature: repair.donorFeature })
    assert.equal(donor.properties.LINIENNAME, repair.expectedDonorName, 'Changed repair donor')
    assert.equal(target.properties.BETREIBER, donor.properties.BETREIBER, 'Repair crosses operators')
    assert(repair.corroboratingSources.length >= 2, 'Repair requires independent source records')
    assert.equal(new Set(repair.corroboratingSources.map(s => s.feature)).size, repair.corroboratingSources.length, 'Duplicate corroborating record')
    for (const ref of repair.corroboratingSources) {
      assert(ref.feature !== repair.donorFeature && ref.feature !== repair.targetFeature)
      const corroboration = extract(ref)
      assert.equal(corroboration.feature.properties.BETREIBER, target.properties.BETREIBER)
      assert.deepEqual(corroboration.points, points, 'Corroborating source geometry changed')
    }
    const graph = lineGraph([target]), from = graph.indexes.get(pointKey(points[0])), to = graph.indexes.get(pointKey(points.at(-1)))
    assert(from !== undefined && to !== undefined && from !== to, 'Repair must join existing target vertices')
    const visited = new Set([from]), queue = [from]
    while (queue.length) for (const [next] of graph.adjacency[queue.pop()]) if (!visited.has(next)) { visited.add(next); queue.push(next) }
    assert(!visited.has(to), 'Repair target components already connected')
    const length = points.slice(1).reduce((n, p, i) => n + distanceMetres(points[i], p), 0)
    assert(length <= config.maximumLengthMetres && Math.abs(length - repair.pathMetres) < 0.01, 'Unreviewed repair length')
    return { ...repair, sourceFeatures: [repair.donorFeature, ...repair.corroboratingSources.map(s => s.feature)],
      edges: new Set(points.slice(1).map((p, i) => edgeKey(points[i], p))),
      feature: { type: 'Feature', properties: { repairId: repair.id }, geometry: { type: 'LineString', coordinates: points } } }
  })
}

export function stGallenGraphs(collections, policy) {
  const groups = new Map(), inventory = []
  const repairs = validatedStGallenRepairs(collections, policy)
  for (const [layer, collection] of Object.entries(collections)) {
    assert.equal(collection.type, 'FeatureCollection')
    assert.equal(new Set(collection.features.map(f => f.id)).size, collection.features.length)
    for (const feature of collection.features) {
      const identity = featureIdentity(layer, feature, policy)
      inventory.push({ ...identity, layer, objectId: feature.id, properties: feature.properties })
      if (!identity.agencyIds) continue
      for (const agency of identity.agencyIds) for (const line of identity.lines) {
        const key = JSON.stringify([agency, identity.mode, line]), group = groups.get(key) ?? { features: [], sourceFeatures: [] }
        group.features.push(feature); group.sourceFeatures.push(identity.key); groups.set(key, group)
      }
    }
  }
  return { inventory, graphs: new Map([...groups].map(([key, group]) => {
    const applicable = repairs.filter(r => group.sourceFeatures.includes(r.targetFeature))
    return [key, { graph: lineGraph([...group.features, ...applicable.map(r => r.feature)]), sourceFeatures: group.sourceFeatures, repairs: applicable }]
  })) }
}

export function matchStGallenPair(candidate, from, to, limits) {
  if (!candidate) return { reason: 'missing-line' }
  const result = matchBaselSegment(candidate.graph, from, to, limits)
  const edges = new Set(result.path?.slice(1).map((p, i) => edgeKey(result.path[i], p)) ?? [])
  const used = candidate.repairs?.filter(r => [...r.edges].some(e => edges.has(e))) ?? []
  return { ...result, sourceFeatures: candidate.sourceFeatures, ...(used.length ? { geometryRepairIds: used.map(r => r.id), repairSourceFeatures: [...new Set(used.flatMap(r => r.sourceFeatures))] } : {}) }
}
