import assert from 'node:assert/strict'
import { applyBernGeometry, bernPatternId } from './bern-line-geometry.mjs'
import { applyThurgauRegionalRoads } from './thurgau-regional-roads.mjs'
import { applyThurgauRail } from './thurgau-rail-geometry.mjs'
import { applyThurgauBoats } from './thurgau-boat-geometry.mjs'
import { applyThurgauCityRoads } from './thurgau-city-roads.mjs'

export { bernPatternId as thurgauPatternId }
export const THURGAU_LIMITS = {
  bus: { snapMetres: 80, detourRatio: 4.5, detourFloorMetres: 1200, alternativeSnapMetres: 5 },
  rail: { snapMetres: 120, detourRatio: 4.5, detourFloorMetres: 3000, alternativeSnapMetres: 5 },
}

// Preserve timetable prefixes. No guessed typo fixes (20.207), substring
// joins, or removal of letters: N50 and BN820 are distinct identities.
export function thurgauLineTokens(value) {
  return String(value ?? '').split(',').map(s => s.trim()).filter(Boolean).map(raw => {
    const match = /^(?:(\d{2})\.)?([A-Z]*\d+)(?:\s*\(([^)]+)\))?$/.exec(raw)
    assert(match, `Unreviewed Thurgau line token: ${raw}`)
    return { code: match[1] ? `${match[1]}.${match[2]}` : match[2], line: match[2], qualification: match[3] ?? null, raw }
  })
}

export function thurgauFeatureMatch(route, feature, crosswalk) {
  const entry = crosswalk.routes.find(r => r.routeId === route.id)
  if (!entry) return false
  assert.equal(entry.agencyId, route.agencyId, 'Changed Thurgau operator')
  assert.equal(entry.line, route.name, 'Changed Thurgau line')
  assert.equal(entry.mode, route.mode, 'Changed Thurgau mode')
  return entry.featureIds.includes(feature.id)
}

export function applyThurgauGeometry(raw, routes, source, crosswalk, cityRoads, regionalRoads, rail, boats) {
  const result = applyBernGeometry(raw, routes, source, crosswalk,
    { featureMatch: thurgauFeatureMatch, limits: THURGAU_LIMITS, lineId: f => f.id })
  return applyThurgauBoats(raw, applyThurgauRail(raw, applyThurgauRegionalRoads(raw, applyThurgauCityRoads(raw, result, cityRoads), regionalRoads, routes), rail), boats, routes)
}
