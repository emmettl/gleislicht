import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { sha256, validateLuzernDownload } from './download-luzern-sources.mjs'
import { matchZugPair, zugRouteKey } from './zug-line-geometry.mjs'

export function zugSupplementGraphs(collection, layer, policy) {
  const graphs = new Map(), inventory = [], domain = new Map(layer.fields.find(f => f.name === 'TU').domain.codedValues.map(v => [v.code, v.name]))
  assert.equal(collection.type, 'FeatureCollection')
  assert.equal(collection.features.length, policy.lines.length)
  for (const entry of policy.lines) {
    assert.equal(domain.get(entry.tu), entry.operator, 'Changed Luzern operator enumeration')
    const features = collection.features.filter(f => f.properties.BUL_ROUTE === entry.feature)
    assert.equal(features.length, 1, 'Missing or duplicate supplemental identity')
    const f = features[0], p = f.properties
    assert.equal(p.FP_JAHR, 2026, 'Unreviewed supplemental timetable year')
    assert.equal(p.TU, entry.tu, 'Wrong supplemental operator')
    assert.equal(p.LINIENNR.replace(/^Linie /, ''), entry.line, 'Wrong supplemental line')
    const key = zugRouteKey({ agencyId: entry.agencyId, mode: 'bus', line: entry.line })
    assert(!graphs.has(key), 'Duplicate supplemental route identity')
    const sourceKey = `luzern-bus:${entry.feature}`
    graphs.set(key, { graph: lineGraph(features), sourceFeatures: [sourceKey] })
    inventory.push({ ...entry, key: sourceKey, properties: p })
  }
  return { graphs, inventory }
}

export async function loadZugBusSupplement(config) {
  const bytes = await readFile(join(config.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), config.sourceSha256, 'Changed supplemental source catalogue')
  const source = JSON.parse(bytes), content = new Map()
  for (const item of source.files) {
    const value = await readFile(join(config.sourceDirectory, item.file))
    assert.equal(sha256(value), item.sha256, `Changed supplemental source ${item.file}`)
    const decoded = item.file.endsWith('.gz') ? gunzipSync(value) : value
    if (item.upstream) assert.equal(sha256(decoded), item.upstream.sha256)
    content.set(item.file, decoded)
  }
  const page = JSON.parse(content.get('bus-page-0.geojson.gz')), ids = JSON.parse(content.get('bus-ids.json')).objectIds
  validateLuzernDownload(page, ids)
  const selected = JSON.parse(content.get('selected.geojson'))
  for (const f of selected.features) assert.deepEqual(f, page.features.find(original => original.properties.OBJECTID === f.properties.OBJECTID), 'Edited supplemental geometry')
  return { ...zugSupplementGraphs(selected, JSON.parse(content.get('bus-layer.json')), config), source }
}

export function matchZugBusPair(primary, supplement, from, to, limits) {
  const original = matchZugPair(primary, from, to, limits)
  if (original.path || !supplement) return { ...original, geometrySource: 'zug' }
  // An alternative supplies the entire adjacent-call path. Graphs are never
  // spliced or joined between stops, and failed alternatives remain evidence.
  return { ...matchBaselSegment(supplement.graph, from, to, limits), geometrySource: 'luzern', sourceFeatures: supplement.sourceFeatures, primaryFailure: original }
}
