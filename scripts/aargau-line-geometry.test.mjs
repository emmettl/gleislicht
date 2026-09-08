import { describe, expect, test } from 'vitest'
import { lineIndex, matchAargauPattern, pointInCanton } from './aargau-line-geometry.mjs'
import { applyAargauGeometry, validateAargauFeed } from './build-aargau-study.mjs'
import { chunkNetworkSnapshot } from '@motionstudies/data/network-chunks'
const a = [8.1, 47.4], b = [8.11, 47.4], c = [8.12, 47.4]
const collection = (parts, extra = {}) => ({ type: 'FeatureCollection', features: [{ id: 1, properties: { GO_NR: '801', VM_NAME: 'Bus', NR: '1', RICHTUNG: 'Hinfahrt', ...extra }, geometry: { type: 'MultiLineString', coordinates: parts } }] })
const lines = parts => lineIndex(collection(parts)).get('801:bus:1')

describe('Aargau ordered source lines', () => {
  test('matches both geometric orientations without equating direction IDs', () => {
    const forward = matchAargauPattern(lines([[a,b,c]]), [a,b,c])
    const reverse = matchAargauPattern(lines([[a,b,c]]), [c,b,a])
    expect(forward.segments.every(s => s.accepted)).toBe(true)
    expect(reverse.coordinateOrder).toBe('reversed')
    expect(reverse.sourceDirection).toBe('Hinfahrt')
    expect(reverse.segments[0].path[0]).toEqual(c)
  })
  test('cannot splice disconnected multipart geometry into a through path', () => {
    const result = matchAargauPattern(lines([[a,b],[b,c]]), [a,b,c])
    expect(result.segments.filter(s => s.accepted)).toHaveLength(1)
    expect(result.segments.some(s => s.reason === 'endpoint-gap')).toBe(true)
  })
  test('rejects a wrong-order chain instead of routing each pair independently', () => {
    const result = matchAargauPattern(lines([[a,b,c]]), [a,c,b])
    expect(result.segments.filter(s => s.accepted)).toHaveLength(1)
    expect(result.segments.some(s => s.reason === 'pattern-order-gap')).toBe(true)
  })
  test('preserves repeated positions around a closed loop', () => {
    const d = [8.11,47.41]
    const result = matchAargauPattern(lines([[a,b,d,a]]), [a,b,d,a])
    expect(result.segments.every(s => s.accepted)).toBe(true)
    expect(result.segments.at(-1).path.at(-1)).toEqual(a)
  })
  test('does not reset progress across a missing stop', () => {
    const absent = [8.5,47.6]
    const result = matchAargauPattern(lines([[a,b,c]]), [a,c,absent,b])
    expect(result.segments.slice(1).every(s => !s.accepted)).toBe(true)
    const progress = result.stopProgressMetres.filter(p => p !== null)
    expect(progress).toEqual([...progress].sort((a,b)=>a-b))
  })
  test('rotates a closed loop to the first stop, but never permits a second lap', () => {
    const d = [8.11,47.41]
    expect(matchAargauPattern(lines([[a,b,d,a]]), [b,d,a,b]).segments.every(s=>s.accepted)).toBe(true)
    expect(matchAargauPattern(lines([[a,b,d,a]]), [b,d,a,b,d,a,b]).segments.every(s=>s.accepted)).toBe(false)
  })
  test('rejects distant platforms and implausible loops', () => {
    expect(matchAargauPattern(lines([[a,b]]), [[8.1,47.41],b]).segments[0].reason).toBe('endpoint-gap')
    const result = matchAargauPattern(lines([[a,[8.1,47.45],[8.11,47.45],b]]), [a,b])
    expect(result.segments[0].reason).toBe('implausible-detour')
  })
  test('requires operator and mode identity; crosswalk is line-specific', () => {
    const index = lineIndex(collection([[a,b]]), [{ go: '801', sourceLine:'1', mode:'bus', agencyId:'999', line:'2' }])
    expect(index.has('999:bus:2')).toBe(true)
    expect(index.has('999:bus:1')).toBe(false)
    expect(index.has('801:bus:1')).toBe(false)
    expect(matchAargauPattern(index.get('999:rail:2'), [a,b]).segments[0].reason).toBe('missing-operator-mode-line')
  })
  test('preserves exact GTFS endpoint precision', () => {
    const precise = [8.100000001, 47.400000003]
    expect(matchAargauPattern(lines([[a,b]]), [precise,b]).segments[0].path[0]).toEqual(precise)
  })
})

test('membership respects canton holes and disconnected polygons', () => {
  const ring = (x,y,size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]
  const geometry = { type:'MultiPolygon', coordinates:[[ring(0,0,10),ring(2,2,2)],[ring(20,20,1)]] }
  expect(pointInCanton([1,1],geometry)).toBe(true)
  expect(pointInCanton([3,3],geometry)).toBe(false)
  expect(pointInCanton([20.5,20.5],geometry)).toBe(true)
  expect(pointInCanton([15,15],geometry)).toBe(false)
})

test('feed reconstruction preserves border stops, calls, absent geometry and direction identity', () => {
  const raw = { metadata:{ feed:{feed_version:'test'}, serviceDate:'2026-09-06' }, stops:[[...a,'A','','A'],[...b,'B','','B'],[...c,'C','','C']], trains:[{id:'test',routeId:'r',agencyId:'801',route:'1',category:'bus',directionId:'0',start:-60,end:180,calls:[['A',-60,-60,'0','0'],['B',60,60,'0','0'],['C',180,180,'0','0']]}] }
  const {snapshot,patterns} = applyAargauGeometry(raw,lineIndex(collection([[a,b]])),['B'])
  const {manifest,chunks} = chunkNetworkSnapshot(snapshot,7200,'chunks')
  expect(validateAargauFeed(snapshot,raw,manifest,chunks).completeSourceStopChains).toBe(true)
  expect(snapshot.trains[0].stops).toHaveLength(3)
  expect(patterns[0].completeGeometry).toBe(false)
  expect(snapshot.trains[0].pathSegments[1]).toBeNull()
  chunks[0].payload.trains[0].stops[1][1]++
  expect(()=>validateAargauFeed(snapshot,raw,manifest,chunks)).toThrow()
})
