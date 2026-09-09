export interface CloudDay {
  date: string
  available: boolean
  file?: string
  frames?: number
  decodedBytes?: number
  sha256?: string
}
export interface CloudManifest {
  version: number
  columns: number
  rows: number
  bounds: { west: number; east: number; south: number; north: number }
  intervalSeconds: number
  missingValue: number
  days: CloudDay[]
}
export interface CloudField { manifest: CloudManifest; day: CloudDay; values: Uint8Array }

export function validateCloudManifest(manifest: CloudManifest): CloudManifest {
  const { columns, rows, bounds } = manifest
  if (manifest.version !== 1 || !Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2 || columns * rows > 1000000 || manifest.intervalSeconds !== 3600 || manifest.missingValue !== 255 || !bounds || !Object.values(bounds).every(Number.isFinite) || bounds.east <= bounds.west || bounds.north <= bounds.south || !Array.isArray(manifest.days)) throw new Error('Invalid cloud grid')
  for (const day of manifest.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || (day.available && (day.frames !== 25 || day.file !== `${day.date}.bin.gz` || day.decodedBytes !== columns * rows * 25 || !/^[a-f0-9]{64}$/.test(day.sha256 ?? '')))) throw new Error('Invalid cloud day')
  }
  return manifest
}

export async function decodeCloudField(bytes: ArrayBuffer, manifest: CloudManifest, day: CloudDay): Promise<CloudField> {
  validateCloudManifest(manifest)
  if (!day.available) throw new Error('Cloud day unavailable')
  // Fetch decodes Content-Encoding: gzip automatically, whereas some static
  // hosts serve the gzip bytes unchanged. Inspect the payload, not the suffix.
  const prefix = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  const compressed = prefix[0] === 0x1f && prefix[1] === 0x8b
  const buffer = compressed
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : bytes
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), n => n.toString(16).padStart(2, '0')).join('')
  const values = new Uint8Array(buffer)
  if (values.length !== day.decodedBytes || hash !== day.sha256 || values.some(n => n > 100 && n !== 255)) throw new Error('Cloud data failed verification')
  return { manifest, day, values }
}

// Clamp at the day's final observation; never interpolate late evening back to its morning.
export function cloudFramePair(seconds: number): [number, number, number] {
  const hour = Math.min(24, Math.max(0, Number.isFinite(seconds) ? seconds / 3600 : 0))
  const first = Math.min(23, Math.floor(hour))
  return [first, first + 1, hour - first]
}

// Premultiplied coverage and validity keep missing cells from appearing as clear sky.
export function cloudTextureFrame(field: CloudField, frame: number): Uint8Array {
  const cells = field.manifest.columns * field.manifest.rows, pixels = new Uint8Array(cells * 4)
  for (let i = 0; i < cells; i++) {
    const value = field.values[frame * cells + i]
    pixels[i * 4] = value === 255 ? 0 : Math.round(value * 2.55)
    pixels[i * 4 + 3] = value === 255 ? 0 : 255
  }
  return pixels
}
