export interface OrbitalManifest {
  version: number
  journeyCount: number
  categories: string[]
  dates: string[]
  model: string
  active: number[]
  sources: { id: string; file: string; date: string; feedVersion: string }[]
  chunks: OrbitalChunkDescriptor[]
}
export interface OrbitalChunkDescriptor {
  file: string; start: number; end: number; journeys: number
  bytes: number; sha256: string; decodedBytes: number; decodedSha256: string
}
export interface OrbitalJourney { start: number; end: number; category: number; offset: number; count: number; tunnelOffset: number; tunnelCount: number }
export interface OrbitalChunk { data: Float32Array; journeys: OrbitalJourney[]; start: number; end: number }
export const ORBITAL_TRANSPORTS = [
  { id: 'rail', label: 'Rail', color: '#a6f3ea', categories: [0, 1, 2, 3, 4, 5, 12] },
  { id: 'bus', label: 'Bus', color: '#f6c46f', categories: [8] },
  { id: 'tram', label: 'Tram', color: '#de9fdd', categories: [6] },
  { id: 'metro', label: 'Metro', color: '#de9fdd', categories: [7] },
  { id: 'cableway', label: 'Cableway', color: '#b9b0ff', categories: [10] },
  { id: 'funicular', label: 'Funicular', color: '#b9b0ff', categories: [11] },
  { id: 'boat', label: 'Boat', color: '#71a9ff', categories: [9] },
] as const
export function orbitalJourneyOpacity(start: number, end: number, time: number, speed: number): number {
  if (time <= start || time >= end || end <= start) return 0
  const duration = Math.min((end - start) / 2, Math.max(2, Math.abs(speed) * 1.2))
  const progress = Math.min(1, (time - start) / duration, (end - time) / duration)
  return progress * progress * (3 - 2 * progress)
}
async function verifyPayload(bytes: ArrayBuffer, length: number, expectedHash: string) {
  if (bytes.byteLength !== length) throw new Error('The movement block failed its integrity check.')
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== expectedHash) throw new Error('The movement block failed its integrity check.')
}
export async function decodeOrbitalPayload(bytes: ArrayBuffer, descriptor: OrbitalChunkDescriptor): Promise<OrbitalChunk> {
  const prefix = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  // Fetch already decodes Content-Encoding: gzip. Static hosts can also send
  // the gzip file unchanged, so inspect the payload rather than its URL suffix.
  const compressed = prefix[0] === 0x1f && prefix[1] === 0x8b
  if (compressed) await verifyPayload(bytes, descriptor.bytes, descriptor.sha256)
  const data = compressed ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes
  await verifyPayload(data, descriptor.decodedBytes, descriptor.decodedSha256)
  const result = decodeOrbitalChunk(data)
  if (result.start !== descriptor.start || result.end !== descriptor.end || result.journeys.length !== descriptor.journeys) throw new Error('The movement block does not match this day.')
  return result
}
export const ORBITAL_COLORS = ['#fff1dc', '#fff1dc', '#f5c9b0', '#a6f3ea', '#85e3f2', '#77cfdb', '#de9fdd', '#de9fdd', '#f6c46f', '#71a9ff', '#b9b0ff', '#b9b0ff', '#b9b0ff']
export function decodeOrbitalChunk(buffer: ArrayBuffer): OrbitalChunk {
  if (buffer.byteLength < 16 || buffer.byteLength % 4) throw new Error('Invalid orbital movement file')
  const data = new Float32Array(buffer), [version, count, start, end] = data
  const stride = version === 2 ? 7 : 5
  if (![1, 2].includes(version) || !Number.isInteger(count) || count < 0 || 4 + count * stride > data.length || start < 0 || end > 86400 || end <= start) throw new Error('Invalid orbital movement header')
  const journeys: OrbitalJourney[] = []
  for (let i = 0; i < count; i++) {
    const [a, b, category, offset, length] = data.subarray(4 + i * stride, 9 + i * stride)
    if (![a, b, category, offset, length].every(Number.isFinite) || b < a || !Number.isInteger(category) || category < 0 || category >= ORBITAL_COLORS.length || !Number.isInteger(offset) || offset < 4 + count * stride || !Number.isInteger(length) || length < 1 || offset + length * 3 > data.length) throw new Error('Invalid orbital journey')
    const tunnelOffset = version === 2 ? data[9 + i * stride] : 0
    const tunnelCount = version === 2 ? data[10 + i * stride] : 0
    if (!Number.isInteger(tunnelOffset) || !Number.isInteger(tunnelCount) || tunnelCount < 0 || tunnelOffset < 0 || tunnelCount > 0 && tunnelOffset < offset + length * 3 || tunnelOffset + tunnelCount * 2 > data.length) throw new Error('Invalid orbital tunnel table')
    let previousEnd = a
    for (let j = 0; j < tunnelCount; j++) {
      const entry = data[tunnelOffset + j * 2], exit = data[tunnelOffset + j * 2 + 1]
      if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry < previousEnd || exit <= entry || exit > b) throw new Error('Invalid orbital tunnel interval')
      previousEnd = exit
    }
    journeys.push({ start: a, end: b, category, offset, count: length, tunnelOffset, tunnelCount })
  }
  return { data, journeys, start, end }
}
// Writes into caller-owned memory: no per-vehicle or per-trail allocations in a frame.
export function orbitalPosition(data: Float32Array, journey: OrbitalJourney, time: number, out: Float32Array, offset: number): boolean {
  if (time < journey.start || time > journey.end) return false
  let low = 0, high = journey.count - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (data[journey.offset + mid * 3] <= time) low = mid
    else high = mid - 1
  }
  const a = journey.offset + low * 3, b = Math.min(a + 3, journey.offset + (journey.count - 1) * 3)
  const progress = a === b ? 0 : Math.max(0, Math.min(1, (time - data[a]) / Math.max(0.001, data[b] - data[a])))
  out[offset] = data[a + 1] + (data[b + 1] - data[a + 1]) * progress
  out[offset + 1] = 0.055
  out[offset + 2] = data[a + 2] + (data[b + 2] - data[a + 2]) * progress
  return true
}
// Zero throughout a mapped tunnel, with eased approaches and departures on
// the surface. Cap accelerated fades so they cannot swallow a whole valley.
function orbitalNextTunnel(data: Float32Array, journey: OrbitalJourney, time: number): number {
  let low = 0, high = journey.tunnelCount
  while (low < high) {
    const mid = (low + high) >>> 1
    if (data[journey.tunnelOffset + mid * 2 + 1] < time) low = mid + 1
    else high = mid
  }
  return low
}
export function orbitalTunnelOpacity(data: Float32Array, journey: OrbitalJourney, time: number, speed: number): number {
  const duration = Math.max(2, Math.min(60, Math.abs(speed) * 1.2))
  const next = orbitalNextTunnel(data, journey, time)
  let distance = next > 0 ? time - data[journey.tunnelOffset + next * 2 - 1] : Infinity
  if (next < journey.tunnelCount) {
    const entry = data[journey.tunnelOffset + next * 2]
    if (time >= entry) return 0
    distance = Math.min(distance, entry - time)
  }
  const progress = Math.min(1, distance / duration)
  return progress * progress * (3 - 2 * progress)
}
// Split a trail chord at every portal. Sampling only its endpoints can leave
// a glowing bridge across an entire short tunnel. Caller-owned output avoids
// allocations in the animation loop. Returns the number of surface intervals.
export function orbitalSurfaceIntervals(data: Float32Array, journey: OrbitalJourney, start: number, end: number, out: Float64Array): number {
  let cursor = start, count = 0
  for (let i = orbitalNextTunnel(data, journey, start); i < journey.tunnelCount; i++) {
    const entry = data[journey.tunnelOffset + i * 2], exit = data[journey.tunnelOffset + i * 2 + 1]
    if (exit <= cursor) continue
    if (entry >= end) break
    if (entry > cursor) { out[count * 2] = cursor; out[count * 2 + 1] = entry; count++ }
    cursor = Math.max(cursor, exit)
    if (cursor >= end) return count
  }
  if (cursor < end) { out[count * 2] = cursor; out[count * 2 + 1] = end; count++ }
  return count
}
export const orbitalClock = (time: number) => `${String(Math.floor(time / 3600)).padStart(2, '0')}:${String(Math.floor(time % 3600 / 60)).padStart(2, '0')}`
export const orbitalBlock = (time: number) => Math.min(11, Math.floor(Math.max(0, time) / 7200))
