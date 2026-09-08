import assert from 'node:assert/strict'
import { lineIndex, matchAargauPattern } from './aargau-line-geometry.mjs'

// Evidence-backed reuse of a specific source part for exact gaps only. The
// whole stop pattern is projected before the allowed adjacent pairs are sliced.
export function aargauGapMatcher(collection, mappings = [], date) {
  const index = lineIndex(collection)
  const rules = mappings.filter(m => m.serviceDates.includes(date)).map(rule => {
    const parts = index.get(rule.sourceKey)?.filter(p => p.featureId === rule.sourceFeatureId)
    assert(parts?.length, `Missing scoped AGIS source ${rule.id}`)
    return { rule, parts, pairs: new Set(rule.directedPairs.map(p => JSON.stringify(p))) }
  })
  return { matchPattern(train, stops) {
    const output = train.calls.slice(1).map(() => undefined)
    for (const { rule, parts, pairs } of rules) {
      if (train.agencyId !== rule.agencyId || train.category !== rule.mode || train.route !== rule.line || !rule.routeIds.includes(train.routeId)) continue
      const { segments, ...source } = matchAargauPattern(parts, stops)
      if (!segments.every(segment => segment.path)) continue
      for (const [i, segment] of segments.entries()) if (segment.path && pairs.has(JSON.stringify([train.calls[i][0], train.calls[i + 1][0]]))) {
        assert(!output[i], 'Ambiguous supplemental AGIS admission')
        output[i] = { ...segment, geometrySource: 'agis', gapMappingId: rule.id, gapSource: source }
      }
    }
    return output
  } }
}
