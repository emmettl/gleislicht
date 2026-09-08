import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { importRoadShapes } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const directory = '/private/tmp/graubuenden-road-matched', output = 'data/graubuenden-roads'
const cache = await importRoadShapes(directory, 'Geofabrik Switzerland 2026-09-02 plus OSM border extract 2026-09-08; pfaedle 99f2cd466696ecc6bdb73b2b3bb9008557fcb84a')
await mkdir(output, { recursive: true })
const files = {}
for (const name of ['patterns.json', 'matching.log', 'shapes.txt', 'trips.txt', 'stop_times.txt', 'routing-run.json']) {
  const bytes = await readFile(`${directory}/${name}`)
  await writeFile(`${output}/${name}.gz`, gzipSync(bytes))
  files[name] = sha256(bytes)
}
await writeFile(`${output}/cache.json.gz`, gzipSync(JSON.stringify(cache)))
await writeFile(`${output}/sources.json`, JSON.stringify({ ...cache.metadata, attribution: '© OpenStreetMap contributors',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/', derivedDatabase: '../../graubuenden-region/road-paths.json', files }, null, 2)+'\n')
console.log(JSON.stringify({ patterns: Object.keys(cache.patterns).length, ...cache.report, issues: undefined, routes: undefined }))
