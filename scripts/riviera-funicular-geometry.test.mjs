import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { applyRivieraFuniculars, loadRivieraFuniculars } from './riviera-funicular-geometry.mjs'
const read = path => JSON.parse(readFileSync(new URL('../'+path, import.meta.url)))
const source = read('data/riviera-sources/funiculars.json')
const fixture = () => read('data/riviera-region/2026-09-13/riviera-region-morning.json')
const routes = new Map(source.routes.map(p => [p.routeId, { agencyId:p.agencyId, mode:'funicular' }]))
describe('Riviera federal funicular axes', () => {
  it('validates retained source bytes', async () => { expect((await loadRivieraFuniculars()).source).toEqual(source) })
  it('preserves intermediate calls and directed paths on all three installations', () => {
    const before=fixture(), {snapshot,reports}=applyRivieraFuniculars(before,routes,source)
    expect(reports).toHaveLength(3)
    for(const train of snapshot.trains.filter(t=>t.category==='funicular')) {
      expect(train.stops).toEqual(before.trains.find(t=>t.id===train.id).stops)
      train.pathSegments.forEach((index,i)=>{
        const path=snapshot.paths[index],a=snapshot.stops[train.stops[i][0]],b=snapshot.stops[train.stops[i+1][0]]
        expect(path[0]).toEqual(a.slice(0,2));expect(path.at(-1)).toEqual(b.slice(0,2))
      })
    }
    expect(Math.max(...reports.map(r=>r.maximumSnapMetres))).toBeLessThan(20)
    expect(reports.find(r=>r.installation==='61.050').stops).toHaveLength(6)
  })
  it('rejects moved stops, reordered calls and a changed route identity', () => {
    const changed=fixture(),t=changed.trains.find(t=>t.routeId==='93-TG-j26-1')
    changed.stops[t.stops[1][0]][0]+=.001
    expect(()=>applyRivieraFuniculars(changed,routes,source)).toThrow('attachment limit')
    const reordered=fixture(),trip=reordered.trains.find(t=>t.routeId==='93-TG-j26-1');[trip.stops[0],trip.stops[1]]=[trip.stops[1],trip.stops[0]]
    expect(()=>applyRivieraFuniculars(reordered,routes,source)).toThrow('call sequence')
    const wrong=new Map(routes);wrong.set('93-TG-j26-1',{agencyId:'42',mode:'funicular'})
    expect(()=>applyRivieraFuniculars(fixture(),wrong,source)).toThrow('route identity')
  })
  it('rejects reversed source geometry and an expired installation', () => {
    const reversed=structuredClone(source);reversed.routes[0].segment.lines[0].reverse()
    expect(()=>applyRivieraFuniculars(fixture(),routes,reversed)).toThrow('stop order')
    const expired=structuredClone(source);expired.routes[0].feature.validUntil='2026-09-01'
    expect(()=>applyRivieraFuniculars(fixture(),routes,expired)).toThrow('validity')
  })
})
