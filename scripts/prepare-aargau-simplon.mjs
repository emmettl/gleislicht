import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { geometryDigest } from './aargau-alignment-corrections.mjs'
import { simplonGeometry, SIMPLON_POLICY } from './aargau-simplon.mjs'

const read = async f => JSON.parse(await readFile(f, 'utf8'))
const root = 'data/aargau-simplon-sources', rules = [], inputTimetableHashes = {}
const verification = await read('data/aargau-seasonal/input/source-verification.json')
for (const date of ['2026-04-03', '2026-08-01']) {
  const file = `data/aargau-seasonal/input/${date}-timetable.json.gz`
  inputTimetableHashes[date] = await hashFile(file)
  assert.equal(inputTimetableHashes[date], verification.fixtures[`${date}-timetable.json.gz`])
  const raw = JSON.parse(gunzipSync(await readFile(file)))
  const trains = raw.trains.filter(t => t.routeId === '91-29-Y-j26-1' && t.calls.at(-1)[0] === '8301003')
  assert.equal(trains.length, 1)
  const t = trains[0]; assert.equal(t.shortName, '1303')
  rules.push({ id: `${date}-ic1303-simplon`, date, sourceTripId: t.sourceTripId, routeId: t.routeId, agencyId: t.agencyId, mode: t.category, line: t.route, directionId: t.directionId, shortName: t.shortName, segmentIndex: t.calls.length - 2, calls: t.calls, stops: t.calls.map(c => raw.stops.find(s => s[4] === c[0])) })
}
const graph = { snapshot: '2026-09-08T00:00:00Z',
  stations: [{ nodeId: 6771438097, number: '8501609', name: 'Brig' }, { nodeId: 2837216238, number: '8501607', name: 'Domodossola' }],
  reviewedCrossoverWayIds: [643956810],
  limits: { stationIdentityMetres: 350, trackAttachmentMetres: 120, projectionAlternativeMetres: 5, maximumTurnDegrees: 90, maximumPathMetres: 50000 } }
const pair = rules[0].stops.slice(-2); assert.deepEqual(pair, rules[1].stops.slice(-2))
const geometry = await simplonGeometry({ graph, pair })
const { path, ...geometryEvidence } = geometry
const evidence = [
  { file: 'osm.json.gz', url: 'https://overpass-api.de/api/interpreter', sourceDate: graph.snapshot, attribution: '© OpenStreetMap contributors, ODbL-1.0',
    finding: 'Pinned bounded rail ways, stop areas, UIC station nodes and complete referenced nodes. Exact shared-node topology only. Main standard-gauge lines plus the specifically reviewed 1435 mm passenger crossover 643956810; sidings, yards, spurs and non-rail features excluded. The other Simplon crossover is not admitted. No source tags or coordinates are edited.' },
  { file: 'rail.overpass', url: null, sourceDate: graph.snapshot, finding: 'Exact reproducible Overpass query with snapshot and full element metadata.' },
  { file: 'sbb-domodossola-stations.json', url: 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/dienststellen-gemass-opentransportdataswiss/records?where=search(%22Domodossola%22)&limit=20', sourceDate: '2024-09-19T15:24:12+00:00', attribution: 'SBB Infrastruktur / opentransportdata.swiss / FOT service points',
    finding: 'Exact record 8501607, Domodossola, assigned operating point, valid from 15 December 2024: FOT comment explicitly identifies timetable under 8301003 (foreign). This establishes the narrowly scoped code association; neither number is inferred from proximity or name alone.' },
  { file: 'sbb-station-catalogue.json', url: 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets', sourceDate: null, finding: 'Archived dataset metadata; acquisition date is not the station record edition date.' },
  { file: 'sbb-domodossola.pdf', url: 'https://company.sbb.ch/content/dam/internet/corporate/downloads/en/sbb-als-geschaeftspartner/flotte-unterhalt/onestopshop/Factsheet_Domodossola.pdf.sbbdownload.pdf', sourceDate: '2024-08-06', visuallyReviewedPage: 3,
    finding: 'SBB Infrastructure diagram distinguishes passenger station Domodossola FS, 83-01003-3, from Domodossola FM and Domodossola II. These other operating points cannot substitute for the timetable destination.' },
  { file: '145-2026.pdf', url: 'https://widgets.oev-info.ch/publikation/jahresfpl/145.pdf', sourceDate: '2026-05-26', visuallyReviewedPage: 1,
    finding: 'Official field 145 shows SBB IC 1303 from Zürich, Brig 09:39 to Domodossola without intermediate calls. Its first seasonal panel is limited to 14 December–28 May. The PDF has 10:07/10:09 arrivals; pinned GTFS has 10:09 on 3 April and 10:16 on 1 August. No PDF time or calendar is substituted for GTFS.' },
  { file: 'bls-closures.html.gz', url: 'https://www.bls.ch/de/unternehmen/projekte-und-hintergruende/bauprojekte/simplontunnel', sourceDate: null,
    finding: 'Rechecked 8 September. Operator describes 2026 construction and replacement services between Iselle and Domodossola, including weekday closures from 10:30. This mutable page is context only; the two pinned GTFS journeys and call times define admission, not a general all-date rail assumption.' },
]
const files = [...evidence.map(e => `${root}/${e.file}`), 'data/aargau-seasonal/input/source-verification.json', ...Object.keys(inputTimetableHashes).map(d => `data/aargau-seasonal/input/${d}-timetable.json.gz`)]
const policy = { schemaVersion: 1, checkedOn: '2026-09-08', scope: 'Two exact IC 1303 seasonal journeys, final Brig–Domodossola segment only. OSM standard-gauge infrastructure inference with official station-code evidence; not certified running track, historical operation or publication approval. Preserve every prior accepted path and all original timetable calls.',
  inputTimetableHashes, files: Object.fromEntries(await Promise.all(files.map(async f => [f, await hashFile(f)]))), evidence, graph, pair, pathSha256: geometryDigest(path), geometryEvidence, rules }
if (process.argv.includes('--check')) assert.deepEqual(await read(SIMPLON_POLICY), policy)
else await writeFile(SIMPLON_POLICY, JSON.stringify(policy, null, 2) + '\n')
console.log(`Verified two scoped Simplon journeys: ${geometry.pathMetres.toFixed(1)} m; track snaps ${geometry.trackAttachmentsMetres.map(n => n.toFixed(2)).join(' / ')} m`)
