import { it, expect } from 'vitest'
import { assertGeometryMeasurementsEqual as compare } from './compare-geometry-measurements.mjs'

it('accepts only sub-micrometre drift in derived measurements', () => {
  const value = { id: 'source', reason: null, points: [[8.5, 47.2]], attachmentMetres: 1.060891719160156,
    stationAttachmentsMetres: [7.1525244854507175, null] }
  const drift = structuredClone(value)
  drift.attachmentMetres = 1.0608917191601561
  drift.stationAttachmentsMetres[0] += 1e-10
  expect(() => compare(drift, value)).not.toThrow()
  for (const mutate of [v => { v.attachmentMetres += .000001 }, v => { v.points[0][0] += 1e-10 },
    v => { v.reason = 'rejected' }, v => { v.id = 'other' }, v => { v.attachmentMetres = NaN },
    v => { v.stationAttachmentsMetres.push(0) }]) {
    const changed = structuredClone(value); mutate(changed)
    expect(() => compare(changed, value)).toThrow()
  }
})
