import assert from 'node:assert/strict'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export const corridorPairKey = p => JSON.stringify([p.routeId, p.fromId, p.toId])

// A documented common corridor is distinct from a short topology repair. Its
// source graph is used only for individually reviewed failed directed pairs.
export function validatedStGallenSharedCorridors(collections, policy) {
  const configs = policy.sharedCorridors ?? []
  assert.equal(new Set(configs.map(c => c.id)).size, configs.length)
  return configs.map(config => {
    const feature = key => collections.bus?.features.find(f => `bus:${f.id}` === key)
    const target = feature(config.targetFeature), donor = feature(config.donorFeature)
    assert(target && donor && target !== donor, 'Missing or identical corridor sources')
    assert.equal(target.properties.LINIENNAME, config.expectedTargetName, 'Changed corridor target')
    assert.equal(donor.properties.LINIENNAME, config.expectedDonorName, 'Changed corridor donor')
    if (config.jointOperation) {
      const joint = config.jointOperation, override = policy.featureOverrides?.[config.targetFeature]
      assert(joint.targetOperator !== config.operator, 'Redundant joint-operator exception')
      assert.equal(target.properties.BETREIBER, joint.targetOperator, 'Changed joint corridor operator')
      assert.equal(override?.expectedName, config.expectedTargetName, 'Joint corridor requires reviewed target identity')
      assert.equal(override.mode, 'bus')
      assert.deepEqual(override.agencyIds, [config.agencyId])
      assert.deepEqual(override.lines, [config.line])
      assert.deepEqual(joint.reviewedDates, policy.dates, 'Joint corridor dates require review')
      assert(joint.routeId && config.approvedPairs.every(p => p.routeId === joint.routeId), 'Unreviewed joint route')
      assert(config.evidence.some(e => e.sha256 === joint.evidenceSha256 && e.purpose === 'joint-operation'), 'Missing joint-operation evidence')
    } else assert.equal(target.properties.BETREIBER, config.operator, 'Changed corridor operator')
    assert.equal(donor.properties.BETREIBER, config.operator, 'Corridor crosses operators')
    assert(policy.operatorCrosswalk[config.operator]?.bus.includes(config.agencyId))
    assert.equal(target.properties.LINIENNAME.split(' ')[0], config.line)
    assert.equal(donor.properties.LINIENNAME.split(' ')[0], config.donorLine)
    assert(config.evidence.length && config.evidence.every(e => /^[a-f0-9]{64}$/.test(e.sha256)))
    assert(config.stopSequence.length >= 2 && new Set(config.stopSequence).size === config.stopSequence.length)
    const adjacent = new Set(config.stopSequence.slice(1).flatMap((name, i) => [
      JSON.stringify([config.stopSequence[i], name]), JSON.stringify([name, config.stopSequence[i]])]))
    assert(config.approvedPairs.length, 'Empty corridor review')
    const pairs = new Map()
    for (const pair of config.approvedPairs) {
      assert(pair.routeId && pair.fromId && pair.toId && pair.fromId !== pair.toId)
      assert(adjacent.has(JSON.stringify([pair.from, pair.to])), 'Pair outside reviewed shared stop sequence')
      assert(/^[a-f0-9]{64}$/.test(pair.geometrySha256), 'Missing reviewed corridor geometry hash')
      const key = corridorPairKey(pair); assert(!pairs.has(key), 'Duplicate corridor pair'); pairs.set(key, pair)
    }
    return { ...config, pairs, graph: lineGraph([donor]) }
  })
}

export function matchStGallenSharedCorridor(candidate, from, to, limits, context, initial) {
  if (initial.reason !== 'endpoint-gap' || !context) return undefined
  const matches = (candidate.sharedCorridors ?? []).filter(c => c.pairs.has(corridorPairKey(context)))
  assert(matches.length <= 1, 'Ambiguous shared corridor')
  if (!matches.length) return undefined
  const corridor = matches[0], reviewed = corridor.pairs.get(corridorPairKey(context))
  assert.equal(context.from, reviewed.from); assert.equal(context.to, reviewed.to)
  const result = matchBaselSegment(corridor.graph, from, to, limits)
  assert(result.path, 'Reviewed shared-corridor pair no longer matches')
  assert.equal(sha256(JSON.stringify(result.path)), reviewed.geometrySha256, 'Shared-corridor geometry changed')
  return { ...result, sourceFeatures: candidate.sourceFeatures, initialReason: initial.reason,
    sharedCorridorIds: [corridor.id], sharedCorridorSourceFeatures: [corridor.donorFeature] }
}
