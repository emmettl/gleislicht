import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parsePdfGridJourneys } from './ingest-tfl-pdf-timetable.mjs'
import { planPdfCoverage } from './compile-tfl-pdf-lattice.mjs'

const stops = [
  { id: 'A', name: 'Alpha Rail Station' },
  { id: 'B', name: 'Bravo Rail Station' },
  { id: 'C', name: 'Charlie Rail Station' },
]

describe('TfL public timetable PDF adapter', () => {
  it('accepts only complete monotonic timetable columns', () => {
    const text = [
      'Example line westbound',
      'Mondays to Fridays',
      'Alpha       0645 0700',
      'Bravo       0650     ',
      'Charlie     0655 0710',
    ].join('\n')
    const journeys = parsePdfGridJourneys({
      text,
      stops,
      originId: 'A',
      destinationId: 'C',
      sectionTitle: 'Example line westbound',
    })

    expect(journeys).toHaveLength(1)
    expect(journeys[0].calls.map(({ stopId, arrival }) => [stopId, arrival])).toEqual([
      ['A', 24_300],
      ['B', 24_600],
      ['C', 24_900],
    ])
  })

  it('accepts an explicitly enabled ordered limited-stop column', () => {
    const text = [
      'Example line westbound',
      'Mondays to Saturdays',
      'Alpha       0645',
      'Bravo           ',
      'Charlie     0655',
    ].join('\n')

    expect(parsePdfGridJourneys({
      text,
      stops,
      originId: 'A',
      destinationId: 'C',
      sectionTitle: 'Example line westbound',
    })).toHaveLength(0)
    expect(parsePdfGridJourneys({
      text,
      stops,
      originId: 'A',
      destinationId: 'C',
      sectionTitle: 'Example line westbound',
      allowSkippedStops: true,
    })[0].calls.map(({ stopId }) => stopId)).toEqual(['A', 'C'])
  })

  it('still rejects a partial column without the requested destination', () => {
    const text = [
      'Example line westbound',
      'Monday to Friday',
      'Alpha       0645',
      'Bravo       0650',
    ].join('\n')
    expect(parsePdfGridJourneys({
      text,
      stops,
      originId: 'A',
      destinationId: 'C',
      sectionTitle: 'Example line westbound',
      allowSkippedStops: true,
    })).toHaveLength(0)
  })

  it('keeps side-by-side timetable grids in their own column bands', () => {
    const text = [
      'Example line westbound                 Example line eastbound',
      'Mondays to Saturdays                   Mondays to Saturdays',
      'Alpha       0645                       Charlie      0647',
      'Bravo       0650                       Bravo        0652',
      'Charlie     0655                       Alpha        0657',
    ].join('\n')
    const westbound = parsePdfGridJourneys({
      text,
      stops,
      originId: 'A',
      destinationId: 'C',
      sectionTitle: 'Example line westbound',
    })
    const eastbound = parsePdfGridJourneys({
      text,
      stops: [...stops].reverse(),
      originId: 'C',
      destinationId: 'A',
      sectionTitle: 'Example line eastbound',
    })

    expect(westbound[0].calls.map(({ arrival }) => arrival)).toEqual([24_300, 24_600, 24_900])
    expect(eastbound[0].calls.map(({ arrival }) => arrival)).toEqual([24_420, 24_720, 25_020])
  })

  it.each([
    ['Elizabeth line', 'fixtures/tfl/all-change-elizabeth-morning.json', 'elizabeth-line', 27, 10],
    ['Elizabeth line eastbound', 'fixtures/tfl/all-change-elizabeth-eastbound-morning.json', 'elizabeth-line', 2, 10],
    ['Lioness', 'fixtures/tfl/all-change-lioness-morning.json', 'overground', 12, 19],
    ['Lioness northbound', 'fixtures/tfl/all-change-lioness-northbound-morning.json', 'overground', 12, 19],
  ])('keeps the committed %s PDF proof complete and source-audited', async (_label, path, mode, trainCount, stopCount) => {
    const snapshot = JSON.parse(await readFile(path, 'utf8'))

    expect(snapshot.metadata.model).toContain('PDF grid extraction')
    expect(snapshot.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.metadata.validFrom).toBe('2026-05-17')
    expect(snapshot.metadata.modes).toEqual([mode])
    expect(snapshot.trains).toHaveLength(trainCount)
    expect(snapshot.stops).toHaveLength(stopCount)
    expect(snapshot.trains.every((train) =>
      train.stops.length === stopCount && train.pathSegments.length === stopCount - 1
    )).toBe(true)
  })

  it('assembles the expanded morning lattice across all five rail-led modes', async () => {
    const snapshot = JSON.parse(
      await readFile('fixtures/tfl/all-change-rail-led-morning.json', 'utf8'),
    )
    expect(new Set(snapshot.metadata.modes)).toEqual(new Set(['tube', 'dlr', 'tram', 'overground', 'elizabeth-line']))
    expect(snapshot.trains).toHaveLength(1_708)
    expect(snapshot.stops).toHaveLength(505)
    expect(snapshot.paths).toHaveLength(1_414)
    expect(snapshot.metadata.note).toContain('all advertised Tube, DLR and Tramlink lines')
    expect(snapshot.metadata.note).toContain('all six named London Overground lines')
    expect(snapshot.metadata.labelHierarchy).toEqual({
      model: 'Stable station-name rank by mode interchange, distinct routes, scheduled calls and graph degree, enriched by advertised topology',
      stationCount: 462,
    })
    expect(snapshot.stops.every((stop) => Number.isInteger(stop[5]))).toBe(true)
    expect(snapshot.stops.find((stop) => stop[2] === 'Whitechapel')?.[5]).toBe(0)
  })

  it('audits every advertised Overground and Elizabeth branch', async () => {
    const catalogue = JSON.parse(await readFile('fixtures/tfl/all-change-rail-led-catalogue.json', 'utf8'))
    const plan = planPdfCoverage(catalogue)
    const snapshot = JSON.parse(await readFile('fixtures/tfl/all-change-pdf-morning.json', 'utf8'))

    expect(plan).toHaveLength(43)
    expect(snapshot.metadata.coverage.advertisedBranchCount).toBe(43)
    expect(snapshot.metadata.coverage.compiledBranchCount).toBe(36)
    expect(snapshot.metadata.coverage.inactiveBranches).toHaveLength(7)
    expect(new Set(snapshot.trains.map(({ route }) => route))).toEqual(new Set([
      'Elizabeth line', 'Liberty', 'Lioness', 'Mildmay', 'Suffragette', 'Weaver', 'Windrush',
    ]))
    expect(snapshot.trains.every(({ stops: calls, pathSegments }) =>
      calls.length >= 2 && pathSegments.length === calls.length - 1)).toBe(true)
  })
})
