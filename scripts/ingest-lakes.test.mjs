import { describe, expect, it } from 'vitest'
import { buildLakeArtifact, simplifyRing } from './ingest-lakes.mjs'

describe('Swiss lake ingestion', () => {
  it('simplifies a closed shoreline while retaining a closed polygon', () => {
    const simplified = simplifyRing(
      [
        [8, 47],
        [8.0001, 47],
        [8.001, 47],
        [8.001, 47.001],
        [8, 47.001],
        [8, 47],
      ],
      20,
    )

    expect(simplified.length).toBe(5)
    expect(simplified[0]).toEqual(simplified.at(-1))
  })

  it('filters tiny lakes and preserves polygon holes', () => {
    const square = [
      [8, 47],
      [8.01, 47],
      [8.01, 47.01],
      [8, 47.01],
      [8, 47],
    ]
    const artifact = buildLakeArtifact(
      {
        results: [
          {
            id: 1,
            properties: { name: 'Testsee', seeflaeche_km2: 2 },
            geometry: { type: 'Polygon', coordinates: [square, square] },
          },
          {
            id: 2,
            properties: { name: 'Puddle', seeflaeche_km2: 0.01 },
            geometry: { type: 'Polygon', coordinates: [square] },
          },
        ],
      },
      { toleranceMetres: 1, minimumAreaSquareKilometres: 0.1 },
    )

    expect(artifact.lakes).toHaveLength(1)
    expect(artifact.lakes[0].name).toBe('Testsee')
    expect(artifact.lakes[0].polygons[0]).toHaveLength(2)
  })
})
