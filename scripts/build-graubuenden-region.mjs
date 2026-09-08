import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'
import { compactLuzern, validateLuzernSnapshot, luzernCategory } from './build-luzern-region.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { previousServiceDate } from './civil-day.mjs'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export const readJson = async path => { const b = await readFile(path); return JSON.parse(path.endsWith('.gz') ? gunzipSync(b) : b) }
export const saveJson = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value)+'\n') }
export function coverage(patterns) {
  const sum = fn => patterns.reduce((n, p) => n + fn(p), 0), pairs = patterns.flatMap(p => p.pairs), unique = new Map()
  for (const p of patterns) for (const pair of p.pairs) {
    const key = JSON.stringify([p.routeId, pair.fromId, pair.toId]), values = unique.get(key) ?? []
    values.push(pair.matched); unique.set(key, values)
  }
  return { trips: sum(p => p.trips), admittedTrips: sum(p => p.admitted ? p.trips : 0), excludedTrips: sum(p => p.admitted ? 0 : p.trips),
    patterns: patterns.length, admittedPatterns: patterns.filter(p => p.admitted).length,
    patternPairs: pairs.length, matchedPatternPairs: pairs.filter(p => p.matched).length,
    uniqueDirectedRouteStopPairs: unique.size, fullyMatchedUniqueDirectedRouteStopPairs: [...unique.values()].filter(v => v.every(Boolean)).length,
    segmentOccurrences: sum(p => p.trips * p.pairs.length), matchedSegmentOccurrences: sum(p => p.trips * p.pairs.filter(s => s.matched).length),
    scheduledSegmentOccurrences: sum(p => (p.trips - p.headwayTrips) * p.pairs.length), matchedScheduledSegmentOccurrences: sum(p => (p.trips - p.headwayTrips) * p.pairs.filter(s => s.matched).length),
    headwayTrips: sum(p => p.headwayTrips), admittedHeadwayTrips: sum(p => p.admitted ? p.headwayTrips : 0),
    carryInTrips: sum(p => p.carryInTrips), admittedCarryInTrips: sum(p => p.admitted ? p.carryInTrips : 0),
    reasons: Object.fromEntries([...new Set(patterns.flatMap(p => p.reasons))].sort().map(reason => [reason, sum(p => p.reasons.includes(reason) ? p.trips : 0)])) }
}

