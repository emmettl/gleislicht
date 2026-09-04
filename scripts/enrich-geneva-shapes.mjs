import { readFile, rename, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const DEFAULT_SNAPSHOT = 'public/data/geneva-tpg-morning.json'
const SOURCE_URL = 'https://sitg.ge.ch/donnees/tpg-lignes'
const SHAPED_CATEGORIES = new Set(['tram', 'bus'])
const KEY_SEPARATOR = '\u0000'

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}. See --help`)
  return value
}

export function normalizeRoute(value) {
  const route = String(value ?? '').trim().replace(/_pl$/i, '+')
  return /^0\d$/.test(route) ? route.slice(1) : route
}

export function categoryForVehicle(value) {
  if (value === 'TRAM') return 'tram'
  if (value === 'BUS' || value === 'TROLLEY') return 'bus'
  return undefined
}

function segmentKey(category, route, fromStopId, toStopId) {
  return [category, normalizeRoute(route), fromStopId, toStopId].join(KEY_SEPARATOR)
}

function graphKey(category, route) {
  return `${category}${KEY_SEPARATOR}${normalizeRoute(route)}`
}

function coordinateKey(point) {
  return `${point[0].toFixed(7)},${point[1].toFixed(7)}`
}

function distanceMetres(first, second) {
  const latitude = ((first[1] + second[1]) / 2) * (Math.PI / 180)
  const x = (first[0] - second[0]) * Math.cos(latitude) * 111_320
  const y = (first[1] - second[1]) * 111_320
  return Math.hypot(x, y)
}

function graphFor(graphs, key) {
  const existing = graphs.get(key)
  if (existing) return existing
  const graph = { nodes: new Map(), adjacency: new Map() }
  graphs.set(key, graph)
  return graph
}

function addEdge(graph, first, second) {
  const firstKey = coordinateKey(first)
  const secondKey = coordinateKey(second)
  graph.nodes.set(firstKey, first)
  graph.nodes.set(secondKey, second)
  const distance = distanceMetres(first, second)
  const firstEdges = graph.adjacency.get(firstKey) ?? []
  const secondEdges = graph.adjacency.get(secondKey) ?? []
  firstEdges.push([secondKey, distance])
  secondEdges.push([firstKey, distance])
  graph.adjacency.set(firstKey, firstEdges)
  graph.adjacency.set(secondKey, secondEdges)
}

function routeGraphs(geojson) {
  const graphs = new Map()
  for (const feature of geojson.features) {
    const category = categoryForVehicle(feature.properties?.VEHICULE)
    const route = normalizeRoute(feature.properties?.LIGNE)
    if (!category || !route || feature.geometry?.type !== 'MultiLineString') continue
    const graph = graphFor(graphs, graphKey(category, route))
    for (const line of feature.geometry.coordinates) {
      for (let index = 1; index < line.length; index += 1) {
        addEdge(graph, line[index - 1], line[index])
      }
    }
  }
  return graphs
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

function nearestNode(graph, point) {
  let nearest
  let nearestDistance = Infinity
  for (const [key, coordinate] of graph.nodes) {
    const distance = distanceMetres(point, coordinate)
    if (distance < nearestDistance) {
      nearest = key
      nearestDistance = distance
    }
  }
  return nearestDistance <= 350 ? nearest : undefined
}

function shortestPath(graph, start, end) {
  if (start === end) return [start]
  const distances = new Map([[start, 0]])
  const previous = new Map()
  const queue = new MinHeap()
  queue.push([0, start])
  while (true) {
    const current = queue.pop()
    if (!current) return undefined
    const [distance, key] = current
    if (distance !== distances.get(key)) continue
    if (key === end) break
    for (const [nextKey, edgeDistance] of graph.adjacency.get(key) ?? []) {
      const nextDistance = distance + edgeDistance
      if (nextDistance >= (distances.get(nextKey) ?? Infinity)) continue
      distances.set(nextKey, nextDistance)
      previous.set(nextKey, key)
      queue.push([nextDistance, nextKey])
    }
  }
  const keys = [end]
  while (keys[0] !== start) {
    const key = previous.get(keys[0])
    if (!key) return undefined
    keys.unshift(key)
  }
  return keys
}

function perpendicularDistance(point, start, end) {
  const px = point[0]
  const py = point[1]
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return distanceMetres(point, start)
  const progress = Math.min(
    1,
    Math.max(0, ((px - start[0]) * dx + (py - start[1]) * dy) / (dx * dx + dy * dy)),
  )
  return distanceMetres(point, [start[0] + progress * dx, start[1] + progress * dy])
}

function simplifyPoints(points, toleranceMetres = 2) {
  if (points.length <= 2) return points
  let furthestDistance = 0
  let furthestIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1))
    if (distance > furthestDistance) {
      furthestDistance = distance
      furthestIndex = index
    }
  }
  if (furthestDistance <= toleranceMetres) return [points[0], points.at(-1)]
  const first = simplifyPoints(points.slice(0, furthestIndex + 1), toleranceMetres)
  const second = simplifyPoints(points.slice(furthestIndex), toleranceMetres)
  return [...first.slice(0, -1), ...second]
}

function pathForSegment(graph, fromStop, toStop, nearestCache) {
  const nearest = (stop) => {
    const id = stop[4]
    if (!nearestCache.has(id)) {
      nearestCache.set(id, nearestNode(graph, [stop[0], stop[1]]))
    }
    return nearestCache.get(id)
  }
  const start = nearest(fromStop)
  const end = nearest(toStop)
  if (!start || !end) return undefined
  const keys = shortestPath(graph, start, end)
  if (!keys) return undefined
  const graphPoints = keys.map((key) => graph.nodes.get(key))
  const directDistance = distanceMetres(fromStop, toStop)
  const pathDistance = graphPoints
    .slice(1)
    .reduce((total, point, index) => total + distanceMetres(graphPoints[index], point), 0)
  if (pathDistance > Math.max(1_200, directDistance * 4.5)) return undefined
  const points = [
    [fromStop[0], fromStop[1]],
    ...graphPoints,
    [toStop[0], toStop[1]],
  ]
  return simplifyPoints(points).map(([longitude, latitude]) => [
    Number(longitude.toFixed(7)),
    Number(latitude.toFixed(7)),
  ])
}

function applyGeometry(snapshot, graphs) {
  const paths = []
  const pathIndexes = new Map()
  const segmentPaths = new Map()
  const nearestCaches = new Map()
  const routeCoverage = new Map()
  const edgePathCounts = new Map()

  function pathIndexFor(train, fromStop, toStop) {
    const key = segmentKey(train.category, train.route, fromStop[4], toStop[4])
    if (segmentPaths.has(key)) return segmentPaths.get(key)
    const routeKey = graphKey(train.category, train.route)
    const graph = graphs.get(routeKey)
    const nearestCache = nearestCaches.get(routeKey) ?? new Map()
    nearestCaches.set(routeKey, nearestCache)
    const path = graph && pathForSegment(graph, fromStop, toStop, nearestCache)
    if (!path || path.length < 2) {
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
    if (!SHAPED_CATEGORIES.has(train.category)) return train
    const routeKey = `${train.category} ${train.route}`
    const coverage = routeCoverage.get(routeKey) ?? { matched: 0, total: 0 }
    const pathSegments = []
    let hasGeometry = false
    for (let index = 1; index < train.stops.length; index += 1) {
      totalSegments += 1
      coverage.total += 1
      const fromIndex = train.stops[index - 1][0]
      const toIndex = train.stops[index][0]
      const pathIndex = pathIndexFor(train, snapshot.stops[fromIndex], snapshot.stops[toIndex])
      pathSegments.push(pathIndex)
      if (pathIndex === null) continue
      hasGeometry = true
      matchedSegments += 1
      coverage.matched += 1
      const edgeKey = fromIndex < toIndex ? `${fromIndex}:${toIndex}` : `${toIndex}:${fromIndex}`
      const counts = edgePathCounts.get(edgeKey) ?? new Map()
      counts.set(pathIndex, (counts.get(pathIndex) ?? 0) + 1)
      edgePathCounts.set(edgeKey, counts)
    }
    routeCoverage.set(routeKey, coverage)
    return hasGeometry ? { ...train, pathSegments } : train
  })
  const edgePaths = snapshot.edges.map(([fromIndex, toIndex]) => {
    const counts = edgePathCounts.get(`${fromIndex}:${toIndex}`)
    return counts ? [...counts].sort((first, second) => second[1] - first[1])[0][0] : null
  })
  return { paths, edgePaths, trains, totalSegments, matchedSegments, routeCoverage }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: node scripts/enrich-geneva-shapes.mjs --geometry /path/tpg-lines.geojson ' +
        '[--snapshot public/data/geneva-tpg-morning.json] [--feed-version YYYY-MM-DD]',
    )
    return
  }
  const geometryPath = resolve(requiredArgument('geometry'))
  const snapshotPath = resolve(argument('snapshot', DEFAULT_SNAPSHOT))
  const feedVersion = argument('feed-version', basename(geometryPath, '.geojson'))
  const [snapshot, geojson] = await Promise.all([
    readFile(snapshotPath, 'utf8').then(JSON.parse),
    readFile(geometryPath, 'utf8').then(JSON.parse),
  ])
  const graphs = routeGraphs(geojson)
  console.log(`Built ${graphs.size} TPG line graphs. Matching timetable segments…`)
  const result = applyGeometry(snapshot, graphs)
  const coverage = result.matchedSegments / result.totalSegments
  const weakestRoutes = [...result.routeCoverage]
    .map(([route, counts]) => ({ route, ...counts, rate: counts.matched / counts.total }))
    .filter(({ rate }) => rate < 0.9)
    .sort((first, second) => first.rate - second.rate || second.total - first.total)
    .slice(0, 15)
  console.log('Weakest route alignment:', weakestRoutes)
  if (coverage < 0.7) {
    throw new Error(`Only ${(coverage * 100).toFixed(1)}% of TPG segments aligned; refusing a weak join.`)
  }
  const enriched = {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      model: 'scheduled interpolation with SITG shape-aware TPG tram and bus paths',
      note: 'Rail uses straight stop segments; TPG tram, trolleybus and bus movement follows matched official SITG geometry, including cross-border branches.',
      geometry: {
        publisher: 'Transports publics genevois (TPG) / SITG',
        feedVersion,
        sourceUrl: SOURCE_URL,
        model: 'line-specific shortest-path alignment between timetable stops and the official TPG line graph',
        matchedSegments: result.matchedSegments,
        totalSegments: result.totalSegments,
      },
    },
    paths: result.paths,
    edgePaths: result.edgePaths,
    trains: result.trains,
  }
  const temporaryPath = `${snapshotPath}.tmp`
  await writeFile(temporaryPath, JSON.stringify(enriched))
  await rename(temporaryPath, snapshotPath)
  console.log(
    `Wrote ${result.paths.length} deduplicated paths with ${(coverage * 100).toFixed(1)}% segment coverage → ${snapshotPath}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
