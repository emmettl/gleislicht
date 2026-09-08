import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rigiGuide } from '../src/studies/rigi-guide.ts'
const read = () => JSON.parse(readFileSync(new URL('../public/data/rigi-day.json', import.meta.url)))

describe('Rigi schematic source connections', () => {
  it('resolves eleven distinct source stops and twelve supported connections', () => {
    const guide = rigiGuide(read())
    expect(guide.nodes).toHaveLength(11)
    expect(guide.links).toHaveLength(12)
    expect(guide.nodes.every(n => n.calls > 0 && n.indices.length > 0)).toBe(true)
    expect(guide.nodes.find(n => n.id === 'kulm').indices).toHaveLength(3)
    expect(guide.nodes.find(n => n.id === 'staffel').indices).toHaveLength(2)
    expect(guide.links.filter(l => l.from === 'kulm' && l.to === 'staffel').map(l => l.mode)).toEqual(['vitznau', 'arth'])
  })
  it('keeps the two Kaltbad stations and Weggis pier/valley distinct while Vitznau includes boat and railway', () => {
    const n = read(), guide = rigiGuide(n), byId = Object.fromEntries(guide.nodes.map(node => [node.id, node]))
    expect(byId.kaltbadRail.indices.some(i => byId.kaltbadCable.indices.includes(i))).toBe(false)
    expect(byId.weggisPier.indices.some(i => byId.weggisCable.indices.includes(i))).toBe(false)
    const vitznau = n.trains.filter(t => t.stops.some(s => byId.vitznau.indices.includes(s[0])))
    expect(new Set(vitznau.map(t => t.routeType))).toEqual(new Set([116, 1000]))
    expect(byId.vitznau.calls).toBe(vitznau.length)
    expect(guide.links.filter(l => l.mode === 'walk')).toHaveLength(2)
  })
  it('does not infer a stop identity from a name or a neighbouring source identifier', () => {
    for (const replacement of ['unknown', 'ch:1:sloid:50690']) {
      const n = read(); n.stops = n.stops.map(s => s[2] === 'Rigi Kulm' ? [...s.slice(0, 4), replacement] : s)
      const guide = rigiGuide(n)
      expect(guide.nodes.some(s => s.id === 'kulm')).toBe(false)
      expect(guide.links.some(l => l.from === 'kulm' || l.to === 'kulm')).toBe(false)
    }
  })
  it('omits unsupported approach lines and requires the audited source before showing walking interchanges', () => {
    const n = read(); n.trains = n.trains.filter(t => t.routeId !== '93-81-j26-1')
    expect(rigiGuide(n).links.some(l => l.mode === 'arth')).toBe(false)
    for (const key of ['serviceDate', 'feedVersion']) {
      const changed = read(); changed.metadata[key] = 'different'
      expect(rigiGuide(changed).links.some(l => l.mode === 'walk')).toBe(false)
    }
    const changed = read(); changed.metadata.sources.timetable.sha256 = 'different'
    expect(rigiGuide(changed).links.some(l => l.mode === 'walk')).toBe(false)
    expect(rigiGuide({ ...n, trains: [] })).toEqual({ nodes: [], links: [] })
  })
})
