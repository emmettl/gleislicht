import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { cloudFramePair, cloudTextureFrame, decodeCloudField, validateCloudManifest, type CloudManifest } from './orbital-clouds.ts'

const manifest: CloudManifest = JSON.parse(readFileSync('public/data/orbital-clouds/manifest.json', 'utf8'))
describe('satellite cloud playback', () => {
  it('interpolates Swiss local hours and clamps the final hour without wrapping to morning', () => {
    expect(cloudFramePair(0)).toEqual([0, 1, 0])
    expect(cloudFramePair(27900)).toEqual([7, 8, 0.75])
    expect(cloudFramePair(84600)).toEqual([23, 24, 0.5])
    expect(cloudFramePair(86400)).toEqual([23, 24, 1])
    expect(cloudFramePair(-1)).toEqual([0, 1, 0])
  })
  it('retains missing coverage as invalid rather than clear sky', () => {
    const field = { manifest: { ...manifest, columns: 2, rows: 2 }, day: manifest.days[0], values: new Uint8Array([0, 50, 100, 255]) }
    expect(Array.from(cloudTextureFrame(field, 0))).toEqual([0, 0, 0, 255, 127, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0])
  })
  it('verifies complete, distinct dated source grids and explicit unavailable coverage', () => {
    expect(validateCloudManifest(manifest)).toBe(manifest)
    const hashes = new Set<string>()
    for (const day of manifest.days.filter(day => day.available)) {
      const bytes = gunzipSync(readFileSync(`public/data/orbital-clouds/${day.file}`))
      expect(bytes.length).toBe(manifest.columns * manifest.rows * 25)
      expect(bytes.every(n => n <= 100 || n === 255)).toBe(true)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(day.sha256)
      expect(new Set(bytes).size).toBeGreaterThan(50)
      hashes.add(day.sha256!)
    }
    expect(hashes.size).toBe(2)
    expect(manifest.days.find(day => day.date === '2026-09-08')?.available).toBe(false)
  })
  it('decodes the distributed gzip and rejects a wrong integrity hash', async () => {
    const day = manifest.days[0]
    const bytes = new Uint8Array(readFileSync(`public/data/orbital-clouds/${day.file}`)).buffer
    const field = await decodeCloudField(bytes, manifest, day)
    expect(field.values.length).toBe(day.decodedBytes)
    await expect(decodeCloudField(bytes, manifest, { ...day, sha256: '0'.repeat(64) })).rejects.toThrow('verification')
  })
  it('accepts cloud data already decompressed by HTTP, retaining integrity checks', async () => {
    for (const day of manifest.days.filter(day => day.available)) {
      const bytes = new Uint8Array(gunzipSync(readFileSync(`public/data/orbital-clouds/${day.file}`))).buffer
      const field = await decodeCloudField(bytes, manifest, day)
      expect(field.values).toEqual(new Uint8Array(bytes))
      const corrupted = bytes.slice(0)
      new Uint8Array(corrupted)[0] ^= 1
      await expect(decodeCloudField(corrupted, manifest, day)).rejects.toThrow('verification')
      await expect(decodeCloudField(bytes.slice(1), manifest, day)).rejects.toThrow('verification')
    }
  })
  it('rejects malformed dimensions and missing end-of-day frames', () => {
    expect(() => validateCloudManifest({ ...manifest, rows: 0 })).toThrow()
    expect(() => validateCloudManifest({ ...manifest, days: [{ ...manifest.days[0], frames: 24 }] })).toThrow()
  })
})
