import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { combineRoadCaches } from './lausanne-mbc.mjs'
import { applyRoadCache } from './enrich-postbus-roads.mjs'
import { assessLausannePath } from './audit-lausanne-study.mjs'

it('restores the real October cache gap without replacing reviewed paths or reusing changed platforms', async () => {
  const [sample, original, weekly, october] = await Promise.all([
    'fixtures/lausanne/october-cache-gap.json', 'data/lausanne-road-cache.json',
    'data/lausanne-weekly-road-cache.json', 'data/lausanne-2026-10-road-cache.json',
  ].map(async path => JSON.parse(await readFile(path, 'utf8'))))
  const before = combineRoadCaches([original, weekly])
  expect(applyRoadCache(sample, sample.trains, before).missingPatterns).toBe(1)
  const combined = combineRoadCaches([original, weekly, october])
  const result = applyRoadCache(sample, sample.trains, combined)
  expect(result.matched).toBe(result.total)
  expect(result.missingPatterns).toBe(0)
  expect(result.trains[0].stops).toEqual(sample.trains[0].stops)
  expect(result.trains[0].sourceTripId).toBe(sample.trains[0].sourceTripId)
  for (const [id, segments] of Object.entries(before.patterns)) expect(combined.patterns[id]).toEqual(segments)
  expect(combined.paths.slice(0, before.paths.length)).toEqual(before.paths)
  for (let i = 1; i < sample.trains[0].stops.length; i++) {
    expect(assessLausannePath(result.paths[result.trains[0].pathSegments[i - 1]],
      sample.stops[sample.trains[0].stops[i - 1][0]], sample.stops[sample.trains[0].stops[i][0]]).accepted).toBe(true)
  }
  const changed = structuredClone(sample)
  changed.stops[0][0] += 0.00001
  expect(applyRoadCache(changed, changed.trains, combined).missingPatterns).toBe(1)
})
