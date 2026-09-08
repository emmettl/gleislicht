import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  nationalRoadConditionsAtTime as referenceConditions,
  reconstructedNationalVehicleCount as referenceCount,
  type NationalRoadStudyManifest, type NationalRoadStudySnapshot,
} from '@motionstudies/core/domain/road-day'
import { nationalRoadConditionsAtTime, reconstructedNationalVehicleCount } from '../src/studies/road-conditions.ts'

const manifest: NationalRoadStudyManifest = JSON.parse(readFileSync('public/data/swiss-road-national-manifest.json', 'utf8'))
const chunk = JSON.parse(readFileSync(`public/data/${manifest.chunks[0].path}`, 'utf8'))
const recorded: NationalRoadStudySnapshot = { ...manifest, minutes: chunk.minutes }

describe('indexed road conditions', () => {
  it('matches recorded conditions and counts through playback, seeks and road selection', () => {
    const times = [recorded.minutes[0][0] - 5, ...recorded.minutes.slice(0, 4).flatMap(minute => [minute[0], minute[0] + 24.5]), recorded.minutes.at(-1)![0] + 5]
    for (const time of [...times, ...times.toReversed()]) {
      for (let site = 0; site < recorded.siteIds.length; site++) {
        expect(nationalRoadConditionsAtTime(recorded, site, time)).toEqual(referenceConditions(recorded, site, time))
      }
      for (const road of [undefined, 'N1', 'N2', 'missing']) {
        expect(reconstructedNationalVehicleCount(recorded, time, road)).toBe(referenceCount(recorded, time, road))
      }
    }
  })

  it('preserves missing-site, single-minute, empty-chunk and chunk-replacement semantics', () => {
    const samples: NationalRoadStudySnapshot['minutes'] = [[0, [[0, 100, 50, 10, 40]]], [60, [[1, 200, 60, 20, 50]]], [120, [[0, 300, 70, 30, 60]]]]
    for (const minutes of [[], samples.slice(0, 1), samples, [[0, []], [60, samples[0][1]]] as typeof samples]) {
      const snapshot = { ...recorded, minutes }
      for (const time of [-10, 0, 30, 60, 90, 120, 140, 30, 0]) {
        for (const site of [0, 1, 2]) {
          expect(nationalRoadConditionsAtTime(snapshot, site, time)).toEqual(referenceConditions(snapshot, site, time))
        }
      }
    }
  })
})
