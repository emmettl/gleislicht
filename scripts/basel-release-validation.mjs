import assert from 'node:assert/strict'
import { previousServiceDate } from './civil-day.mjs'

export const BASEL_RELEASE_GROUPS = ['BLT-bus', 'BLT-tram', 'BVB-bus', 'BVB-tram', 'regional-rail']

export function validateBaselRelease(day, morning, trains) {
  const metadata = day.metadata
  assert.equal(metadata.baselReleaseVersion, 1, 'Basel: unsupported release')
  assert.equal(metadata.dayModel, 'civil day with preceding service-day spillover')
  assert.deepEqual(metadata.sourceServiceDates, [previousServiceDate(metadata.serviceDate), metadata.serviceDate])
  assert(metadata.scope?.serviceDates.includes(metadata.serviceDate), 'Basel: unreviewed study date')
  assert(metadata.sourceServiceDates.every(date => metadata.scope.geometryServiceDates.includes(date)), 'Basel: unreviewed preceding-day geometry')
  for (const field of ['baselReleaseVersion', 'dayModel', 'sourceServiceDates', 'sourceHashes', 'scope', 'baselGeometry', 'baselRouteAgencies', 'geometry', 'railGeometry']) {
    assert.deepEqual(morning.metadata[field], metadata[field], `Basel: mixed ${field}`)
  }
  for (const field of ['stops', 'paths', 'edges', 'edgePaths']) assert.deepEqual(morning[field], day[field], `Basel: mixed ${field}`)
  const byId = new Map(trains.map(train => [train.id, train]))
  for (const train of morning.trains) assert.deepEqual(train, byId.get(train.id), 'Basel: changed morning journey')
  assert.deepEqual(metadata.baselGeometry?.map(group => group.id), BASEL_RELEASE_GROUPS, 'Basel: missing operator/mode group')
  assert.equal(metadata.geometry.license, 'ODbL-1.0', 'Basel: missing OSM attribution')
  assert(metadata.railGeometry.maximumSnapMetres <= 120, 'Basel: rail snap exceeds guard')
  if (metadata.geometry.reviewedRepairs) {
    assert(/^[a-f0-9]{64}$/.test(metadata.sourceHashes.reviewedGeometry), 'Basel: missing reviewed geometry hash')
    assert(metadata.geometry.reviewedRepairs.maximumSnapMetres <= 120, 'Basel: reviewed geometry snap exceeds guard')
    assert.equal(metadata.geometry.reviewedRepairs.sources.tlm.attribution, '© swisstopo', 'Basel: missing swisstopo attribution')
  }
  const counts = new Map(BASEL_RELEASE_GROUPS.map(id => [id, { trips: 0, matched: 0, total: 0 }]))
  for (const train of trains) {
    const agency = metadata.baselRouteAgencies[train.routeId]
    assert(agency && train.sourceTripId && metadata.sourceServiceDates.includes(train.sourceServiceDate), 'Basel: missing source identity')
    const local = ['bus', 'tram'].includes(train.category)
    const id = local ? `${agency === '823' ? 'BVB' : agency === '37' ? 'BLT' : 'unknown'}-${train.category}` : 'regional-rail'
    const count = counts.get(id)
    assert(count && train.pathSegments?.length === train.stops.length - 1, 'Basel: invalid movement group or paths')
    assert(train.start < 86400 && train.end >= 0, 'Basel: movement outside civil day')
    if (!local) {
      const range = train.sourceCallRange
      assert(range?.length === 2 && range.every(Number.isInteger) && range[0] >= 0 && range[1] <= train.sourceCallCount && range[1] - range[0] === train.stops.length, 'Basel: invalid rail boundary provenance')
    }
    count.trips++; count.total += train.pathSegments.length
    count.matched += train.pathSegments.filter(index => index !== null).length
  }
  for (const group of metadata.baselGeometry) {
    const count = counts.get(group.id)
    assert.deepEqual(count, { trips: group.trips, matched: group.matched, total: group.total }, `Basel: changed ${group.id} counts`)
    assert(count.trips && count.matched / count.total >= .95, `Basel: insufficient ${group.id} geometry`)
  }
}
