import { describe, expect, it } from 'vitest'
import { decodeOrbitalChunk, decodeOrbitalPayload, orbitalBlock, orbitalClock, orbitalPosition, orbitalJourneyOpacity, ORBITAL_TRANSPORTS, orbitalTunnelOpacity, orbitalSurfaceIntervals } from './orbital-data.ts'

function fixture() {
  // One journey with a one-minute dwell, followed by movement to the next stop.
  return new Float32Array([1, 1, 0, 7200, 100, 220, 8, 9, 3, 100, 1, 2, 160, 1, 2, 220, 7, 8])
}
describe('orbital playback', () => {
  it('fades smoothly inside journey endpoints, with a consistent duration at accelerated speeds', () => {
    for (const speed of [30, 60, 180, 600]) {
      const start = 1000, end = 10000, halfway = speed * 0.6
      expect(orbitalJourneyOpacity(start, end, start, speed)).toBe(0)
      expect(orbitalJourneyOpacity(start, end, end, speed)).toBe(0)
      expect(orbitalJourneyOpacity(start, end, start + halfway, speed)).toBeCloseTo(0.5)
      expect(orbitalJourneyOpacity(start, end, end - halfway, speed)).toBeCloseTo(0.5)
      expect(orbitalJourneyOpacity(start, end, start + speed * 1.2, speed)).toBe(1)
    }
    expect(orbitalJourneyOpacity(0, 10, -1, 60)).toBe(0)
    expect(orbitalJourneyOpacity(0, 10, 11, 60)).toBe(0)
    expect(orbitalJourneyOpacity(0, 10, 5, 600)).toBe(1)
    expect(orbitalJourneyOpacity(0, 0, 0, 60)).toBe(0)
    expect(orbitalJourneyOpacity(0, 10, 1, 1)).toBeCloseTo(0.5)
  })
  it('assigns every feed category to exactly one independently selectable transport type', () => {
    const categories = ORBITAL_TRANSPORTS.flatMap(mode => [...mode.categories])
    expect(categories.sort((a, b) => a - b)).toEqual(Array.from({ length: 13 }, (_, i) => i))
  })
  it('accepts both browser-decoded HTTP gzip and unchanged gzip assets without skipping integrity checks', async () => {
    const raw = fixture().buffer
    const compressed = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
    const hash = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
    const descriptor = { file: '00.bin.gz', start: 0, end: 7200, journeys: 1, bytes: compressed.byteLength, sha256: await hash(compressed), decodedBytes: raw.byteLength, decodedSha256: await hash(raw) }
    expect(await decodeOrbitalPayload(compressed, descriptor)).toEqual(await decodeOrbitalPayload(raw, descriptor))
    const corruptRaw = raw.slice(0); new Float32Array(corruptRaw)[10] = 99
    await expect(decodeOrbitalPayload(corruptRaw, descriptor)).rejects.toThrow('integrity')
    const corruptGzip = compressed.slice(0); new Uint8Array(corruptGzip)[10] ^= 1
    await expect(decodeOrbitalPayload(corruptGzip, descriptor)).rejects.toThrow('integrity')
    await expect(decodeOrbitalPayload(raw, { ...descriptor, journeys: 2 })).rejects.toThrow('does not match')
  })
  it('holds at stops, interpolates movement, and excludes inactive services', () => {
    const chunk = decodeOrbitalChunk(fixture().buffer), out = new Float32Array(3)
    const train = chunk.journeys[0]
    expect(orbitalPosition(chunk.data, train, 99, out, 0)).toBe(false)
    expect(orbitalPosition(chunk.data, train, 140, out, 0)).toBe(true)
    expect([out[0], out[2]]).toEqual([1, 2])
    orbitalPosition(chunk.data, train, 190, out, 0)
    expect([out[0], out[2]]).toEqual([4, 5])
    expect(orbitalPosition(chunk.data, train, 220, out, 0)).toBe(true)
    expect([out[0], out[2]]).toEqual([7, 8])
    expect(orbitalPosition(chunk.data, train, 221, out, 0)).toBe(false)
  })
  it('rejects corrupt headers and offsets before allocating render buffers', () => {
    expect(() => decodeOrbitalChunk(new ArrayBuffer(3))).toThrow()
    for (const [index, value] of [[0, 3], [1, 1e9], [6, 50], [7, 99], [8, -1]]) {
      const bytes = fixture(); bytes[index] = value
      expect(() => decodeOrbitalChunk(bytes.buffer)).toThrow()
    }
  })
  it('switches blocks exactly at the boundary and formats the full day', () => {
    expect(orbitalBlock(7199.9)).toBe(0)
    expect(orbitalBlock(7200)).toBe(1)
    expect(orbitalBlock(86399)).toBe(11)
    expect(orbitalClock(27900)).toBe('07:45')
    expect(orbitalClock(86400)).toBe('24:00')
  })
})

describe('underground orbital movement', () => {
  function tunnelFixture() {
    // Two tunnels within the same movement edge, including one a trail sample
    // could jump across entirely. The first crosses a two-hour block edge.
    return new Float32Array([2, 1, 7200, 14400, 7000, 7400, 1, 11, 2, 17, 2, 7000, 0, 0, 7400, 4, 0, 7180, 7220, 7300, 7310])
  }
  it('preserves a service and its position underground, but fades its core and halo to zero', () => {
    const chunk = decodeOrbitalChunk(tunnelFixture().buffer), journey = chunk.journeys[0], out = new Float32Array(3)
    expect(orbitalPosition(chunk.data, journey, 7200, out, 0)).toBe(true)
    for (const t of [7180, 7200, 7220, 7305]) expect(orbitalTunnelOpacity(chunk.data, journey, t, 30)).toBe(0)
    expect(orbitalTunnelOpacity(chunk.data, journey, 7162, 30)).toBeCloseTo(0.5)
    expect(orbitalTunnelOpacity(chunk.data, journey, 7238, 30)).toBeCloseTo(0.5)
    expect(orbitalTunnelOpacity(chunk.data, journey, 7100, 600)).toBe(1)
    const legacy = decodeOrbitalChunk(fixture().buffer)
    expect(orbitalTunnelOpacity(legacy.data, legacy.journeys[0], 190, 60)).toBe(1)
  })
  it('clips every underground part even when both trail endpoints are on the surface', () => {
    const chunk = decodeOrbitalChunk(tunnelFixture().buffer), out = new Float64Array(6), journey = chunk.journeys[0]
    const count = orbitalSurfaceIntervals(chunk.data, journey, 7100, 7350, out)
    expect(count).toBe(3)
    expect([...out]).toEqual([7100, 7180, 7220, 7300, 7310, 7350])
    expect(orbitalSurfaceIntervals(chunk.data, journey, 7190, 7210, out)).toBe(0)
    expect(orbitalSurfaceIntervals(chunk.data, journey, 7180, 7220, out)).toBe(0)
    expect(orbitalSurfaceIntervals(chunk.data, journey, 7200, 7250, out)).toBe(1)
    expect([...out.slice(0, 2)]).toEqual([7220, 7250])
  })
  it('rejects invalid tunnel counts, offsets and unordered or out-of-journey ranges', () => {
    for (const [index, value] of [[9, 16], [9, 999], [10, -1], [10, 3], [17, 6999], [18, 7179], [19, 7200], [20, 7401]]) {
      const bytes = tunnelFixture(); bytes[index] = value
      expect(() => decodeOrbitalChunk(bytes.buffer)).toThrow('tunnel')
    }
  })
})
