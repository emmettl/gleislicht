import assert from 'node:assert/strict'
import { inventoryAargau, hashFile } from './inventory-aargau.mjs'
const arg = (name, fallback) => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`)+1] : fallback
const archive = arg('archive', '/tmp/GTFS_FP2026_20260902.zip')
assert.equal(await hashFile(archive), 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e', 'Unreviewed national timetable')
await inventoryAargau({ archive, sources: arg('sources', 'data/ticino-sources'), output: arg('output', 'data/ticino'), dates: ['2026-09-04','2026-09-06'], cantonName: 'Ticino' })
