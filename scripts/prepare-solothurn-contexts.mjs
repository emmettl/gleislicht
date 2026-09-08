import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { bernPatternId } from './bern-line-geometry.mjs'
import { SO_SEASONAL_DATES } from './solothurn-timetable.mjs'
const raw = JSON.parse(gunzipSync(await readFile('data/solothurn-audit/seasonal-timetable-cache.json.gz')))
assert.deepEqual(raw.snapshots.map(s => s.metadata.serviceDate), SO_SEASONAL_DATES)
const seen = new Set()
const snapshots = raw.snapshots.map(s => ({ metadata: s.metadata, stops: s.stops, trains: s.trains.filter(t => {
  const id = bernPatternId(t, s.stops)
  if (seen.has(id)) return false
  seen.add(id); return true
}) }))
const contexts = { schemaVersion: 1, sourceHashes: raw.sourceHashes, routes: raw.routes, snapshots }
await writeFile('data/solothurn-pattern-contexts.json.gz', gzipSync(JSON.stringify(contexts), { mtime: 0 }))
console.log(`Retained ${seen.size} complete seasonal stop contexts`)
