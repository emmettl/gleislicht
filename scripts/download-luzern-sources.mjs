import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const LUZERN_SERVICE = 'https://public.geo.lu.ch/ogd/rest/services/managed/OEVXXXXX_COL_V5_MP/MapServer'
export const LUZERN_METADATA = 'https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5'
export const LUZERN_TERMS = 'https://geoportal.lu.ch/Nutzungsbedingungen'
export const LUZERN_BOUNDARY = 'https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/3?sr=4326&geometryFormat=geojson'
export const LUZERN_LAYERS = [
  { id: 8, name: 'bus', vintage: '2026-05-26' },
  { id: 253, name: 'rail', vintage: '2026-05-08' },
  { id: 10, name: 'boat', vintage: '2015-08-05' },
  { id: 7, name: 'stops', vintage: '2026-08-06' },
]
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

export function validateLuzernDownload(collection, ids) {
  assert.equal(collection.type, 'FeatureCollection')
  assert(!collection.exceededTransferLimit, 'Truncated Luzern response')
  assert(ids.length > 0 && new Set(ids).size === ids.length, 'Invalid source object IDs')
  const actual = collection.features.map(f => f.properties.OBJECTID)
  assert.deepEqual([...actual].sort((a, b) => a - b), [...ids].sort((a, b) => a - b), 'Missing or duplicate Luzern features')
  for (const f of collection.features) {
    assert(['Point', 'LineString', 'MultiLineString'].includes(f.geometry?.type), 'Invalid Luzern geometry')
    const points = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat()
    assert(points.length && points.every(p => p.length >= 2 && p.every(Number.isFinite) && p[0] > 7 && p[0] < 10 && p[1] > 46 && p[1] < 48), 'Expected WGS84 Luzern coordinates')
  }
}

export async function downloadLuzernSources(output, request = fetch) {
  await mkdir(output, { recursive: true })
  const sources = []
  const save = async (file, url, extra = {}) => {
    const response = await request(url, { signal: AbortSignal.timeout(60_000) })
    assert(response.ok, `HTTP ${response.status}: ${url}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(join(output, file), bytes)
    sources.push({ file, url, retrievedAt: new Date().toISOString(), sha256: sha256(bytes), bytes: bytes.length, ...extra })
    return bytes
  }
  await save('metadata.html', LUZERN_METADATA)
  await save('terms.html', LUZERN_TERMS)
  const boundary = JSON.parse(await save('boundary.json', LUZERN_BOUNDARY, { publisher: 'swisstopo', vintage: null, attribution: '© swisstopo', note: 'API polygon; see feature attributes for source revision. Retrieval is not vintage.' }))
  assert.equal(boundary.feature.id, 3)
  assert.equal(boundary.feature.geometry.type, 'MultiPolygon')
  for (const layer of LUZERN_LAYERS) {
    await save(`${layer.name}-layer.json`, `${LUZERN_SERVICE}/${layer.id}?f=pjson`)
    const idsUrl = `${LUZERN_SERVICE}/${layer.id}/query?where=1%3D1&returnIdsOnly=true&f=json`
    const ids = JSON.parse(await save(`${layer.name}-ids.json`, idsUrl)).objectIds
    assert(Array.isArray(ids) && ids.length)
    // IDs are fetched independently of the transfer limit. Page explicitly.
    const features = []
    for (let i = 0; i < ids.length; i += 500) {
      const page = ids.slice(i, i + 500)
      const url = `${LUZERN_SERVICE}/${layer.id}/query?${new URLSearchParams({ objectIds: page.join(','), outFields: '*', outSR: '4326', returnGeometry: 'true', f: 'geojson' })}`
      const result = JSON.parse(await save(`${layer.name}-page-${i / 500}.geojson`, url, { vintage: layer.vintage, license: 'Open-By', attribution: '© rawi Kanton Luzern; © Verkehrsverbund Luzern', metadataUrl: LUZERN_METADATA, termsUrl: LUZERN_TERMS, sourceCrs: 'EPSG:2056', outputCrs: 'EPSG:4326', features: page.length }))
      validateLuzernDownload(result, page); features.push(...result.features)
    }
    const collection = { type: 'FeatureCollection', features }
    validateLuzernDownload(collection, ids)
    const after = await request(idsUrl, { signal: AbortSignal.timeout(60_000) })
    assert(after.ok)
    assert.deepEqual((await after.json()).objectIds.sort((a, b) => a - b), [...ids].sort((a, b) => a - b), 'Source changed during acquisition')
    const bytes = Buffer.from(JSON.stringify(collection))
    await writeFile(join(output, `${layer.name}.geojson`), bytes)
    sources.push({ file: `${layer.name}.geojson`, derivedFrom: sources.filter(s => s.file.startsWith(`${layer.name}-page-`)).map(s => s.file), sha256: sha256(bytes), bytes: bytes.length, features: ids.length, vintage: layer.vintage })
  }
  const catalogue = { schemaVersion: 1, sources, note: 'Raw pages and metadata retained. Current API snapshots are identified by hashes; metadata vintage must be re-reviewed on refresh. Line geometry has no direction or one-way field.' }
  await writeFile(join(output, 'sources.json'), JSON.stringify(catalogue, null, 2) + '\n')
  return catalogue
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2], 'Usage: node scripts/download-luzern-sources.mjs OUTPUT_DIRECTORY')
  console.log(JSON.stringify(await downloadLuzernSources(resolve(process.argv[2])), null, 2))
}
