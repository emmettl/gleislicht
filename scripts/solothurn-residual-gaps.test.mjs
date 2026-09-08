import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { assertPreservedPattern } from './review-solothurn-residual-gaps.mjs'
const paths = [[[7, 47], [7.1, 47.1]], [[7.1, 47.1], [7.2, 47.2]]]
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const before = { id: 'pattern', routeId: '91-81-A-j26-1', agencyId: '11', line: 'IC81', directionId: '0', stopIds: ['a', 'b', 'c'], pathSegments: [hash(paths[0]), null], admittedTrips: 0 }
const after = { ...before, pathSegments: [0, 1], admittedTrips: 1 }
describe('Solothurn complete-context preservation audit', () => {
  it('permits only missing geometry on reviewed routes while preserving every earlier selected segment', () => {
    expect(() => assertPreservedPattern(before, after, paths)).not.toThrow()
    expect(() => assertPreservedPattern(before, { ...after, pathSegments: [1, 0] }, paths)).toThrow('Changed previously selected geometry')
    expect(() => assertPreservedPattern({ ...before, routeId: 'other' }, { ...after, routeId: 'other' }, paths)).toThrow('Unreviewed route gained geometry')
    expect(() => assertPreservedPattern(before, { ...after, stopIds: ['a', 'c'] }, paths)).toThrow('Changed original complete stop chain')
  })
  it('rejects loss of previous complete admission even if segment hashes survive', () => {
    const complete = { ...before, admittedTrips: 1, pathSegments: paths.map(hash) }
    expect(() => assertPreservedPattern(complete, { ...after, admittedTrips: 0 }, paths)).toThrow('Lost previously admitted full pattern')
  })
})
