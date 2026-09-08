import { expect,it } from 'vitest'
import {readFileSync} from 'node:fs'
import {auditGornergratGeometry,selectGornergratRoute} from './build-gornergrat-study.mjs'
it('requires the exact cogwheel operator and rejects the unrelated route 48 cableway',()=>{
 expect(selectGornergratRoute({route_id:'93-48-j26-1',agency_id:'121',route_type:'116'})).toBe(true)
 expect(selectGornergratRoute({route_id:'93-48-Y-j26-1',agency_id:'294',route_type:'1300'})).toBe(false)
})
it('audits every delivered segment and rejects a missing or distant path',()=>{
 const n=JSON.parse(readFileSync('public/data/gornergrat-day.json','utf8'))
 expect(auditGornergratGeometry(n).passed).toBe(true)
 n.paths[0]=[[0,0],[1,1]];expect(auditGornergratGeometry(n).passed).toBe(false)
 n.paths=[];expect(auditGornergratGeometry(n).passed).toBe(false)
})
