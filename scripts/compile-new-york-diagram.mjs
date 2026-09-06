import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const input = resolve(option('--input', 'fixtures/mta/local-express-lexington-morning.json'))
const output = resolve(option('--output', 'fixtures/mta/local-express-diagram.json'))
const overridesInput = resolve(
  option('--overrides', 'fixtures/mta/local-express-diagram-overrides.json'),
)
const bytes = await readFile(input)
const overridesBytes = await readFile(overridesInput)
const network = JSON.parse(bytes)
const overrides = JSON.parse(overridesBytes)
const uniqueStations = [...new Map(network.stops.map((stop) => [stop[2], stop])).values()]
  .toSorted((first, second) => second[1] - first[1])
const stationOrder = new Map(uniqueStations.map((stop, index) => [stop[2], index]))
const step = uniqueStations.length <= 1 ? 0 : 1 / (uniqueStations.length - 1)
const knownStationNames = new Set(uniqueStations.map((stop) => stop[2]))
const authoredStationNames = Object.keys(overrides.stations ?? {})
for (const [name, band] of Object.entries(overrides.stations ?? {})) {
  if (!knownStationNames.has(name)) throw new Error(`Unknown diagram station ${name}`)
  if (
    !Array.isArray(band) ||
    band.length !== 3 ||
    !band.every(Number.isFinite) ||
    band[2] <= 0
  ) {
    throw new Error(`Diagram station ${name} must be [centreX, y, directionGap]`)
  }
}
if (authoredStationNames.length !== uniqueStations.length) {
  throw new Error(
    `Diagram overrides cover ${authoredStationNames.length}/${uniqueStations.length} station bands`,
  )
}
const round = (value) => Number(value.toFixed(5))
const positions = new Map(
  network.stops.map((stop) => {
    const order = stationOrder.get(stop[2]) ?? 0
    const band = overrides.stations?.[stop[2]]
    const centreX = band?.[0] ?? 0
    const y = band?.[1] ?? 0.5 - order * step
    const directionGap = band?.[2] ?? 0.036
    const direction = stop[3] === 'N' ? -1 : 1
    return [stop[4], [round(centreX + direction * directionGap / 2), round(y)]]
  }),
)

const pathEndpoints = new Map()
network.edgePaths?.forEach((pathIndex, edgeIndex) => {
  if (pathIndex === null || pathIndex === undefined || pathEndpoints.has(pathIndex)) return
  const [fromIndex, toIndex] = network.edges[edgeIndex]
  pathEndpoints.set(pathIndex, [network.stops[fromIndex][4], network.stops[toIndex][4]])
})
const paths = (network.paths ?? []).map((_, pathIndex) => {
  const endpointIds = pathEndpoints.get(pathIndex)
  if (!endpointIds) return []
  const from = positions.get(endpointIds[0])
  const to = positions.get(endpointIds[1])
  return from && to ? [from, to] : []
})
const waterPaths = (overrides.context?.waterPaths ?? []).map((path, index) => {
  if (
    !Array.isArray(path) ||
    path.length < 2 ||
    !path.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(Number.isFinite),
    )
  ) {
    throw new Error(`Diagram water path ${index} must contain coordinate pairs`)
  }
  return path.map(([x, y]) => [round(x), round(y)])
})
const allCoordinates = [
  ...positions.values(),
  ...waterPaths.flat(),
]
const allX = allCoordinates.map(([x]) => x)
const allY = allCoordinates.map(([, y]) => y)

const artifact = {
  metadata: {
    id: 'diagram',
    label: 'Diagram',
    kind: 'topological',
    coordinateSpace: 'normalized',
    sourceNetwork: input.split('/').at(-1),
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    overridesSource: overridesInput.split('/').at(-1),
    overridesSha256: createHash('sha256').update(overridesBytes).digest('hex'),
    feedVersion: network.metadata.feedVersion,
    model: 'authored station bands / separated directions / schematic river strokes / canonical route progress',
    note: 'An original Lexington Avenue corridor diagram. Its bends and spacing are composed for service-pattern comparison; it separates direction, not physical track assignment, and preserves every MTA stop and path identity.',
  },
  bounds: {
    minX: Math.min(...allX),
    minY: Math.min(...allY),
    maxX: Math.max(...allX),
    maxY: Math.max(...allY),
  },
  stops: network.stops.map((stop) => [stop[4], ...positions.get(stop[4])]),
  paths,
  context: waterPaths.length > 0 ? { waterPaths } : undefined,
}

await writeFile(output, `${JSON.stringify(artifact)}\n`)
console.log(`Wrote ${output} with ${artifact.stops.length} stops and ${paths.length} paths.`)
