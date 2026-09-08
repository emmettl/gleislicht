import { describe, expect, it } from 'vitest'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import fixture from '../public/data/jungfrau-day.json'
import evidence from '../data/jungfrau-ascent-source.json'
import { jungfrauAscents, ascentPhase, ascentFocus } from '../src/studies/jungfrau-ascent.ts'
import { jungfrauGuide } from '../src/studies/jungfrau-guide.ts'
const network = fixture as unknown as NetworkSnapshot

describe('source-audited Jungfrau ascent', () => {
 it('joins dated public calls via Lauterbrunnen and preserves transfer and boarding time', () => {
  const choices = jungfrauAscents(network)
  expect(choices).toHaveLength(17)
  const midday = choices.find(s => s.start === 43440)!
  expect(midday.end).toBe(52860)
  expect(midday.legs.map(l => l.train.shortName)).toEqual(['159','361','81561'])
  expect(midday.waits.map(w => (w.end-w.start)/60)).toEqual([34,20])
  for (const s of choices) {
   expect(s.legs.map(l => [l.from,l.to])).toEqual([['Interlaken Ost','Lauterbrunnen'],['Lauterbrunnen','Kleine Scheidegg'],['Kleine Scheidegg','Jungfraujoch']])
   expect(s.waits[0].end-s.waits[0].start).toBeGreaterThanOrEqual(600)
   expect(s.waits[1].end-s.waits[1].start).toBeGreaterThanOrEqual(780)
   expect(s.waits.every(w => w.end-w.start <= 3600)).toBe(true)
   for (const leg of s.legs) {
    const source = evidence.trips[leg.train.id as keyof typeof evidence.trips]
    expect(source.calls[0].pickup).toBe('0'); expect(source.calls.at(-1)?.dropOff).toBe('0')
    expect(leg.departure).toBe(source.calls[0].departure); expect(leg.arrival).toBe(source.calls.at(-1)?.arrival)
   }
  }
 })
 it('changes map focus at each exact arrival and departure, including backwards scrubbing', () => {
  const s = jungfrauAscents(network)[0]
  expect(ascentPhase(s,s.start-1)).toBe('before')
  for (let i=0; i<3; i++) {
   expect(ascentPhase(s,s.legs[i].departure)).toBe(`leg-${i}`)
   expect(ascentFocus(s,`leg-${i}`).trainId).toBe(s.legs[i].train.id)
   expect(ascentPhase(s,s.legs[i].arrival-1)).toBe(`leg-${i}`)
   if (i<2) {
    expect(ascentPhase(s,s.legs[i].arrival)).toBe(`wait-${i}`)
    expect(ascentFocus(s,`wait-${i}`)).toEqual({ trainId: undefined, station: s.legs[i].to })
   }
  }
  expect(ascentPhase(s,s.end)).toBe('complete'); expect(ascentFocus(s,'complete').station).toBe('Jungfraujoch')
  expect(ascentPhase(s,s.start)).toBe('leg-0')
 })
 it('fails closed for changed dates, source identity, calls or missing geometry', () => {
  expect(jungfrauAscents({...network,metadata:{...network.metadata,serviceDate:'2026-09-05'}})).toEqual([])
  const altered = structuredClone(network)
  const s = jungfrauAscents(altered)[0], target = altered.trains.find(t => t.id === s.legs[0].train.id)!
  target.stops[0][2]++
  expect(jungfrauAscents(altered).some(x => x.id === s.id)).toBe(false)
  const broken = structuredClone(network); broken.paths = []
  expect(jungfrauAscents(broken)).toEqual([])
  const renamed = structuredClone(network); renamed.stops = renamed.stops.map(s => [...s.slice(0,4),'wrong'] as typeof s)
  expect(jungfrauAscents(renamed)).toEqual([])
  expect(jungfrauAscents({...network,trains:[...network.trains,network.trains[0]]})).toEqual([])
 })
 it('requires the exact public direction for every approach in the guide', () => {
  expect(jungfrauGuide(network).map(a => [a.id,a.available])).toEqual([['wengen',true],['grindelwald',true],['eiger',true]])
  const withoutCable = {...network, trains:network.trains.filter(t => t.category !== 'cableway')}
  expect(jungfrauGuide(withoutCable).map(a => a.available)).toEqual([true,true,false])
  const downOnly = {...network,trains:network.trains.filter(t => network.stops[t.stops[0][0]][2] !== 'Interlaken Ost')}
  expect(jungfrauGuide(downOnly).every(a => !a.available)).toBe(true)
 })
})
