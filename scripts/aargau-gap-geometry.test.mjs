import { test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { aargauGapMatcher } from './aargau-gap-geometry.mjs'
import { lineIndex, matchAargauPattern } from './aargau-line-geometry.mjs'
const stops = [[8.1,47.4,'A','','A'],[8.11,47.4,'B','','B'],[8.12,47.4,'C','','C']]
const collection = { features: [{ id: 1, properties: { GO_NR: '11', VM_NAME: 'Zug', NR: 'S41' }, geometry: { type: 'MultiLineString', coordinates: [stops.map(s => s.slice(0,2))] } }] }
const rule = { id:'crossing',agencyId:'65',mode:'rail',line:'S36',routeIds:['r'],sourceFeatureId:1,sourceKey:'11:rail:S41',directedPairs:[['B','C'],['C','B']],serviceDates:['2026-09-06'] }
const train = { agencyId:'65',category:'rail',route:'S36',routeId:'r',calls:stops.map(s=>[s[4],0,0]) }
test('gap reuse requires exact route, agency, date and directed platform pair', () => {
  const m = aargauGapMatcher(collection,[rule],'2026-09-06')
  expect(m.matchPattern(train,stops).map(s=>Boolean(s?.path))).toEqual([false,true])
  for (const change of [{agencyId:'11'},{category:'bus'},{routeId:'other'},{route:'S41'}]) expect(m.matchPattern({...train,...change},stops).every(s=>!s)).toBe(true)
  expect(aargauGapMatcher(collection,[rule],'2026-09-14').matchPattern(train,stops).every(s=>!s)).toBe(true)
  const reverse=m.matchPattern({...train,calls:[...train.calls].reverse()},[...stops].reverse())
  expect(reverse[0].path).toEqual([...m.matchPattern(train,stops)[1].path].reverse())
})
test('gap reuse validates the full ordered pattern rather than an isolated pair', () => {
  const wrong=[stops[2],stops[0],stops[1],stops[2]]
  const result=aargauGapMatcher(collection,[rule],'2026-09-06').matchPattern({...train,calls:wrong.map(s=>[s[4],0,0])},wrong)
  expect(result[2]?.path).toBeUndefined()
})
test('actual Hallwilersee mappings validate both full loops with unchanged guards', () => {
  const col=JSON.parse(gunzipSync(readFileSync('data/aargau-sources/lines.json.gz')))
  const crosswalk=JSON.parse(readFileSync('data/aargau-line-crosswalk.json','utf8'))
  const index=lineIndex(col,crosswalk.mappings)
  const raw=JSON.parse(gunzipSync(readFileSync('data/aargau/2026-09-06-timetable.json.gz'))), byId=new Map(raw.stops.map(s=>[s[4],s]))
  for(const [line,feature,direction] of [['3652',318,'reversed'],['3653',315,'forward']]) {
    const trip=raw.trains.find(t=>t.agencyId==='181'&&t.route===line)
    const match=matchAargauPattern(index.get(`181:ferry:${line}`),trip.calls.map(c=>byId.get(c[0])))
    expect(match).toMatchObject({featureId:feature,coordinateOrder:direction,closedLoop:true})
    expect(match.segments.every(s=>s.path&&s.maximumSnapMetres<=120)).toBe(true)
    expect(match.stopProgressMetres.at(-1)-match.stopProgressMetres[0]).toBeLessThanOrEqual(index.get(`181:ferry:${line}`)[0].length+.01)
  }
})
