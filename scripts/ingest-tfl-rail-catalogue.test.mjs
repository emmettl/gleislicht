import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  RAIL_LED_MODES,
  summariseRouteSequence,
  summariseStopHierarchy,
} from './ingest-tfl-rail-catalogue.mjs'

describe('TfL rail-led catalogue', () => {
  it('keeps the five opening modes explicit and rail-led', () => {
    expect(RAIL_LED_MODES).toEqual(['tube', 'elizabeth-line', 'overground', 'dlr', 'tram'])
  })

  it('preserves named branches and their ordered NaPTAN stops', () => {
    const summary = summariseRouteSequence({
      direction: 'outbound',
      stations: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      orderedLineRoutes: [
        { name: 'Alpha  &harr;  Bravo ', serviceType: 'Regular', naptanIds: ['A', 'B'] },
        { name: 'Alpha  &harr;  Charlie ', serviceType: 'Regular', naptanIds: ['A', 'C'] },
      ],
      lineStrings: ['[[[0,0],[1,1]]]', '[[[0,0],[2,2]]]'],
    })

    expect(summary.direction).toBe('outbound')
    expect(summary.branches.map(({ name }) => name)).toEqual(['Alpha ↔ Bravo', 'Alpha ↔ Charlie'])
    expect(summary.branches[1].stopIds).toEqual(['A', 'C'])
    expect(summary.branches[0].geometrySha256).not.toBe(summary.branches[1].geometrySha256)
  })

  it('retains platform and interchange children without inventing platform names', () => {
    const summary = summariseStopHierarchy('example', 'station', {
      id: 'hub',
      commonName: 'Example',
      stopType: 'TransportInterchange',
      children: [
        { id: 'p1', commonName: 'Example', stopType: 'NaptanMetroPlatform' },
        { id: 'p2', commonName: 'Example', stopType: 'NaptanMetroPlatform', platformName: '2' },
        { id: 'e1', commonName: 'Example', stopType: 'NaptanMetroEntrance' },
      ],
    })

    expect(summary.resolvedId).toBe('hub')
    expect(summary.childTypeCounts).toEqual({ NaptanMetroPlatform: 2, NaptanMetroEntrance: 1 })
    expect(summary.children[0].platformName).toBeNull()
  })

  it('keeps the committed discovery audit complete and capability-honest', async () => {
    const catalogue = JSON.parse(
      await readFile('fixtures/tfl/all-change-rail-led-catalogue.json', 'utf8'),
    )
    const branchCount = catalogue.lines.reduce((total, line) =>
      total + line.directions.reduce((subtotal, direction) => subtotal + direction.branches.length, 0), 0)

    expect(catalogue.lines).toHaveLength(20)
    expect(branchCount).toBe(125)
    expect(catalogue.stopHierarchySamples).toHaveLength(3)
    expect(catalogue.stopHierarchySamples[0].childTypeCounts.NaptanMetroPlatform).toBe(6)
    expect(catalogue.movementProofs.find(({ mode }) => mode === 'tube')).toMatchObject({
      status: 'compiled-all-lines-bidirectional',
      fixtures: ['all-change-unified-morning.json'],
    })
    expect(catalogue.movementProofs.find(({ mode }) => mode === 'elizabeth-line')).toMatchObject({
      status: 'audited-full-branch-family',
      fixtures: ['all-change-pdf-morning.json'],
    })
    expect(catalogue.movementProofs.find(({ mode }) => mode === 'overground')).toMatchObject({
      status: 'compiled-all-lines-bidirectional',
      lines: ['liberty', 'lioness', 'mildmay', 'suffragette', 'weaver', 'windrush'],
      fixtures: ['all-change-pdf-morning.json'],
    })
  })
})
