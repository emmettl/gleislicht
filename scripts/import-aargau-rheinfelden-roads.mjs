import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { hashFile } from './inventory-aargau.mjs'
const arg = name => { const i = process.argv.indexOf(`--${name}`); assert(i >= 0, `Missing --${name}`); return process.argv[i + 1] }
const directory = arg('matched'), input = JSON.parse(await readFile(`${directory}/patterns.json`, 'utf8'))
assert.equal(input.metadata.aargauRoadAgencyId, 'sbg034')
assert(input.patterns.every(p => p.routeId === '92-731-2-j26-1'))
const cache = await importRoadShapes(directory, 'OSM Overpass Rheinfelden roads and complete bus relations; osm_base 2026-09-08T18:21:11Z; retrieved 2026-09-08')
assert.equal(cache.metadata.sourceSha256, '29597ce62da93e6d712df73da8a0348049d3453ce348d593d518e7930bbd55a0', 'Review dates before importing different OSM bytes')
cache.metadata.agencyId = 'sbg034'
cache.metadata.serviceDates = input.metadata.serviceDates
cache.metadata.inputTimetableHashes = input.metadata.inputTimetableHashes
cache.metadata.sourceDates = { osmBase: '2026-09-08T18:21:11Z', retrievedOn: '2026-09-08' }
cache.metadata.query = { file: 'data/aargau-supplemental-sources/rheinfelden.overpass', sha256: await hashFile('data/aargau-supplemental-sources/rheinfelden.overpass'), endpoint: 'https://overpass-api.de/api/interpreter', bounds: [7.75, 47.53, 7.83, 47.60] }
cache.identities = Object.fromEntries(input.patterns.map(p => [p.id, { routeId: p.routeId, stopIds: p.stops.map(([i]) => input.stops[i][4]) }]))
await writeFile(arg('output'), JSON.stringify({ schemaVersion: 1, agencyCaches: { sbg034: cache } }))
console.log(cache.report)
