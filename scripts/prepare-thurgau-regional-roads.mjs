import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'

const bytes = await readFile('data/thurgau-audit/timetable-cache.json.gz')
const timetable = JSON.parse(gunzipSync(bytes))
const output = process.argv[2] ?? '/private/tmp/thurgau-regional-road-feeds'
const reports = []
for (const id of ['138', '744', '801', '896']) {
  const stops = [], indexes = new Map(), trains = []
  for (const raw of timetable.snapshots) for (const train of raw.trains) {
    if (train.agencyId !== id || train.route === 'NT' || train.reservationRequired || timetable.routes.find(r => r.id === train.routeId).type === 715) continue
    assert(train.category === 'bus')
    const shift = -Math.floor(Math.min(0, ...train.stops.flatMap(s => s.slice(1))) / 86400) * 86400
    trains.push({ ...train, stops: train.stops.map(([i, a, d]) => {
      const stop = raw.stops[i], key = JSON.stringify(stop)
      if (!indexes.has(key)) { indexes.set(key, stops.length); stops.push(stop) }
      return [indexes.get(key), a + shift, d + shift]
    }) })
  }
  const route = timetable.routes.find(r => r.agencyId === id)
  const metadata = { ...timetable.snapshots[0].metadata, serviceDates: timetable.snapshots.map(s => s.metadata.serviceDate),
    sourceTimetableSha256: createHash('sha256').update(bytes).digest('hex'),
    note: 'Routing-only union of complete regional bus patterns. Shifted times are not a passenger timetable; GTFS type 715 and reservation/on-demand calls excluded.' }
  reports.push({ agencyId: id, ...await prepareRoadFeed({ manifest: { metadata, stops }, trains, output: join(output, id),
    agency: { id, name: route.agency, url: 'https://opentransportdata.swiss' } }) })
}
await mkdir(output, { recursive: true })
await writeFile(join(output, 'preparation.json'), JSON.stringify(reports, null, 2) + '\n')
console.log(reports)
