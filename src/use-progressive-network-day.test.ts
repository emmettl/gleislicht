import { describe, expect, it } from 'vitest'
import type { NetworkDayChunkDescriptor } from './domain/network.ts'
import { verifiedNetworkDayChunk } from './use-progressive-network-day.ts'

const body = JSON.stringify({ trains: [] })
const descriptor: NetworkDayChunkDescriptor = {
  id: '06-08',
  windowStart: 21_600,
  windowEnd: 28_800,
  path: 'day/06-08.json',
  tripCount: 0,
  bytes: 13,
  sha256: 'a00ca4e9cd6706b6e63790ca9bc3eb094c20381a4c16af1caab155e0ba26ad43',
}

describe('verified network day loading', () => {
  it('adopts a chunk only after its size and digest match', async () => {
    await expect(
      verifiedNetworkDayChunk(new Response(body), descriptor),
    ).resolves.toEqual({ trains: [] })
  })

  it('rejects a truncated chunk', async () => {
    await expect(
      verifiedNetworkDayChunk(new Response('{}'), descriptor),
    ).rejects.toThrow('unexpected size')
  })

  it('rejects content with a stale digest', async () => {
    await expect(
      verifiedNetworkDayChunk(new Response(body), {
        ...descriptor,
        sha256: '0'.repeat(64),
      }),
    ).rejects.toThrow('failed its integrity check')
  })
})
