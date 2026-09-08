import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { SERVICE_CATEGORIES } from '@motionstudies/core/theme'
import { stGallenGraphs, matchStGallenPair, directedPatternKey } from './st-gallen-line-geometry.mjs'
import { stGallenMode } from './st-gallen-timetable.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const save = async (path, value, pretty = false) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + (pretty ? '\n' : '')) }
const ratio = (a, b) => b ? a / b : null
const gz = value => gzipSync(JSON.stringify(value)).length
const keyForRoute = r => JSON.stringify([r.agencyId, r.mode, r.line])
export const stGallenCategory = r => r.mode === 'rail' ? r.line.startsWith('S') ? 's-bahn' : r.line.startsWith('RE') ? 'regional-express' : r.line.startsWith('IR') ? 'interregio' : 'regional' : r.mode === 'mountain' ? r.routeType === 116 ? 'other' : r.routeType === 1400 ? 'funicular' : 'cableway' : r.mode === 'boat' ? 'ferry' : r.mode

export function compactStGallen(trains, stops, paths, metadata) {
  const ids = [...new Set(trains.flatMap(t => t.calls.map(c => c.id)))].sort(), indices = new Map(ids.map((id, i) => [id, i]))
  const platforms = ids.map(id => { const s = stops.get(id); return [Number(s.stop_lon), Number(s.stop_lat), s.stop_name, s.platform_code, id] })
  const usedPaths = [...new Set(trains.flatMap(t => t.pathSegments))].sort((a, b) => a - b), remap = new Map(usedPaths.map((id, i) => [id, i]))
  const movements = trains.map(({ calls, ...t }) => ({ ...t, stops: calls.map(c => [indices.get(c.id), c.arrival, c.departure]),
    callRules: calls.map(c => [c.pickupType, c.dropOffType]), sourceCallSequences: calls.map(c => c.sequence), pathSegments: t.pathSegments.map(p => remap.get(p)),
    start: calls[0].departure, end: calls.at(-1).arrival }))
  const edges = [...new Set(movements.flatMap(t => t.stops.slice(1).map(([b], i) => [t.stops[i][0], b].sort((a, b) => a - b).join(':'))))].sort().map(k => k.split(':').map(Number))
  return { metadata, bounds: { minLongitude: Math.min(...platforms.map(s => s[0])), maxLongitude: Math.max(...platforms.map(s => s[0])), minLatitude: Math.min(...platforms.map(s => s[1])), maxLatitude: Math.max(...platforms.map(s => s[1])) },
    stops: platforms, trains: movements, paths: usedPaths.map(i => paths[i]), edges, edgePaths: edges.map(() => null) }
}

export function validateStGallenSnapshot(snapshot) {
  assert(snapshot.trains.length, 'Empty St. Gallen feed')
  assert.equal(new Set(snapshot.trains.map(t => t.id)).size, snapshot.trains.length)
  for (const t of snapshot.trains) {
    assert(SERVICE_CATEGORIES.some(c => c.id === t.category), 'Unknown feed service category')
    assert.equal(t.pathSegments.length, t.stops.length - 1)
    assert.equal(t.sourceCallSequences.length, t.stops.length)
    assert.equal(t.callRules.length, t.stops.length)
    assert(t.stops.every(([i, a, d], j) => snapshot.stops[i] && Number.isFinite(a) && a <= d && (!j || a >= t.stops[j - 1][2])), 'Invalid timetable')
    for (let i = 0; i < t.pathSegments.length; i++) {
      const index = t.pathSegments[i], p = snapshot.paths[index]
      assert(Number.isInteger(index) && p?.length >= 2, 'Admitted trip has a geometry gap')
      const near = (a, b) => Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001
      assert(near(p[0], snapshot.stops[t.stops[i][0]]) && near(p.at(-1), snapshot.stops[t.stops[i + 1][0]]), 'Path direction/endpoints do not match source calls')
    }
  }
}

