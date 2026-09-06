import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  compileTflLineProof,
  linePointsForStops,
  parseClock,
} from './ingest-tfl-line.mjs'

const routeSequence = {
  lineId: 'test-line',
  lineName: 'Test Line',
  direction: 'outbound',
  mode: 'tube',
  lineStrings: ['[[[-0.12,51.5],[-0.13,51.51],[-0.14,51.52]]]'],
}

const stops = [
  { id: 'A', name: 'Alpha Underground Station', lon: -0.12, lat: 51.5 },
  { id: 'B', name: 'Bravo Underground Station', lon: -0.13, lat: 51.51 },
  { id: 'C', name: 'Charlie Underground Station', lon: -0.14, lat: 51.52 },
]

const timetable = {
  lineId: 'test-line',
  direction: 'outbound',
  stops,
  timetable: {
    departureStopId: 'A',
    routes: [
      {
        stationIntervals: [
          {
            id: '0',
            intervals: [
              { stopId: 'B', timeToArrival: 2 },
              { stopId: 'C', timeToArrival: 5 },
            ],
          },
        ],
        schedules: [
          {
            name: 'Monday - Friday',
            knownJourneys: [
              { hour: '6', minute: '42', intervalId: 0 },
              { hour: '7', minute: '00', intervalId: 0 },
              { hour: '8', minute: '46', intervalId: 0 },
            ],
          },
        ],
      },
    ],
  },
}

