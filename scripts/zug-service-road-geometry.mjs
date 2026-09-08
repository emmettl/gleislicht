import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { loadZugRoads } from './zug-road-geometry.mjs'

export async function loadZugServiceRoads(policy, baselinePolicy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed service-road catalogue')
  const source = JSON.parse(bytes)
  for (const file of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, file.file))), file.sha256, `Changed service-road evidence ${file.file}`)
  assert.equal(sha256(gunzipSync(await readFile(join(policy.sourceDirectory, 'roads.osm.gz')))), policy.osmSha256, 'Changed routing input')
  const osm = JSON.parse(gunzipSync(await readFile(join(policy.sourceDirectory, 'roads.json.gz'))))
  assert.equal(osm.elements.length, source.elementCount)
  const way = osm.elements.find(e => e.type === 'way' && e.id === source.serviceAccessWay.id)
  assert.deepEqual({ id: way.id, version: way.version, timestamp: way.timestamp, tags: way.tags }, source.serviceAccessWay)
  assert.equal(way.tags.highway, 'service')
  assert.equal(way.tags.access, undefined, 'New access restriction requires review')
  assert.equal(way.tags.bus, undefined, 'Changed bus access requires review')
  const baseline = await readFile(baselinePolicy.configFile, 'utf8'), actual = await readFile(policy.configFile, 'utf8')
  const start = baseline.indexOf('[bus, coach]'); assert(start >= 0)
  const expected = baseline.slice(0, start) + baseline.slice(start).replace('osm_filter_keep:\n', 'osm_filter_keep:\n\t# Scoped line 619 access to Chloesterli; retain mapped service roads.\n\thighway=service\n')
  assert.equal(actual, expected, 'Service-road review may only retain mapped service roads')
  const roads = await loadZugRoads(policy, raw, timetableHash)
  const control = await loadZugRoads({ ...policy, cacheFile: policy.controlCacheFile, cacheSha256: policy.controlCacheSha256,
    configFile: baselinePolicy.configFile, configSha256: baselinePolicy.configSha256 }, raw, timetableHash)
  assert.deepEqual(roads.inventory, control.inventory, 'Changed control inputs')
  assert.equal(roads.inventory.length, 4, 'Changed complete line 619 pattern inventory')
  assert([...roads.candidates.values()].every(r => r.path), 'Every trial pattern must pass independently')
  const candidates = new Map(), review = []
  for (const pair of policy.reviewedPairs) {
    const key = JSON.stringify(pair), original = control.candidates.get(key), result = roads.candidates.get(key)
    assert.equal(original?.reason, 'road-matcher-rejected', 'Control must reproduce the omitted access-road failure')
    assert(result?.path, 'Service-road candidate did not pass all complete-pattern checks')
    assert(!candidates.has(key), 'Duplicate reviewed service-road pair')
    candidates.set(key, { ...result, geometrySource: 'osm-service-road-inference', serviceRoadControl: original })
    review.push({ routeId: pair[0], fromId: pair[1], toId: pair[2], geometrySha256: sha256(JSON.stringify(result.path)),
      lengthMetres: result.lengthMetres, directMetres: result.directMetres, controlReason: original.reason, roadPatternIds: result.roadPatternIds })
  }
  return { source, roadSource: roads.source, inventory: roads.inventory, review, candidates }
}

// This source is a reviewed exception for explicit failed pairs, never a new
// general road graph. Keep earlier successes and their provenance byte-for-byte.
export function matchZugServiceRoadPair(original, service, routeId, fromId, toId) {
  if (original.path || original.reason !== 'road-matcher-rejected') return original
  const result = service.candidates.get(JSON.stringify([routeId, fromId, toId]))
  return result ? { ...result, officialFailure: original.officialFailure, serviceRoadPreviousFailure: original } : original
}
