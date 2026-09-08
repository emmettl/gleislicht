import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

async function readCandidate(directory) {
  const bytes = await readFile(join(directory, 'basel-core-day-manifest.json'))
  const manifest = JSON.parse(bytes), trains = new Map()
  for (const chunk of manifest.chunks) {
    const payload = JSON.parse(await readFile(join(directory, chunk.path)))
    for (const train of payload.trains) {
      if (trains.has(train.id)) assert.deepEqual(train, trains.get(train.id), 'Inconsistent chunk copies')
      trains.set(train.id, train)
    }
  }
  assert.equal(trains.size, manifest.tripCount)
  return { manifest, trains, manifestSha256: createHash('sha256').update(bytes).digest('hex') }
}

export async function checkBaselGeometryRegression(beforeDirectory, afterDirectory, { allowReviewedGeometryUpdate = false } = {}) {
  const before = await readCandidate(beforeDirectory), after = await readCandidate(afterDirectory)
  assert.deepEqual(after.manifest.stops, before.manifest.stops, 'Platform identity or coordinates changed')
  assert.deepEqual(after.manifest.edges, before.manifest.edges, 'Timetable edges changed')
  assert.deepEqual([...after.trains.keys()].sort(), [...before.trains.keys()].sort(), 'Source journey set changed')
  for (const [name, hash] of Object.entries(before.manifest.metadata.sourceHashes)) {
    if (name === 'reviewedGeometry' && allowReviewedGeometryUpdate) continue
    assert.equal(after.manifest.metadata.sourceHashes[name], hash, `Original source changed: ${name}`)
  }
  let retained = 0, added = 0, unmatched = 0
  const improvements = {}
  for (const [id, old] of before.trains) {
    const current = after.trains.get(id)
    const { pathSegments: previousPaths, ...previousCalls } = old
    const { pathSegments: currentPaths, ...currentCalls } = current
    assert.deepEqual(currentCalls, previousCalls, `Source calls/times/boundaries changed: ${id}`)
    assert.equal(currentPaths.length, previousPaths.length)
    previousPaths.forEach((path, i) => {
      if (path !== null) {
        assert.notEqual(currentPaths[i], null, `Accepted geometry lost: ${id}`)
        assert.deepEqual(after.manifest.paths[currentPaths[i]], before.manifest.paths[path], `Accepted path changed: ${id}`)
        retained++
      } else if (currentPaths[i] !== null) { added++; improvements[current.route] = (improvements[current.route] ?? 0) + 1 }
      else unmatched++
    })
  }
  return { serviceDate: after.manifest.metadata.serviceDate, trips: after.trains.size, platforms: after.manifest.stops.length,
    beforeManifestSha256: before.manifestSha256, afterManifestSha256: after.manifestSha256,
    ...(allowReviewedGeometryUpdate ? { reviewedGeometryUpdate: {
      beforeSha256: before.manifest.metadata.sourceHashes.reviewedGeometry,
      afterSha256: after.manifest.metadata.sourceHashes.reviewedGeometry,
    } } : {}),
    preservedAcceptedMovements: retained, addedMovements: added, unmatchedMovements: unmatched, improvements,
    sourceCallsTimesAndBoundariesUnchanged: true, passed: true }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
  assert(['before', 'after', 'output'].every(name => process.argv.includes(`--${name}`)), 'Supply --before --after --output')
  const checks = []
  for (const date of ['2026-09-08', '2026-09-13']) checks.push(await checkBaselGeometryRegression(join(arg('before'), date), join(arg('after'), date), {
    allowReviewedGeometryUpdate: process.argv.includes('--allow-reviewed-geometry-update'),
  }))
  await writeFile(arg('output'), `${JSON.stringify({ schemaVersion: 1, checks }, null, 2)}\n`)
  console.log(checks)
}
