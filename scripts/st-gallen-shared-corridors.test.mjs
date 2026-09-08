import test from 'node:test'
import assert from 'node:assert/strict'
import { stGallenGraphs, matchStGallenPair } from './st-gallen-line-geometry.mjs'
import { validatedStGallenSharedCorridors } from './st-gallen-shared-corridors.mjs'
import { sha256 } from './download-luzern-sources.mjs'

const feature=(id,line,points)=>({type:'Feature',id,properties:{ANGEBOT:'Tag',BERECHTIGT:'Ja',BETREIBER:'PAG',KURSBUCHNR:`80.${line}`,LINIENNAME:`${line} A - B`},geometry:{type:'LineString',coordinates:points}})
const limits={snapMetres:120,detourRatio:4.5,detourFloorMetres:1200,alternativeSnapMetres:5}
function fixture() {
  const sources={bus:{type:'FeatureCollection',features:[feature(1,'210',[[9.35,47.42],[9.36,47.42]]),feature(2,'211',[[9.37,47.42],[9.38,47.42]])]}}
  const policy={operatorCrosswalk:{PAG:{bus:['801']}},featureOverrides:{},limits}
  const context={routeId:'route',fromId:'a',toId:'b',from:'A',to:'B'}, from=[9.371,47.42],to=[9.379,47.42]
  const donor=stGallenGraphs(sources,policy).graphs.get(JSON.stringify(['801','bus','211']))
  const path=matchStGallenPair(donor,from,to,limits).path
  policy.sharedCorridors=[{id:'shared',agencyId:'801',operator:'PAG',line:'210',donorLine:'211',targetFeature:'bus:1',donorFeature:'bus:2',expectedTargetName:'210 A - B',expectedDonorName:'211 A - B',stopSequence:['A','B'],evidence:[{sha256:'a'.repeat(64)}],approvedPairs:[{...context,geometrySha256:sha256(JSON.stringify(path))}]}]
  const candidate=stGallenGraphs(sources,policy).graphs.get(JSON.stringify(['801','bus','210']))
  return{sources,policy,candidate,context,from,to,path}
}
test('shared corridor applies only to the exact approved directed route-stop pair',()=>{
  const f=fixture(),r=matchStGallenPair(f.candidate,f.from,f.to,limits,f.context)
  assert.deepEqual(r.path,f.path);assert.deepEqual(r.sharedCorridorIds,['shared']);assert.deepEqual(r.sharedCorridorSourceFeatures,['bus:2'])
  assert.equal(r.initialReason,'endpoint-gap')
  for(const context of [undefined,{...f.context,routeId:'another-route'},{...f.context,fromId:'another-platform'}, {...f.context,fromId:'b',toId:'a'}])
    assert.equal(matchStGallenPair(f.candidate,f.from,f.to,limits,context).reason,'endpoint-gap')
  assert.throws(()=>matchStGallenPair(f.candidate,f.from,f.to,limits,{...f.context,from:'Wrong name'}))
  assert.throws(()=>matchStGallenPair(f.candidate,[9.3711,47.42],f.to,limits,f.context),/geometry changed/)
})
test('passing primary geometry remains unchanged even for an approved fallback pair',()=>{
  const f=fixture(),candidate={...f.candidate,graph:f.candidate.sharedCorridors[0].graph}
  const r=matchStGallenPair(candidate,f.from,f.to,limits,f.context)
  assert.deepEqual(r.path,f.path);assert.equal(r.sharedCorridorIds,undefined)
})
test('shared corridor rejects changed source identity, operator, sequence and duplicate approvals',()=>{
  for(const mutate of [s=>s.bus.features[1].properties.BETREIBER='BOS',s=>s.bus.features[1].properties.LINIENNAME='212 A - B']){
    const f=fixture();mutate(f.sources);assert.throws(()=>validatedStGallenSharedCorridors(f.sources,f.policy))
  }
  for(const mutate of [c=>c.approvedPairs.push(c.approvedPairs[0]),c=>c.approvedPairs[0].to='Elsewhere',c=>c.approvedPairs[0].geometrySha256='invalid']){
    const f=fixture();mutate(f.policy.sharedCorridors[0]);assert.throws(()=>validatedStGallenSharedCorridors(f.sources,f.policy))
  }
})
