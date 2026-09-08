import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
import { loadThurgauShipping } from './thurgau-shipping.mjs'
import { loadThurgauBoatExclusions } from './thurgau-boat-exclusions.mjs'
const timetable = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz')))
const boats = await loadThurgauBoats(timetable), shipping = await loadThurgauShipping(timetable)
const review = await loadThurgauBoatExclusions(timetable, shipping, boats)
await writeFile('data/thurgau-audit/boat-exclusions.json', JSON.stringify(review, null, 2) + '\n')
console.log(review.days.map(({ date, excludedJourneys }) => ({ date, excludedJourneys })))
console.table(review.pairs.map(p => ({ from: p.from[2], to: p.to[2], result: p.diagnosticResult, snapMetres: p.maximumSnapMetres })))
