import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { combineRoadCaches } from './lausanne-mbc.mjs'
import { applyRoadCache } from './enrich-postbus-roads.mjs'

it('covers an actual missing Monday pattern while preserving reviewed geometry', async () => {
  const [sample, original, weekly] = await Promise.all(['fixtures/lausanne/monday-cache-gap.json', 'data/lausanne-road-cache.json', 'data/lausanne-weekly-road-cache.json'].map(async path => JSON.parse(await readFile(path, 'utf8'))))
  expect(applyRoadCache(sample, sample.trains, original).matched).toBe(0)
  const combined = combineRoadCaches([original, weekly])
  const geometry = applyRoadCache(sample, sample.trains, combined)
  expect(geometry.matched).toBe(geometry.total)
  expect(geometry.missingPatterns).toBe(0)
  for (const [id, segments] of Object.entries(original.patterns)) {
    expect(combined.patterns[id]).toEqual(segments)
    for (const i of segments) if (i !== null) expect(combined.paths[i]).toEqual(original.paths[i])
  }
})
