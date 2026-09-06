import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const input = resolve(
  process.argv[2] ?? 'fixtures/tfl/all-change-rail-led-morning.json',
)
const output = resolve(
  process.argv[3] ?? 'fixtures/tfl/all-change-diagram.json',
)
const overridesInput = resolve(
  process.argv[4] ?? 'fixtures/tfl/all-change-diagram-overrides.json',
)
const raw = await readFile(input)
const overridesRaw = await readFile(overridesInput)
const network = JSON.parse(raw.toString('utf8'))
const overrides = JSON.parse(overridesRaw.toString('utf8'))
const stops = network.stops
const count = stops.length
// Central London needs substantially more room than its geographic share of
// the network, while the long Elizabeth and outer Underground branches need
// to remain present without determining the entire composition. This
// asinh projection behaves like a lens: almost linear through Zone 1 and
// progressively compressed towards the termini.
const centreLongitude = -0.1
const centreLatitude = 51.515
const longitudeScale = Math.cos((centreLatitude * Math.PI) / 180)
const x = new Float64Array(count)
const y = new Float64Array(count)
const neighbours = Array.from({ length: count }, () => new Set())

for (let index = 0; index < count; index += 1) {
  const stop = stops[index]
  const longitude = (stop[0] - centreLongitude) * longitudeScale
  const latitude = stop[1] - centreLatitude
  x[index] = Math.asinh(longitude / 0.12) * 0.22
  y[index] = Math.asinh(latitude / 0.065) * 0.15
}

for (const [from, to] of network.edges) {
  if (from === to || !neighbours[from] || !neighbours[to]) continue
  neighbours[from].add(to)
  neighbours[to].add(from)
}

function canonicalStationName(name) {
  return String(name)
    .replace(/^London\s+/i, '')
    .replace(/\s+\(London\)$/i, '')
    .replace(/\s+\(H&C Line\)-Underground$/i, '')
    .replace(/-Underground$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const GRID = 0.012
const occupied = new Set()
const gridPositions = new Array(count)
const stopIndexById = new Map(stops.map((stop, index) => [stop[4], index]))
const overriddenCells = new Map()
const sharedStationCells = new Map()
for (const [sourceId, cell] of Object.entries(overrides.stops ?? {})) {
  const index = stopIndexById.get(sourceId)
  if (index === undefined) throw new Error(`Unknown overridden stop ${sourceId}`)
  if (
    !Array.isArray(cell) ||
    cell.length !== 2 ||
    !cell.every(Number.isInteger)
  ) {
    throw new Error(`Diagram stop override ${sourceId} must be two grid integers`)
  }
  const key = `${cell[0]}:${cell[1]}`
  if (occupied.has(key)) throw new Error(`Duplicate overridden diagram cell ${key}`)
  occupied.add(key)
  overriddenCells.set(index, cell)
  sharedStationCells.set(canonicalStationName(stops[index][2]), cell)
}
const rankedIndexes = Array.from({ length: count }, (_, index) => index).sort(
  (first, second) =>
    (stops[first][5] ?? Number.MAX_SAFE_INTEGER) -
      (stops[second][5] ?? Number.MAX_SAFE_INTEGER) ||
    String(stops[first][4]).localeCompare(String(stops[second][4])),
)

function nearbyCells(originX, originY) {
  const cells = [[originX, originY]]
  for (let radius = 1; radius <= 3; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      cells.push([originX + dx, originY - radius], [originX + dx, originY + radius])
    }
    for (let dy = -radius + 1; dy < radius; dy += 1) {
      cells.push([originX - radius, originY + dy], [originX + radius, originY + dy])
    }
  }
  return cells
}

for (const index of rankedIndexes) {
  const stationName = canonicalStationName(stops[index][2])
  const sharedCell = sharedStationCells.get(stationName)
  if (sharedCell) {
    gridPositions[index] = sharedCell
    continue
  }
  const override = overriddenCells.get(index)
  if (override) {
    gridPositions[index] = override
    continue
  }
  const desiredX = Math.round(x[index] / GRID)
  const desiredY = Math.round(y[index] / GRID)
  const blockedNeighbourCells = new Set(
    [...neighbours[index]]
      .map((neighbour) => gridPositions[neighbour])
      .filter(Boolean)
      .map(([cellX, cellY]) => `${cellX}:${cellY}`),
  )
  const selected = nearbyCells(desiredX, desiredY).find(
    ([cellX, cellY]) => !blockedNeighbourCells.has(`${cellX}:${cellY}`),
  )
  if (!selected) throw new Error(`Unable to separate ${stops[index][2]} from its neighbours`)
  gridPositions[index] = selected
  sharedStationCells.set(stationName, selected)
}

const round = (value) => Number((value * GRID).toFixed(5))
const diagramStops = gridPositions.map(([cellX, cellY], index) => [
  stops[index][4],
  round(cellX),
  round(cellY),
])

function octilinearPath(fromIndex, toIndex) {
  const [fromCellX, fromCellY] = gridPositions[fromIndex]
  const [toCellX, toCellY] = gridPositions[toIndex]
  const runsForward =
    fromCellX < toCellX || (fromCellX === toCellX && fromCellY <= toCellY)
  if (!runsForward) return octilinearPath(toIndex, fromIndex).reverse()
  const deltaX = toCellX - fromCellX
  const deltaY = toCellY - fromCellY
  if (!deltaX && !deltaY) return [[round(fromCellX), round(fromCellY)]]
  if (!deltaX || !deltaY || Math.abs(deltaX) === Math.abs(deltaY)) {
    return [
      [round(fromCellX), round(fromCellY)],
      [round(toCellX), round(toCellY)],
    ]
  }
  const diagonal = Math.min(Math.abs(deltaX), Math.abs(deltaY))
  const bend =
    Math.abs(deltaX) > Math.abs(deltaY)
      ? [fromCellX + Math.sign(deltaX) * diagonal, toCellY]
      : [toCellX, fromCellY + Math.sign(deltaY) * diagonal]
  return [
    [round(fromCellX), round(fromCellY)],
    [round(bend[0]), round(bend[1])],
    [round(toCellX), round(toCellY)],
  ]
}

const edgeForPath = new Map()
for (let edgeIndex = 0; edgeIndex < network.edgePaths.length; edgeIndex += 1) {
  const pathIndex = network.edgePaths[edgeIndex]
  if (pathIndex === null || pathIndex === undefined || edgeForPath.has(pathIndex)) continue
  edgeForPath.set(pathIndex, network.edges[edgeIndex])
}

function nearestStop([longitude, latitude]) {
  let nearest = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < count; index += 1) {
    const deltaLongitude = (stops[index][0] - longitude) * longitudeScale
    const deltaLatitude = stops[index][1] - latitude
    const distance = deltaLongitude ** 2 + deltaLatitude ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = index
    }
  }
  return nearest
}

