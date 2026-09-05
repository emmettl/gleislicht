import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_SNAPSHOT = 'public/data/swiss-rail-morning.json'
const SOURCE_URL =
  'https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz'
const PRODUCT_URL =
  'https://map.geo.admin.ch/#/map?lang=en&center=2660000,1190000&z=1&topic=ech&layers=ch.bav.schienennetz'

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}. See --help`)
  return value
}

function decodeXml(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function matchText(body, tag) {
  return decodeXml(body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1])
}

function lv95ToWgs84([east, north]) {
  const y = (east - 2_600_000) / 1_000_000
  const x = (north - 1_200_000) / 1_000_000
  const longitudeSeconds =
    2.6779094 +
    4.728982 * y +
    0.791484 * y * x +
    0.1306 * y * x * x -
    0.0436 * y * y * y
  const latitudeSeconds =
    16.9023892 +
    3.238272 * x -
    0.270978 * y * y -
    0.002528 * x * x -
    0.0447 * y * y * x -
    0.014 * x * x * x
  return [
    Number((longitudeSeconds * 100 / 36).toFixed(6)),
    Number((latitudeSeconds * 100 / 36).toFixed(6)),
  ]
}

function distanceMetres(first, second) {
  const latitude = ((first[1] + second[1]) / 2) * (Math.PI / 180)
  const x = (first[0] - second[0]) * Math.cos(latitude) * 111_320
  const y = (first[1] - second[1]) * 111_320
  return Math.hypot(x, y)
}

function lv95Distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1])
}

function perpendicularDistance(point, first, second) {
  const deltaX = second[0] - first[0]
  const deltaY = second[1] - first[1]
  if (!deltaX && !deltaY) return lv95Distance(point, first)
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - first[0]) * deltaX + (point[1] - first[1]) * deltaY) /
        (deltaX * deltaX + deltaY * deltaY),
    ),
  )
  return lv95Distance(point, [
    first[0] + deltaX * progress,
    first[1] + deltaY * progress,
  ])
}

export function simplifyPolyline(points, toleranceMetres = 100) {
  if (points.length <= 2) return points
  let furthestDistance = 0
  let furthestIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1))
    if (distance <= furthestDistance) continue
    furthestDistance = distance
    furthestIndex = index
  }
  if (furthestDistance <= toleranceMetres) return [points[0], points.at(-1)]
  const first = simplifyPolyline(points.slice(0, furthestIndex + 1), toleranceMetres)
  const second = simplifyPolyline(points.slice(furthestIndex), toleranceMetres)
  return [...first.slice(0, -1), ...second]
}

function coordinatePairs(body) {
  return [...body.matchAll(/<COORD><C1>([^<]+)<\/C1><C2>([^<]+)<\/C2><\/COORD>/g)]
    .map((match) => [Number(match[1]), Number(match[2])])
    .filter((point) => point.every(Number.isFinite))
}

export function parseRailNetworkXtf(xml, toleranceMetres = 100) {
  const nodes = new Map()
  const nodePattern =
    /<Schienennetz_LV95_V1_3\.Schienennetz\.Netzknoten TID="([^"]+)">([\s\S]*?)<\/Schienennetz_LV95_V1_3\.Schienennetz\.Netzknoten>/g
  for (const match of xml.matchAll(nodePattern)) {
    const coordinates = coordinatePairs(match[2])
    if (!coordinates.length) continue
    nodes.set(match[1], {
      id: match[1],
      number: matchText(match[2], 'Nummer'),
      name: matchText(match[2], 'Name'),
      coordinate: lv95ToWgs84(coordinates[0]),
    })
  }

  const segments = []
  const segmentPattern =
    /<Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment TID="([^"]+)">([\s\S]*?)<\/Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment>/g
  for (const match of xml.matchAll(segmentPattern)) {
    const start = match[2].match(/<rAnfangsknoten REF="([^"]+)">/)?.[1]
    const end = match[2].match(/<rEndknoten REF="([^"]+)">/)?.[1]
    const coordinates = coordinatePairs(match[2])
    if (!start || !end || !nodes.has(start) || !nodes.has(end) || coordinates.length < 2) {
      continue
    }
    const simplified = simplifyPolyline(coordinates, toleranceMetres)
    const length = coordinates
      .slice(1)
      .reduce((total, point, index) => total + lv95Distance(coordinates[index], point), 0)
    segments.push({
      id: match[1],
      start,
      end,
      length,
      points: simplified.map(lv95ToWgs84),
    })
  }
  return { nodes, segments }
}

function normalName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de-CH')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/\bbahnhof\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function sloidNumber(sourceId) {
  const value = String(sourceId ?? '').match(/sloid:(\d+)/)?.[1]
  return value ? `85${value.padStart(5, '0')}` : undefined
}

function candidatesBy(nodes, selector) {
  const index = new Map()
  for (const node of nodes.values()) {
    const key = selector(node)
    if (!key) continue
    const values = index.get(key) ?? []
    values.push(node)
    index.set(key, values)
  }
  return index
}

function closestNode(candidates, stop, maximumDistance) {
  let best
  let bestDistance = maximumDistance
  const point = [stop[0], stop[1]]
  for (const node of candidates) {
    const distance = distanceMetres(node.coordinate, point)
    if (distance >= bestDistance) continue
    best = node
    bestDistance = distance
  }
  return best
}

export function createStopNodeResolver(nodes) {
  const byNumber = candidatesBy(nodes, (node) => node.number)
  const byName = candidatesBy(nodes, (node) => normalName(node.name))
  const all = [...nodes.values()]
  return (stop) => {
    const numbered = byNumber.get(sloidNumber(stop[4])) ?? []
    const numberMatch = closestNode(numbered, stop, 2_000)
    if (numberMatch) return numberMatch.id
    const named = byName.get(normalName(stop[2])) ?? []
    const nameMatch = closestNode(named, stop, 2_000)
    if (nameMatch) return nameMatch.id
    return closestNode(all, stop, 650)?.id
  }
}

class MinHeap {
  #items = []

  push(item) {
    this.#items.push(item)
    let index = this.#items.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.#items[parent][0] <= item[0]) break
      this.#items[index] = this.#items[parent]
      index = parent
    }
    this.#items[index] = item
  }

  pop() {
    if (!this.#items.length) return undefined
    const first = this.#items[0]
    const last = this.#items.pop()
    if (this.#items.length && last) {
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        if (left >= this.#items.length) break
        const smallest =
          right < this.#items.length && this.#items[right][0] < this.#items[left][0]
            ? right
            : left
        if (this.#items[smallest][0] >= last[0]) break
        this.#items[index] = this.#items[smallest]
        index = smallest
      }
      this.#items[index] = last
    }
    return first
  }
}

function buildGraph(network) {
  const adjacency = new Map()
  const add = (from, to, length, points) => {
    const edges = adjacency.get(from) ?? []
    edges.push({ to, length, points })
    adjacency.set(from, edges)
  }
  for (const segment of network.segments) {
    add(segment.start, segment.end, segment.length, segment.points)
    add(segment.end, segment.start, segment.length, [...segment.points].reverse())
  }
  return adjacency
}

function shortestPath(graph, start, end, maximumDistance) {
  if (start === end) return []
  const distances = new Map([[start, 0]])
  const previous = new Map()
  const queue = new MinHeap()
  queue.push([0, start])
  while (true) {
    const current = queue.pop()
    if (!current) return undefined
    const [distance, node] = current
    if (distance !== distances.get(node)) continue
    if (distance > maximumDistance) return undefined
    if (node === end) break
    for (const edge of graph.get(node) ?? []) {
      const nextDistance = distance + edge.length
      if (
        nextDistance > maximumDistance ||
        nextDistance >= (distances.get(edge.to) ?? Infinity)
      ) {
        continue
      }
      distances.set(edge.to, nextDistance)
      previous.set(edge.to, { node, edge })
      queue.push([nextDistance, edge.to])
    }
  }
  const edges = []
  let node = end
  while (node !== start) {
    const step = previous.get(node)
    if (!step) return undefined
    edges.unshift(step.edge)
    node = step.node
  }
  return edges
}

function pathDistance(points) {
  return points
    .slice(1)
    .reduce((total, point, index) => total + distanceMetres(points[index], point), 0)
}

function collapsePoints(points) {
  const result = []
  for (const point of points) {
    if (result.length && distanceMetres(result.at(-1), point) < 2) continue
    result.push(point)
  }
  return result
}

function infrastructurePath(graph, fromNode, toNode, fromStop, toStop) {
  if (!fromNode || !toNode) return undefined
  const directDistance = distanceMetres(fromStop, toStop)
  const edges = shortestPath(
    graph,
    fromNode,
    toNode,
    Math.max(3_000, directDistance * 4.5),
  )
  if (!edges) return undefined
  const points = collapsePoints([
    [fromStop[0], fromStop[1]],
    ...edges.flatMap((edge) => edge.points),
    [toStop[0], toStop[1]],
  ])
  if (points.length < 2) return undefined
  const distance = pathDistance(points)
  if (distance > Math.max(3_000, directDistance * 4.5)) return undefined
  return points
}

export function applyRailGeometry(snapshot, network) {
  const graph = buildGraph(network)
  const resolveStop = createStopNodeResolver(network.nodes)
  const stopNodes = snapshot.stops.map(resolveStop)
  const paths = []
  const pathIndexes = new Map()
  const segmentPaths = new Map()
  const edgePathCounts = new Map()

  function pathIndexFor(fromIndex, toIndex) {
    const fromNode = stopNodes[fromIndex]
    const toNode = stopNodes[toIndex]
    if (!fromNode || !toNode) return null
    const forward = fromNode.localeCompare(toNode) <= 0
    const startNode = forward ? fromNode : toNode
    const endNode = forward ? toNode : fromNode
    const key = `${startNode}:${endNode}`
    if (segmentPaths.has(key)) return segmentPaths.get(key)
    const start = network.nodes.get(startNode)?.coordinate
    const end = network.nodes.get(endNode)?.coordinate
    if (!start || !end) return null
    const path = infrastructurePath(
      graph,
      startNode,
      endNode,
      start,
      end,
    )
    if (!path) {
      segmentPaths.set(key, null)
      return null
    }
    const signature = JSON.stringify(path)
    let pathIndex = pathIndexes.get(signature)
    if (pathIndex === undefined) {
      pathIndex = paths.length
      paths.push(path)
      pathIndexes.set(signature, pathIndex)
    }
    segmentPaths.set(key, pathIndex)
    return pathIndex
  }

  let totalSegments = 0
  let matchedSegments = 0
  const trains = snapshot.trains.map((train) => {
    const pathSegments = []
    let hasGeometry = false
    for (let index = 1; index < train.stops.length; index += 1) {
      totalSegments += 1
      const fromIndex = train.stops[index - 1][0]
      const toIndex = train.stops[index][0]
      const pathIndex = pathIndexFor(fromIndex, toIndex)
      pathSegments.push(pathIndex)
      if (pathIndex === null) continue
      hasGeometry = true
      matchedSegments += 1
      const edgeKey = fromIndex < toIndex ? `${fromIndex}:${toIndex}` : `${toIndex}:${fromIndex}`
      const counts = edgePathCounts.get(edgeKey) ?? new Map()
      counts.set(pathIndex, (counts.get(pathIndex) ?? 0) + 1)
      edgePathCounts.set(edgeKey, counts)
    }
    return hasGeometry ? { ...train, pathSegments } : train
  })
  const edgePaths = snapshot.edges.map(([fromIndex, toIndex]) => {
    const counts = edgePathCounts.get(`${fromIndex}:${toIndex}`)
    if (counts) return [...counts].sort((first, second) => second[1] - first[1])[0][0]

    // The topology contains platform-specific GTFS stop records that may not occur
    // in the selected time window. Resolve those edges directly as well, otherwise
    // a measured route used by moving trains can still appear as a straight chord
    // in the quieter structural network.
    return pathIndexFor(fromIndex, toIndex)
  })
  return {
    paths,
    edgePaths,
    trains,
    totalSegments,
    matchedSegments,
    resolvedStops: stopNodes.filter(Boolean).length,
  }
}

async function readDocument(snapshotPath) {
  const document = JSON.parse(await readFile(snapshotPath, 'utf8'))
  const isDayManifest = Array.isArray(document.chunks) && !Array.isArray(document.trains)
  const chunks = isDayManifest
    ? await Promise.all(
        document.chunks.map(async (descriptor) => {
          const path = resolve(dirname(snapshotPath), descriptor.path)
          return { path, payload: JSON.parse(await readFile(path, 'utf8')) }
        }),
      )
    : []
  const trains = isDayManifest
    ? [
        ...new Map(
          chunks.flatMap(({ payload }) => payload.trains).map((train) => [train.id, train]),
        ).values(),
      ]
    : document.trains
  return { document, isDayManifest, chunks, snapshot: { ...document, trains } }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:rail:shapes -- --source /path/schienennetz_2056_de.xtf ' +
        '[--snapshot public/data/swiss-rail-morning.json] [--tolerance 100]',
    )
    return
  }
  const sourcePath = resolve(requiredArgument('source'))
  const snapshotPath = resolve(argument('snapshot', DEFAULT_SNAPSHOT))
  const toleranceMetres = Number(argument('tolerance', '100'))
  const [{ document, isDayManifest, chunks, snapshot }, xml] = await Promise.all([
    readDocument(snapshotPath),
    readFile(sourcePath, 'utf8'),
  ])
  const network = parseRailNetworkXtf(xml, toleranceMetres)
  console.log(
    `Parsed ${network.nodes.size} official rail nodes and ${network.segments.length} segments.`,
  )
  const geometry = applyRailGeometry(snapshot, network)
  const coverage = geometry.matchedSegments / geometry.totalSegments
  if (coverage < 0.65) {
    throw new Error(
      `Only ${(coverage * 100).toFixed(1)}% of rail segment occurrences aligned; refusing a weak join.`,
    )
  }
  const metadata = {
    ...snapshot.metadata,
    model: 'scheduled interpolation along official FOT rail geometry',
    note:
      'Movement follows matched Federal Office of Transport rail infrastructure geometry where available; unmatched and cross-border segments retain direct scheduled interpolation.',
    geometry: {
      publisher: 'Federal Office of Transport (FOT)',
      feedVersion: '2021-07-06',
      sourceUrl: SOURCE_URL,
      productUrl: PRODUCT_URL,
      model: 'shortest valid infrastructure path between matched timetable stops',
      matchedSegments: geometry.matchedSegments,
      totalSegments: geometry.totalSegments,
      resolvedStops: geometry.resolvedStops,
      totalStops: snapshot.stops.length,
      simplificationToleranceMetres: toleranceMetres,
    },
  }
  const enriched = {
    ...document,
    metadata,
    paths: geometry.paths,
    edgePaths: geometry.edgePaths,
    ...(isDayManifest ? {} : { trains: geometry.trains }),
  }
  const trains = new Map(geometry.trains.map((train) => [train.id, train]))
  const pending = chunks.map(({ path, payload }) => ({
    path,
    temporaryPath: `${path}.tmp`,
    value: {
      ...payload,
      trains: payload.trains.map((train) => trains.get(train.id) ?? train),
    },
  }))
  pending.push({
    path: snapshotPath,
    temporaryPath: `${snapshotPath}.tmp`,
    value: enriched,
  })
  await Promise.all(
    pending.map(({ temporaryPath, value }) => writeFile(temporaryPath, JSON.stringify(value))),
  )
  await Promise.all(
    pending.map(({ temporaryPath, path }) => rename(temporaryPath, path)),
  )
  console.log(
    `Wrote ${geometry.paths.length} shared paths with ${(coverage * 100).toFixed(1)}% occurrence coverage and ${geometry.resolvedStops}/${snapshot.stops.length} matched stops → ${snapshotPath}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
