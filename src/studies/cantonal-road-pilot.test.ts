import { validateCantonalPilot } from './validate-cantonal-pilot.ts'
import pilotSource from '../../public/data/zurich-cantonal-road-pilot.json'
import wallisellenSource from '../../public/data/wallisellen-bassersdorf-road-pilot.json'
import nationalSource from '../../public/data/swiss-road-topology.json'
import { describe, expect, it } from 'vitest'
import { cantonalPilotForRoad, cantonalPilotWindow, searchRoadsWithPilots, topologyWithPilot, type CantonalPilot } from './cantonal-road-pilot.ts'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
const pilot = pilotSource as unknown as CantonalPilot
const national = nationalSource as unknown as RoadTopologySnapshot
const wallisellen = wallisellenSource as unknown as CantonalPilot

describe('Horgen afternoon playback', () => {
  it('accepts the published pilot and never samples between recorded windows', () => {
    expect(validateCantonalPilot(pilot)).toBe(pilot)
    expect(pilot.metadata.completeMinutes).toBe(40)
    expect(cantonalPilotWindow(pilot,49440)?.metadata.windowEnd).toBe(50460)
    for (const time of [48179,48961,49020,49380,50520,51180,51661]) expect(cantonalPilotWindow(pilot,time)).toBeUndefined()
  })
  it('rejects gaps concealed inside a window and incomplete lane values', () => {
    const gap = structuredClone(pilot); Object.assign(gap.windows[0], { minutes: gap.windows[0].minutes.filter((_,i)=>i!==3) })
    expect(()=>validateCantonalPilot(gap)).toThrow('Incomplete')
    const missing = structuredClone(pilot); (missing.windows[0].minutes[0][1] as unknown[]).pop()
    expect(()=>validateCantonalPilot(missing)).toThrow('Incomplete')
    const wrongDate = structuredClone(pilot); Object.assign(wrongDate.windows[0].metadata,{serviceDate:'2026-09-07'})
    expect(()=>validateCantonalPilot(wrongDate)).toThrow('Invalid pilot window')
  })
  it('adds only pilot sites and sections while retaining national geometry and metadata', () => {
    const merged = topologyWithPilot(national,pilot)
    expect(merged.paths).toBe(national.paths)
    expect(merged.metadata).toBe(national.metadata)
    expect(merged.sections).toHaveLength(national.sections.length+2)
    expect(()=>topologyWithPilot(merged,pilot)).toThrow('collision')
  })
  it('rejects hidden gaps, incorrect coverage totals and disconnected section mappings', () => {
    const hidden = structuredClone(pilot); hidden.gaps.pop()
    expect(() => validateCantonalPilot(hidden)).toThrow('coverage')
    const count = structuredClone(pilot); count.metadata.completeMinutes++
    expect(() => validateCantonalPilot(count)).toThrow('coverage')
    const mapping = structuredClone(pilot); Object.assign(mapping.windows[0].sections[0], { fromSiteIndex: 0 })
    expect(() => validateCantonalPilot(mapping)).toThrow('section mapping')
  })
  it('validates the second corridor with its own identity, sites and uninterrupted window', () => {
    expect(validateCantonalPilot(wallisellen)).toBe(wallisellen)
    expect(wallisellen.windows).toHaveLength(1)
    expect(wallisellen.windows[0].minutes).toHaveLength(104)
    expect(wallisellen.gaps).toEqual([])
    expect(cantonalPilotWindow(wallisellen, 57420)).toBe(wallisellen.windows[0])
    expect(cantonalPilotWindow(wallisellen, 57421)).toBeUndefined()
    expect(() => validateCantonalPilot(pilot, cantonalPilotForRoad('ZH:1'))).toThrow('identity')
    const stale = structuredClone(wallisellen); stale.metadata.recordingId = pilot.metadata.recordingId
    expect(() => validateCantonalPilot(stale)).toThrow('identity')
    const wrongSites = structuredClone(wallisellen); Object.assign(wrongSites.topology.sites[0], { stationId: 'ZH.CH:4590' })
    expect(() => validateCantonalPilot(wrongSites)).toThrow('sites')
    expect(cantonalPilotForRoad('A1')).toBeUndefined()
  })
  it('finds the pilot by place names omitted from the official route description without changing the road', () => {
    const road = { ...national.roads[0], id: 'ZH:1', label: 'ZH 1', description: 'Dietikon - Wallisellen - Winterthur' }
    expect(searchRoadsWithPilots([road], 'Bassersdorf')).toEqual([road])
    expect(searchRoadsWithPilots([road], 'Neue Winterthurerstrasse')[0]).toBe(road)
    expect(searchRoadsWithPilots(national.roads, 'A1')[0]?.id).toBe('N1')
  })
})
