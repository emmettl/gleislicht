import { expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { checkRoundabout, compileJunctionAudit } from './audit-regional-road-junctions.mjs'

const review = { status: 'intervening-roundabout', cycleFeatureIds: [1, 2, 3], branchFeatureId: 4, branchName: 'Dorfstrasse' }
const feature = (featureId, points, name = 'Seestrasse') => ({ featureId, properties: { strassenname: name }, geometry: { type: 'MultiLineString', coordinates: [points] } })
const features = () => [feature(1, [[100, 0], [110, -10]]), feature(2, [[110, -10], [120, 0]]), feature(3, [[120, 0], [100, 0]]), feature(4, [[110, -50], [110, -10]], 'Dorfstrasse')]
const path = { points: [[0, 0], [300, 0]] }

it('reproduces the pinned junction audit and replaces the open review with an actual roundabout hold', async () => {
  const result = await compileJunctionAudit()
  expect(`${JSON.stringify(result, null, 2)}\n`).toBe(await readFile('data/regional-road-junction-audit.json', 'utf8'))
  expect(result.reviewed).toHaveLength(1)
  expect(result.corridors.filter(p => p.holdReasons.includes('intervening-roundabout'))).toHaveLength(1)
  expect(result.corridors.every(p => !p.playbackEligible)).toBe(true)
})

it('requires a closed cycle between the counters with a named joining branch', () => {
  expect(checkRoundabout(review, features(), path, 50, 200).playbackEligible).toBe(false)
  const broken = features()
  broken[2].geometry.coordinates[0][1] = [99, 0]
  expect(() => checkRoundabout(review, broken, path, 50, 200)).toThrow('disconnected')
  const branch = features()
  branch[3].geometry.coordinates[0][1] = [111, -10]
  expect(() => checkRoundabout(review, branch, path, 50, 200)).toThrow('does not join')
})

it('rejects a cycle beyond the counter interval or far off the matched axis', () => {
  expect(() => checkRoundabout(review, features(), path, 115, 200)).toThrow('outside')
  expect(() => checkRoundabout(review, features(), { points: [[0, 100], [300, 100]] }, 50, 200)).toThrow('outside')
})
