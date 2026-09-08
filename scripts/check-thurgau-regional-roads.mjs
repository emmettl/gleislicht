import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { roadPatternId } from './prepare-postbus-road-feed.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export async function checkThurgauRegionalRoads() {
  const bundle = JSON.parse(gunzipSync(await readFile('data/thurgau-regional-roads/cache.json.gz')))
  assert.equal(sha(await readFile(join('data/thurgau-regional-roads', bundle.metadata.reviewNotes.path))), bundle.metadata.reviewNotes.sha256)
  const bytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), timetable = JSON.parse(gunzipSync(bytes))
  const temporary = await mkdtemp(join(tmpdir(), 'thurgau-city-replay-'))
  try {
    for (const file of bundle.metadata.files) {
      const bytes = gunzipSync(await readFile(join('data/thurgau-regional-roads', file.path)))
      assert.equal(sha(bytes), file.sha256); assert.equal(bytes.length, file.bytes)
      const path = join(temporary, file.path.slice(0, -3))
      await mkdir(join(temporary, file.path.split('/')[0]), { recursive: true })
      await writeFile(path, bytes)
    }
    for (const id of ['138', '744', '801', '896']) {
      const directory = join(temporary, id)
      const input = JSON.parse(await readFile(join(directory, 'patterns.json')))
      assert.equal(input.metadata.sourceTimetableSha256, sha(bytes))
      const expected = new Set(timetable.snapshots.flatMap(raw => raw.trains.filter(t => t.agencyId === id && t.route !== 'NT' && !t.reservationRequired && timetable.routes.find(r => r.id === t.routeId).type !== 715).map(t => roadPatternId(t, raw.stops))))
      assert.deepEqual([...expected].sort(), input.patterns.map(p => p.id).sort())
      const imported = await importRoadShapes(directory, bundle.metadata.source)
      assert.equal(imported.metadata.matcher.binarySha256, '6d193a755bc22c45516f8bce7594bb30e07a2632a5ef049a95915b262406cbd8')
      assert.equal(imported.metadata.matcher.configSha256, '31deee35fee9cb6fadc89cc5298e501a95cc4e8d78d7ae7fe6b60932cbf23db4')
      assert.equal(imported.metadata.matcher.osmSha256, 'd5c675456e935cfbcab88fe894fe9145dc5bd1fbd4318cea30ffd838a9aad02b')
      assert.deepEqual(imported, bundle.caches[id], 'Changed cache does not reproduce from original matcher files')
      for (const [key, segments] of Object.entries(imported.patterns)) for (const [i, value] of segments.entries()) {
        assert.equal(value === null, imported.report.issues.some(issue => issue.pattern === key && issue.segment === i))
      }
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
  return bundle
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const bundle = await checkThurgauRegionalRoads()
  console.log(`Replayed ${Object.values(bundle.caches).reduce((n, c) => n + Object.keys(c.patterns).length, 0)} regional road patterns (including audited rejections) from preserved matcher outputs`)
}
