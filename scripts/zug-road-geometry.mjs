import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { luzernRoadInputs, roadConsensus, importLuzernRoads, verifyLuzernRoadEvidence } from './luzern-road-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const save = (path, value) => writeFile(path, JSON.stringify(value) + '\n')

export function zugRoadScope(raw, policy) {
  const ids = new Set(policy.routes.map(r => r.routeId))
  assert.equal(ids.size, policy.routes.length)
  for (const entry of policy.routes) {
    const route = raw.inventory.find(r => r.routeId === entry.routeId)
    for (const [key, value] of Object.entries(entry)) assert.equal(route?.[key], value, 'Changed road route identity')
    assert.equal(route.mode, 'bus')
  }
  return { ...raw, snapshots: raw.snapshots.map(d => ({ ...d, trains: d.trains.filter(t => ids.has(t.routeId)) })) }
}

export function validateZugRoadScope(raw, cache, policy) {
  assert.deepEqual(cache.metadata.dates, raw.dates)
  assert.equal(cache.metadata.feedVersion, raw.feed.feed_version)
  const { stops, agencies } = luzernRoadInputs(zugRoadScope(raw, policy))
  assert.deepEqual([...agencies.keys()].sort(), Object.keys(cache.agencies).sort())
  for (const [id, agency] of agencies) {
    const expected = [...new Set(agency.trains.map(t => roadPatternId(t, stops)))].sort()
    assert.deepEqual(Object.keys(cache.agencies[id].identities).sort(), expected, 'Road evidence must cover every complete scoped pattern on both dates')
  }
}

export async function prepareZugRoads(timetablePath, policyPath, output) {
  const bytes = await readFile(timetablePath), raw = JSON.parse(gunzipSync(bytes)), policy = (await json(policyPath)).road
  const { stops, agencies } = luzernRoadInputs(zugRoadScope(raw, policy))
  const metadata = { serviceDate: raw.dates[0], dates: raw.dates, feedVersion: raw.feed.feed_version,
    timetableSha256: sha256(bytes), sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
    scope: 'Every complete Zug-calling 653 and N73 bus pattern across both civil days; all short branches, platform identities and cross-canton calls retained' }
  await mkdir(output, { recursive: true })
  const summaries = []
  for (const agency of agencies.values()) summaries.push({ agencyId: agency.id, ...await prepareRoadFeed({
    manifest: { stops, metadata }, trains: agency.trains, output: join(output, agency.id),
    agency: { id: agency.id, name: agency.name, url: metadata.sourceUrl },
  }) })
  await save(join(output, 'index.json'), { metadata, agencies: summaries })
  return summaries
}

export async function loadZugRoads(policy, raw, timetableHash) {
  const bytes = await readFile(policy.cacheFile)
  assert.equal(sha256(bytes), policy.cacheSha256, 'Changed Zug road cache')
  assert.equal(sha256(await readFile(policy.configFile)), policy.configSha256, 'Changed matcher configuration')
  const cache = JSON.parse(bytes)
  assert.equal(cache.metadata.timetableSha256, timetableHash)
  validateZugRoadScope(raw, cache, policy)
  for (const agency of Object.values(cache.agencies)) {
    assert.equal(agency.cache.metadata.matcher.configSha256, policy.configSha256)
    assert.equal(agency.cache.metadata.matcher.binarySha256, policy.binarySha256)
  }
  // Re-import retained warnings and shapes; a rejected matcher hop cannot be
  // laundered into a successful fallback merely by editing the derived cache.
  await verifyLuzernRoadEvidence(cache)
  return { source: cache.metadata, candidates: roadConsensus(cache, policy.limits),
    inventory: Object.entries(cache.agencies).flatMap(([agencyId, a]) => Object.entries(a.identities).map(([id, p]) => ({ id, agencyId, routeId: p.routeId, stopIds: p.stops.map(s => s[4]) }))) }
}

export function matchZugRoadPair(official, roads, routeId, fromId, toId) {
  if (official.path) return official
  const road = roads.candidates.get(JSON.stringify([routeId, fromId, toId]))
  return road ? { ...road, officialFailure: official } : official
}

// The failed official attempt remains in the supplemental source inventory even
// when an inferred road path subsequently supplies the adjacent-call segment.
export function zugOfficialAttempt(pair) {
  return pair.officialFailure ? { ...pair, ...pair.officialFailure, matched: false } : pair
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2)
  assert(['prepare', 'import'].includes(command), 'Usage: prepare TIMETABLE POLICY DIRECTORY | import PREPARED MATCHED CACHE EVIDENCE')
  console.log(command === 'prepare' ? await prepareZugRoads(...args) : await importLuzernRoads(...args))
}
