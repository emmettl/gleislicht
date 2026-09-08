import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { plantazTurnaround, PLANTAZ_PLATFORMS, osmSegments } from './mbc-supplement-geometry.mjs'
import { applyLausanneRailGeometry } from './lausanne-rail-geometry.mjs'
const source = JSON.parse(readFileSync('data/vaud-sources/mbc-terminal-funicular-osm.json'))
const poles = [[6.47731134,46.50823079,'La Plantaz','B',PLANTAZ_PLATFORMS[0]],[6.47726642,46.5081195,'La Plantaz','A',PLANTAZ_PLATFORMS[1]]]
describe('source-backed MBC supplemental geometry', () => {
  it('preserves the roundabout turnaround between adjacent La Plantaz platforms', () => {
    const result = plantazTurnaround(source, ...poles)
    expect(result.length).toBeGreaterThan(400)
    expect(result.length).toBeLessThan(1500)
    expect(result.snap).toBeLessThan(15)
    expect(result.path.some(([lon,lat])=>lon<6.476 && lat<46.507)).toBe(true)
    expect(()=>plantazTurnaround(source, poles[1], poles[0])).toThrow()
    const broken=structuredClone(source);broken.terminalRelation.orderedWayIds.splice(2,1)
    expect(()=>plantazTurnaround(broken,...poles)).toThrow('Disconnected')
    const truncated=structuredClone(source);truncated.terminalRelation.orderedWayIds.pop()
    expect(()=>plantazTurnaround(truncated,...poles)).toThrow('Incomplete')
  })
  it('projects both directions onto the isolated funicular without using nearby mainline tracks', () => {
    const stops = [[6.50990222,46.61204341,'Cossonay-Ville','','top'],[6.52286491,46.60590308,'Cossonay-Penthalaz (funi)','','bottom']]
    const trains=[{id:'down',routeId:'funi',category:'funicular',stops:[[0,0,0],[1,300,300]]},{id:'up',routeId:'funi',category:'funicular',stops:[[1,0,0],[0,300,300]]}]
    const result=applyLausanneRailGeometry({stops,trains,edges:[[0,1]]},null,new Map([['funi',{agencyId:'344'}]]),{rail:osmSegments(source).filter(s=>s.tags.railway==='funicular')})
    expect(result.matchedSegments).toBe(2)
    expect(result.projectionAudit.issues).toEqual([])
    expect(result.projectionAudit.snaps.every(s=>s.snapMetres<25)).toBe(true)
    const down=result.paths[result.trains[0].pathSegments[0]],up=result.paths[result.trains[1].pathSegments[0]]
    expect(down[0]).toEqual([6.509902,46.612043]);expect(up[0]).toEqual(down.at(-1))
    expect(down.length).toBeGreaterThan(10)
  })
})
