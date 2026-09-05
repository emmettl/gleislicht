import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_SNAPSHOTS = [
  'public/data/swiss-rail-morning.json',
  'public/data/swiss-rail-day-manifest.json',
]
const MAXIMUM_ENDPOINT_DISTANCE_METRES = 2_500

function argumentValues(name) {
  const values = []
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === `--${name}` && process.argv[index + 1]) {
      values.push(process.argv[index + 1])
    }
  }
  return values
}

function normalName(value) {
  return String(value ?? '').normalize('NFC').trim()
}

function pairKey(stops, fromIndex, toIndex) {
  return [normalName(stops[fromIndex]?.[2]), normalName(stops[toIndex]?.[2])]
    .sort((first, second) => first.localeCompare(second, 'de-CH'))
    .join('\u0000')
}

function distanceMetres(first, second) {
  const latitude = ((first[1] + second[1]) / 2) * (Math.PI / 180)
  const x = (first[0] - second[0]) * Math.cos(latitude) * 111_320
  const y = (first[1] - second[1]) * 111_320
  return Math.hypot(x, y)
}

function pathFitsEdge(path, fromStop, toStop) {
  if (!path?.length || !fromStop || !toStop) return false
  const first = path[0]
  const last = path.at(-1)
  const forward = Math.max(distanceMetres(first, fromStop), distanceMetres(last, toStop))
  const reverse = Math.max(distanceMetres(last, fromStop), distanceMetres(first, toStop))
  return Math.min(forward, reverse) <= MAXIMUM_ENDPOINT_DISTANCE_METRES
}

export function backfillEquivalentEdgePaths(snapshot, trains = snapshot.trains ?? []) {
  const votes = new Map()
  const vote = (key, pathIndex) => {
    if (!Number.isInteger(pathIndex) || !snapshot.paths[pathIndex]) return
    const counts = votes.get(key) ?? new Map()
    counts.set(pathIndex, (counts.get(pathIndex) ?? 0) + 1)
    votes.set(key, counts)
  }

  for (const train of trains) {
    for (let index = 1; index < train.stops.length; index += 1) {
      vote(
        pairKey(snapshot.stops, train.stops[index - 1][0], train.stops[index][0]),
        train.pathSegments?.[index - 1],
      )
    }
  }
  snapshot.edges.forEach(([fromIndex, toIndex], edgeIndex) => {
    vote(pairKey(snapshot.stops, fromIndex, toIndex), snapshot.edgePaths[edgeIndex])
  })

  let filled = 0
  const edgePaths = snapshot.edges.map(([fromIndex, toIndex], edgeIndex) => {
    const existing = snapshot.edgePaths[edgeIndex]
    if (existing !== null && existing !== undefined) return existing
    const candidates = votes.get(pairKey(snapshot.stops, fromIndex, toIndex))
    if (!candidates) return null
    const fromStop = snapshot.stops[fromIndex]
    const toStop = snapshot.stops[toIndex]
    const selected = [...candidates]
      .sort((first, second) => second[1] - first[1])
      .find(([pathIndex]) => pathFitsEdge(snapshot.paths[pathIndex], fromStop, toStop))
    if (!selected) return null
    filled += 1
    return selected[0]
  })
  return { edgePaths, filled }
}

async function readTrains(snapshotPath, snapshot) {
  if (Array.isArray(snapshot.trains)) return snapshot.trains
  if (!Array.isArray(snapshot.chunks)) return []
  const chunks = await Promise.all(
    snapshot.chunks.map(({ path }) =>
      readFile(resolve(dirname(snapshotPath), path), 'utf8').then(JSON.parse),
    ),
  )
  return chunks.flatMap((chunk) => chunk.trains ?? [])
}

async function repair(snapshotPath) {
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
  if (!Array.isArray(snapshot.paths) || !Array.isArray(snapshot.edgePaths)) {
    throw new Error(`${snapshotPath} has no enriched rail paths`)
  }
  const trains = await readTrains(snapshotPath, snapshot)
  const result = backfillEquivalentEdgePaths(snapshot, trains)
  if (!result.filled) {
    console.log(`No equivalent edge paths needed in ${snapshotPath}`)
    return
  }
  const temporaryPath = `${snapshotPath}.tmp`
  await writeFile(temporaryPath, JSON.stringify({ ...snapshot, edgePaths: result.edgePaths }))
  await rename(temporaryPath, snapshotPath)
  console.log(`Filled ${result.filled} equivalent edge paths in ${snapshotPath}`)
}

async function main() {
  const requested = argumentValues('snapshot')
  const snapshots = (requested.length ? requested : DEFAULT_SNAPSHOTS).map((path) => resolve(path))
  for (const snapshot of snapshots) await repair(snapshot)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