export async function buildStGallenRegion({ timetablePath, sourceDirectory, policyPath, output, auditPath }) {
  const raw = await json(timetablePath), policy = await json(policyPath), catalogue = await json(join(sourceDirectory, 'sources.json'))
  assert.equal(catalogue.sources.find(s => s.file === 'al-oev-20260324.zip')?.sha256, policy.sourceArchiveSha256, 'Unreviewed geometry archive')
  assert(!resolve(output).startsWith(resolve('public') + '/'), 'Restricted St. Gallen feed must remain outside public assets')
  assert.equal(raw.sourceHashes.archive, policy.feedSha256, 'Unreviewed timetable archive')
  assert.deepEqual(raw.dates, policy.dates)
  for (const source of catalogue.sources) assert.equal(sha256(await readFile(join(sourceDirectory, source.file))), source.sha256, `Changed source ${source.file}`)
  assert.equal(raw.sourceHashes.boundary, sha256(await readFile(join(sourceDirectory, 'boundary.json'))))
  const sourceHashes = { ...raw.sourceHashes, timetable: sha256(await readFile(timetablePath)), policy: sha256(await readFile(policyPath)), catalogue: sha256(await readFile(join(sourceDirectory, 'sources.json'))) }
  const collections = {}
  for (const layer of ['bus', 'city', 'rail', 'boat', 'mountain']) collections[layer] = JSON.parse(gunzipSync(await readFile(join(sourceDirectory, `${layer}.geojson.gz`))))
  const { graphs, inventory: sourceInventory } = stGallenGraphs(collections, policy)
  const routes = new Map(raw.inventory.map(r => [r.routeId, { ...r, mode: stGallenMode(r.routeType) }]))
  const stops = new Map(raw.stops.map(s => [s.stop_id, s])), pairCache = new Map(), paths = [], pathIndices = new Map()
  const days = []
  for (const day of raw.snapshots) {
    console.log(`Matching ${day.date}: ${day.trains.length} full civil-day trips…`)
    const patterns = new Map(), pairs = new Map(), admitted = [], routeCounts = new Map(), reasons = new Map()
    for (const train of day.trains) {
      const route = routes.get(train.routeId), candidate = graphs.get(keyForRoute(route)), patternKey = directedPatternKey(train)
      if (!patterns.has(patternKey)) {
        const pairKeys = train.calls.slice(1).map((call, i) => {
          const from = train.calls[i].id, to = call.id, key = JSON.stringify([route.routeId, from, to])
          if (!pairCache.has(key)) {
            const a = stops.get(from), b = stops.get(to)
            const result = matchStGallenPair(candidate, [Number(a.stop_lon), Number(a.stop_lat)], [Number(b.stop_lon), Number(b.stop_lat)], policy.limits)
            const { path, ...assessment } = result
            let pathIndex = null
            if (path) { const signature = JSON.stringify(path); if (!pathIndices.has(signature)) { pathIndices.set(signature, paths.length); paths.push(path) } pathIndex = pathIndices.get(signature) }
            pairCache.set(key, { key, routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line, fromId: from, toId: to, from: a.stop_name, to: b.stop_name, pathIndex, geometrySha256: path ? sha256(JSON.stringify(path)) : null, ...assessment })
          }
          return key
        })
        const failures = pairKeys.filter(k => pairCache.get(k).pathIndex === null)
        // A service requiring prior arrangement is inventoried, not animated as
        // an unconditional fixed departure. This also preserves GTFS call rules.
        const demandResponsive = train.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))
        const reasonList = [...new Set(failures.map(k => pairCache.get(k).reason)), ...(demandResponsive ? ['prior-arrangement-call'] : [])]
        patterns.set(patternKey, { id: sha256(patternKey).slice(0, 20), routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line,
          directionId: train.directionId, stopIds: train.calls.map(c => c.id), stopNames: train.calls.map(c => stops.get(c.id).stop_name), callRules: train.calls.map(c => [c.pickupType, c.dropOffType]),
          pairKeys, trips: 0, admitted: !reasonList.length, reasons: reasonList, geometryPairs: pairKeys.length - failures.length, totalPairs: pairKeys.length,
          carryInTrips: 0, representativeHeadwayTrips: 0 })
      }
      const pattern = patterns.get(patternKey)
      pattern.trips++; pattern.carryInTrips += Number(train.sourceServiceDate !== day.date); pattern.representativeHeadwayTrips += Number(train.frequency?.exactTimes === 0)
      for (const k of pattern.pairKeys) { const pair = pairs.get(k) ?? { ...pairCache.get(k), occurrences: 0, scheduledOccurrences: 0, representativeHeadwayOccurrences: 0, admittedOccurrences: 0 }; pair.occurrences++; pair.scheduledOccurrences += Number(train.frequency?.exactTimes !== 0); pair.representativeHeadwayOccurrences += Number(train.frequency?.exactTimes === 0); pair.admittedOccurrences += Number(pattern.admitted); pairs.set(k, pair) }
      const count = routeCounts.get(route.routeId) ?? { routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line, trips: 0, admittedTrips: 0, segmentOccurrences: 0, matchedSegmentOccurrences: 0, carryInTrips: 0, admittedCarryInTrips: 0 }
      count.trips++; count.admittedTrips += Number(pattern.admitted); count.segmentOccurrences += pattern.totalPairs; count.matchedSegmentOccurrences += pattern.geometryPairs
      count.carryInTrips += Number(train.sourceServiceDate !== day.date); count.admittedCarryInTrips += Number(pattern.admitted && train.sourceServiceDate !== day.date)
      routeCounts.set(route.routeId, count)
      if (pattern.admitted) admitted.push({ ...train, route: route.line, agencyId: route.agencyId, routeType: route.routeType, transportMode: route.routeType === 116 ? 'cogwheel' : route.mode === 'boat' ? 'ferry' : route.mode, category: stGallenCategory(route), patternId: pattern.id, pathSegments: pattern.pairKeys.map(k => pairCache.get(k).pathIndex) })
      else for (const reason of pattern.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
    const metadata = { publisher: 'Gleislicht, derived from SBB and official St. Gallen AL_OEV data', feedVersion: raw.feed.feed_version, serviceDate: day.date,
      dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: [new Date(Date.parse(`${day.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10), day.date],
      windowStart: 0, windowEnd: 86400, focusTime: 27900, sourceHashes, modes: [...new Set(admitted.map(t => routes.get(t.routeId).mode))],
      label: 'St. Gallen canton — admitted complete stop patterns', model: 'scheduled interpolation along inferred official alignments',
      note: policy.admission, scope: raw.scope.description, exclusions: policy.scopeLimits,
      attribution: ['Timetable: SBB / opentransportdata.swiss', '© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG; underlying swissTNE Base © swisstopo', 'Canton boundary: © swisstopo'],
      sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/',
      reuse: catalogue.reuse,
      geometry: { license: catalogue.reuse.license, metadataUrl: 'https://www.sg.ch/bauen/geoinformation/gi/geodaten/al.html', termsUrl: catalogue.reuse.termsUrl,
        archiveDate: '2026-03-24', geometryVintage: '2026 timetable; no per-feature survey date', documentationDate: '2026-03-24',
        limits: policy.limits, ...catalogue.transformation,
        direction: 'Undirected source alignments; ordered GTFS calls determine travel direction. No one-way street certification.',
        disclaimer: 'For information only; no legal effect. Publisher disclaims completeness, currency and accuracy and liability for use.' },
      frequency: { headwayTrips: admitted.filter(t => t.frequency?.exactTimes === 0).length, exactFrequencyTrips: admitted.filter(t => t.frequency?.exactTimes === 1).length, model: 'Source-interval-anchored representative grid when exact_times=0; not scheduled departures.' } }
    if (metadata.frequency.headwayTrips) metadata.model = 'scheduled and representative headway interpolation along inferred official alignments'
    const snapshot = compactStGallen(admitted, stops, paths, metadata)
    validateStGallenSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'st-gallen-region-day-chunks')
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    const destination = join(output, day.date)
    for (const { descriptor, payload } of chunks) await save(join(destination, descriptor.path), payload)
    await save(join(destination, 'st-gallen-region-day-manifest.json'), manifest)
    await save(join(destination, 'st-gallen-region-morning.json'), morning)
    const counts = [...routeCounts.values()], ps = [...patterns.values()], pairList = [...pairs.values()]
    const groups = [...new Set(counts.map(c => `${c.agencyId}:${c.mode}`))].map(id => {
      const rr = counts.filter(c => `${c.agencyId}:${c.mode}` === id), pp = ps.filter(p => `${p.agencyId}:${p.mode}` === id), sp = pairList.filter(p => `${p.agencyId}:${p.mode}` === id)
      const sum = key => rr.reduce((n, r) => n + r[key], 0)
      return { id, agency: routes.get(rr[0].routeId).agency, mode: rr[0].mode, routes: rr.length, trips: sum('trips'), admittedTrips: sum('admittedTrips'),
        patterns: pp.length, admittedPatterns: pp.filter(p => p.admitted).length, directedPairs: sp.length, matchedDirectedPairs: sp.filter(p => p.pathIndex !== null).length,
        segmentOccurrences: sum('segmentOccurrences'), matchedSegmentOccurrences: sum('matchedSegmentOccurrences'), geometryCoverage: ratio(sum('matchedSegmentOccurrences'), sum('segmentOccurrences')) }
    })
    days.push({ date: day.date, trips: day.trains.length, admittedTrips: admitted.length, excludedTrips: day.trains.length - admitted.length,
      carryInTrips: day.trains.filter(t => t.sourceServiceDate !== day.date).length, admittedCarryInTrips: admitted.filter(t => t.sourceServiceDate !== day.date).length,
      representativeHeadwayTrips: day.trains.filter(t => t.frequency?.exactTimes === 0).length, admittedHeadwayTrips: metadata.frequency.headwayTrips,
      patterns: ps.length, admittedPatterns: ps.filter(p => p.admitted).length, directedPairs: pairList.length, matchedDirectedPairs: pairList.filter(p => p.pathIndex !== null).length,
      segmentOccurrences: counts.reduce((n, c) => n + c.segmentOccurrences, 0), matchedSegmentOccurrences: counts.reduce((n, c) => n + c.matchedSegmentOccurrences, 0),
      scheduledSegmentOccurrences: pairList.reduce((n, p) => n + p.scheduledOccurrences, 0), matchedScheduledSegmentOccurrences: pairList.filter(p => p.pathIndex !== null).reduce((n, p) => n + p.scheduledOccurrences, 0),
      representativeHeadwaySegmentOccurrences: pairList.reduce((n, p) => n + p.representativeHeadwayOccurrences, 0),
      repairedDirectedPairs: pairList.filter(p => p.geometryRepairIds?.length).length,
      admittedTripsUsingRepair: ps.filter(p => p.admitted && p.pairKeys.some(k => pairs.get(k).geometryRepairIds?.length)).reduce((n, p) => n + p.trips, 0),
      groups, routes: counts, exclusionReasons: Object.fromEntries(reasons), directedPatterns: ps, directedStopPairs: pairList.map(({ pathIndex, ...p }) => ({ ...p, matched: pathIndex !== null })),
      artifacts: { directory: destination, manifestGzipBytes: gz(manifest), morningGzipBytes: gz(morning), chunks: chunks.map(({ descriptor, payload }) => ({ id: descriptor.id, gzipBytes: gz(payload), trips: descriptor.tripCount })) } })
  }
  const inventory = [...routes.values()].map(r => ({ ...r, sourceFeatures: graphs.get(keyForRoute(r))?.sourceFeatures ?? [], days: days.map(day => {
    const c = day.routes.find(c => c.routeId === r.routeId), patterns = day.directedPatterns.filter(p => p.routeId === r.routeId)
    return { date: day.date, trips: c?.trips ?? 0, admittedTrips: c?.admittedTrips ?? 0, status: !c ? 'inactive-on-civil-day' : c.admittedTrips === c.trips ? 'admitted' : c.admittedTrips ? 'partially-admitted' : 'excluded', reasons: [...new Set(patterns.flatMap(p => p.reasons))] }
  }) }))
  for (const source of sourceInventory) {
    source.gtfsRoutes = inventory.filter(r => r.sourceFeatures.includes(source.key)).map(r => r.routeId)
    source.candidateRouteAdmittedTrips = days.reduce((n, d) => n + d.routes.filter(r => source.gtfsRoutes.includes(r.routeId)).reduce((n, r) => n + r.admittedTrips, 0), 0)
    source.status = !source.agencyIds ? 'identity-or-vintage-exclusion' : !source.gtfsRoutes.length ? 'no-annual-St-Gallen-calling-route' : source.candidateRouteAdmittedTrips ? 'candidate-graph-for-admitted-patterns' : 'no-admitted-fixture-pattern'
  }
  const report = { schemaVersion: 1, feed: raw.feed, sourceHashes, scope: raw.scope, policy, annualRouteRecords: inventory.length, annualAgencies: new Set(inventory.map(r => r.agencyId)).size,
    catalogue, sourceInventory, inventory, days,
    validation: { passed: true, annualPinnedTimetableInventoryComplete: true, admittedGeometryComplete: true, cantonMotionCoverageComplete: false, publicationReady: false,
      meaning: 'All admitted complete directed patterns pass numerical and artifact checks. Coverage denominators include excluded modes/patterns. This does not certify road direction or establish year-round geometry coverage.',
      pending: ['Resolve St. Gallen raw/derived-vector redistribution permission before publication', 'Resolve every excluded route/pattern before claiming complete cantonal motion coverage', 'Review street directions, loops, rail branches and temporary diversions before presenting paths as direction-certified', 'Validate seasonal and holiday dates', 'Integrate UI selection and refresh separately if requested'] } }
  await save(auditPath, report, true)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [timetablePath = 'data/st-gallen-sources/local/timetable.json', sourceDirectory = 'data/st-gallen-sources/local', output = 'data/st-gallen-region/local', auditPath = 'data/st-gallen-audit/local-report.json'] = process.argv.slice(2)
  assert(timetablePath, 'Usage: node scripts/build-st-gallen-region.mjs TIMETABLE [SOURCES OUTPUT AUDIT]')
  const r = await buildStGallenRegion({ timetablePath, sourceDirectory, output, auditPath, policyPath: 'data/st-gallen-policy.json' })
  console.log(JSON.stringify({ routes: r.annualRouteRecords, agencies: r.annualAgencies, days: r.days.map(({ directedPatterns: _patterns, directedStopPairs: _pairs, routes: _routes, ...d }) => d) }, null, 2))
}
