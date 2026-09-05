import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nationalSiteReferences } from './record-astra-traffic.mjs'

describe('national ASTRA recording scope', () => {
  it('requests each accepted station once and excludes unresolved sites', async () => {
    const path = resolve(
      process.env.TMPDIR ?? '/tmp',
      `gleislicht-road-topology-${process.pid}.json`,
    )
    await writeFile(
      path,
      JSON.stringify({
        sites: [
          { stationId: 'CH:0002', match: { confidence: 'high' } },
          { stationId: 'CH:0002', match: { confidence: 'high' } },
          { stationId: 'CH:0003', match: { confidence: 'continuity' } },
          { stationId: 'CH:0004', match: { confidence: 'review' } },
          { stationId: 'CH:0005', match: { confidence: 'unmatched' } },
        ],
      }),
    )
    await expect(nationalSiteReferences(path)).resolves.toEqual([
      'CH:0002/#',
      'CH:0003/#',
    ])
  })
})
