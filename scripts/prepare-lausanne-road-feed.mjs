import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareRoadFeed, readPostbusDay } from './prepare-postbus-road-feed.mjs'
import { LAUSANNE_AGENCY } from './audit-lausanne-study.mjs'

// A routing-only feed combines dated patterns; its synthetic calendar is not a
// passenger timetable. Shift whole trips crossing midnight to valid GTFS times.
export function combineLausanneBusPatterns(snapshots) {
  const stops = [], indexes = new Map(), trains = []
  const dates = new Set(), sourceDays = new Set()
  for (const snapshot of snapshots) {
    assert.deepEqual(snapshot.metadata.localAgencyIds, ['151'], 'Expected the tl-only local-service scope')
    assert.equal(snapshot.metadata.dayModel, 'civil day with preceding service-day spillover')
    dates.add(snapshot.metadata.serviceDate)
    snapshot.metadata.sourceServiceDates.forEach(date => sourceDays.add(date))
    const remap = snapshot.stops.map(stop => {
      const key = JSON.stringify(stop)
      if (!indexes.has(key)) { indexes.set(key, stops.length); stops.push(stop) }
      return indexes.get(key)
    })
    for (const train of snapshot.trains.filter(train => train.category === 'bus')) {
      const minimum = Math.min(0, ...train.stops.flatMap(stop => stop.slice(1)))
      const shift = -Math.floor(minimum / 86400) * 86400
      trains.push({ ...train, id: `${snapshot.metadata.serviceDate}:${train.id}`, stops: train.stops.map(([index, arrival, departure]) => [remap[index], arrival + shift, departure + shift]) })
    }
  }
  assert(trains.length, 'No tl bus patterns')
  return { manifest: { metadata: { ...snapshots[0].metadata, serviceDates: [...dates].sort(), sourceServiceDates: [...sourceDays].sort(), note: 'Routing-only union of dated tl bus patterns; not a passenger timetable.' }, stops }, trains }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const paths = process.argv.flatMap((value, i) => value === '--snapshot' ? [process.argv[i + 1]] : [])
  const output = process.argv[process.argv.indexOf('--output') + 1]
  assert(paths.length && process.argv.includes('--output'), 'Use --snapshot FILE [--snapshot FILE] --output DIR')
  const snapshots = await Promise.all(paths.map(async path => {
    const value = JSON.parse(await readFile(path, 'utf8'))
    if (!value.chunks) return value
    const { trains } = await readPostbusDay(path)
    return { ...value, trains }
  }))
  console.log(await prepareRoadFeed({ ...combineLausanneBusPatterns(snapshots), output, agency: LAUSANNE_AGENCY }))
}
