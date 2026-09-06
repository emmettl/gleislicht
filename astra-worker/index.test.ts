import { describe, expect, it } from 'vitest'
import { nationalSiteReferences, objectKey } from './index.ts'

describe('ASTRA scheduled recorder', () => {
  it('derives unique accepted national station filters', () => {
    expect(
      nationalSiteReferences({
        sites: [
          { stationId: 'CH:0002', match: { confidence: 'high' } },
          { stationId: 'CH:0002', match: { confidence: 'high' } },
          { stationId: 'CH:0003', match: { confidence: 'continuity' } },
          { stationId: 'CH:0004', match: { confidence: 'unmatched' } },
        ],
      }),
    ).toEqual(['CH:0002/#', 'CH:0003/#'])
  })

  it('uses an append-only date-partitioned object key', () => {
    expect(objectKey('a1-zurich', '2026-09-06T21:04:00.000Z')).toBe(
      'astra/a1-zurich/2026-09-06/2026-09-06T21-04-00-000Z.json.gz',
    )
  })
})
