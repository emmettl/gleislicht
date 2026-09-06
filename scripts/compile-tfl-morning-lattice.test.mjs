import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { compileUnifiedApiLattice, planUnifiedApiCoverage } from './compile-tfl-morning-lattice.mjs'

const catalogue = {
  lines: [{
    id: 'test-line',
    name: 'Test Line',
    mode: 'tube',
    directions: [
      {
        direction: 'outbound',
        branches: [
          { stopIds: ['A', 'B', 'C'] },
          { stopIds: ['A', 'B', 'D'] },
        ],
      },
      {
        direction: 'inbound',
        branches: [
          { stopIds: ['C', 'B', 'A'] },
          { stopIds: ['D', 'B', 'A'] },
        ],
      },
    ],
  }],
}

const stops = {
  A: { id: 'A', name: 'Alpha Underground Station', lon: -0.1, lat: 51.5 },
  B: { id: 'B', name: 'Bravo Underground Station', lon: -0.11, lat: 51.51 },
  C: { id: 'C', name: 'Charlie Underground Station', lon: -0.12, lat: 51.52 },
  D: { id: 'D', name: 'Delta Underground Station', lon: -0.12, lat: 51.5 },
}

function routeSequence(direction) {
  const branchIds = direction === 'outbound'
    ? [['A', 'B', 'C'], ['A', 'B', 'D']]
    : [['C', 'B', 'A'], ['D', 'B', 'A']]
  return {
    lineId: 'test-line',
    lineName: 'Test Line',
    direction,
    mode: 'tube',
    stations: Object.values(stops),
    orderedLineRoutes: branchIds.map((naptanIds) => ({ naptanIds, name: naptanIds.join(' to ') })),
    lineStrings: branchIds.map((ids) => JSON.stringify([ids.map((id) => [stops[id].lon, stops[id].lat])])),
  }
}

function timetable(direction, origin) {
  const destination = origin === 'A' ? 'C' : 'A'
  const middle = 'B'
  return {
    lineId: 'test-line',
    direction,
    stops: Object.values(stops),
    timetable: {
      departureStopId: origin,
      routes: [{
        stationIntervals: [{
          id: '0',
          intervals: [
            { stopId: middle, timeToArrival: 2 },
            { stopId: destination, timeToArrival: 5 },
          ],
        }],
        schedules: [{
          name: 'Monday - Friday',
          knownJourneys: [{ hour: '7', minute: origin === 'A' ? '00' : '05', intervalId: 0 }],
        }],
      }],
    },
  }
}

describe('TfL morning lattice compiler', () => {
  it('plans every distinct directional branch origin without duplicate API calls', () => {
    expect(planUnifiedApiCoverage(catalogue)).toEqual([
      expect.objectContaining({ direction: 'outbound', origin: 'A', branchCount: 2 }),
      expect.objectContaining({ direction: 'inbound', origin: 'C', branchCount: 1 }),
      expect.objectContaining({ direction: 'inbound', origin: 'D', branchCount: 1 }),
    ])
  })

  it('compiles all planned origins into one source-audited contract', async () => {
    const requested = []
    const lattice = await compileUnifiedApiLattice({
      catalogue,
      serviceDate: '2026-09-04',
      retrievedAt: '2026-09-06T12:00:00.000Z',
      pauseMs: 0,
      loadJson: async (path) => {
        requested.push(path)
        const origin = path.split('/').at(-1).split('?')[0]
        const direction = path.includes('/inbound') || (path.includes('/Timetable/') && origin !== 'A')
          ? 'inbound'
          : 'outbound'
        if (path.includes('/Route/Sequence/')) return routeSequence(direction)
        return timetable(direction, origin)
      },
    })

    expect(lattice.metadata.coverage).toEqual({
      status: 'complete-for-unified-api-modes',
      modes: ['tube', 'dlr', 'tram'],
      lineCount: 1,
      directionCount: 2,
      originCount: 3,
      activeOriginCount: 3,
      inactiveOrigins: [],
      advertisedBranchCount: 4,
      compiledSnapshotCount: 3,
    })
    expect(lattice.trains).toHaveLength(3)
    expect(new Set(lattice.trains.map(({ id }) => id)).size).toBe(3)
    expect(requested.filter((path) => path.includes('/Route/Sequence/'))).toHaveLength(2)
    expect(requested.filter((path) => path.includes('/Timetable/'))).toHaveLength(3)
  })

  it('keeps the committed bidirectional Unified API lattice complete and renderable', async () => {
    const lattice = JSON.parse(await readFile('fixtures/tfl/all-change-unified-morning.json', 'utf8'))
    expect(lattice.metadata.coverage).toMatchObject({
      status: 'complete-for-unified-api-modes',
      modes: ['tube', 'dlr', 'tram'],
      lineCount: 13,
      directionCount: 26,
      originCount: 48,
      activeOriginCount: 46,
      advertisedBranchCount: 82,
      compiledSnapshotCount: 46,
    })
    expect(lattice.metadata.coverage.inactiveOrigins).toHaveLength(2)
    expect(lattice.trains).toHaveLength(1_422)
    expect(lattice.stops).toHaveLength(356)
    expect(new Set(lattice.trains.map(({ id }) => id)).size).toBe(lattice.trains.length)
    expect(lattice.trains.every((train) =>
      train.stops.length >= 2 && train.pathSegments.length === train.stops.length - 1
    )).toBe(true)
  })
})
