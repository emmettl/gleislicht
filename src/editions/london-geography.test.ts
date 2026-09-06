import { describe, expect, it } from 'vitest'
import {
  londonBoundary,
  londonWater,
  type LondonGeographySnapshot,
} from './london-geography.ts'

const snapshot: LondonGeographySnapshot = {
  metadata: {
    publisher: 'Greater London Authority',
    sourceUrl: 'https://example.com/london',
    license: 'Open Government Licence v3.0',
    licenseUrl: 'https://example.com/licence',
    toleranceMetres: 35,
  },
  boundary: {
    type: 'Polygon',
    coordinates: [
      [
        [-0.5, 51.4],
        [0.2, 51.4],
        [0.2, 51.7],
        [-0.5, 51.4],
      ],
    ],
  },
  thames: {
    type: 'Polygon',
    coordinates: [
      [
        [-0.3, 51.5],
        [0.1, 51.49],
        [0.1, 51.5],
        [-0.3, 51.5],
      ],
    ],
  },
}

describe('All Change geography adapter', () => {
  it('presents the GLA shell through edition-neutral map contracts', () => {
    const boundary = londonBoundary(snapshot)
    const water = londonWater(snapshot)

    expect(boundary.rings).toHaveLength(1)
    expect(boundary.metadata.edition).toBe('All Change · London')
    expect(water.lakes[0]).toMatchObject({
      id: 'river-thames',
      name: 'River Thames',
    })
    expect(water.lakes[0]?.polygons).toHaveLength(1)
  })
})
