import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { sha256, validateLuzernDownload } from './download-luzern-sources.mjs'

const [input = 'data/luzern-sources', output = 'data/zug-luzern-sources'] = process.argv.slice(2)
const catalogue = JSON.parse(await readFile(join(input, 'sources.json')))
const files = [], bytes = new Map()
await mkdir(output, { recursive: true })
for (const file of ['metadata.html', 'terms.html', 'bus-layer.json', 'bus-ids.json', 'bus-page-0.geojson']) {
  const original = catalogue.sources.find(s => s.file === file); assert(original)
  const content = await readFile(join(input, file))
  assert.equal(sha256(content), original.sha256, `Changed upstream source ${file}`)
  bytes.set(file, content)
  const compressed = file.endsWith('.geojson'), name = compressed ? `${file}.gz` : file, saved = compressed ? gzipSync(content) : content
  await writeFile(join(output, name), saved)
  files.push({ file: name, sha256: sha256(saved), bytes: saved.length, upstream: original })
}
const page = JSON.parse(bytes.get('bus-page-0.geojson')), ids = JSON.parse(bytes.get('bus-ids.json')).objectIds
validateLuzernDownload(page, ids)
const labels = ['A23', 'B073', 'B110', 'B653', 'B973']
const features = labels.map(label => {
  const matches = page.features.filter(f => f.properties.BUL_ROUTE === label)
  assert.equal(matches.length, 1); return matches[0]
})
const selected = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }))
await writeFile(join(output, 'selected.geojson'), selected)
files.push({ file: 'selected.geojson', sha256: sha256(selected), bytes: selected.length, derivedFrom: 'bus-page-0.geojson.gz', labels })
const manifest = { schemaVersion: 1, publisher: 'Kanton Luzern / Verkehrsverbund Luzern', attribution: '© rawi Kanton Luzern; © Verkehrsverbund Luzern',
  vintage: '2026-05-26', timetableYear: 2026, license: 'Open-By', metadataUrl: 'https://daten.geo.lu.ch/produkt/oevxxxxx_col_v5', termsUrl: 'https://geoportal.lu.ch/Nutzungsbedingungen',
  sourceCrs: 'EPSG:2056', outputCrs: 'EPSG:4326', transformation: 'WGS84 GeoJSON as returned by the official ArcGIS service, without simplification or coordinate editing.', files }
await writeFile(join(output, 'sources.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Preserved ${features.length} reviewed candidates and the complete ${ids.length}-feature upstream page`)
