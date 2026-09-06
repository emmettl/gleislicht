import { describe, expect, it } from 'vitest'
import { compileParisGeography } from './compile-paris-geography.mjs'

const square = (west, south, east, north) => [[
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
]]

describe('Correspondances geography compiler', () => {
  it('keeps boundary and water provenance separate', () => {
    const boundaryBytes = Buffer.from('boundary')
    const waterBytes = Buffer.from('water')
    const result = compileParisGeography({
      boundarySource: {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: square(2.2, 48.8, 2.5, 48.95) },
      },
      waterSource: {
        results: [{
          objectid: 1,
          geo_shape: { geometry: { type: 'Polygon', coordinates: square(2.3, 48.84, 2.4, 48.87) } },
        }],
      },
      peripheriqueSource: {
        results: [{
          l_longmin: 'Boulevard Périphérique',
          geom: {
            geometry: {
              type: 'MultiLineString',
              coordinates: [[[2.25, 48.82], [2.35, 48.81], [2.45, 48.86]]],
            },
          },
        }],
      },
      boundaryBytes,
      waterBytes,
      peripheriqueBytes: Buffer.from('peripherique'),
      retrievedAt: '2026-09-06T00:00:00.000Z',
    })
    expect(result.metadata.layers.boundary.publisher).toContain('interministérielle')
    expect(result.metadata.layers.water.license).toBe('Open Database License (ODbL)')
    expect(result.metadata.layers.boundary.sourceSha256).not.toBe(
      result.metadata.layers.water.sourceSha256,
    )
    expect(result.boundary).toHaveLength(1)
    expect(result.water[0].polygons).toHaveLength(1)
    expect(result.references[0]).toMatchObject({
      id: 'boulevard-peripherique',
      name: 'Boulevard Périphérique',
    })
  })
})
