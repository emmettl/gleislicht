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
const centreLongitude =
  (network.bounds.minLongitude + network.bounds.maxLongitude) / 2
const centreLatitude =
  (network.bounds.minLatitude + network.bounds.maxLatitude) / 2
const longitudeScale = Math.cos((centreLatitude * Math.PI) / 180)
const projectedWidth =
  (network.bounds.maxLongitude - network.bounds.minLongitude) * longitudeScale
const scale = 2 / projectedWidth
const originalX = new Float64Array(count)
const originalY = new Float64Array(count)
const x = new Float64Array(count)
const y = new Float64Array(count)
const neighbours = Array.from({ length: count }, () => new Set())

for (let index = 0; index < count; index += 1) {
  const stop = stops[index]
  x[index] = originalX[index] =
    (stop[0] - centreLongitude) * longitudeScale * scale
  y[index] = originalY[index] = (stop[1] - centreLatitude) * scale
}

for (const [from, to] of network.edges) {
  if (from === to || !neighbours[from] || !neighbours[to]) continue
  neighbours[from].add(to)
  neighbours[to].add(from)
}

// A deterministic topology-preserving relaxation. Interchanges retain a
// stronger geographic spring while long, uneven branches acquire regularity.
for (let iteration = 0; iteration < 140; iteration += 1) {
  const nextX = new Float64Array(x)
  const nextY = new Float64Array(y)
  for (let index = 0; index < count; index += 1) {
    const adjacent = [...neighbours[index]]
    if (!adjacent.length) continue
    let averageX = 0
    let averageY = 0
    for (const neighbour of adjacent) {
      averageX += x[neighbour]
      averageY += y[neighbour]
    }
    averageX /= adjacent.length
    averageY /= adjacent.length
    const interchangeWeight = Math.min(1, adjacent.length / 6)
    const topologySpring = 0.052 - interchangeWeight * 0.018
    const geographySpring = 0.017 + interchangeWeight * 0.04
    nextX[index] =
      x[index] +
      (averageX - x[index]) * topologySpring +
      (originalX[index] - x[index]) * geographySpring
    nextY[index] =
      y[index] +
      (averageY - y[index]) * topologySpring +
      (originalY[index] - y[index]) * geographySpring
  }
  x.set(nextX)
  y.set(nextY)
}

const GRID = 0.032
const occupied = new Set()
const gridPositions = new Array(count)
const stopIndexById = new Map(stops.map((stop, index) => [stop[4], index]))
const overriddenCells = new Map()
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
}
const rankedIndexes = Array.from({ length: count }, (_, index) => index).sort(
  (first, second) =>
    (stops[first][5] ?? Number.MAX_SAFE_INTEGER) -
      (stops[second][5] ?? Number.MAX_SAFE_INTEGER) ||
    String(stops[first][4]).localeCompare(String(stops[second][4])),
)

function candidateCells(originX, originY, radius) {
  if (radius === 0) return [[originX, originY]]
  const cells = []
  for (let dx = -radius; dx <= radius; dx += 1) {
    cells.push([originX + dx, originY - radius], [originX + dx, originY + radius])
  }
  for (let dy = -radius + 1; dy < radius; dy += 1) {
    cells.push([originX - radius, originY + dy], [originX + radius, originY + dy])
  }
  return cells
}

for (const index of rankedIndexes) {
  const override = overriddenCells.get(index)
  if (override) {
    gridPositions[index] = override
    continue
  }
  const desiredX = Math.round(x[index] / GRID)
  const desiredY = Math.round(y[index] / GRID)
  let selected
  for (let radius = 0; radius <= 14 && !selected; radius += 1) {
    const candidates = candidateCells(desiredX, desiredY, radius)
      .filter(([cellX, cellY]) => !occupied.has(`${cellX}:${cellY}`))
      .sort((first, second) => {
        const score = ([cellX, cellY]) =>
          (cellX - desiredX) ** 2 +
          (cellY - desiredY) ** 2 +
          0.2 *
            ((cellX - originalX[index] / GRID) ** 2 +
              (cellY - originalY[index] / GRID) ** 2)
        return score(first) - score(second) || first[0] - second[0] || first[1] - second[1]
      })
    selected = candidates[0]
  }
  if (!selected) throw new Error(`Unable to place ${stops[index][2]} on diagram grid`)
  occupied.add(`${selected[0]}:${selected[1]}`)
  gridPositions[index] = selected
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
const allX = diagramStops.map((stop) => stop[1])
const allY = diagramStops.map((stop) => stop[2])
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
    model: 'deterministic topology relaxation / unique 0.032 grid / octilinear path routing',
    note: 'An independently generated Beck-inspired coordinate study. It preserves source stop and path identity but does not reproduce TfL map artwork.',
  },
  bounds: {
    minX: Math.min(...allX),
    minY: Math.min(...allY),
    maxX: Math.max(...allX),
    maxY: Math.max(...allY),
  },
  stops: diagramStops,
  paths: diagramPaths,
}

await writeFile(output, JSON.stringify(artifact))
console.log(
  `Wrote ${output} with ${artifact.stops.length} stops and ${artifact.paths.length} octilinear paths.`,
)
