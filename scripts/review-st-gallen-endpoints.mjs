import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stGallenGraphs, matchStGallenPair, featureIdentity } from './st-gallen-line-geometry.mjs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const root = 'data/st-gallen-sources/local/endpoint-review'
const output = 'data/st-gallen-endpoint-review.json'
const json = async p => JSON.parse(await readFile(p, 'utf8'))
const save = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n')
const run = promisify(execFile)
const sources = [
  { id: '323', file: '323.html', publisher: 'RTB Rheintal Bus', url: 'https://www.rtb.ch/reisen/info-haltestelle/detail-linie/323',
    required: ['Dornbirn, Messeplatz', 'Dornbirn, Heinzenbeer', 'Lustenau, Schmitter'] },
  { id: '705', file: '705.html', publisher: 'WilMobil / BOS Gruppe', url: 'https://www.wilmobil.ch/reisen/info-haltestelle/detail-linie/705',
    required: ['Wil SG, Gallusstrasse', 'Wil SG, Lenzenbüel'] },
  { id: '734', file: '734.html', publisher: 'WilMobil / BOS Gruppe', url: 'https://www.wilmobil.ch/reisen/info-haltestelle/detail-linie/734',
    required: ['Wil SG, Winkelriedstrasse', 'Wil SG, Psychiatrie', 'Wil SG, Zürcherstrasse'] },
  { id: 'notices', file: 'notices.html', publisher: 'WilMobil / BOS Gruppe', url: 'https://www.wilmobil.ch/reisen/stoerungen/betriebsmeldungen',
    required: ['Wil SG, Gallusstrasse und Wil SG, Lenzenbüel', '150 Meter weiter in Richtung Wil SG, Zürcherstrasse',
      '24.08.2026, 05:00 - 21.09.2026, 23:59', 'Als Ersatz dient die Haltestelle Wil SG, Psychiatrie.'] },
  { id: 'vmobil-catalogue', file: 'vmobil.html', publisher: 'Mobilitätsdaten Österreich / AustriaTech',
    url: 'https://mobilitaetsdaten.gv.at/daten/soll-fahrplandaten-gtfs', required: ['20260703-0010_gtfs_flex_vmobil_2026.zip'] },
  { id: 'vmobil-license', file: 'vmobil-license.pdf', publisher: 'Mobilitätsverbünde Österreich OG',
    url: 'https://mobilitaetsdaten.gv.at/sites/default/files/metadataset/contract_examples/Lizenzvereinbarung_DBP_v1.1_0.pdf' },
  { id: 'vmobil', file: 'vmobil-20260703.zip', publisher: 'Mobilitätsverbünde Österreich OG / Verkehrsverbund Vorarlberg',
    url: 'https://mobilitaetsdaten.gv.at/sites/default/files/metadataset/sample_data/20260703-0010_gtfs_flex_vmobil_2026.zip',
    expectedSha256: 'c19094742f994a7c7b346d67a2021d35b71bce610a994e5825b0f8d1900438ed', sourceEditionDate: '2026-07-03' },
]

export async function fetchStGallenEndpointEvidence() {
  await mkdir(root, { recursive: true })
  const records = await Promise.all(sources.map(async s => {
    await run('curl', ['-fsSL', '--max-time', '90', s.url, '-o', join(root, s.file)])
    const bytes = await readFile(join(root, s.file)), hash = sha256(bytes)
    if (s.expectedSha256) assert.equal(hash, s.expectedSha256, 'Changed pinned external source')
    return { ...s, sha256: hash, bytes: bytes.length, retrievedAt: new Date().toISOString(), sourceEditionDate: s.sourceEditionDate ?? null }
  }))
  await save(join(root, 'sources.json'), records)
}

