import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { hashFile } from './solothurn-timetable.mjs'
const hash = path => createHash('sha256').update(JSON.stringify(path)).digest('hex')
const normalize = path => path.map(p => p.slice(0, 2).map(v => Number(v.toFixed(7))))

export async function loadSolothurnS29Precedence(corridors) {
  const file = 'data/solothurn-s29-precedence-policy.json', policy = JSON.parse(await readFile(file))
  const source = corridors.metadata.s29
  for (const field of ['routeId', 'agencyId', 'line', 'mode', 'sourceLine']) assert.equal(policy[field], source[field])
  assert.equal(policy.sourceSha256, source.sha256)
  assert.equal(policy.contextSha256, await hashFile('data/solothurn-pattern-contexts.json.gz'))
  const review = new Map()
  return { metadata: { policy, policySha256: await hashFile(file) }, review,
    select(route, from, to, original, context) {
      if (route.id !== policy.routeId || route.agencyId !== policy.agencyId || route.name !== policy.line || route.mode !== policy.mode) return original
      const pair = policy.pairs.find(p => p.from[4] === from[4] && p.to[4] === to[4])
      if (!pair) return original
      assert.deepEqual(from, pair.from, 'Changed reviewed S29 platform'); assert.deepEqual(to, pair.to, 'Changed reviewed S29 platform')
      const selected = corridors.match(route, from, to)
      assert(selected.path && selected.sourceFeature === policy.sourceLine, 'Reviewed S29 source no longer supplies this path')
      selected.path = normalize(selected.path)
      const key = JSON.stringify([route.id, from[4], to[4]])
      const row = review.get(key) ?? { key, from, to, selectedSource: selected.geometrySource, selectedPathSha256: hash(selected.path),
        selectedPathMetres: selected.pathMetres, maximumSnapMetres: selected.maximumSnapMetres, contexts: [] }
      assert.equal(row.selectedPathSha256, hash(selected.path), 'Reviewed S29 line differs across complete contexts')
      row.contexts.push({ ...context, previous: { source: original.geometrySource ?? null, reason: original.reason ?? null,
        pathMetres: original.pathMetres ?? null, pathSha256: original.path ? hash(normalize(original.path)) : null },
        selectedPathSha256: hash(selected.path) })
      review.set(key, row)
      return { ...selected, sourcePrecedence: 'reviewed-s29-line-over-context-dependent-fot' }
    } }
}
