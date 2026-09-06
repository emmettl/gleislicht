import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { compileLondonGeography, simplifyGeometry } from './ingest-london-geography.mjs'

const polygon = {
  type: 'Polygon',
  coordinates: [[
    [-0.2, 51.5],
    [-0.15, 51.500001],
    [-0.1, 51.5],
    [-0.1, 51.6],
    [-0.2, 51.6],
    [-0.2, 51.5],
  ]],
}

describe('London geography compiler', () => {
  it('simplifies polygon rings while keeping them closed and renderable', () => {
    const simplified = simplifyGeometry(polygon, 20)
    expect(simplified.type).toBe('Polygon')
    expect(simplified.coordinates[0].length).toBeLessThan(polygon.coordinates[0].length)
    expect(simplified.coordinates[0][0]).toEqual(simplified.coordinates[0].at(-1))
    expect(simplified.coordinates[0].length).toBeGreaterThanOrEqual(4)
  })

  it('records independent source identities for the boundary and Thames', () => {
    const geography = compileLondonGeography({
      boundarySource: { type: 'FeatureCollection', features: [{ geometry: polygon }] },
      thamesSource: { type: 'FeatureCollection', features: [{ geometry: polygon }] },
      retrievedAt: '2026-09-06T12:00:00.000Z',
      toleranceMetres: 20,
    })
    expect(geography.metadata.publisher).toBe('Greater London Authority')
    expect(geography.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(geography.metadata.layers.boundary.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(geography.metadata.layers.thames.sourceUrl).toMatch(/\/1$/)
  })

  it('keeps the committed geography compact, source-audited and polygonal', async () => {
    const geography = JSON.parse(await readFile('fixtures/tfl/all-change-geography.json', 'utf8'))
    expect(geography.metadata.publisher).toBe('Greater London Authority')
    expect(geography.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(geography.metadata.pointCounts.boundary.compiled).toBeLessThan(geography.metadata.pointCounts.boundary.source)
    expect(geography.metadata.pointCounts.thames.compiled).toBeLessThan(geography.metadata.pointCounts.thames.source)
    expect(geography.boundary.type).toMatch(/Polygon/)
    expect(geography.thames.type).toMatch(/Polygon/)
  })
})
