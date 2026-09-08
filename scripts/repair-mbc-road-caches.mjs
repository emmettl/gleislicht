import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { readMbcGeometrySource, repairPlantazCache } from './mbc-supplement-geometry.mjs'
const [cachePath, patternsPath] = process.argv.slice(2)
assert(cachePath && patternsPath, 'Usage: node scripts/repair-mbc-road-caches.mjs CACHE MATCHED/patterns.json')
const cache = JSON.parse(await readFile(cachePath)), bytes = await readFile(patternsPath)
assert.equal(createHash('sha256').update(bytes).digest('hex'), cache.metadata.matcher.patternsSha256, 'Changed source patterns')
const { source, sha256 } = await readMbcGeometrySource()
const repaired = repairPlantazCache(cache, JSON.parse(bytes), source, sha256)
await writeFile(cachePath, JSON.stringify(repaired))
console.log({ cachePath, coverage: repaired.report.coverage, repairs: repaired.metadata.terminalRepair })
