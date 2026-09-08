import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { rowsFromArchive } from '@motionstudies/data/gtfs'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
const [archive, snapshotPath, output] = process.argv.slice(2)
assert(archive && snapshotPath && output, 'Usage: ARCHIVE COMPLETE_SNAPSHOT OUTPUT')
const snapshot = JSON.parse(await readFile(snapshotPath))
const routes = new Map(); for await (const row of rowsFromArchive(archive, 'routes.txt')) routes.set(row.route_id, row.agency_id)
// One matcher feed; original route IDs retain the three distinct source operators.
const trains = snapshot.trains.filter(t => t.category === 'bus' && ['876', '7040', '7260'].includes(routes.get(t.routeId)))
assert(trains.length, 'Riviera: no bus journeys')
assert.deepEqual(snapshot.metadata.agencyIds, ['42', '64', '131', '125', '155', '876', '7040', '7260'])
const shifted = trains.map(t => {
  const shift = -Math.floor(Math.min(0, ...t.stops.flatMap(s => s.slice(1))) / 86400) * 86400
  return { ...t, stops: t.stops.map(([i, a, d]) => [i, a + shift, d + shift]) }
})
await prepareRoadFeed({ manifest: snapshot, trains: shifted, output, agency: { id: 'riviera-road-audit', name: 'VMCV and MOB/MVR replacement audit', url: 'https://www.vmcv.ch' } })
console.log({ date: snapshot.metadata.serviceDate, trips: trains.length })
