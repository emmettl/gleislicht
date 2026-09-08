import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readZugTimetable } from './zug-timetable.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const dates = ['2026-01-16', '2026-01-18', '2026-04-03', '2026-04-05', '2026-07-17', '2026-07-19', '2026-08-01', '2026-09-04', '2026-09-06', '2026-10-23', '2026-10-25', '2026-12-11']
const archive = process.argv[2] ?? '/private/tmp/GTFS_FP2026_20260902.zip'
const policy = JSON.parse(await readFile('data/graubuenden-policy.json'))
assert.equal(sha256(await readFile(archive)), policy.feedSha256)
const result = await readZugTimetable(archive, 'data/graubuenden-sources/boundary.json', dates, { cantonCode: 'GR', cantonName: 'Graubünden' })
assert.equal(result.sourceHashes.boundary, policy.boundarySha256)
await writeFile('data/graubuenden-audit/seasonal-timetable.json.gz', gzipSync(JSON.stringify(result)))
console.log(JSON.stringify({ scope: result.scope, routes: result.inventory.length, days: result.snapshots.map(d => ({ date: d.date, trips: d.trains.length })) }))
