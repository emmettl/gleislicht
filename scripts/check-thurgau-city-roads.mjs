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
export async function checkThurgauCityRoads() {
  const bundle = JSON.parse(gunzipSync(await readFile('data/thurgau-city-roads/cache.json.gz')))
  const bytes = await readFile('data/thurgau-audit/timetable-cache.json.gz'), timetable = JSON.parse(gunzipSync(bytes))
  const temporary = await mkdtemp(join(tmpdir(), 'thurgau-city-replay-'))
  try {
    for (const file of bundle.metadata.files) {
      const bytes = gunzipSync(await readFile(join('data/thurgau-city-roads', file.path)))
      assert.equal(sha(bytes), file.sha256); assert.equal(bytes.length, file.bytes)
      const path = join(temporary, file.path.slice(0, -3))
      await mkdir(join(temporary, file.path.split('/')[0]), { recursive: true })
      await writeFile(path, bytes)
    }
    for (const id of ['727', '797']) {
      const directory = join(temporary, id)
      const input = JSON.parse(await readFile(join(directory, 'patterns.json')))
      assert.equal(input.metadata.sourceTimetableSha256, sha(bytes))
      const expected = new Set(timetable.snapshots.flatMap(raw => raw.trains.filter(t => t.agencyId === id && t.route !== 'NT' && !t.reservationRequired).map(t => roadPatternId(t, raw.stops))))
      assert.deepEqual([...expected].sort(), input.patterns.map(p => p.id).sort())
      const imported = await importRoadShapes(directory, bundle.metadata.source)
      assert.deepEqual(imported, bundle.caches[id], 'Changed cache does not reproduce from original matcher files')
      assert.equal(imported.report.rejectedPatternSegments, 0)
      assert(Object.values(imported.patterns).every(p => p.every(i => i !== null)))
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
  return bundle
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const bundle = await checkThurgauCityRoads()
  console.log(`Replayed ${Object.values(bundle.caches).reduce((n, c) => n + Object.keys(c.patterns).length, 0)} complete city road patterns from preserved matcher outputs`)
}
