import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {selectPilatusRoute,auditPilatusGeometry} from './build-pilatus-study.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8')),network=read('public/data/pilatus-day.json')
describe('Pilatus source and geometry gates',()=>{
 it('requires the exact operator, route and cogwheel type',()=>{
  const route={route_id:'93-R83-j26-1',agency_id:'136',route_type:'116'}
  expect(selectPilatusRoute(route)).toBe(true)
  for(const changed of [{agency_id:'200'},{route_type:'1300'},{route_id:'93-48-j26-1'}])expect(selectPilatusRoute({...route,...changed})).toBe(false)
 })
 it('maps every scheduled segment and rejects missing or remote paths',()=>{
  const audit=auditPilatusGeometry(network)
  expect(audit.passed).toBe(true);expect(audit.maxOffsetMetres).toBeLessThan(39)
  expect(auditPilatusGeometry({...network,paths:[]}).passed).toBe(false)
  expect(auditPilatusGeometry({...network,paths:network.paths.map(p=>p.map(([x,y])=>[x+1,y]))}).passed).toBe(false)
  expect(gzipSync(readFileSync('public/data/pilatus-day.json')).length).toBeLessThan(40*1024)
  expect(network.metadata.sources.timetable.sha256).toBe('d325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e')
  expect(network.metadata.sources.rail.sha256).toBe('2895811c6c338cdc3d32e946d2861ce58ca72ddde7d700fe9b73f2c393f7b828')
 })
})
