import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { loadZugBusSupplement, zugSupplementGraphs, matchZugBusPair } from './zug-bus-supplement.mjs'

const read = file => JSON.parse(readFileSync(file))
const policy = read('data/zug-policy.json')
const collection = read('data/zug-luzern-sources/selected.geojson')
const layer = read('data/zug-luzern-sources/bus-layer.json')
const A = [8.5,47.17], B = [8.51,47.17], C = [8.51,47.18]
const candidate = (points, key) => ({ graph:lineGraph([{geometry:{type:'LineString',coordinates:points}}]), sourceFeatures:[key] })

describe('Zug neighbouring official bus supplement', () => {
  it('verifies the complete upstream page and preserves only five exact candidate identities', async () => {
    const result = await loadZugBusSupplement(policy.busSupplement)
    expect(result.inventory.map(r=>r.line)).toEqual(['23','73','110','653','N73'])
    expect(result.graphs.has(JSON.stringify(['820','bus','23']))).toBe(true)
    expect(result.graphs.has(JSON.stringify(['839','bus','23']))).toBe(false)
    await expect(loadZugBusSupplement({...policy.busSupplement,sourceSha256:'changed'})).rejects.toThrow('catalogue')
  })
  it('rejects changed year, operator, label, enumeration and duplicate features', () => {
    for (const [field,value,error] of [['FP_JAHR',2025,'year'],['TU',4,'operator'],['LINIENNR','Linie 230','line']]) {
      const altered=structuredClone(collection);altered.features[0].properties[field]=value
      expect(()=>zugSupplementGraphs(altered,layer,policy.busSupplement)).toThrow(error)
    }
    const altered=structuredClone(layer);altered.fields.find(f=>f.name==='TU').domain.codedValues.find(v=>v.code===11).name='changed'
    expect(()=>zugSupplementGraphs(collection,altered,policy.busSupplement)).toThrow('enumeration')
    const duplicate=structuredClone(collection);duplicate.features[1]=duplicate.features[0]
    expect(()=>zugSupplementGraphs(duplicate,layer,policy.busSupplement)).toThrow('duplicate')
  })
  it('retains a successful original curve even if the alternative is shorter', () => {
    const result=matchZugBusPair(candidate([A,C,B],'zug'),candidate([A,B],'luzern'),A,B,policy.limits)
    expect(result.geometrySource).toBe('zug')
    expect(result.path).toContainEqual(C)
    expect(result.primaryFailure).toBeUndefined()
  })
  it('uses a whole directed alternative path and records the original failure', () => {
    const result=matchZugBusPair(undefined,candidate([A,C,B],'luzern'),B,A,policy.limits)
    expect(result.geometrySource).toBe('luzern')
    expect(result.path[0]).toEqual(B);expect(result.path.at(-1)).toEqual(A)
    expect(result.primaryFailure.reason).toBe('missing-reviewed-line-geometry')
  })
  it('never stitches two incomplete source graphs together between stops', () => {
    const mid=[8.505,47.17]
    const result=matchZugBusPair(candidate([A,mid],'zug'),candidate([mid,B],'luzern'),A,B,policy.limits)
    expect(result.path).toBeUndefined()
    expect(result.reason).toBe('endpoint-gap')
    expect(result.primaryFailure.reason).toBe('endpoint-gap')
  })
  it('retains failed official 653 and N73 attempts when roads complete the trips', () => {
    const audit=read('data/zug-study-audit.json')
    for(const entry of audit.supplementInventory.filter(s=>['653','N73'].includes(s.line))) {
      expect(entry.days.some(d=>d.admittedTrips>0)).toBe(true)
      expect(entry.days.some(d=>d.failures.length>0)).toBe(true)
      for (const day of entry.days) for (const failure of day.failures) {
        const pair = audit.days.find(d=>d.date===day.date).directedStopPairs.find(p=>entry.routeIds.includes(p.routeId)&&p.fromId===failure.fromId&&p.toId===failure.toId)
        expect(pair).toMatchObject({ matched: true, geometrySource: 'osm-road-inference', officialFailure: { reason: failure.reason, sourceFeatures: [entry.key] } })
      }
    }
    expect(audit.days.map(d=>d.admittedTripsUsingSupplement)).toEqual([282,156])
  })
})
