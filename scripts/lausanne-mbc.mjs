import assert from 'node:assert/strict'

export const MBC_AGENCY_IDS = ['29', '764']
export const MBC_BUS_CACHES = ['data/vaud-mbc-road-cache.json', 'data/vaud-mbc-sunday-road-cache.json']
export const LAUSANNE_WEST_GROUPS = ['tl-bus', 'mbc-bus', 'm1', 'm2', 'leb', 'mbc-rail', 'rail']

// Replace the old clipped MBC rail journeys by complete source journeys. The
// existing Lausanne crop and all other operators retain their exact stop chains.
export function mergeLausanneMbc(base, mbc, routes) {
  for (const key of ['feedVersion', 'serviceDate', 'dayModel', 'windowStart', 'windowEnd']) assert.equal(mbc.metadata[key], base.metadata[key], `MBC ${key} mismatch`)
  assert.equal(mbc.metadata.dayModel, 'civil day with preceding service-day spillover')
  assert.deepEqual(mbc.metadata.sourceServiceDates, base.metadata.sourceServiceDates)
  assert.deepEqual(mbc.metadata.agencyIds, MBC_AGENCY_IDS)
  assert.deepEqual(mbc.metadata.modes, ['rail', 'bus'])
  const agency = train => {
    const route = routes.get(train.routeId)
    assert(route, `Missing route ${train.routeId}`)
    return route.agencyId
  }
  assert(mbc.trains.length && mbc.trains.every(train => MBC_AGENCY_IDS.includes(agency(train))), 'Unexpected MBC supplement operator')
  for (const id of MBC_AGENCY_IDS) assert(mbc.trains.some(train => agency(train) === id), `Missing MBC agency ${id}`)
  const stops = [], indexes = new Map(), trains = []
  for (const [snapshot, selected] of [[base, base.trains.filter(train => !MBC_AGENCY_IDS.includes(agency(train)))], [mbc, mbc.trains]]) {
    const remap = snapshot.stops.map(stop => {
      const existing = indexes.get(stop[4])
      if (existing !== undefined) { assert.deepEqual(stops[existing], stop, `Changed platform ${stop[4]}`); return existing }
      const index = stops.length; indexes.set(stop[4], index); stops.push(stop); return index
    })
    for (const { pathSegments: _paths, ...train } of selected) trains.push({ ...train, stops: train.stops.map(([index, ...times]) => [remap[index], ...times]) })
  }
  assert.equal(new Set(trains.map(train => train.id)).size, trains.length, 'Duplicate merged journey')
  return { ...base, metadata: { ...base.metadata, lausanneScopeVersion: 2, localAgencyIds: ['151', '764'], completeAgencyIds: MBC_AGENCY_IDS }, stops, trains }
}

// Keep the original matcher rejections and choose the first available complete
// pattern. Every cache must carry provenance; geometry never joins by line label.
export function combineRoadCaches(caches) {
  assert(caches.length)
  const paths = [], patterns = {}, sources = []
  for (const cache of caches) {
    assert.equal(cache.schemaVersion, 1)
    assert.equal(cache.metadata.license, 'ODbL-1.0')
    assert.match(cache.metadata.sourceSha256, /^[a-f0-9]{64}$/)
    const offset = paths.length
    paths.push(...cache.paths)
    for (const [key, segments] of Object.entries(cache.patterns)) {
      assert(segments.every(index => index === null || Number.isInteger(index) && index >= 0 && index < cache.paths.length), 'Invalid cached path index')
      if (!(key in patterns)) patterns[key] = segments.map(index => index === null ? null : index + offset)
    }
    sources.push(cache.metadata)
  }
  return { schemaVersion: 1, paths, patterns, metadata: { publisher: 'OpenStreetMap contributors', sourceUrl: 'https://www.openstreetmap.org/copyright', license: 'ODbL-1.0', model: 'Inferred bus paths from dated exact route/platform patterns; not operator-verified', sources } }
}

export function assertCompleteMbcCalls(train, stops, sourceCalls, date) {
  assert(sourceCalls?.length >= 2, `Missing MBC source calls ${train.sourceTripId}`)
  assert.deepEqual(train.stops.map(([i]) => stops[i][4]), sourceCalls.map(call => call.id), `Clipped MBC source journey ${train.id}`)
  const offset = train.stops[0][2] - sourceCalls[0].departure
  if (date && !train.frequency) assert.equal(offset, train.sourceServiceDate === date ? 0 : -86400, 'Changed MBC service-day offset')
  assert.deepEqual(train.stops.map(([, a, d]) => [a, d]), sourceCalls.map(call => [call.arrival + offset, call.departure + offset]), `Changed MBC source times ${train.id}`)
}
