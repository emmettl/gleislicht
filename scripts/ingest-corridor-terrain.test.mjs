import { describe, expect, it } from 'vitest'
import { corridorRoute, wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

describe('corridor terrain ingestion', () => {
  it('converts WGS84 coordinates to the Swiss LV95 frame', () => {
    const [easting, northing] = wgs84ToLv95(8.5364, 47.3786)
    expect(easting).toBeCloseTo(2682901, -1)
    expect(northing).toBeCloseTo(1248109, -1)
  })

  it('assembles route paths in travel order', () => {
    const network = {
      stops: [
        [8.5, 47.3, 'Zürich HB'],
        [8.7, 47.2, 'Thalwil'],
        [9.5, 46.8, 'Chur'],
      ],
      paths: [
        [[8.7, 47.2], [8.6, 47.25], [8.5, 47.3]],
        [[8.7, 47.2], [9.1, 47], [9.5, 46.8]],
      ],
      trains: [{
        route: 'IR35',
        start: 1,
        stops: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
        pathSegments: [0, 1],
      }],
    }
    expect(corridorRoute(network).points).toEqual([
      [8.5, 47.3],
      [8.6, 47.25],
      [8.7, 47.2],
      [9.1, 47],
      [9.5, 46.8],
    ])
  })
})
