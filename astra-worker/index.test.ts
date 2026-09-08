import { describe, expect, it, vi } from 'vitest'
import { archiveScopes, nationalSiteReferences, objectKey, referencesFor, scopesFrom } from './index.ts'
import type { AstraSnapshot } from '../scripts/astra-measured-data.mjs'

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

  it('adds cantonal collection only when configured and keeps its own archive prefix', () => {
    expect(scopesFrom({ RECORDING_SCOPE: 'national' })).toEqual(['national'])
    expect(scopesFrom({ RECORDING_SCOPE: 'national', ADDITIONAL_RECORDING_SCOPE: 'zurich-cantonal' })).toEqual(['national', 'zurich-cantonal'])
    expect(scopesFrom({ RECORDING_SCOPE: 'zurich-cantonal', ADDITIONAL_RECORDING_SCOPE: 'zurich-cantonal' })).toEqual(['zurich-cantonal'])
    expect(referencesFor('zurich-cantonal')).toHaveLength(331)
    expect(objectKey('zurich-cantonal', '2026-09-08T10:00:00.000Z')).toBe('astra/zurich-cantonal/2026-09-08/2026-09-08T10-00-00-000Z.json.gz')
  })

  it('archives federal data even when the additional cantonal supplier is absent', async () => {
    const snapshot: AstraSnapshot = {
      metadata: { publisher: 'FEDRO', publicationTime: '2026-09-08T10:01:20.000Z', receivedAt: '2026-09-08T10:01:24.000Z', measurementKind: 'recorded', sourceUrl: 'https://example.test' },
      measurements: [{ siteId: referencesFor('national')[0].replace('/#', '.01'), measurementTime: '2026-09-08T10:00:00.000Z', lightFlowPerHour: 100, lightSpeedKmh: 50, heavyFlowPerHour: 0 }],
    }
    const put = vi.fn(async () => undefined)
    const bucket = { head: vi.fn(async () => null), put } as unknown as R2Bucket
    await expect(archiveScopes({ OBSERVATIONS: bucket }, snapshot, ['national', 'zurich-cantonal'])).rejects.toThrow('scopes failed')
    expect(put).toHaveBeenCalledOnce()
    expect(put.mock.calls[0][0]).toContain('astra/national/')
  })

  it('splits a combined response into compressed archives and preserves existing minutes', async () => {
    const federalId = referencesFor('national')[0].replace('/#', '.01')
    const cantonalId = referencesFor('zurich-cantonal')[0].replace('/#', '.01')
    const snapshot: AstraSnapshot = {
      metadata: { publisher: 'FEDRO', publicationTime: '2026-09-08T10:01:20.000Z', receivedAt: '2026-09-08T10:01:24.000Z', measurementKind: 'recorded', sourceUrl: 'https://example.test', measurementSiteTableVersion: 23 },
      measurements: [federalId, cantonalId].map((siteId) => ({ siteId, measurementTime: '2026-09-08T10:00:00.000Z', lightFlowPerHour: 100, lightSpeedKmh: 50, heavyFlowPerHour: 0 })),
    }
    const objects = new Map<string, ArrayBuffer>()
    const put = vi.fn(async (key: string, bytes: ArrayBuffer) => { objects.set(key, bytes) })
    const bucket = { head: vi.fn(async (key: string) => objects.has(key) ? {} : null), put } as unknown as R2Bucket
    await archiveScopes({ OBSERVATIONS: bucket }, snapshot, ['national', 'zurich-cantonal'])
    for (const [scope, id] of [['national', federalId], ['zurich-cantonal', cantonalId]] as const) {
      const bytes = objects.get(objectKey(scope, '2026-09-08T10:00:00.000Z'))!
      const decoded = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json()
      expect(decoded.measurements.map(({ siteId }: { siteId: string }) => siteId)).toEqual([id])
      expect(decoded.metadata.recordingScope).toBe(scope)
    }
    await archiveScopes({ OBSERVATIONS: bucket }, snapshot, ['national', 'zurich-cantonal'])
    expect(put).toHaveBeenCalledTimes(2)
  })
})
