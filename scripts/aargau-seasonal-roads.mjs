import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { hashFile } from './inventory-aargau.mjs'
import { importAargauRoads } from './aargau-road-geometry.mjs'
import { AARGAU_SEASONAL_DATES, readJson, readGzipJson } from './aargau-seasonal.mjs'

export const SEASONAL_ROAD_SOURCE = 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd4; twelve-date compatibility union'
export const SEASONAL_ROAD_DIRECTORY = 'data/aargau-seasonal-roads'
const outputNames = ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']

export async function loadSeasonalRoadBundle(directory = SEASONAL_ROAD_DIRECTORY) {
  const source = await readJson(join(directory, 'source.json'))
  for (const [file, sha256] of Object.entries(source.files)) assert.equal(await hashFile(join(directory, file)), sha256)
  const bundle = await readGzipJson(join(directory, 'cache.json.gz'))
  assert.equal(source.inputInventorySha256, await hashFile('data/aargau-seasonal/input/inventory.json'))
  for (const cache of Object.values(bundle.agencyCaches)) {
    assert.deepEqual(cache.metadata.serviceDates, AARGAU_SEASONAL_DATES)
    assert.equal(cache.metadata.sourceSha256, source.osmSha256)
    assert.equal(cache.metadata.matcher.binarySha256, source.binarySha256)
    assert.equal(cache.metadata.matcher.configSha256, source.configSha256)
    assert.equal(cache.metadata.license, 'ODbL-1.0')
    for (const date of AARGAU_SEASONAL_DATES) assert.equal(cache.metadata.inputTimetableHashes[date], await hashFile(`data/aargau-seasonal/input/${date}-timetable.json.gz`))
  }
  return { bundle, source }
}

export async function packageSeasonalRoads(preparation, matched, output = SEASONAL_ROAD_DIRECTORY) {
  const plan = await readJson(join(preparation, 'preparation.json'))
  const cache = await importAargauRoads(preparation, matched, SEASONAL_ROAD_SOURCE)
  const evidence = { preparation: await readFile(join(preparation, 'preparation.json'), 'utf8'), agencies: {} }
  for (const { agencyId } of plan.agencies) {
    evidence.agencies[agencyId] = {}
    for (const name of outputNames) evidence.agencies[agencyId][name] = await readFile(join(matched, agencyId, name), 'utf8')
  }
  await mkdir(output, { recursive: true })
  await writeFile(join(output, 'cache.json.gz'), gzipSync(JSON.stringify(cache), { level: 9 }))
  await writeFile(join(output, 'matcher-evidence.json.gz'), gzipSync(JSON.stringify(evidence), { level: 9 }))
  const runs = Object.values(cache.agencyCaches).map(c => c.metadata.matcher)
  assert(runs.every(r => r.osmSha256 === runs[0].osmSha256 && r.binarySha256 === runs[0].binarySha256 && r.configSha256 === runs[0].configSha256))
  const source = { schemaVersion: 1, scope: 'Additional exact complete bus patterns for the twelve-date compatibility audit only. Fill prior gaps after the preserved AGIS, base road, Rheinfelden road and rail decisions. Existing September publication hashes and date-scoped exceptions are unchanged.',
    attribution: '© OpenStreetMap contributors; ODbL-1.0', sourceUrl: 'https://www.openstreetmap.org/copyright', sourceDates: { switzerland: '2026-09-02', borderRetrieved: '2026-09-08' },
    osmSha256: runs[0].osmSha256, binarySha256: runs[0].binarySha256, configSha256: runs[0].configSha256,
    inputInventorySha256: await hashFile('data/aargau-seasonal/input/inventory.json'),
    files: Object.fromEntries(await Promise.all(['cache.json.gz', 'matcher-evidence.json.gz'].map(async file => [file, await hashFile(join(output, file))]))),
    agencies: Object.entries(cache.agencyCaches).map(([agencyId, c]) => ({ agencyId, patterns: Object.keys(c.patterns).length, rejectedPatternSegments: c.report.issues.length, maximumSnapMetres: c.report.maxSnapMetres })) }
  await writeFile(join(output, 'source.json'), JSON.stringify(source, null, 2) + '\n')
  await loadSeasonalRoadBundle(output)
  return source
}

export async function checkSeasonalRoads(directory = SEASONAL_ROAD_DIRECTORY) {
  const { bundle, source } = await loadSeasonalRoadBundle(directory)
  const evidence = await readGzipJson(join(directory, 'matcher-evidence.json.gz'))
  const temporary = await mkdtemp(join(tmpdir(), 'aargau-road-replay-'))
  try {
    await writeFile(join(temporary, 'preparation.json'), evidence.preparation)
    for (const [agency, files] of Object.entries(evidence.agencies)) {
      assert(/^[a-z0-9]+$/.test(agency))
      await mkdir(join(temporary, agency))
      assert.deepEqual(Object.keys(files), outputNames)
      for (const [name, bytes] of Object.entries(files)) await writeFile(join(temporary, agency, name), bytes)
    }
    assert.deepEqual(await importAargauRoads(temporary, temporary, SEASONAL_ROAD_SOURCE), bundle)
  } finally { await rm(temporary, { recursive: true, force: true }) }
  console.log(`Verified ${source.agencies.reduce((n, a) => n + a.patterns, 0)} complete patterns across ${source.agencies.length} agencies against archived matcher outputs`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--check')) await checkSeasonalRoads()
  else {
    assert(process.argv[2] && process.argv[3], 'Supply preparation and matched directories')
    console.log(await packageSeasonalRoads(process.argv[2], process.argv[3]))
  }
}
