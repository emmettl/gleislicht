import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { featureIdentity, stGallenGraphs, matchStGallenPair, directedPatternKey, validatedStGallenRepairs } from './st-gallen-line-geometry.mjs'
import { inCanton, civilInstances, stGallenMode } from './st-gallen-timetable.mjs'
import { validateStGallenSnapshot, stGallenCategory } from './build-st-gallen-region.mjs'
const policy = { ...JSON.parse(readFileSync(new URL('../data/st-gallen-policy.json', import.meta.url))), geometryRepairs: undefined, sharedCorridors: undefined }
const feature = (properties = {}, coords = [[9.37,47.42],[9.38,47.42],[9.39,47.42]]) => ({type:'Feature',id:999,properties:{ANGEBOT:'Tag', BERECHTIGT:'Ja', BETREIBER:'VBSG', LINIENNR:'1', KURSBUCHNR:'80.001', LINIENNAME:'1 Winkeln - Stephanshorn', ...properties},geometry:{type:'LineString',coordinates:coords}})

test('publisher line identity preserves prefixes and separates rail book numbers', () => {
  assert.deepEqual(featureIdentity('rail',feature({BETREIBER:'AB',LINIENNR:'855',KURSBUCHNR:'855',LINIENNAME:'S21/S22 St. Gallen - Trogen'}),policy).lines,['S21','S22'])
  assert.deepEqual(featureIdentity('bus',feature({BETREIBER:'AB',LINIENNR:'856',LINIENNAME:'B24 Gais - Altstätten Stadt'}),policy).lines,['B24'])
  assert.deepEqual(featureIdentity('bus',feature({BETREIBER:'BuS',LINIENNR:'30',ANGEBOT:'Nacht',LINIENNAME:'N30 Chur - Gams'}),policy).lines,['N30'])
  assert.equal(featureIdentity('bus',feature({BETREIBER:'unknown'}),policy).reason,'unresolved-source-identity')
  assert.throws(()=>featureIdentity('rail',feature({BETREIBER:'SBB',LINIENNAME:'unknown rail identity'}),policy))
})
test('source override fails closed when publisher record identity changes', () => {
  const [key, override] = Object.entries(policy.featureOverrides)[0]
  assert.throws(()=>featureIdentity(key.split(':')[0],{...feature(),id:Number(key.split(':')[1])},policy),/Changed override/)
  assert(override.reason)
})
test('line graphs are operator-scoped, ordered, and never bridge disconnected pieces', () => {
  const graphs=stGallenGraphs({city:{type:'FeatureCollection',features:[feature()]}},policy).graphs
  const candidate=graphs.get(JSON.stringify(['885','bus','1']))
  assert(candidate)
  assert.equal(graphs.get(JSON.stringify(['801','bus','1'])),undefined)
  const reverse=matchStGallenPair(candidate,[9.389,47.42],[9.371,47.42],policy.limits)
  assert.deepEqual(reverse.path[0],[9.389,47.42]); assert.deepEqual(reverse.path.at(-1),[9.371,47.42])
  assert.equal(matchStGallenPair(candidate,[9.37,47.43],[9.39,47.42],policy.limits).reason,'endpoint-gap')
  const multipart={...feature(),geometry:{type:'MultiLineString',coordinates:[[[9.37,47.42],[9.375,47.42]],[[9.385,47.42],[9.39,47.42]]]}}
  const broken=stGallenGraphs({city:{type:'FeatureCollection',features:[multipart]}},policy).graphs.get(JSON.stringify(['885','bus','1']))
  assert.equal(matchStGallenPair(broken,[9.371,47.42],[9.389,47.42],policy.limits).reason,'disconnected-line')
})
test('scope respects holes and disjoint polygons, includes all transport modes', () => {
  const geometry={type:'MultiPolygon',coordinates:[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]],[[[20,20],[21,20],[21,21],[20,21],[20,20]]]]}
  assert(inCanton([1,1],geometry)); assert(!inCanton([5,5],geometry)); assert(inCanton([20.5,20.5],geometry))
  assert.equal(stGallenMode(1300),'mountain');assert.equal(stGallenMode(1000),'boat');assert.equal(stGallenMode(700),'bus')
})
test('civil day carries preceding 24+ hour services and preserves ordered conditional calls', () => {
  const trip={calls:[{id:'a',arrival:86500,departure:86520,pickupType:'2',dropOffType:'0'},{id:'b',arrival:87000,departure:87000,pickupType:'0',dropOffType:'0'}]}
  const instances=civilInstances('trip',trip,undefined,[-86400],'2026-09-06')
  assert.equal(instances.length,1);assert.equal(instances[0].stops[0].arrival,100)
  assert.equal(instances[0].metadata.sourceServiceDate,'2026-09-05')
  const base={routeId:'r',directionId:'0',calls:trip.calls}
  assert.notEqual(directedPatternKey(base),directedPatternKey({...base,calls:[...trip.calls].reverse()}))
  assert.notEqual(directedPatternKey(base),directedPatternKey({...base,calls:trip.calls.map(c=>({...c,pickupType:'0'}))}))
})
test('artifact validator rejects reversed paths and missing call geometry', () => {
  const snapshot={stops:[[9.37,47.42],[9.39,47.42]],paths:[[[9.39,47.42],[9.37,47.42]]],trains:[{id:'x',category:'bus',stops:[[0,0,0],[1,60,60]],sourceCallSequences:[1,2],callRules:[['0','0'],['0','0']],pathSegments:[0]}]}
  assert.throws(()=>validateStGallenSnapshot(snapshot),/direction/)
  snapshot.paths[0].reverse();validateStGallenSnapshot(snapshot)
  snapshot.trains[0].pathSegments=[];assert.throws(()=>validateStGallenSnapshot(snapshot))
})

