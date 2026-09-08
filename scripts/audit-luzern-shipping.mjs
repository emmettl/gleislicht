import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { cablewayCoordinate } from './luzern-cableway-geometry.mjs'
import { inCanton } from './luzern-timetable.mjs'

const directory = 'data/luzern-shipping-sources'
const json = async p => JSON.parse(await readFile(p, 'utf8'))

// The complete, small national shipping class is retained, not a spatial crop.
// Preserve original DBF strings and PolylineZ vertices for source review only.
export function parseShippingMembers(dbf, shp, shx) {
  const count = dbf.readUInt32LE(4), header = dbf.readUInt16LE(8), size = dbf.readUInt16LE(10), fields = []
  for (let offset = 32; dbf[offset] !== 13; offset += 32) {
    assert(offset + 32 < header)
    fields.push([dbf.subarray(offset, offset + 11).toString().replace(/\0.*$/, ''), dbf[offset + 16]])
  }
  assert.equal(size, 1 + fields.reduce((n, [, bytes]) => n + bytes, 0))
  assert(dbf.length >= header + size * count)
  for (const b of [shp, shx]) { assert.equal(b.readInt32BE(0), 9994); assert.equal(b.readInt32BE(24) * 2, b.length); assert.equal(b.readInt32LE(32), 13) }
  assert.equal(shx.length, 100 + count * 8)
  const features = []
  let offset = 100
  for (let i = 0; i < count; i++) {
    const attributes = {}, row = dbf.subarray(header + i * size, header + (i + 1) * size)
    assert.equal(row[0], 32, 'Deleted shipping record')
    let fieldOffset = 1
    for (const [name, bytes] of fields) { attributes[name] = row.subarray(fieldOffset, fieldOffset + bytes).toString('utf8').trim(); fieldOffset += bytes }
    assert.equal(shx.readInt32BE(100 + i * 8) * 2, offset)
    assert.equal(shp.readInt32BE(offset), i + 1)
    const bytes = shp.readInt32BE(offset + 4) * 2
    assert.equal(shx.readInt32BE(104 + i * 8) * 2, bytes)
    const record = shp.subarray(offset + 8, offset + 8 + bytes)
    assert.equal(record.readInt32LE(0), 13, 'Unexpected shipping shape type')
    const parts = record.readInt32LE(36), points = record.readInt32LE(40), xyOffset = 44 + parts * 4, zOffset = xyOffset + points * 16 + 16
    assert(parts > 0 && points >= 2 && zOffset + points * 8 <= record.length)
    const starts = Array.from({ length: parts }, (_, j) => record.readInt32LE(44 + j * 4)).concat(points)
    assert.equal(starts[0], 0)
    const coordinates = Array.from({ length: points }, (_, j) => [record.readDoubleLE(xyOffset + j * 16), record.readDoubleLE(xyOffset + j * 16 + 8), record.readDoubleLE(zOffset + j * 8)])
    assert(coordinates.flat().every(Number.isFinite))
    const paths = starts.slice(1).map((end, j) => { assert(end - starts[j] >= 2); return coordinates.slice(starts[j], end) })
    features.push({ id: attributes.UUID, attributes, paths })
    offset += bytes + 8
  }
  assert.equal(offset, shp.length)
  assert.equal(new Set(features.map(f => f.id)).size, count)
  return features
}

export async function auditLuzernShipping() {
  const source = await json(`${directory}/source.json`)
  for (const [file, hash] of Object.entries(source.sha256)) assert.equal(sha256(await readFile(`${directory}/${file}`)), hash, `Changed shipping source ${file}`)
  const name = 'swissTLM3D_TLM_SCHIFFFAHRT'
  const features = parseShippingMembers(...await Promise.all(['dbf', 'shp', 'shx'].map(ext => readFile(`${directory}/${name}.${ext}`))))
  const boundary = (await json('data/luzern-sources/boundary.json')).feature.geometry
  const rows = features.map(f => {
    const endpoints = f.paths.flatMap(p => [p[0], p.at(-1)]).map(p => cablewayCoordinate(p[0], p[1]))
    return { ...f, endpointsWgs84: endpoints, endpointInCanton: endpoints.map(p => inCanton(p, boundary)), admitted: false }
  })
  assert.equal(rows.length, 27)
  assert.deepEqual([...new Set(rows.map(r => r.attributes.OBJEKTART))].sort(), ['Autofaehre', 'Personenfaehre'])
  const scoped = rows.filter(r => r.endpointInCanton.some(Boolean))
  assert.deepEqual(scoped.map(r => r.attributes.NAME), ['Rotsee'])
  const suspensionBytes = gunzipSync(await readFile(`${directory}/rotsee-status.html.gz`))
  assert.equal(sha256(suspensionBytes), source.operatorNoticeUncompressedSha256)
  const suspension = suspensionBytes.toString('utf8')
  assert(suspension.replaceAll('&auml;', 'ä').includes('Ab 1.4.2025 ist der Fährbetrieb eingestellt.'))
  return { source, classCount: rows.length, selection: 'At least one source alignment endpoint in the full Luzern canton polygon; approximate LV95 to WGS84 transformation for inventory only',
    rows, sourceOnlyExclusions: scoped.map(r => ({ sourceId: r.id, name: r.attributes.NAME, reason: 'owner-reports-suspended-since-2025-04-01; no-reviewed-timetable-binding',
      geometryModified: r.attributes.DATUM_AEND, geometryRevisionYear: r.attributes.REVISION_J, operatorNoticeUrl: source.operatorNoticeUrl, admitted: false })),
    conclusion: 'The national class contains ferry crossings, not a route-bound SGV or Hallwilersee course network. Beckenried–Gersau is a separate car ferry. No source feature is substituted for the eight annual lake-service routes.',
    scopeLimit: 'This inventory does not infer a departure schedule from topographic geometry, enumerate all services absent from GTFS, or establish an exact cadastral boundary test.' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await auditLuzernShipping(), output = 'data/luzern-shipping-probe.json'
  if (process.argv.includes('--check')) assert.deepEqual(await json(output), result)
  else await writeFile(output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, sourceFeatures: result.classCount, sourceOnlyExclusions: result.sourceOnlyExclusions }, null, 2))
}
