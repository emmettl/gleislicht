import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadBernUrban, prepareBernUrban, importBernUrban, applyBernUrban, BERN_ROAD_LIMITS } from './bern-urban-geometry.mjs'

export const BERN_REGIONAL_ROUTES = ['96-701-j26-1', '92-74-j26-1', '92-31-B-j26-1', '92-24-B-j26-1',
  '92-4-C-j26-1', '92-9-D-j26-1', '96-925-j26-1', '96-881-j26-1', '92-281-j26-1', '92-461-A-j26-1',
  '96-705-j26-1', '92-64-B-j26-1', '92-332-j26-1', '92-462-j26-1', '96-706-j26-1', '92-160-j26-1', '96-738-j26-1']
export const BERN_REGIONAL_ROAD_FILES = { cachePath: 'data/bern-regional-road-cache.json',
  policyPath: 'data/bern-regional-road-policy.json', evidenceDirectory: 'data/bern-regional-road-evidence', scope: BERN_REGIONAL_ROUTES }
export async function loadBernRegionalRoads(raw) {
  const result = await loadBernUrban(raw, BERN_REGIONAL_ROAD_FILES)
  assert.deepEqual(result.policy.roadRouteIds, BERN_REGIONAL_ROUTES)
  assert.deepEqual(result.policy.tramPairs, [])
  assert.equal(result.policy.sourceId, 'bern-regional-osm-20260902')
  result.metadata.model = 'Missing regional-bus pairs only; all complete patterns on both September dates must agree. Inferred OSM road paths, not operator-certified movements.'
  return result
}
export function applyBernRegionalRoads(raw, result, source, roads) {
  const matched = applyBernUrban(raw, result, source, roads)
  for (const pair of matched.pairs) if (pair.sourceId === roads.policy.sourceId) {
    // The original cantonal gap is evidence of its rejection, not the road
    // matcher’s endpoint error. Preserve it only inside originalAssessment.
    delete pair.maximumSnapMetres
    pair.roadSnapLimitMetres = BERN_ROAD_LIMITS.snapMetres
  }
  return matched
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, a, b] = process.argv.slice(2)
  if (command === 'prepare') await prepareBernUrban(JSON.parse(gunzipSync(await readFile(a))), b, BERN_REGIONAL_ROUTES)
  else if (command === 'import') await importBernUrban(a, b, BERN_REGIONAL_ROAD_FILES)
  else assert.fail('Usage: prepare TIMETABLE_CACHE DIRECTORY | import PREPARED MATCHED')
}