// Inventory only: external shapes are not imported into the regional feed.
async function vmobilInventory() {
  const { stdout } = await run('python3', ['-c', `
import csv,io,json,zipfile,collections,sys
z=zipfile.ZipFile(sys.argv[1])
def rows(n): return csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))
routes=list(rows('routes.txt')); agencies={r['agency_id']:r for r in rows('agency.txt')}
selected=[r for r in routes if r['route_short_name'] in ['323','164']]
ids={r['route_id'] for r in selected}; trips=[t for t in rows('trips.txt') if t['route_id'] in ids]
shapes={t['shape_id'] for t in trips if t.get('shape_id')}; points=collections.Counter()
for r in rows('shapes.txt'):
 if r['shape_id'] in shapes: points[r['shape_id']]+=1
print(json.dumps({'feed':list(rows('feed_info.txt'))[0],'routeRecords':len(routes),
 'selectedRoutes':[dict(r,agency=agencies[r['agency_id']]) for r in selected],
 'selectedTripRecords':len(trips),'selectedShapeRecords':len(shapes),'selectedShapePoints':sum(points.values()),
 'everySelectedShapeHasMultiplePoints':all(points[s]>=2 for s in shapes),
 'line323Present':any(r['route_short_name']=='323' for r in routes)}))
`, join(root, 'vmobil-20260703.zip')])
  const result = JSON.parse(stdout)
  assert.equal(result.feed.feed_version, '20260703'); assert.equal(result.line323Present, false)
  assert.equal(result.selectedRoutes.length, 1); assert.equal(result.selectedRoutes[0].route_short_name, '164')
  return result
}

const resultSummary = r => ({ reason: r.reason ?? 'candidate-path', maximumSnapMetres: r.maximumSnapMetres ?? null,
  pathMetres: r.pathMetres ?? null, ...(r.path ? { geometrySha256: sha256(JSON.stringify(r.path)) } : {}) })

