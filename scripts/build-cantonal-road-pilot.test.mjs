import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCantonalPilot } from './build-cantonal-road-pilot.mjs'
import { buildDirectionTopology } from './validate-cantonal-road-directions.mjs'
const topology = JSON.parse(readFileSync('data/zurich-cantonal-road-directions.json','utf8'))
const options = { serviceDate:'2026-09-08', windowStart:48180, windowEnd:48420 }
const connected = new Set(topology.sections.flatMap(s=>[s.fromSiteId,s.toSiteId]))
const ids = topology.sites.filter(s=>connected.has(s.id)).flatMap(s=>s.detectorIds)
const snapshot = minute => ({ metadata:{recordingScope:'zurich-cantonal',measurementKind:'recorded',measurementSiteTableVersion:23}, measurements:ids.map(siteId=>({siteId,measurementTime:`2026-09-08T11:${minute}:00Z`,lightFlowPerHour:600,lightSpeedKmh:50,heavyFlowPerHour:0})) })
describe('publishable cantonal observation windows',()=>{
  it('splits incomplete minutes into explicit gaps rather than interpolating them',()=>{
    const bad = snapshot('25');bad.measurements.pop()
    const result=buildCantonalPilot([snapshot('23'),snapshot('24'),bad,snapshot('26'),snapshot('27')],topology,options)
    expect(result.windows.map(w=>w.metadata.completeMinutes)).toEqual([2,2])
    expect(result.gaps).toEqual([{start:48300,end:48300}])
    expect(result.metadata.completeMinutes).toBe(4)
  })
  it('does not publish isolated samples and does not hide source-version drift',()=>{
    expect(()=>buildCantonalPilot([snapshot('23'),snapshot('25')],topology,options)).toThrow('No continuous')
    const changed=snapshot('25');changed.metadata.measurementSiteTableVersion=24
    expect(()=>buildCantonalPilot([snapshot('23'),snapshot('24'),changed],topology,options)).toThrow('version mismatch')
  })
  it('builds only the selected reviewed corridor even when Horgen has no observations', () => {
    const read = path => JSON.parse(readFileSync(path, 'utf8'))
    const reviewed = buildDirectionTopology(read('public/data/zurich-cantonal-road-topology.json'), read('data/zurich-cantonal-road-counters.json'), topology.places, read('data/zurich-cantonal-road-direction-reviews.json').entries)
    const measurements = ['ZH.CH:0088.01', 'ZH.CH:0088.02', 'ZH.CH:2092.01', 'ZH.CH:2092.02']
    const samples = ['23', '24'].map(minute => ({ ...snapshot(minute), measurements: measurements.map(siteId => ({ ...snapshot(minute).measurements[0], siteId })) }))
    const pilot = buildCantonalPilot(samples, reviewed, { ...options, windowEnd: 48240, pilotId: 'wallisellen-bassersdorf-2026-09-08' })
    expect(pilot.metadata.road).toBe('ZH:1')
    expect(pilot.metadata.recordingId).toBe('wallisellen-bassersdorf-2026-09-08')
    expect(pilot.topology.sections).toHaveLength(2)
    expect(pilot.topology.sections.every(s => s.road === 'ZH:1')).toBe(true)
    expect(pilot.topology.sites).toHaveLength(4)
    expect(() => buildCantonalPilot(samples, topology, { ...options, pilotId: 'wallisellen-bassersdorf-2026-09-08' })).toThrow('validated directions')
  })
})
