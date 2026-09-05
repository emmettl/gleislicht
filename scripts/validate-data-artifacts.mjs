import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DATA_DIRECTORY = resolve('public/data')

async function readJson(path) {
  return JSON.parse(await readFile(resolve(DATA_DIRECTORY, path), 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const morning = await readJson('swiss-rail-morning.json')
const hubs = await readJson('swiss-hub-day.json')
const day = await readJson('swiss-rail-day-manifest.json')

const artifacts = [morning, hubs, day]
const serviceDates = new Set(artifacts.map((artifact) => artifact.metadata?.serviceDate))
const feedVersions = new Set(artifacts.map((artifact) => artifact.metadata?.feedVersion))

assert(serviceDates.size === 1 && !serviceDates.has(undefined), 'National artifacts disagree on service date')
assert(feedVersions.size === 1 && !feedVersions.has(undefined), 'National artifacts disagree on feed version')
assert(Array.isArray(morning.trains) && morning.trains.length > 1_000, 'Morning study has too few trains')
assert(Array.isArray(morning.stops) && morning.stops.length > 500, 'Morning study has too few stops')
assert(Array.isArray(morning.edges) && morning.edges.length > 500, 'Morning study has too few edges')
assert(day.tripCount > 10_000, 'Full-day study has too few trips')
assert(Array.isArray(day.chunks) && day.chunks.length >= 8, 'Full-day study is missing time chunks')

for (const [name, artifact] of [['morning', morning], ['full-day', day]]) {
  const geometry = artifact.metadata?.geometry
  assert(Array.isArray(artifact.paths) && artifact.paths.length > 1_000, `${name} study has too few rail paths`)
  assert(Array.isArray(artifact.edgePaths), `${name} study has no edge-path index`)
  assert(geometry?.publisher === 'Federal Office of Transport (FOT)', `${name} study has no FOT geometry provenance`)
  assert(
    geometry.matchedSegments / geometry.totalSegments >= 0.65,
    `${name} study has insufficient rail geometry coverage`,
  )
  for (const destination of ['Bern', 'Basel SBB']) {
    const corridorEdges = artifact.edges
      .map((edge, edgeIndex) => ({ edge, edgeIndex }))
      .filter(({ edge: [fromIndex, toIndex] }) => {
        const names = [artifact.stops[fromIndex][2], artifact.stops[toIndex][2]]
        return names.includes('Zürich HB') && names.includes(destination)
      })
    assert(corridorEdges.length > 0, `${name} study is missing Zürich HB–${destination}`)
    assert(
      corridorEdges.every(({ edgeIndex }) => artifact.edgePaths[edgeIndex] !== null),
      `${name} study has straight Zürich HB–${destination} topology chords`,
    )
  }
}

for (const hub of ['zurich', 'bern', 'basel', 'geneva']) {
  assert(Array.isArray(hubs.hubs?.[hub]), `Hub study is missing ${hub}`)
  assert(hubs.hubs[hub].length > 100, `Hub study has too few ${hub} calls`)
}

for (const descriptor of day.chunks) {
  const chunk = await readJson(descriptor.path)
  assert(chunk.windowStart === descriptor.windowStart, `${descriptor.id} start time differs from its manifest`)
  assert(chunk.windowEnd === descriptor.windowEnd, `${descriptor.id} end time differs from its manifest`)
  assert(Array.isArray(chunk.trains), `${descriptor.id} has no train array`)
  assert(chunk.trains.length === descriptor.tripCount, `${descriptor.id} trip count differs from its manifest`)
}

console.log(
  `Validated national GTFS ${[...feedVersions][0]} for ${[...serviceDates][0]}: ` +
    `${morning.trains.length.toLocaleString('en')} morning trips, ` +
    `${day.tripCount.toLocaleString('en')} day trips and ${day.chunks.length} chunks.`,
)
