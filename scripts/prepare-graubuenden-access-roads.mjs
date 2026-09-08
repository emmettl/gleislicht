import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { loadGraubuendenGeometry } from './graubuenden-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const input = 'data/graubuenden-audit', output = 'data/graubuenden-access-roads'
const bytes = await readFile(`${input}/timetable.json.gz`), raw = JSON.parse(gunzipSync(bytes))
const policy = JSON.parse(await readFile('data/graubuenden-policy.json'))
const baseline = await loadGraubuendenGeometry({ ...policy, roadAccessReview: undefined }, raw)
const routeIndex = new Map(raw.inventory.map(r => [r.routeId, r])), ids = new Set()
for (const day of raw.snapshots) for (const t of day.trains) {
 const r = routeIndex.get(t.routeId)
 if (r.mode === 'bus' && (!baseline.matchPattern(t, r).every(p => p.path) || t.calls.some(c => ['2','3'].includes(c.pickupType) || ['2','3'].includes(c.dropOffType)))) ids.add(r.routeId)
}
const routes = raw.inventory.filter(r => ids.has(r.routeId)).map(({routeId,agencyId,line}) => ({routeId,agencyId,line}))
const stops = raw.stops.map(s => [Number(s.stop_lon), Number(s.stop_lat), s.stop_name, s.platform_code, s.stop_id]), indexes = new Map(stops.map((s, i) => [s[4], i]))
const trains = raw.snapshots.flatMap(d => d.trains.filter(t => ids.has(t.routeId)).map(t => {
 const shift = -Math.floor(Math.min(0, t.calls[0].arrival) / 86400) * 86400
 return { ...t, route: routes.find(r => r.routeId === t.routeId).line, stops: t.calls.map(c => [indexes.get(c.id), c.arrival + shift, c.departure + shift]) }
}))
await mkdir(output, { recursive: true })
const parentDir = 'data/luzern-access-road-sources', parentBytes = await readFile(`${parentDir}/source.json`), parent = JSON.parse(parentBytes)
for (const [file, hash] of Object.entries(parent.files)) assert.equal(sha256(await readFile(`${parentDir}/${file}`)), hash)
await writeFile(`${output}/parent-source.json`, parentBytes)
for (const file of ['filter.cfg', 'routing.cfg', 'pfaedle-LICENSE']) await writeFile(`${output}/${file}`, await readFile(`${parentDir}/${file}`))
const pbf = '/private/tmp/gleislicht-switzerland-260902.osm.pbf'
assert.equal(sha256(await readFile(pbf)), parent.parentPbfSha256)
const metadata = { serviceDate: raw.dates[0], serviceDates: raw.dates, feedVersion: raw.feed.feed_version, timetableSha256: sha256(bytes), routes,
 sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
 note: 'Every complete fixture pattern on every route with a previously excluded bus journey. A newly filtered graph from the pinned Swiss PBF and stricter 20 m matcher candidates are a geometry experiment; no source access restrictions are removed. All original complete journeys are retained for review.' }
await writeFile(`${output}/selection.json`, JSON.stringify(metadata, null, 2)+'\n')
console.log(await prepareRoadFeed({ manifest: { stops, metadata }, trains, agency: { id: 'GR-access-review', name: 'Graubünden rejected-route full-pattern review', url: 'https://www.gr.ch' }, output: '/private/tmp/graubuenden-access-feed' }))

const binary = '/private/tmp/gleislicht-pfaedle/build/pfaedle', osm = '/private/tmp/graubuenden-access-network.osm'
assert.equal(sha256(await readFile(binary)), parent.binarySha256)
const args = ['-x', pbf, '-c', `${output}/filter.cfg`, '-i', '/private/tmp/graubuenden-access-feed', '-m', 'bus', '-X', osm]
const result = await promisify(execFile)(binary, args, { maxBuffer: 8 * 1024 * 1024 })
await writeFile(`${output}/filtering.log.gz`, gzipSync(result.stdout + result.stderr))
const graph = await readFile(osm); await writeFile(`${output}/network.osm.gz`, gzipSync(graph))
await writeFile(`${output}/filter-patterns.json.gz`, gzipSync(await readFile('/private/tmp/graubuenden-access-feed/patterns.json')))
await writeFile(`${output}/graph-source.json`, JSON.stringify({ sourceUrl: parent.sourceUrl, parentPbfSha256: parent.parentPbfSha256, sourceDate: parent.swissDate,
 osmSha256: sha256(graph), binarySha256: parent.binarySha256, matcherCommit: parent.matcherCommit, args,
 note: 'Filtered from the original Swiss PBF with the complete Graubünden review input. pfaedle applies input-dependent bounding boxes as well as tag filters. Foreign coverage is limited by the original extract; no national extent is claimed.' }, null, 2)+'\n')
