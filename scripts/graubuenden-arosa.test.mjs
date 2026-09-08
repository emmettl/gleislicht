import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseLuzernCableways } from './luzern-cableway-geometry.mjs'
import { graubuendenCablewayPattern } from './graubuenden-cableways.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
const read = p => JSON.parse(readFileSync(p)), raw = JSON.parse(gunzipSync(readFileSync('data/graubuenden-audit/timetable.json.gz')))
const review = read('data/graubuenden-cableway-policy.json'), audit = read('data/graubuenden-audit/cableways.json')
const network = parseLuzernCableways(gunzipSync(readFileSync('data/luzern-cableway-sources/network.xtf.gz')).toString()), stops = new Map(raw.stops.map(s=>[s.stop_id,s]))
const route = raw.inventory.find(r=>r.routeId==='93-291-0-j26-1')
const trains = [...new Map(raw.snapshots[0].trains.filter(t=>t.routeId===route.routeId).map(t=>[directedPatternKey(t),t])).values()]
const match = (t,r=review,ss=stops) => graubuendenCablewayPattern(network,r,t,route,ss)[0]
describe('Arosa Weisshorn complete section review',()=>{
  it('preserves both complete source axes in all four original directions',()=>{
    expect(trains).toHaveLength(4)
    expect(audit.additionalSections.arosaMiddleStations[0].coordinate).toEqual(audit.additionalSections.arosaMiddleStations[1].coordinate)
    for(const t of trains){
      const p=match(t), line=network.segments.find(s=>s.id===p.sourceSegmentId).lines[0]
      expect(p.path.slice(1,-1)).toEqual(p.sourceStationNumbers[0]=== (p.installation==='71.003'?'8509160':'8530998') ? line : [...line].reverse())
      expect(p.stationAliases).toHaveLength(p.installation==='71.003'?0:1)
      expect(p.stationAttachmentLimitsMetres).toEqual(t.calls[0].id==='ch:1:sloid:9282'?[20,10]:[10,20])
      expect(Math.max(...p.stationAttachmentsMetres)).toBeCloseTo(13.06021,4)
    }
  })
  it('rejects middle-station drift and retains the 10 m valley/summit limits',()=>{
    for(const t of trains){
      const p=match(t)
      for(const [j,c]of t.calls.entries()){
        const ss=new Map(stops), s=network.stations.find(s=>s.number===p.sourceStationNumbers[j]), metres=c.id==='ch:1:sloid:9282'?25:15
        ss.set(c.id,{...ss.get(c.id),stop_lon:s.coordinate[0],stop_lat:s.coordinate[1]+metres/111195})
        expect(match(t,review,ss).path).toBeUndefined();expect(match(t,review,ss).reason).toBe('cableway-endpoint-gap')
      }
      const r=structuredClone(review);for(const s of r.routes.find(r=>r.routeId===route.routeId).segments)delete s.stationAttachmentReview
      expect(match(t,r).reason).toBe('cableway-endpoint-gap')
    }
    const lower=trains.find(t=>match(t).installation==='71.003'), r=structuredClone(review)
    delete r.routes.find(r=>r.routeId===route.routeId).segments[0].stationAttachmentReview.exactStationReason
    expect(()=>match(lower,r)).toThrow('station identity')
  })
  it('does not invent through journeys or discard earlier mountain paths',()=>{
    const t=structuredClone(trains.find(t=>t.calls[0].id==='ch:1:sloid:9160'));t.calls.push({...t.calls.at(-1),id:'ch:1:sloid:9162',sequence:3})
    expect(match(t).reason).toBe('cableway-unreviewed-complete-pattern')
    const old=read('data/graubuenden-cableway-sources/eleven-route-paths.json');expect(old).toHaveLength(22)
    for(const p of old)expect(audit.patterns.find(q=>q.id===p.id)).toEqual(p)
    expect(audit.days.map(d=>[d.elevenRouteScopeAdmitted,d.arosaAdded])).toEqual([[10011,99],[8848,99]])
  })
  it('retains every diagnostic path for the five reviewed section candidates',()=>{
    const trials=audit.additionalSections.trials;expect(trials).toHaveLength(5)
    expect(trials.flatMap(t=>t.patterns)).toHaveLength(14)
    expect(trials.every(t=>t.patterns.every(p=>p.pairs.every(p=>p.path)))).toBe(true)
    for(const t of trials.filter(t=>t.routeId!==route.routeId))expect(audit.patterns.some(p=>p.routeId===t.routeId)).toBe(false)
    expect(trials.find(t=>t.routeId==='93-77-Y-j26-1').patterns[0].pairs[0].stationAttachmentsMetres.some(n=>n>80)).toBe(true)
  })
})
