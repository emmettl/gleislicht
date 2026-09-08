import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { hashFile } from './solothurn-timetable.mjs'
const directory = 'data/solothurn-seasonal-roads', input = 'data/solothurn-pattern-contexts.json.gz'
const raw = JSON.parse(gunzipSync(await readFile(input)))
const routeIds = ['92-507-j26-1', '92-N51-j26-1', '92-A01-T-j26-1']
const routes = raw.routes.filter(r => routeIds.includes(r.id)); assert.equal(routes.length, routeIds.length); assert(routes.every(r => r.mode === 'bus'))
const stops = [], indexes = new Map(), trains = []
for (const day of raw.snapshots) for (const train of day.trains.filter(t => routeIds.includes(t.routeId))) {
  const shift = Math.max(0, Math.ceil(-train.stops[0][1] / 86400) * 86400)
  trains.push({ ...train, id: `${day.metadata.serviceDate}:${train.id}`, stops: train.stops.map(([i, a, d]) => {
    const stop = day.stops[i], key = JSON.stringify(stop)
    if (!indexes.has(key)) { indexes.set(key, stops.length); stops.push(stop) }
    return [indexes.get(key), a + shift, d + shift]
  }) })
}
await mkdir(directory, { recursive: true })
const parentDir = 'data/luzern-access-road-sources', parentBytes = await readFile(`${parentDir}/source.json`), parent = JSON.parse(parentBytes)
for (const file of ['filter.cfg', 'routing.cfg', 'pfaedle-LICENSE']) {
  assert.equal(await hashFile(`${parentDir}/${file}`), parent.files[file]); await copyFile(`${parentDir}/${file}`, `${directory}/${file}`)
}
await writeFile(`${directory}/parent-source.json`, parentBytes)
const pbf = '/private/tmp/gleislicht-switzerland-260902.osm.pbf', binary = '/private/tmp/gleislicht-pfaedle/build/pfaedle'
assert.equal(await hashFile(pbf), parent.parentPbfSha256); assert.equal(await hashFile(binary), parent.binarySha256)
const metadata = { serviceDate: raw.snapshots[0].metadata.serviceDate, dates: raw.snapshots.map(d => d.metadata.serviceDate), feedVersion: raw.snapshots[0].metadata.feedVersion,
  sourceHashes: raw.sourceHashes, contextSha256: await hashFile(input), sourceUrl: raw.snapshots[0].metadata.sourceUrl,
  routes: routes.map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name })),
  scope: 'Every complete retained twelve-date pattern on three routes with unresolved winter or summer bus pairs. Original calls and coordinates retained; routing-only nonnegative times. Geometry experiment, not automatic admission.' }
const feed = '/private/tmp/solothurn-seasonal-road-feed', osm = '/private/tmp/solothurn-seasonal-road-network.osm'
console.log(await prepareRoadFeed({ manifest: { stops, metadata }, trains, output: feed, agency: { id: 'SO-access-review', name: 'Solothurn complete-pattern review', url: metadata.sourceUrl } }))
const csv = rows => rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n'
await writeFile(`${feed}/agency.txt`, csv([['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ...[...new Set(routes.map(r => r.agencyId))].map(id => [id, routes.find(r => r.agencyId === id).agency, metadata.sourceUrl, 'Europe/Zurich'])]))
await writeFile(`${feed}/routes.txt`, csv([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'], ...routes.map(r => [r.id, r.agencyId, r.name, r.longName, 3])]))
await writeFile(`${directory}/selection.json`, JSON.stringify(metadata, null, 2) + '\n')
const args = ['-x', pbf, '-c', `${directory}/filter.cfg`, '-i', feed, '-m', 'bus', '-X', osm]
const run = await promisify(execFile)(binary, args, { maxBuffer: 8 * 1024 * 1024 })
await writeFile(`${directory}/filtering.log.gz`, gzipSync(run.stdout + run.stderr))
await writeFile(`${directory}/network.osm.gz`, gzipSync(await readFile(osm)))
await writeFile(`${directory}/filter-patterns.json.gz`, gzipSync(await readFile(`${feed}/patterns.json`)))
await writeFile(`${directory}/graph-source.json`, JSON.stringify({ sourceUrl: parent.sourceUrl, sourceDate: parent.swissDate, parentPbfSha256: parent.parentPbfSha256,
  osmSha256: await hashFile(osm), binarySha256: parent.binarySha256, matcherCommit: parent.matcherCommit, args,
  attribution: parent.attribution, license: parent.license, licenseUrl: parent.licenseUrl,
  method: 'Input-dependent pfaedle extraction from the pinned Swiss PBF, adding service roads with original access/direction/turn rules. Routing profile tightens stop candidates to 20 m. No current operator itinerary or physical access certification.' }, null, 2) + '\n')
console.log('Prepared Solothurn seasonal road graph and complete routing input')