export async function buildGraubuendenRegion({ output = 'public/data/graubuenden-region', audit = 'data/graubuenden-audit' } = {}) {
  const raw = await readJson('data/graubuenden-audit/timetable.json.gz'), policy = await readJson('data/graubuenden-policy.json')
  assert.equal(raw.sourceHashes.archive, policy.feedSha256); assert.equal(raw.sourceHashes.boundary, policy.boundarySha256)
  assert.equal(sha256(await readFile('data/graubuenden-sources/boundary.json')), policy.boundarySha256)
  assert.deepEqual(raw.dates, policy.dates)
  assert.equal(sha256(await readFile('data/graubuenden-audit/timetable.json.gz')), policy.timetableSha256, 'Changed complete timetable census')
  const sourceHashes = { ...raw.sourceHashes, timetable: sha256(await readFile('data/graubuenden-audit/timetable.json.gz')),
    policy: sha256(await readFile('data/graubuenden-policy.json')), roads: policy.roads.cacheSha256, rail: policy.rail.sourceSha256 }
  const geometry = await loadGraubuendenGeometry(policy, raw), stops = new Map(raw.stops.map(s => [s.stop_id, s])), routes = new Map(raw.inventory.map(r => [r.routeId, r]))
  const railSource = await readJson(join(policy.rail.sourceDirectory, 'source.json')), roadSource = await readJson('data/graubuenden-roads/sources.json')
  const sources = { timetable: { publisher: 'SBB / opentransportdata.swiss', sha256: policy.feedSha256, feed: raw.feed,
      url: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', termsUrl: 'https://opentransportdata.swiss/en/terms-of-use/',
      refresh: 'Pinned archival study. Rebuild and reaudit before treating as current service.' },
    boundary: { publisher: '© swisstopo', sha256: policy.boundarySha256,
      url: 'https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/18?sr=4326&geometryFormat=geojson',
      termsUrl: 'https://www.swisstopo.admin.ch/de/nutzungsbedingungen-kostenlose-geodaten-und-geodienste', vintage: 'No boundary edition supplied in this response.' },
    rail: railSource, railAnchorReview: geometry.railAnchors ? { policy: geometry.railAnchors.policy, reviews: geometry.railAnchors.reviews,
      model: 'Explicit stop attachments on two subdivided FOT curves; derived nodes are not original FOT operating-point records.',
      supportingEvidence: geometry.railAnchors.evidence } : null,
    roads: { ...roadSource, derivedDatabase: 'road-paths.json' },
    railCompletionReview: geometry.railCompletion ? { policy: geometry.railCompletion.review, terminalExtension: geometry.railCompletion.extension, note: 'Exact existing FOT station-curve extension and single-segment operator review; no running-track certification.' } : null,
    accessRoads: geometry.accessRoads ? { ...geometry.accessRoads.source, review: geometry.accessRoads.review, derivedDatabase: 'access-road-paths.json' } : null,
    cableways: geometry.cableways ? { ...geometry.cableways.source, review: geometry.cableways.review } : null,
    localGeometry: { admitted: false, evidence: 'See docs/GRAUBUENDEN-STUDY.md and data/graubuenden-sources/probes.json' } }
  const memo = new Map(), paths = [], pathIndexes = new Map(), reports = [], inventory = raw.inventory.map(r => ({ ...r, days: [] }))
  for (const day of raw.snapshots) {
    const patterns = new Map(), admitted = []
    for (const train of day.trains) {
      const route = routes.get(train.routeId), key = directedPatternKey(train)
      if (!memo.has(key)) {
        const results = geometry.matchPattern(train, route)
        assert.equal(results.length, train.calls.length - 1)
        const pathSegments = [], pairs = results.map(({ path, ...evidence }, i) => {
          let index = null
          if (path) {
            assert(path.length >= 2 && path.every(p => p.length === 2 && p.every(Number.isFinite)))
            const signature = JSON.stringify(path)
            if (!pathIndexes.has(signature)) { pathIndexes.set(signature, paths.length); paths.push(path) }
            index = pathIndexes.get(signature)
          }
          pathSegments.push(index)
          return { fromId: train.calls[i].id, toId: train.calls[i + 1].id, matched: index !== null,
            geometrySha256: path ? sha256(JSON.stringify(path)) : null, ...evidence }
        })
        const reasons = [...new Set(pairs.filter(p => !p.matched).map(p => p.reason))]
        if (train.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType))) reasons.push('prior-arrangement-call')
        memo.set(key, { id: sha256(key).slice(0, 20), routeId: route.routeId, agencyId: route.agencyId, mode: route.mode, line: route.line,
          directionId: train.directionId, stopIds: train.calls.map(c => c.id), callRules: train.calls.map(c => [c.pickupType, c.dropOffType]),
          admitted: !reasons.length, reasons, pairs, pathSegments })
      }
      if (!patterns.has(key)) patterns.set(key, { ...memo.get(key), trips: 0, carryInTrips: 0, headwayTrips: 0 })
      const p = patterns.get(key)
      p.trips++; p.carryInTrips += Number(train.sourceServiceDate !== day.date); p.headwayTrips += Number(train.frequency?.exactTimes === 0)
      if (p.admitted) admitted.push({ ...train, route: route.line, agencyId: route.agencyId, routeType: route.routeType,
        category: luzernCategory(route), transportMode: route.mode, geometrySource: ['bus', 'mountain'].includes(route.mode) ? p.pairs[0].geometrySource : (p.pairs.find(pair => pair.geometrySource?.startsWith('fot-reviewed-'))?.geometrySource ?? 'fot'), patternId: p.id, pathSegments: p.pathSegments })
    }
    const pp = [...patterns.values()], counts = coverage(pp)
    const metadata = { publisher: 'Gleislicht', serviceDate: day.date, feedVersion: raw.feed.feed_version, sourceHashes,
      dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: [previousServiceDate(day.date), day.date],
      windowStart: 0, windowEnd: 86400, focusTime: 27900, modes: [...new Set(admitted.map(t => t.transportMode))],
      label: 'Graubünden · initial rail, bus and cableway study', scope: raw.scope.description, exclusions: policy.scopeLimits, note: policy.admission,
      model: 'Timetable interpolation on reviewed rail infrastructure and inferred OSM bus paths, with selected reviewed federal cableway axes. Frequency services are representative headway movement, not exact departures or observed cabins.',
      attribution: 'SBB / opentransportdata.swiss · © Federal Office of Transport (FOT) · © swisstopo · © OpenStreetMap contributors',
      sourceUrl: sources.timetable.url, termsUrl: sources.timetable.termsUrl,
      geometry: { publisher: 'FOT / OpenStreetMap contributors', sourceUrl: 'https://www.openstreetmap.org/copyright', license: 'ODbL-1.0 for bus path database; attribution terms for FOT rail and cableways',
        productUrl: '../sources.json', model: 'Inferred full-pattern paths', matchedSegments: admitted.reduce((n, t) => n + t.pathSegments.length, 0), totalSegments: admitted.reduce((n, t) => n + t.pathSegments.length, 0),
        coverageScope: 'Admitted journeys only. Full-candidate coverage in the study audit.', maximumSnapMetres: geometry.roads.report.maxSnapMetres },
      candidateCoverage: counts }
    const snapshot = compactLuzern(admitted, stops, paths, metadata)
    validateLuzernSnapshot(snapshot)
    const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, 'day-chunks')
    const destination = join(output, day.date)
    // Chunk descriptors hash the exact JSON bytes: never append a newline here.
    for (const { descriptor, payload } of chunks) { await mkdir(dirname(join(destination, descriptor.path)), { recursive: true }); await writeFile(join(destination, descriptor.path), JSON.stringify(payload)) }
    await saveJson(join(destination, 'graubuenden-region-day-manifest.json'), manifest)
    const morning = extractNetworkWindow(snapshot, 24300, 31500, 27900)
    validateLuzernSnapshot(morning)
    await saveJson(join(destination, 'graubuenden-region-morning.json'), morning)
    for (const r of inventory) r.days.push({ date: day.date, ...coverage(pp.filter(p => p.routeId === r.routeId)) })
    const groups = field => [...new Set(raw.inventory.map(r => r[field]))].sort().map(id => ({ id, ...(field === 'agencyId' ? { agency: raw.inventory.find(r => r.agencyId === id).agency } : {}), ...coverage(pp.filter(p => p[field] === id)) }))
    const report = { date: day.date, sourceHashes, ...counts, byMode: groups('mode'), byAgency: groups('agencyId'),
      patterns: pp.map(({ pathSegments, ...p }) => p),
      outsideCantonStopRecords: snapshot.stops.filter(s => !raw.cantonStops.some(c => c.stop_id === s[4])).length,
      zeroDurationAdmittedSegments: snapshot.trains.reduce((n, t) => n + t.stops.slice(1).filter((c, i) => c[1] === t.stops[i][2]).length, 0) }
    await saveJson(join(audit, `${day.date}.json`), report)
    reports.push({ ...report, patternCount: pp.length, patterns: undefined })
    console.log(JSON.stringify({ date: day.date, ...counts }))
  }
  for (const r of inventory) {
    const total = r.days.reduce((n, d) => n + d.trips, 0), admitted = r.days.reduce((n, d) => n + d.admittedTrips, 0)
    r.status = !total ? 'inactive-on-validation-dates' : !admitted ? 'excluded' : admitted === total ? 'admitted-all-dated-trips' : 'partially-admitted'
  }
  const summary = { schemaVersion: 1, sourceHashes, sources, scope: raw.scope, policy, annualRouteRecords: inventory.length,
    annualAgencies: new Set(inventory.map(r => r.agencyId)).size, routeStatus: Object.fromEntries([...new Set(inventory.map(r => r.status))].map(s => [s, inventory.filter(r => r.status === s).length])), days: reports }
  await saveJson(join(audit, 'summary.json'), summary); await saveJson(join(audit, 'routes.json'), inventory)
  await saveJson(join(audit, 'stops.json'), raw.cantonStops); await saveJson(join(audit, 'rail-segments.json'), geometry.railInventory)
  await saveJson(join(output, 'sources.json'), sources)
  await saveJson(join(output, 'road-paths.json'), { ...geometry.roads, metadata: { ...geometry.roads.metadata, attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0' } })
  if (geometry.accessRoads) await saveJson(join(output, 'access-road-paths.json'), { ...geometry.accessRoads.cache, metadata: { ...geometry.accessRoads.cache.metadata, attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0' } })
  await saveJson(join(output, 'index.json'), { label: 'Graubünden initial regional study', sourceHashes, dates: await Promise.all(raw.dates.map(async date => ({ date,
    manifest: `${date}/graubuenden-region-day-manifest.json`, morning: `${date}/graubuenden-region-morning.json`,
    manifestSha256: sha256(await readFile(join(output, date, 'graubuenden-region-day-manifest.json'))), morningSha256: sha256(await readFile(join(output, date, 'graubuenden-region-morning.json'))) }))),
    admission: policy.admission })
  return summary
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildGraubuendenRegion()
