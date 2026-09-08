import { expect, it } from 'vitest'
import { combineLausanneBusPatterns } from './prepare-lausanne-road-feed.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

it('merges platform indices and keeps routing pattern identity while normalizing overnight times', () => {
  const stops = [[6.6, 46.5, 'A', '', 'a'], [6.7, 46.6, 'B', '', 'b']]
  const metadata = { localAgencyIds: ['151'], dayModel: 'civil day with preceding service-day spillover', serviceDate: '2026-09-08', sourceServiceDates: ['2026-09-07', '2026-09-08'] }
  const train = { id: 'night', routeId: 'route', category: 'bus', stops: [[0, -300, -300], [1, 600, 600]] }
  const result = combineLausanneBusPatterns([{ metadata, stops, trains: [train] }, { metadata: { ...metadata, serviceDate: '2026-09-13', sourceServiceDates: ['2026-09-12', '2026-09-13'] }, stops: [...stops].reverse(), trains: [{ ...train, stops: [[1, 300, 300], [0, 1200, 1200]] }] }])
  expect(result.manifest.stops).toEqual(stops)
  expect(result.manifest.metadata.serviceDates).toEqual(['2026-09-08', '2026-09-13'])
  expect(result.trains[0].stops).toEqual([[0, 86100, 86100], [1, 87000, 87000]])
  expect(result.trains[1].stops).toEqual([[0, 300, 300], [1, 1200, 1200]])
  expect(new Set(result.trains.map(t => t.id)).size).toBe(2)
  expect(result.trains.map(t => roadPatternId(t, result.manifest.stops))).toEqual([roadPatternId(train, stops), roadPatternId(train, stops)])
  expect(train.stops[0][1]).toBe(-300)
  expect(() => combineLausanneBusPatterns([{ metadata: { ...metadata, localAgencyIds: ['801'] }, stops, trains: [train] }])).toThrow('tl-only')
})
