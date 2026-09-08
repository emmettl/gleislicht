import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { buildMeilenSeestrasseDirections } from './build-meilen-seestrasse-directions.mjs'
const files = ['public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-counters.json', 'data/zurich-cantonal-road-directions.json', 'data/lakeside-road-review-sources.json', 'data/meilen-staefa-axis-continuation.json', 'data/meilen-seestrasse-direction-scope.json', 'data/meilen-seestrasse-junction-source.json']
const inputs = files.map(f => JSON.parse(readFileSync(f, 'utf8')))
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')

it('admits only the separately reviewed Meilen pair and audits its original section', () => {
  const { topology, junctions } = buildMeilenSeestrasseDirections(...inputs)
  expect(topology.paths).toEqual(inputs[0].paths)
  for (const section of inputs[2].sections) expect(topology.sections).toContainEqual(section)
  expect(topology.sections.filter(s => s.road === 'ZH:17').map(s => s.distanceKm)).toEqual([2.90183, 2.90183])
  for (const id of ['ZH.CH:0491', 'ZH.CH:0591']) {
    const station = topology.stationAudit.find(s => s.id === id)
    expect(station.status).toBe('validated')
    expect(station.detectors[1]).toMatchObject({ direction: 'positive', destinationRoadDistanceMetres: 85.38 })
  }
  for (const id of ['ZH.CH:1091', 'ZH.CH:0291', 'ZH.CH:1291']) expect(topology.stationAudit.find(s => s.id === id).status).toBe('unresolved-direction-pair')
  expect(junctions.map(j => [j.offsetMetres, j.axes])).toEqual([[711, ['municipal']], [877, ['703']], [1920, ['716']]])
})

it('rejects stale counter evidence and attempts to broaden the station scope', () => {
  const changed = structuredClone(inputs)
  changed[5].stations[0].detectorAuditSha256 = 'stale'
  expect(() => buildMeilenSeestrasseDirections(...changed)).toThrow('station evidence changed')
  changed[5].stations[0] = changed[5].stations[1]
  expect(() => buildMeilenSeestrasseDirections(...changed)).toThrow('review scope')
  changed[5].stations[0] = { id: 'ZH.CH:1291' }
  expect(() => buildMeilenSeestrasseDirections(...changed)).toThrow('review scope')
})

it('rejects changed continuation, topology or junction evidence', () => {
  for (const i of [0, 1, 4, 6]) {
    const changed = structuredClone(inputs)
    changed[i].unexpected = true
    expect(() => buildMeilenSeestrasseDirections(...changed)).toThrow('review inputs changed')
  }
})

it('rejects incomplete or geographically insufficient junction responses even when rehashed', () => {
  const changed = structuredClone(inputs)
  changed[6].collection.features.pop()
  changed[5].junctionSourceSha256 = digest(changed[6])
  expect(() => buildMeilenSeestrasseDirections(...changed)).toThrow('incomplete WFS response')
  const cropped = structuredClone(inputs)
  cropped[6].url = cropped[6].url.replace('2689700,1235100,2693000,1236800', '2691000,1235100,2693000,1236800')
  cropped[5].junctionSourceSha256 = digest(cropped[6])
  expect(() => buildMeilenSeestrasseDirections(...cropped)).toThrow('does not cover')
})
