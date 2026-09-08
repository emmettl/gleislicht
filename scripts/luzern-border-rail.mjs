import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { luzernRailInputs, luzernRailConsensus, luzernOperatingPoint } from './luzern-rail-geometry.mjs'
import { zugSbbRailSupplement, sbbSegmentKey } from './zug-sbb-rail-supplement.mjs'

export function luzernBorderMatcher(page, policy) {
  const source = zugSbbRailSupplement([page], policy)
  for (const c of policy.corridors) {
    const first = page.results.find(r => sbbSegmentKey(r) === JSON.stringify(c.features[0]))
    const last = page.results.find(r => sbbSegmentKey(r) === JSON.stringify(c.features.at(-1)))
    assert.deepEqual([first.bp_anf_bez, last.bp_end_bez], c.sourcePointNames, 'Changed SBB station-name crosswalk')
  }
  const allowed = new Set(policy.pairs.map(p => JSON.stringify([p.routeId, p.fromId, p.toId])))
  return { inventory: source.inventory.map(r => ({ ...r, exclusion: r.usedBy.length ? null : r.vertices <= 2 ? 'schematic-two-point-record' : 'outside-reviewed-konstanz-corridor' })),
    match(train, stops, route) {
      const identity = policy.routes.find(r => r.routeId === train.routeId)
      assert(identity && identity.agencyId === route.agencyId && identity.line === route.line, 'Unreviewed border route identity')
      return train.calls.slice(1).map((call, i) => {
        const key = JSON.stringify([train.routeId, train.calls[i].id, call.id])
        if (!allowed.has(key)) return { reason: 'border-unreviewed-pair' }
        const k = train.calls[i].id === '8014586' ? i : i + 1
        if (k !== 0 && k !== train.calls.length - 1) return { reason: 'border-unreviewed-interior-call' }
        const a = stops.get(train.calls[i].id), b = stops.get(call.id)
        const c = policy.corridors.find(c => c.operatingPointIds.includes(luzernOperatingPoint(a)) && c.operatingPointIds.includes(luzernOperatingPoint(b)))
        assert(c, 'Missing exact border station crosswalk')
        for (const s of [a, b]) assert.equal(s.stop_name, c.sourcePointNames[c.operatingPointIds.indexOf(luzernOperatingPoint(s))], 'Changed GTFS station-name crosswalk')
        const r = source.matchPair({ reason: 'border-primary-sources-incomplete' }, route, { ...a, didok: luzernOperatingPoint(a) }, { ...b, didok: luzernOperatingPoint(b) })
        if (!r.path) return r
        const forward = luzernOperatingPoint(a) === c.operatingPointIds[0]
        const features = forward ? c.features : [...c.features].reverse()
        return { ...r, geometrySource: 'sbb-border-rail-inference', gauge: 'mm1435',
          directedSourceSegments: features.map(f => ({ id: `sbb:${JSON.stringify(f)}`, from: f[forward ? 1 : 2], to: f[forward ? 2 : 1] })) }
      })
    } }
}

export function luzernBorderConsensus(inputs, matcher, policy) {
  const all = luzernRailConsensus(inputs, matcher, policy), pairs = new Map()
  for (const review of policy.pairs) {
    const key = JSON.stringify([review.routeId, review.fromId, review.toId]), r = all.pairs.get(key)
    assert(r?.path, 'Missing or rejected border pair consensus')
    assert.equal(sha256(JSON.stringify(r.path)), review.geometrySha256, 'Changed reviewed border path')
    assert.equal(sha256(JSON.stringify(r.directedSourceSegments)), review.segmentsSha256, 'Changed directed border source edges')
    assert(!pairs.has(key), 'Duplicate border review')
    pairs.set(key, r)
  }
  return { pairs, patterns: all.patterns }
}

export async function loadLuzernBorderRail(config, raw) {
  const bytes = await readFile(config.policyPath), policy = JSON.parse(bytes)
  assert.equal(sha256(bytes), config.sha256, 'Changed border policy')
  const sourceBytes = await readFile(join(policy.sourceDirectory, 'source.json')), source = JSON.parse(sourceBytes)
  assert.equal(sha256(sourceBytes), policy.sourceSha256)
  for (const { file, sha256: hash, uncompressedSha256 } of source.files) {
    const bytes = await readFile(join(policy.sourceDirectory, file))
    assert.equal(sha256(bytes), hash, `Changed border source ${file}`)
    if (uncompressedSha256) assert.equal(sha256(gunzipSync(bytes)), uncompressedSha256)
  }
  const metadata = JSON.parse(await readFile(join(policy.sourceDirectory, 'metadata.json'))).metas
  assert.equal(metadata.dcat_ap_ch.license, source.license); assert.equal(metadata.dcat_ap_ch.rights, source.rights)
  assert.equal(metadata.default.modified, source.modified); assert.equal(metadata.default.data_processed, source.dataProcessed)
  assert.equal(metadata.default.metadata_processed, source.metadataProcessed)
  const inputBytes = await readFile(policy.inputs), inputs = JSON.parse(inputBytes)
  assert.equal(sha256(inputBytes), policy.inputsSha256)
  if (raw) assert.deepEqual(inputs, luzernRailInputs(raw, policy), 'Border review must cover every complete fixture pattern and original stop')
  const matcher = luzernBorderMatcher(JSON.parse(await readFile(join(policy.sourceDirectory, 'foreign-review.json'))), policy)
  return { policy, source, inputs, inventory: matcher.inventory, ...luzernBorderConsensus(inputs, matcher, policy) }
}
