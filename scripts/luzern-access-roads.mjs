import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { prepareRoadFeed, roadPatternId } from './prepare-postbus-road-feed.mjs'
import { luzernRoadInputs, roadConsensus, verifyLuzernRoadEvidence } from './luzern-road-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export const ACCESS_ROUTES = [
  { routeId: '92-101-A-j26-1', agencyId: '839', line: '101' },
  { routeId: '96-354-4-j26-1', agencyId: '801', line: '233' },
  { routeId: '92-A05-X-j26-1', agencyId: '7231', line: 'EV3' },
]

export function accessRoadInputs(raw) {
  for (const identity of ACCESS_ROUTES) {
    const route = raw.inventory.find(r => r.routeId === identity.routeId)
    assert(route && route.mode === 'bus')
    for (const [key, value] of Object.entries(identity)) assert.equal(route[key], value, 'Changed access-road route identity')
  }
  const { stops, agencies } = luzernRoadInputs(raw), ids = new Set(ACCESS_ROUTES.map(r => r.routeId))
  return { stops, agencies: [...agencies.values()].map(a => ({ ...a, trains: a.trains.filter(t => ids.has(t.routeId)) })).filter(a => a.trains.length) }
}

export async function prepareLuzernAccessRoads(timetablePath, output) {
  const bytes = await readFile(timetablePath), raw = JSON.parse(bytes), { stops, agencies } = accessRoadInputs(raw)
  const metadata = { serviceDate: raw.dates[0], dates: raw.dates, feedVersion: raw.feed.feed_version,
    sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', timetableSha256: sha256(bytes),
    scope: 'Every full fixture pattern on the three reviewed Luzern access-road routes', routes: ACCESS_ROUTES }
  await mkdir(output, { recursive: true })
  const summaries = []
  for (const agency of agencies) summaries.push({ agencyId: agency.id, ...await prepareRoadFeed({ manifest: { stops, metadata }, trains: agency.trains,
    output: join(output, agency.id), agency: { id: agency.id, name: agency.name, url: metadata.sourceUrl } }) })
  await writeFile(join(output, 'index.json'), JSON.stringify({ metadata, agencies: summaries }) + '\n')
  return summaries
}

export function reviewedAccessPairs(cache, source, config) {
  assert.deepEqual(cache.metadata.routes, ACCESS_ROUTES)
  const all = roadConsensus(cache, config.limits, source.osmSha256), pairs = new Map()
  for (const review of config.pairs) {
    const identity = ACCESS_ROUTES.find(r => r.routeId === review.routeId)
    assert(identity, 'Unreviewed access-road route')
    const key = JSON.stringify([review.routeId, review.fromId, review.toId]), result = all.get(key)
    assert(result?.path && result.agencyId === identity.agencyId, 'Rejected or missing access-road consensus')
    assert.equal(sha256(JSON.stringify(result.path)), review.geometrySha256, 'Changed reviewed access-road geometry')
    assert(!pairs.has(key), 'Duplicate access-road pair')
    pairs.set(key, { ...result, geometrySource: 'osm-access-road-inference', accessRoadReviewId: review.id })
  }
  return { all, pairs }
}

export async function loadLuzernAccessRoads(config, raw, verifyEvidence = false) {
  const sourceBytes = await readFile(join(config.sourceDirectory, 'source.json')), source = JSON.parse(sourceBytes)
  assert.equal(sha256(sourceBytes), config.sourceSha256)
  for (const [file, digest] of Object.entries(source.files)) assert.equal(sha256(await readFile(join(config.sourceDirectory, file))), digest, `Changed access-road source ${file}`)
  assert.equal(sha256(gunzipSync(await readFile(join(config.sourceDirectory, 'network.osm.gz')))), source.osmSha256)
  const cacheBytes = await readFile(config.cache), cache = JSON.parse(cacheBytes)
  assert.equal(sha256(cacheBytes), config.sha256)
  assert.deepEqual(cache.metadata.source, source)
  for (const agency of Object.values(cache.agencies)) {
    assert.equal(agency.cache.metadata.matcher.configSha256, source.files['routing.cfg'])
    assert.equal(agency.cache.metadata.matcher.binarySha256, source.binarySha256)
  }
  if (raw) {
    const { stops, agencies } = accessRoadInputs(raw)
    assert.deepEqual(cache.metadata.dates, raw.dates)
    assert.deepEqual(Object.keys(cache.agencies).sort(), agencies.map(a => a.id).sort())
    for (const a of agencies) assert.deepEqual(Object.keys(cache.agencies[a.id].identities).sort(), [...new Set(a.trains.map(t => roadPatternId(t, stops)))].sort(), 'Access roads must cover every complete fixture pattern on each reviewed route')
  }
  if (verifyEvidence) await verifyLuzernRoadEvidence(cache, source.description)
  return { source, cache, ...reviewedAccessPairs(cache, source, config) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(await prepareLuzernAccessRoads(...process.argv.slice(2)))
