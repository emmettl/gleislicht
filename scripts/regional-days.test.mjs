import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
for (const id of ['zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region']) describe(`${id} full day`, () => {
  const manifest = JSON.parse(readFileSync(`public/data/${id}-day-manifest.json`))
  it('has a complete day of integrity-checked chunks and valid geometry indices', () => {
    expect(manifest.metadata.windowStart).toBe(0)
    expect(manifest.metadata.windowEnd).toBe(86400)
    expect(manifest.metadata.railGeometry.matchedSegments / manifest.metadata.railGeometry.totalSegments).toBeGreaterThan(.65)
    let end = 0
    for (const descriptor of manifest.chunks) {
      expect(descriptor.windowStart).toBe(end)
      end = descriptor.windowEnd
      const bytes = readFileSync(`public/data/${descriptor.path}`)
      expect(bytes.length).toBe(descriptor.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(descriptor.sha256)
      expect(gzipSync(bytes).length).toBeLessThan(450 * 1024)
      const chunk = JSON.parse(bytes)
      for (const train of chunk.trains) for (const index of train.pathSegments ?? []) if (index !== null) expect(index >= 0 && index < manifest.paths.length).toBe(true)
    }
    expect(end).toBe(86400)
    expect(gzipSync(JSON.stringify(manifest)).length).toBeLessThan(650 * 1024)
  })
})