const diagramPaths = network.paths.map((path, pathIndex) => {
  const override = overrides.paths?.[pathIndex]
  if (override) {
    if (
      !Array.isArray(override) ||
      override.length < 2 ||
      !override.every(
        (cell) =>
          Array.isArray(cell) &&
          cell.length === 2 &&
          cell.every(Number.isInteger),
      )
    ) {
      throw new Error(`Diagram path override ${pathIndex} must use grid cells`)
    }
    return override.map(([cellX, cellY]) => [round(cellX), round(cellY)])
  }
  const edge = edgeForPath.get(pathIndex)
  const from = edge?.[0] ?? nearestStop(path[0])
  const to = edge?.[1] ?? nearestStop(path.at(-1))
  return octilinearPath(from, to)
})
const waterPaths = (overrides.context?.waterPaths ?? []).map((path, pathIndex) => {
  if (
    !Array.isArray(path) ||
    path.length < 2 ||
    !path.every(
      (cell) =>
        Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger),
    )
  ) {
    throw new Error(`Diagram water path ${pathIndex} must use grid cells`)
  }
  return path.map(([cellX, cellY]) => [round(cellX), round(cellY)])
})
const allCoordinates = [
  ...diagramStops.map((stop) => [stop[1], stop[2]]),
  ...waterPaths.flat(),
]
const allX = allCoordinates.map(([coordinateX]) => coordinateX)
const allY = allCoordinates.map(([, coordinateY]) => coordinateY)
const artifact = {
  metadata: {
    id: 'diagram',
    label: 'Diagram',
    kind: 'topological',
    coordinateSpace: 'normalized',
    sourceNetwork: input.split('/').at(-1),
    sourceSha256: createHash('sha256').update(raw).digest('hex'),
    overridesSource: overridesInput.split('/').at(-1),
    overridesSha256: createHash('sha256').update(overridesRaw).digest('hex'),
    feedVersion: network.metadata.feedVersion,
    model: 'central-London lens / shared interchange cells / 0.012 grid / octilinear path routing',
    note: 'An independently generated London diagram study. It preserves source stop and path identity, expands the central interchange field and compresses outer branches without reproducing TfL map artwork.',
  },
  bounds: {
    minX: Math.min(...allX),
    minY: Math.min(...allY),
    maxX: Math.max(...allX),
    maxY: Math.max(...allY),
  },
  stops: diagramStops,
  paths: diagramPaths,
  context: waterPaths.length > 0 ? { waterPaths } : undefined,
}

await writeFile(output, JSON.stringify(artifact))
console.log(
  `Wrote ${output} with ${artifact.stops.length} stops and ${artifact.paths.length} octilinear paths.`,
)