test('boat feed uses native ferry category', () => { assert.equal(stGallenCategory({mode:'boat',line:'BAT',routeType:1000}),'ferry') })


test('repairs use corroborated source slices and exact disconnected target vertices', () => {
  const a=[9.37,47.42], b=[9.37004,47.42], mid=[9.37002,47.42]
  const target={...feature(),id:1,properties:{...feature().properties,LINIENNAME:'target'},geometry:{type:'MultiLineString',coordinates:[[[9.369,47.42],a],[b,[9.371,47.42]]]}}
  const donor={...feature({},[a,mid,b]),id:2,properties:{...feature().properties,LINIENNAME:'donor'}}
  const sources={bus:{type:'FeatureCollection',features:[target,donor,{...structuredClone(donor),id:3},{...structuredClone(donor),id:4}]}}
  const config={geometryRepairs:{maximumLengthMetres:15,repairs:[{id:'test',targetFeature:'bus:1',expectedTargetName:'target',donorFeature:'bus:2',expectedDonorName:'donor',partIndex:0,startVertex:0,endVertex:2,pathMetres:3.012864651,corroboratingSources:[{feature:'bus:3',partIndex:0,startVertex:0,endVertex:2},{feature:'bus:4',partIndex:0,startVertex:0,endVertex:2}]}]}}
  // Derive the fixture distance from the actual spherical coordinate metric.
  const candidate=stGallenGraphs({bus:{type:'FeatureCollection',features:[feature({},[a,mid,b])]}},policy).graphs.get(JSON.stringify(['885','bus','1']))
  config.geometryRepairs.repairs[0].pathMetres=matchStGallenPair(candidate,a,b,policy.limits).pathMetres
  assert.equal(validatedStGallenRepairs(sources,config).length,1)
  const badLength=structuredClone(config);badLength.geometryRepairs.repairs[0].pathMetres=14
  assert.throws(()=>validatedStGallenRepairs(sources,badLength),/length/)
  const moved=structuredClone(sources);moved.bus.features[2].geometry.coordinates[1][1]+=0.0001
  assert.throws(()=>validatedStGallenRepairs(moved,config),/geometry changed/)
  const joined=structuredClone(sources);joined.bus.features[0].geometry.coordinates.push([a,b])
  assert.throws(()=>validatedStGallenRepairs(joined,config),/already connected/)
  const foreign=structuredClone(sources);foreign.bus.features[1].properties.BETREIBER='PAG'
  assert.throws(()=>validatedStGallenRepairs(foreign,config),/operators/)
  const shifted=structuredClone(config);shifted.geometryRepairs.repairs[0].startVertex=1
  assert.throws(()=>validatedStGallenRepairs(sources,shifted))
})
