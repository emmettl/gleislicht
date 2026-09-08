import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readZugTimetable } from './zug-timetable.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const archive = process.argv[2] ?? '/private/tmp/GTFS_FP2026_20260902.zip'
assert.equal(sha256(await readFile(archive)), 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e', 'Unreviewed national timetable')
const result = await readZugTimetable(archive, 'data/graubuenden-sources/boundary.json', ['2026-09-04', '2026-09-06'], { cantonCode: 'GR', cantonName: 'Graubünden' })
await writeFile('data/graubuenden-audit/timetable.json.gz', gzipSync(JSON.stringify(result)))
console.log(JSON.stringify({ scope: result.scope, routes: result.inventory.length, days: result.snapshots.map(s => ({ date: s.date, trips: s.trains.length })) }))
