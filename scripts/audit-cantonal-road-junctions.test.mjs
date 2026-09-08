import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { junctionCandidates } from './audit-cantonal-road-junctions.mjs'
const sources = JSON.parse(readFileSync('data/zurich-cantonal-road-junction-sources.json', 'utf8'))
describe('official road-axis junction review', () => {
  it('groups roundabout approaches and identifies the three Horgen junction areas', () => {
    const horgen = sources.entries[0]
    const junctions = junctionCandidates(horgen.path, '3', horgen.collection)
    expect(junctions.map(j => j.axes)).toEqual([['702'], ['341', 'K-003'], ['686']])
    expect(junctions.map(j => j.offsetMetres)).toEqual([315, 705, 1162])
  })
  it('rejects partial source responses and never interprets geometry as legal turning flows', () => {
    const horgen = sources.entries[0]
    expect(() => junctionCandidates(horgen.path, '3', { ...horgen.collection, numberMatched: 999 })).toThrow('incomplete')
    expect(junctionCandidates(horgen.path, '3', horgen.collection).every(j => j.status === 'geometric-junction-candidate')).toBe(true)
  })
})
