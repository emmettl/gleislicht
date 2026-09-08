import assert from 'node:assert/strict'
import { lineGraph, directedPatternKey } from './luzern-line-geometry.mjs'
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

export function stGallenGraphs(collections, policy) {
  const groups = new Map(), inventory = []
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
  return { inventory, graphs: new Map([...groups].map(([key, group]) => [key, { graph: lineGraph(group.features), sourceFeatures: group.sourceFeatures }])) }
}

export function matchStGallenPair(candidate, from, to, limits) {
  if (!candidate) return { reason: 'missing-line' }
  return { ...matchBaselSegment(candidate.graph, from, to, limits), sourceFeatures: candidate.sourceFeatures }
}
