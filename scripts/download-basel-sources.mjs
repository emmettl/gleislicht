import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const BASE = 'https://wfs.geo.bs.ch/'
const layers = ['LN_Tramlinie', 'LN_Buslinie']
export function validateBaselDownload(collection, expected) {
  assert.equal(collection.type, 'FeatureCollection')
  assert(Number.isInteger(expected) && expected > 0, 'Invalid WFS feature count')
  assert.equal(collection.features.length, expected, 'Truncated Basel WFS response')
  // This GeoJSON service omits IDs. Reject duplicate complete features rather
  // than mistaking a page repeated by the server for a complete response.
  assert.equal(new Set(collection.features.map(feature => JSON.stringify(feature))).size, expected, 'Duplicate Basel WFS features')
}

export async function downloadBaselSources(output, fetchData = fetch) {
  const request = async url => {
    const response = await fetchData(url, { signal: AbortSignal.timeout(60_000) })
    assert(response.ok, `Basel WFS HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  const downloads = await Promise.all(layers.map(async layer => {
    const params = { SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: `ms:${layer}` }
    const countUrl = `${BASE}?${new URLSearchParams({ ...params, RESULTTYPE: 'hits' })}`
    const count = async () => {
      const xml = (await request(countUrl)).toString('utf8')
      const value = /\bnumberMatched="(\d+)"/.exec(xml)?.[1]
      assert(value, 'Basel WFS did not supply numberMatched')
      return Number(value)
    }
    const expected = await count()
    const url = `${BASE}?${new URLSearchParams({ ...params, COUNT: String(expected + 1), OUTPUTFORMAT: 'geojson', SRSNAME: 'EPSG:4326' })}`
    const bytes = await request(url)
    validateBaselDownload(JSON.parse(bytes), expected)
    assert.equal(await count(), expected, 'Basel feature count changed during download')
    return { bytes, source: { layer, url, countUrl, features: expected, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } }
  }))
  await mkdir(output, { recursive: true })
  for (const download of downloads) await writeFile(join(output, `${download.source.layer}.geojson`), download.bytes)
  const catalogue = { retrievedAt: new Date().toISOString(), validOn: null, note: 'Retrieval time is not a source validity date. Whole-layer counts checked before and after; source GeoJSON omits feature IDs.', sources: downloads.map(download => download.source) }
  await writeFile(join(output, 'sources.json'), `${JSON.stringify(catalogue, null, 2)}\n`)
  return catalogue
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2], 'Usage: node scripts/download-basel-sources.mjs OUTPUT_DIRECTORY')
  console.log(JSON.stringify(await downloadBaselSources(resolve(process.argv[2])), null, 2))
}
