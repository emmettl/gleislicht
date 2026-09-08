import assert from 'node:assert/strict'
import { baselGraphs, matchBaselSegment, BASEL_PATH_LIMITS } from './basel-line-geometry.mjs'

// These reviewed adjacent city-stop corridors need a tighter bound than the
// general regional graph: reject returns around the centre caused by missing
// source joins rather than counting a long but technically connected route.
export const BASEL_DIVERSION_LIMITS = { ...BASEL_PATH_LIMITS, detourRatio: 2, detourFloorMetres: 600 }

const key = (agency, line, from, to) => JSON.stringify([agency, line, from, to])

export function baselTramDiversions(collections, policy, serviceDate) {
  assert.equal(policy.schemaVersion, 1)
  assert(policy.serviceDates.includes(serviceDate), 'Tram diversion policy has not been reviewed for this service date')
  const admitted = new Map()
  for (const rule of policy.rules) {
    assert(['823', '37'].includes(rule.agencyId) && rule.stops.length >= 2 && typeof rule.bothDirections === 'boolean')
    for (let i = 1; i < rule.stops.length; i++) {
      const pairs = [[rule.stops[i - 1], rule.stops[i]]]
      if (rule.bothDirections) pairs.push([rule.stops[i], rule.stops[i - 1]])
      for (const [from, to] of pairs) {
        const id = key(rule.agencyId, rule.line, from, to)
        assert(!admitted.has(id), 'Overlapping directed diversion rules')
        admitted.set(id, rule.id)
      }
    }
  }
  // Physical infrastructure only: shared tram tracks do not admit another
  // operator's journeys. Source parts remain disconnected unless their actual
  // vertices coincide, with the unchanged bounded projection alternatives.
  const features = collections.flatMap(collection => collection.features).filter(feature => feature.properties.ln_verkehrsmittel === 'Tram' && ['BVB', 'BLT'].includes(feature.properties.ln_tu))
    .map(feature => ({ ...feature, properties: { ...feature.properties, ln_tu: 'BVB', ln_liniennr: 'diversion-infrastructure' } }))
  const graph = baselGraphs([{ type: 'FeatureCollection', features }]).get('823:tram:diversion-infrastructure')
  return {
    match(route, train, from, to) {
      if (train.category !== 'tram') return undefined
      const ruleId = admitted.get(key(route.agencyId, train.route, from[2], to[2]))
      if (!ruleId) return undefined
      return { ...matchBaselSegment(graph, from, to, BASEL_DIVERSION_LIMITS, { compareNearbyParts: true }), diversionRule: ruleId }
    },
    provenance: { policy, sourceFeatures: features.length, limits: BASEL_DIVERSION_LIMITS, inference: 'Existing BS BVB/BLT tram infrastructure, restricted to dated, explicitly listed directed diversion pairs. Compare connected paths across source parts within the same 5 m additional snap allowance; choose shortest accepted path. Undirected geometry; running tracks remain unreviewed.' },
  }
}
