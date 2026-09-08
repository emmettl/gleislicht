import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { applyBernGeometry, BERN_LIMITS } from './bern-line-geometry.mjs'

// Same projection limits as Bern. Only the explicit, hashed millimetre repair
// below can join otherwise separate source components.
export const FRIBOURG_LIMITS = BERN_LIMITS
export function fribourgFeatureIdentity(feature, policy) {
  const p = feature.properties
  assert(Number.isInteger(p.OBJECTID) && p.NUMERO_LIGNE && p.NOM_LIGNE)
  const mode = /^Bus /.test(p.TYPE_LIGNE_VALEUR) ? 'bus'
    : ['IC/IR', 'RE', 'Train régional'].includes(p.TYPE_LIGNE_VALEUR) ? 'rail' : null
  const override = policy.featureOverrides[String(p.OBJECTID)]
  if (override) {
    assert.equal(override.expectedNumber, p.NUMERO_LIGNE)
    assert.equal(override.expectedName, p.NOM_LIGNE)
    assert.equal(override.expectedEnterprise, p.ENTREPRISE_VALEUR)
    assert.equal(override.expectedType, p.TYPE_LIGNE_VALEUR)
    return { mode, agencyIds: override.agencyIds, lines: override.lines, evidence: override.evidence }
  }
  const agencyIds = policy.operators[p.ENTREPRISE_VALEUR]?.[mode] ?? []
  const night = /^([NM]\d+)\s/.exec(p.NOM_LIGNE)?.[1]
  // NUMERO_LIGNE is a timetable field, not a display label. Bus suffixes
  // are used only for explicitly reviewed operators and non-night records.
  const busNumber = /^(10|20|30)\.(\d{3})$/.exec(p.NUMERO_LIGNE)
  const label = /^(S\d+(?:\/S\d+)*|R\d+)\s/.exec(p.NOM_LIGNE)?.[1]
  const lines = night ? [night] : mode === 'bus' && busNumber && p.TYPE_LIGNE_VALEUR !== 'Bus de nuit' && !/nuit/i.test(p.NOM_LIGNE)
    ? [String(Number(busNumber[2]))] : mode === 'rail' && label ? label.split('/') : []
  return { mode, agencyIds, lines, evidence: night ? 'Explicit night label in NOM_LIGNE'
    : mode === 'bus' ? 'Reviewed timetable-field prefix/suffix plus exact source operator and GTFS display line'
      : 'Explicit passenger line token in NOM_LIGNE; unnamed rail fields remain unresolved' }
}

export function fribourgFeatureMatch(route, feature, policy) {
  const identity = fribourgFeatureIdentity(feature, policy)
  return identity.mode === route.mode && identity.agencyIds.includes(route.agencyId) && identity.lines.includes(route.name)
}

export function applyFribourgGeometry(raw, routes, source, policy) {
  const prepared = { ...source, lines: applyFribourgTopology(source.lines, policy) }
  const result = applyBernGeometry(raw, routes, prepared, policy, { featureMatch: fribourgFeatureMatch,
    limits: FRIBOURG_LIMITS, lineId: f => String(f.properties.OBJECTID) })
  const repairedRoutes = new Map(result.routeCrosswalk.map(r => [r.routeId,
    (policy.topologyRepairs ?? []).filter(repair => r.sourceLines.includes(String(repair.sourceId))).map(repair => repair.id)]))
  result.trains = result.trains.map(t => repairedRoutes.get(t.routeId).length
    ? { ...t, geometryInference: { sourceTopologyRepairs: repairedRoutes.get(t.routeId), scope: 'Route graph includes this inferred endpoint adjustment; not every segment traverses it.' } } : t)
  return result
}

export function applyFribourgTopology(lines, policy) {
  return lines.map(feature => {
    const repairs = (policy.topologyRepairs ?? []).filter(r => r.sourceId === feature.properties.OBJECTID)
    if (!repairs.length) return feature
    const changed = structuredClone(feature)
    for (const repair of repairs) {
      assert.equal(createHash('sha256').update(JSON.stringify(feature.geometry)).digest('hex'), repair.geometrySha256, 'Changed Fribourg repair source')
      const paths = changed.geometry.coordinates
      assert.deepEqual(paths[repair.fromPart][repair.fromVertex], repair.from)
      assert.deepEqual(paths[repair.toPart][repair.toVertex], repair.to)
      assert([0, paths[repair.fromPart].length - 1].includes(repair.fromVertex))
      assert([0, paths[repair.toPart].length - 1].includes(repair.toVertex))
      const gap = Math.hypot(repair.from[0] - repair.to[0], repair.from[1] - repair.to[1])
      assert(gap > 0 && gap <= 0.02, 'Only reviewed sub-2cm endpoint adjustments permitted')
      paths[repair.fromPart][repair.fromVertex] = [...repair.to]
    }
    return changed
  })
}
