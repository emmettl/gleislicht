import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { SpatialLayoutSnapshot } from '@motionstudies/core/domain/spatial-layout'
import type { AirSnapshot } from '@motionstudies/core/domain/air'
import type { RoadTrafficSnapshot } from '@motionstudies/core/domain/road'
import type { VisualTheme } from '@motionstudies/core/theme'

export const network: NetworkSnapshot = {
  metadata: { publisher: 'Motion Studies Lab', feedVersion: 'synthetic-1', serviceDate: '2026-01-01',
    windowStart: 0, windowEnd: 240, focusTime: 60, sourceUrl: 'https://example.test/synthetic',
    model: 'Synthetic widget fixture', note: 'Invented stops and journeys; no live transport data.' },
  bounds: { minLongitude: 0, maxLongitude: 0.3, minLatitude: 0, maxLatitude: 0.18 },
  stops: [[0.03, 0.03, 'West', '1', 'west'], [0.14, 0.13, 'Junction', '2', 'junction'], [0.27, 0.05, 'East', '3', 'east']],
  edges: [[0, 1], [1, 2]],
  paths: [[[0.03, 0.03], [0.07, 0.1], [0.14, 0.13]], [[0.14, 0.13], [0.21, 0.12], [0.27, 0.05]]],
  edgePaths: [0, 1],
  trains: [
    { id: 'one', route: '1', headsign: 'East', shortName: '101', category: 'regional', start: 0, end: 240,
      stops: [[0, 0, 0], [1, 110, 130], [2, 240, 240]], pathSegments: [0, 1] },
    { id: 'two', route: '2', headsign: 'West', shortName: '202', category: 'intercity', start: 0, end: 240,
      stops: [[2, 0, 0], [1, 110, 130], [0, 240, 240]], pathSegments: [1, 0] },
  ],
}
export const emptyNetwork: NetworkSnapshot = { ...network, stops: [], edges: [], paths: [], edgePaths: [], trains: [] }
export const layout: SpatialLayoutSnapshot = {
  metadata: { id: 'diagram', label: 'Diagram', kind: 'topological', coordinateSpace: 'normalized',
    sourceNetwork: 'synthetic-1', sourceSha256: 'synthetic', feedVersion: 'synthetic-1', model: 'Three-stop line', note: 'Lab fixture' },
  bounds: { minX: -1, minY: -0.6, maxX: 1, maxY: 0.6 },
  stops: [['west', -0.8, 0], ['junction', 0, 0], ['east', 0.8, 0]],
  paths: [[[-0.8, 0], [0, 0]], [[0, 0], [0.8, 0]]],
}
export const air: AirSnapshot = {
  metadata: { ...network.metadata, license: 'Synthetic fixture', licenseUrl: 'https://example.test/synthetic', sampleIntervalSeconds: 30 },
  bounds: network.bounds,
  tracks: [{ id: 'flight', callsign: 'LAB01', start: 0, end: 240,
    samples: Array.from({ length: 9 }, (_, index) => [index * 30, 0.025 + index * 0.03, 0.15, 2500, 160] as const) }],
}
export const road: RoadTrafficSnapshot = {
  metadata: { ...network.metadata, measurementSiteUrl: 'https://example.test/synthetic', measurementSiteTableVersion: 1,
    measurementSitePublishedAt: '2026-01-01', measurementKind: 'representative-calibration', sampleIntervalSeconds: 240, visualSampleRate: 0.2 },
  corridors: [{ id: 'road', name: 'Lab road', road: 'R1', distanceKm: 20, path: [[0.03, 0.02], [0.27, 0.02]],
    directions: [{ id: 'forward', label: 'Forward', reverse: false, detectorIds: [], samples: [[0, 900, 70, 80, 55], [240, 900, 70, 80, 55]] }] }],
}
export const themes: Record<string, VisualTheme> = {
  cyan: { background: '#070912', ink: '#f2f6ff', muted: '#9faabf', line: '#344256', primary: '#8dfaff', secondary: '#ff5edb', panel: '#101623', air: '#ff5edb', roadLight: '#fff1cf', roadHeavy: '#ff9d52' },
  amber: { background: '#140f09', ink: '#fff4dc', muted: '#bead95', line: '#51412e', primary: '#ffcf79', secondary: '#afcba7', panel: '#20190f', air: '#afcba7', roadLight: '#fff1cf', roadHeavy: '#ff9d52' },
}
