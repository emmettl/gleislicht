import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { chunkNetworkSnapshot } from '@motionstudies/data/network-chunks'
import { applyRailGeometry, parseRailNetworkXtf } from './enrich-swiss-rail-geometry.mjs'

const arg = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
for (const name of ['archive', 'zvv', 'tpg', 'rail']) if (!process.argv.includes(`--${name}`)) throw new Error(`Missing --${name}`)
const date = process.argv.includes('--date') ? arg('date') : '2026-09-04'
const workspace = await mkdtemp(join(tmpdir(), 'gleislicht-regional-days-'))
const run = (script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${script} failed`)
}
const railXml = await readFile(arg('rail'), 'utf8')
const rail = parseRailNetworkXtf(railXml, 30)
const railCategories = new Set(['international', 'intercity', 'interregio', 'regional-express', 's-bahn', 'regional', 'other'])
const studies = [
  ['zurich-city', '8.45,47.32,8.63,47.44'],
  ['zvv-region', '8.32,47.15,9.02,47.72'],
  ['geneva-tpg', '5.90,46.05,6.35,46.38'],
]
for (const [id, bounds] of studies) {
  if (process.argv.includes('--study') && arg('study') !== id) continue
  const output = join(workspace, `${id}.json`)
  run('scripts/ingest-gtfs.mjs', ['--archive', arg('archive'), '--date', date, '--modes', 'all', '--bounds', bounds, '--window-start', '00:00', '--window-end', '24:00', '--output', output, '--hub-output', 'none', ...(id === 'geneva-tpg' ? ['--local-agencies', '881'] : ['--local-stop-archive', arg('zvv')])])
  run(id === 'geneva-tpg' ? 'scripts/enrich-geneva-shapes.mjs' : 'scripts/enrich-zurich-shapes.mjs', ['--snapshot', output, ...(id === 'geneva-tpg' ? ['--geometry', arg('tpg')] : ['--archive', arg('zvv')])])
  const snapshot = JSON.parse(await readFile(output, 'utf8'))
  // Keep local-mode geometry and its indices; append rail paths for rail services only.
  const railSnapshot = { ...snapshot, trains: snapshot.trains.filter(train => railCategories.has(train.category)) }
  const railPairs = new Set(railSnapshot.trains.flatMap(train => train.stops.slice(1).map(([to], index) => { const from = train.stops[index][0]; return from < to ? `${from}:${to}` : `${to}:${from}` })))
  const geometry = applyRailGeometry(railSnapshot, rail)
  if (geometry.matchedSegments / geometry.totalSegments < 0.65) throw new Error(`${id}: insufficient rail geometry`)
  const offset = snapshot.paths.length
  const railTrains = new Map(geometry.trains.map(train => [train.id, { ...train, pathSegments: train.pathSegments?.map(index => index === null ? null : index + offset) }]))
  snapshot.trains = snapshot.trains.map(train => railTrains.get(train.id) ?? train)
  snapshot.paths.push(...geometry.paths)
  snapshot.edgePaths = snapshot.edges.map(([a, b], index) => snapshot.edgePaths[index] ?? (!railPairs.has(a < b ? `${a}:${b}` : `${b}:${a}`) || geometry.edgePaths[index] === null ? null : geometry.edgePaths[index] + offset))
  snapshot.metadata.note = 'Scheduled full-day regional transport. Local tram and bus paths use official operator geometry; rail follows matched FOT infrastructure. Unmatched segments retain stop interpolation. Headway services are representative, not exact departures.'
  snapshot.metadata.sourceHashes = Object.fromEntries(await Promise.all(['archive', id === 'geneva-tpg' ? 'tpg' : 'zvv'].map(async name => [name, createHash('sha256').update(await readFile(arg(name))).digest('hex')])))
  snapshot.metadata.railGeometry = { publisher: 'Federal Office of Transport', sourceUrl: 'https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz', sha256: createHash('sha256').update(railXml).digest('hex'), matchedSegments: geometry.matchedSegments, totalSegments: geometry.totalSegments }
  snapshot.trains.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const { manifest, chunks } = chunkNetworkSnapshot(snapshot, 7200, `${id}-day-chunks`)
  for (const { descriptor, payload } of chunks) {
    const path = join('public/data', descriptor.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(payload))
  }
  await writeFile(`public/data/${id}-day-manifest.json`, JSON.stringify(manifest))
  console.log(`${id}: ${snapshot.trains.length} services, ${chunks.length} verified chunks`)
}
