import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { hashFile } from './inventory-aargau.mjs'
import { aargauRoadMatcher } from './aargau-road-geometry.mjs'

export const geometryDigest = path => createHash('sha256').update(JSON.stringify(path)).digest('hex')

export function aargauAlignmentCorrections(policy, roads, date) {
  assert.equal(policy.schemaVersion, 1)
  return { policy, overrideSegment(train, stops, index, segment) {
    const rule = policy.rules.find(r => r.date === date && r.agencyId === train.agencyId && r.routeId === train.routeId && r.line === train.route &&
      r.mode === train.category && r.directionId === train.directionId && r.segmentIndex === index && JSON.stringify(r.stops) === JSON.stringify(stops))
    if (!rule) return segment
    assert.equal(segment.geometrySource, 'agis', 'Reviewed correction must replace the pinned AGIS segment')
    assert.equal(geometryDigest(segment.path), rule.originalPathSha256, 'AGIS path changed: review the correction again')
    const replacement = roads.matchPattern({ ...train, stops: stops.map((_, i) => [i, 0, 0]) }, stops)?.[index]
    assert(replacement?.path, 'Reviewed correction has no accepted complete-pattern road path')
    assert.equal(geometryDigest(replacement.path), rule.replacementPathSha256)
    return { ...replacement, alignmentCorrectionId: rule.id, agisRejection: 'reviewed-unserved-branch',
      supersededGeometry: { geometrySource: 'agis', pathSha256: rule.originalPathSha256, pathMetres: segment.pathMetres, featureId: rule.sourceFeatureId, part: rule.sourcePart } }
  } }
}

export async function loadAargauAlignmentCorrections(path, date) {
  const policy = JSON.parse(await readFile(path, 'utf8'))
  for (const [file, sha256] of Object.entries(policy.files)) assert.equal(await hashFile(file), sha256, `Changed alignment evidence: ${file}`)
  const cache = JSON.parse(await readFile('data/aargau-road-cache.json', 'utf8'))
  return aargauAlignmentCorrections(policy, aargauRoadMatcher(cache), date)
}
