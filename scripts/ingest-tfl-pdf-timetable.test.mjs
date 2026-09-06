import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parsePdfGridJourneys } from './ingest-tfl-pdf-timetable.mjs'

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
    expect(snapshot.metadata.modes).toEqual(['tube', 'dlr', 'tram', 'overground', 'elizabeth-line'])
    expect(snapshot.trains).toHaveLength(1_475)
    expect(snapshot.stops).toHaveLength(385)
    expect(snapshot.paths).toHaveLength(1_073)
    expect(snapshot.metadata.note).toContain('All advertised Tube, DLR and Tramlink lines in both directions')
    expect(snapshot.metadata.note).toContain('remaining five London Overground lines')
  })
})
