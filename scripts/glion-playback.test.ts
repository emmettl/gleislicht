import {describe, expect, it} from 'vitest'
import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import funicular from '../public/data/territet-day.json'
import railway from '../public/data/rochers-day.json'
import {glionJourneys, glionPhase} from '../src/studies/glion.ts'
import {readStudyLink} from '../src/studies/explore.ts'
import {studyLinkUrl} from '../src/studies/share-link.ts'
const f = funicular as unknown as NetworkSnapshot, r = railway as unknown as NetworkSnapshot

describe('combined Glion playback', () => {
 it('round-trips an exact combined journey and omits it for unrelated studies', () => {
  const state = {study: 'territet', range: 'morning', date: '2026-09-04', time: 47400, glion: '.ojp-91-37-F.1.TA.89.j26'} as const
  const url = studyLinkUrl('https://example.org/?latitude=46&longitude=6', state)
  expect(readStudyLink(new URL(url).search)).toMatchObject(state)
  expect(url).not.toContain('latitude')
  expect(readStudyLink('?study=national&glion=.ojp-91-37-F.1.TA.89.j26').glion).toBeUndefined()
  expect(readStudyLink('?study=territet&glion=unrecognised').glion).toBeUndefined()
 })
 it('binds all 20 pairs with separate Glion places and no walking edge', () => {
  for (const direction of ['ascent', 'descent'] as const) {
   const journeys = glionJourneys(f, r, direction)
   expect(journeys).toHaveLength(10)
   for (const {connection: c, network: n} of journeys) {
    expect(n.trains).toHaveLength(2)
    expect(n.stops).toHaveLength(15)
    expect(n.edges).toHaveLength(13)
    expect(n.paths).toHaveLength(13)
    expect(n.stops.some(s => s[2] === 'Montreux')).toBe(false)
    const last = n.trains[0].stops.at(-1)![0], first = n.trains[1].stops[0][0]
    expect(n.stops[last][4]).toBe(c.transfer.fromStopId)
    expect(n.stops[first][4]).toBe(c.transfer.toStopId)
    expect(n.edges.some(([a, b]) => a === last && b === first || a === first && b === last)).toBe(false)
    for (const [i, train] of n.trains.entries()) {
     expect(train.stops.map(([s, a, d]) => [n.stops[s][4], a, d])).toEqual(c.legs[i].calls.map(s => [s.stopId, s.arrival, s.departure]))
     expect(train.start).toBe(c.legs[i].calls[0].departure)
     expect(train.end).toBe(c.legs[i].calls.at(-1)!.arrival)
     const source = train.id === c.funicularTripId ? f : r, original = source.trains.find(t => t.id === train.id)!
     const offset = original.stops.findIndex(([s]) => source.stops[s][4] === c.legs[i].calls[0].stopId)
     expect(train.pathSegments?.map(p => n.paths?.[p!])).toEqual(original.pathSegments?.slice(offset, offset + train.stops.length - 1).map(p => source.paths?.[p!]))
    }
   }
  }
 })
 it('switches exactly at source arrival, second departure and final arrival', () => {
  for (const direction of ['ascent', 'descent'] as const) {
   const c = glionJourneys(f, r, direction)[3].connection
   expect(glionPhase(c, c.start - 1)).toBe('before')
   expect(glionPhase(c, c.start)).toBe('first-leg')
   expect(glionPhase(c, c.transfer.arrival - 1)).toBe('first-leg')
   expect(glionPhase(c, c.transfer.arrival)).toBe('interchange')
   expect(glionPhase(c, c.transfer.departure - 1)).toBe('interchange')
   expect(glionPhase(c, c.transfer.departure)).toBe('second-leg')
   expect(glionPhase(c, c.end)).toBe('complete')
  }
 })
 it('rejects altered dates, source identities, calls, geometry and malformed payloads', () => {
  expect(glionJourneys(f, {...r, metadata: {...r.metadata, serviceDate: '2026-09-05'}}, 'ascent')).toEqual([])
  expect(glionJourneys(f, {} as NetworkSnapshot, 'ascent')).toEqual([])
  const id = glionJourneys(f, r, 'ascent')[3].connection.railwayTripId
  for (const mutate of [(t: typeof railway.trains[number]) => {t.routeId = 'other'}, (t: typeof railway.trains[number]) => {t.stops[4][1]++}, (t: typeof railway.trains[number]) => {t.pathSegments[4] = -1}]) {
   const bad = structuredClone(railway); mutate(bad.trains.find(t => t.id === id)!)
   expect(glionJourneys(f, bad as unknown as NetworkSnapshot, 'ascent').some(j => j.connection.railwayTripId === id)).toBe(false)
  }
 })
})