describe('TfL line adapter', () => {
  it('parses service-day clock times including 24:00', () => {
    expect(parseClock('06:45')).toBe(24_300)
    expect(parseClock('24:00')).toBe(86_400)
    expect(() => parseClock('24:01')).toThrow('Invalid clock time')
  })

  it('compiles overlapping weekday journeys into the shared network contract', () => {
    const snapshot = compileTflLineProof({
      routeSequence,
      timetable,
      serviceDate: '2026-09-04',
      retrievedAt: '2026-09-06T00:00:00.000Z',
      routeUrl: 'https://api.tfl.gov.uk/Line/test-line/Route/Sequence/Outbound',
      timetableUrl: 'https://api.tfl.gov.uk/Line/test-line/Timetable/A',
    })

    expect(snapshot.metadata.publisher).toBe('Transport for London')
    expect(snapshot.metadata.model).toContain('not realtime')
    expect(snapshot.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.metadata.geometry.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.stops.map((stop) => stop[2])).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
    expect(snapshot.trains).toHaveLength(2)
    expect(snapshot.trains[0]).toMatchObject({
      category: 'metro',
      start: parseClock('06:42'),
      end: parseClock('06:47'),
      pathSegments: [0, 1],
    })
    expect(snapshot.paths).toHaveLength(2)
    expect(snapshot.edgePaths).toEqual([0, 1])
  })

  it('rejects mismatched topology and timetable sources', () => {
    expect(() =>
      compileTflLineProof({
        routeSequence: { ...routeSequence, lineId: 'wrong-line' },
        timetable,
        serviceDate: '2026-09-04',
        retrievedAt: '2026-09-06T00:00:00.000Z',
        routeUrl: 'route',
        timetableUrl: 'timetable',
      }),
    ).toThrow('line IDs disagree')
  })

  it('keeps bus movements distinct from rail-led metro services', () => {
    const snapshot = compileTflLineProof({
      routeSequence: { ...routeSequence, mode: 'bus' },
      timetable,
      serviceDate: '2026-09-04',
      retrievedAt: '2026-09-06T00:00:00.000Z',
      routeUrl: 'route',
      timetableUrl: 'timetable',
    })

    expect(snapshot.metadata.modes).toEqual(['bus'])
    expect(snapshot.trains.every((train) => train.category === 'bus')).toBe(true)
  })

  it('can place a source-defined after-midnight schedule on its civil day', () => {
    const overnightTimetable = structuredClone(timetable)
    overnightTimetable.timetable.routes[0].schedules[0].knownJourneys = [
      { hour: '24', minute: '20', intervalId: 0 },
    ]
    const snapshot = compileTflLineProof({
      routeSequence: { ...routeSequence, mode: 'bus' },
      timetable: overnightTimetable,
      serviceDate: '2026-09-04',
      windowStart: 0,
      windowEnd: 3_600,
      timeOffsetSeconds: -86_400,
      retrievedAt: '2026-09-06T00:00:00.000Z',
      routeUrl: 'route',
      timetableUrl: 'timetable',
    })

    expect(snapshot.trains).toHaveLength(1)
    expect(snapshot.trains[0].start).toBe(20 * 60)
  })

  it('keeps the committed Bakerloo proof source-audited and renderable', async () => {
    const snapshot = JSON.parse(
      await readFile('fixtures/tfl/all-change-bakerloo-morning.json', 'utf8'),
    )

    expect(snapshot.metadata).toMatchObject({
      publisher: 'Transport for London',
      serviceDate: '2026-09-04',
      windowStart: 24_300,
      windowEnd: 31_500,
      model: 'TfL recurring weekday timetable interpolation / not realtime',
    })
    expect(snapshot.metadata.licenseUrl).toContain('transport-data-service')
    expect(snapshot.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.metadata.geometry.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.metadata.geometry.matchedSegments).toBe(24)
    expect(snapshot.stops).toHaveLength(25)
    expect(snapshot.trains).toHaveLength(39)
    expect(snapshot.trains.every((train) =>
      train.start <= snapshot.metadata.windowEnd &&
      train.end >= snapshot.metadata.windowStart &&
      train.stops.length >= 2 &&
      train.pathSegments.length === train.stops.length - 1
    )).toBe(true)
  })

  it.each([
    ['DLR', 'fixtures/tfl/all-change-dlr-bank-morning.json', 'dlr', 'metro', 51, 24],
    ['Tramlink', 'fixtures/tfl/all-change-tram-beckenham-morning.json', 'tram', 'tram', 17, 27],
    ['Northern', 'fixtures/tfl/all-change-northern-morden-morning.json', 'tube', 'metro', 84, 50],
  ])('keeps the committed %s branch proof renderable', async (_label, path, mode, category, trainCount, stopCount) => {
    const snapshot = JSON.parse(await readFile(path, 'utf8'))

    expect(snapshot.metadata.modes).toEqual([mode])
    expect(snapshot.stops).toHaveLength(stopCount)
    expect(snapshot.trains).toHaveLength(trainCount)
    expect(snapshot.trains.every((train) =>
      train.category === category &&
      train.stops.length >= 2 &&
      train.pathSegments.length === train.stops.length - 1 &&
      train.pathSegments.every((pathIndex) => snapshot.paths[pathIndex])
    )).toBe(true)
  })

  it('retains TfL dwell time while collapsing duplicate interval stops', async () => {
    const snapshot = JSON.parse(
      await readFile('fixtures/tfl/all-change-dlr-bank-morning.json', 'utf8'),
    )
    expect(snapshot.trains.some((train) => train.stops.some(([, arrival, departure]) => departure > arrival))).toBe(true)
  })

  it('keeps the optional surface study mode-specific and renderable', async () => {
    const snapshot = JSON.parse(
      await readFile('fixtures/tfl/all-change-surface-day.json', 'utf8'),
    )

    expect(snapshot.metadata).toMatchObject({
      publisher: 'Transport for London',
      serviceDate: '2026-09-04',
      windowStart: 0,
      windowEnd: 86_400,
      modes: expect.arrayContaining(['river-bus', 'cable-car']),
    })
    expect(snapshot.trains).toHaveLength(492)
    expect(new Set(snapshot.trains.map(({ category }) => category))).toEqual(
      new Set(['ferry', 'cableway']),
    )
    expect(snapshot.stops.some((stop) => stop[2] === 'Canary Wharf')).toBe(true)
    expect(snapshot.stops.some((stop) => stop[2] === 'Royal Docks')).toBe(true)
    expect(
      snapshot.trains.every(
        (train) =>
          train.stops.length >= 2 &&
          train.pathSegments.length === train.stops.length - 1 &&
          train.pathSegments.every((pathIndex) => snapshot.paths[pathIndex]),
      ),
    ).toBe(true)
  })

  it('matches limited-stop journeys as ordered branch subsequences', () => {
    const limitedStopTimetable = structuredClone(timetable)
    limitedStopTimetable.stops.push({ id: 'D', name: 'Delta Underground Station', lon: -0.135, lat: 51.515 })
    limitedStopTimetable.timetable.routes[0].stationIntervals[0].intervals = [
      { stopId: 'D', timeToArrival: 3 },
      { stopId: 'C', timeToArrival: 5 },
    ]
    const branchedRoute = {
      ...routeSequence,
      stations: limitedStopTimetable.stops,
      orderedLineRoutes: [{ naptanIds: ['A', 'B', 'D', 'C'], name: 'Alpha to Charlie' }],
      lineStrings: ['[[[-0.12,51.5],[-0.13,51.51],[-0.135,51.515],[-0.14,51.52]]]'],
    }

    const snapshot = compileTflLineProof({
      routeSequence: branchedRoute,
      timetable: limitedStopTimetable,
      serviceDate: '2026-09-04',
      retrievedAt: '2026-09-06T00:00:00.000Z',
      routeUrl: 'route',
      timetableUrl: 'timetable',
    })

    expect(snapshot.trains).toHaveLength(2)
    expect(snapshot.trains[0].stops).toHaveLength(3)
    expect(snapshot.paths).toHaveLength(2)
  })

  it('matches branch geometry by its stops when TfL line strings use a different order', () => {
    const route = {
      ...routeSequence,
      orderedLineRoutes: [
        { naptanIds: ['A', 'B', 'C'], name: 'Alpha to Charlie' },
        { naptanIds: ['A', 'B'], name: 'Alpha to Bravo' },
      ],
      lineStrings: [
        '[[[-0.12,51.5],[-0.125,51.505],[-0.13,51.51]]]',
        '[[[-0.12,51.5],[-0.13,51.51],[-0.14,51.52]]]',
      ],
    }

    const geometry = linePointsForStops(route, stops, 0)

    expect(geometry.lineStringIndex).toBe(1)
    expect(geometry.reversed).toBe(false)
    expect(geometry.points.at(-1)).toEqual([-0.14, 51.52])
  })

  it('orients a matching line string to the timetable direction', () => {
    const geometry = linePointsForStops(
      { ...routeSequence, lineStrings: ['[[[-0.14,51.52],[-0.13,51.51],[-0.12,51.5]]]'] },
      stops,
    )

    expect(geometry.reversed).toBe(true)
    expect(geometry.points[0]).toEqual([-0.12, 51.5])
  })
})
