// Offline consistency checks for the survey's independent evidence files.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)))
const sources = read('swiss-transit-sources')
const probes = read('swiss-transit-source-probes')
const cantons = read('swiss-transit-cantons')
const census = read('swiss-transit-agencies')
const realtime = read('swiss-transit-realtime-catalogue')
const unique = (rows, key) => {
  const map = new Map(rows.map(row => [row[key], row]))
  assert.equal(map.size, rows.length, `Duplicate ${key}`)
  return map
}
const sourceMap = unique(sources.sources, 'id')
const probeMap = unique(probes.probes, 'id')
const agencyMap = unique(census.agencies, 'id')
const cantonMap = unique(cantons.cantons, 'code')
assert.deepEqual([...cantonMap.keys()].sort(),
  'AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH'.split(' '))
assert.deepEqual([...sourceMap.keys()].sort(), [...probeMap.keys()].sort())
assert.equal(probes.sourcesSha256, createHash('sha256')
  .update(readFileSync(new URL('../data/swiss-transit-sources.json', import.meta.url))).digest('hex'))
for (const [id, source] of sourceMap) {
  const probe = probeMap.get(id)
  assert.equal(source.url, probe.url, id)
  assert.equal(new URL(source.url).protocol, 'https:')
  assert(Number.isFinite(Date.parse(probe.checkedAt)), id)
  if (probe.bytes !== undefined) assert.match(probe.sha256, /^[a-f0-9]{64}$/)
  if (probe.expectedBodyReceived) {
    assert.equal(probe.httpStatus, 200, id)
    assert.equal(probe.curlExitCode, 0, id)
    assert(source.expectedKinds.includes(probe.bodyKind), id)
    assert(!probe.serviceError && !probe.serviceExceptions?.length, id)
  }
}
for (const canton of cantonMap.values()) {
  for (const field of ['authorityAndPublisher', 'geometryStatus', 'evidence', 'vintage', 'reuse', 'nextAction'])
    assert(canton[field]?.length, `${canton.code}: ${field}`)
  assert(canton.sourceIds.length && canton.reviewAreas.length && canton.networks.length)
  for (const id of canton.sourceIds) assert(sourceMap.has(id), `${canton.code}: source ${id}`)
  for (const id of canton.representativeAgencyIds) assert(agencyMap.has(id), `${canton.code}: agency ${id}`)
}
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0)
assert.equal(census.totals.agencies, agencyMap.size)
assert.equal(census.totals.routeRecords, sum(census.agencies, 'routeRecords'))
for (const total of census.totals.days) {
  const days = census.agencies.map(a => a.days.find(day => day.date === total.date))
  assert(days.every(Boolean))
  assert.equal(total.activeAgencies, days.filter(day => day.activeTripRecords > 0).length)
  for (const key of ['activeRouteRecords', 'activeTripRecords', 'activeFrequencyTemplates'])
    assert.equal(total[key], sum(days, key), `${total.date}: ${key}`)
  for (const day of days) assert.equal(day.activeNonFrequencyTripRecords + day.activeFrequencyTemplates, day.activeTripRecords)
}
const rtProbe = probeMap.get(realtime.sourceId)
assert.equal(realtime.sourceSha256, rtProbe.sha256)
assert.equal(realtime.sourceUrl, rtProbe.url)
assert.equal(realtime.checkedAt, rtProbe.checkedAt)
assert.equal(realtime.totals.rows, realtime.entries.length)
for (const key of ['etAUS', 'ptREFAUS', 'complete']) {
  const counts = {}
  for (const row of realtime.entries) counts[row[key]] = (counts[row[key]] ?? 0) + 1
  assert.deepEqual(counts, realtime.totals[key])
}
const doc = readFileSync(new URL('../docs/SWISS-TRANSIT-SOURCE-INVENTORY.md', import.meta.url), 'utf8')
for (const code of cantonMap.keys()) assert(doc.includes(`<a id="${code.toLowerCase()}"></a>`), code)
console.log(`Validated ${cantonMap.size} cantons, ${sourceMap.size} source/probe pairs, ${agencyMap.size} agency records and ${realtime.entries.length} realtime entries.`)