export async function reviewStGallenEndpoints() {
  const audit = await json('data/st-gallen-audit/local-report.json')
  assert.equal(sha256(await readFile('data/st-gallen-policy.json')), audit.sourceHashes.policy)
  const raw = await readFile('data/st-gallen-sources/local/timetable.json')
  assert.equal(sha256(raw), audit.sourceHashes.timetable)
  const timetable = JSON.parse(raw), stops = new Map(timetable.stops.map(s => [s.stop_id, [Number(s.stop_lon), Number(s.stop_lat)]]))
  const catalogueBytes = await readFile('data/st-gallen-sources/local/sources.json')
  assert.equal(sha256(catalogueBytes), audit.sourceHashes.catalogue)
  const catalogue = JSON.parse(catalogueBytes), collections = {}
  for (const layer of ['bus', 'city']) {
    const file = `${layer}.geojson.gz`, bytes = await readFile(join('data/st-gallen-sources/local', file))
    assert.equal(sha256(bytes), catalogue.sources.find(s => s.file === file).sha256)
    collections[layer] = JSON.parse(gunzipSync(bytes))
  }
  const evidence = await json(join(root, 'sources.json'))
  assert.equal(evidence.length, sources.length)
  for (const expected of sources) {
    const e = evidence.find(s => s.id === expected.id); assert(e)
    assert.equal(e.url, expected.url); assert.equal(e.file, expected.file)
    assert(Number.isFinite(Date.parse(e.retrievedAt)))
    const bytes = await readFile(join(root, e.file))
    assert.equal(sha256(bytes), e.sha256); assert.equal(bytes.length, e.bytes)
    if (expected.expectedSha256) assert.equal(e.sha256, expected.expectedSha256)
    const text = bytes.toString('utf8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    for (const phrase of expected.required ?? []) assert(text.includes(phrase), `Changed endpoint evidence: ${e.id}: ${phrase}`)
  }
  const { graphs } = stGallenGraphs(collections, audit.policy)
  const donors = Object.entries(collections).flatMap(([layer, c]) => c.features.map(f => ({
    ...featureIdentity(layer, f, audit.policy), name: f.properties.LINIENNAME, graph: lineGraph([f]) })))
  const selected = new Map(audit.days.flatMap(d => d.directedStopPairs.filter(p => p.mode === 'bus' && p.reason === 'endpoint-gap').map(p => [p.key, p])))
  const pairs = []
  for (const pair of selected.values()) {
    const candidate = graphs.get(JSON.stringify([pair.agencyId, pair.mode, pair.line]))
    const from = stops.get(pair.fromId), to = stops.get(pair.toId)
    const production = matchStGallenPair(candidate, from, to, audit.policy.limits, pair)
    assert.equal(production.reason, 'endpoint-gap'); assert.equal(production.maximumSnapMetres, pair.maximumSnapMetres)
    assert.deepEqual(production.sourceFeatures, pair.sourceFeatures)
    const candidates = []
    for (const donor of donors.filter(d => d.mode === 'bus' && d.agencyIds?.includes(pair.agencyId) && !pair.sourceFeatures.includes(d.key))) {
      const result = matchBaselSegment(donor.graph, from, to, audit.policy.limits)
      if (result.path) candidates.push({ feature: donor.key, name: donor.name, ...resultSummary(result) })
    }
    const days = audit.days.map(day => {
      const p = day.directedStopPairs.find(p => p.key === pair.key)
      const patterns = day.directedPatterns.filter(p => p.pairKeys.includes(pair.key))
      assert(patterns.every(p => !p.admitted))
      return { date: day.date, occurrences: p?.occurrences ?? 0, affectedPatterns: patterns.length,
        affectedTrips: patterns.reduce((n, p) => n + p.trips, 0), patternIdsSha256: sha256(JSON.stringify(patterns.map(p => p.id).sort())) }
    })
    pairs.push({ key: pair.key, routeId: pair.routeId, agencyId: pair.agencyId, line: pair.line,
      fromId: pair.fromId, toId: pair.toId, from: pair.from, to: pair.to, sourceFeatures: pair.sourceFeatures,
      production: resultSummary(production), sameAgencyCandidates: candidates, days, decision: 'Retain complete-pattern exclusion.' })
  }
  const routes = [...new Set(pairs.map(p => p.routeId))].map(routeId => {
    const pp = pairs.filter(p => p.routeId === routeId)
    return { routeId, agencyId: pp[0].agencyId, line: pp[0].line, reviewedPairs: pp.length,
      pairsWithCandidate: pp.filter(p => p.sameAgencyCandidates.length).length,
      maximumSnapMetres: Math.max(...pp.map(p => p.production.maximumSnapMetres)),
      days: audit.days.map(day => {
        const patterns = day.directedPatterns.filter(p => p.routeId === routeId && p.pairKeys.some(k => selected.has(k)))
        return { date: day.date, affectedPatterns: patterns.length, affectedTrips: patterns.reduce((n, p) => n + p.trips, 0) }
      }) }
  }).sort((a, b) => b.days.reduce((n, d) => n + d.affectedTrips, 0) - a.days.reduce((n, d) => n + d.affectedTrips, 0))
  const days = audit.days.map(day => {
    const patterns = day.directedPatterns.filter(p => p.pairKeys.some(k => selected.has(k)))
    return { date: day.date, reviewedPairs: pairs.filter(p => p.days.find(d => d.date === day.date).occurrences).length,
      affectedPatterns: patterns.length, affectedTrips: patterns.reduce((n, p) => n + p.trips, 0), admittedTrips: day.admittedTrips,
      dayAuditSha256: sha256(JSON.stringify(day)) }
  })
  return { schemaVersion: 1, scope: 'Every remaining bus endpoint-gap pair across the two pinned St. Gallen civil-day fixtures.',
    sourceHashes: audit.sourceHashes, evidence: evidence.map(({ required: _required, expectedSha256: _expectedSha256, ...e }) => e), externalInventory: await vmobilInventory(),
    method: 'Replay each production graph. Diagnose every other individual regional/city bus record mapped to the same GTFS agency with unchanged limits. Candidate geometry hashes establish reproducibility, not route authority. No operator union, external shapes, changed stop locations or relaxed limits are used for admission.',
    pairs, routes, days, validation: { passed: true, feedChanged: false, admissionLimitsChanged: false, directionCertified: false } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--fetch-evidence')) await fetchStGallenEndpointEvidence()
  const report = await reviewStGallenEndpoints()
  if (process.argv.includes('--check')) assert.deepEqual(report, await json(output), 'Stale endpoint review')
  else await save(output, report)
  console.log(JSON.stringify({ passed: true, reviewedPairs: report.pairs.length, routes: report.routes, days: report.days }, null, 2))
}
