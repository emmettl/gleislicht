import { describe, expect, it } from 'vitest'
import { assertCompleteNyonCalls, nyonRailCorridor } from './nyon-geometry.mjs'
describe('Nyon scope and source identity', () => {
  const stops = [[6.2,46.3,'A','','a'],[6.21,46.31,'B','','b'],[6.22,46.32,'C','','c']]
  const calls = [{id:'a',arrival:86300,departure:86300},{id:'b',arrival:86500,departure:86500}]
  const trip = {id:'overnight',sourceServiceDate:'2026-09-07',stops:[[0,-100,-100],[1,100,100]]}
  it('preserves complete cross-border calls and midnight spillover', () => {
    expect(()=>assertCompleteNyonCalls(trip,stops,calls,'2026-09-08')).not.toThrow()
    expect(()=>assertCompleteNyonCalls({...trip,stops:[[0,-100,-100],[2,100,100]]},stops,calls,'2026-09-08')).toThrow('Clipped')
    expect(()=>assertCompleteNyonCalls({...trip,stops:[[0,0,0],[1,200,200]]},stops,calls,'2026-09-08')).toThrow('offset')
    expect(()=>assertCompleteNyonCalls({...trip,stops:[[0,-100,-100],[1,101,101]]},stops,calls,'2026-09-08')).toThrow('times')
  })
  it('isolates NStCM underground Nyon from the nearby SBB railway', () => {
    const network={nodes:new Map([['c',{id:'c',number:'8501060'}],['n',{id:'n',number:'8519325'}],['s',{id:'s',number:'8501030'}]]),segments:[{id:'nstcm',start:'c',end:'n'}]}
    expect(nyonRailCorridor(network).map(s=>s.id)).toEqual(['nstcm'])
    expect(()=>nyonRailCorridor({...network,segments:[...network.segments,{id:'wrong',start:'n',end:'s'}]})).toThrow('mainline')
  })
})
