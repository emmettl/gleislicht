import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const DEFAULT_OUTPUT = 'public/data/swiss-road-topology.json'
const SOURCE_URL =
  'https://data.geo.admin.ch/api/stac/v0.9/collections/ch.astra.nationalstrassenachsen'
const SOURCE_ASSET =
  'https://data.geo.admin.ch/ch.astra.nationalstrassenachsen/nationalstrassenachsen/nationalstrassenachsen_2056.xtf.zip'
const MEASUREMENT_SITE_URL =
  'https://data.opentransportdata.swiss/en/dataset/trafficcounters'
const GRID_SIZE = 10_000
const HIGH_CONFIDENCE_DISTANCE = 800
const AMBIGUITY_DISTANCE = 180
const MAXIMUM_MATCH_DISTANCE = 1_500
const CONTINUITY_RADIUS = 25_000
const CONTINUITY_DECAY = 8_000
const CONTINUITY_MINIMUM_SCORE = 0.55
const CONTINUITY_SCORE_RATIO = 1.55
const CONTINUITY_SCORE_MARGIN = 0.35
const MAXIMUM_SECTION_DISTANCE_KM = 45

const ROAD_DESCRIPTIONS = {
  N1: 'Genève · Lausanne · Bern · Zürich · St. Margrethen',
  N2: 'Basel · Gotthard · Chiasso',
  N3: 'Basel · Zürich · Sargans',
  N4: 'Schaffhausen · Zürich · Altdorf',
  N5: 'Yverdon · Neuchâtel · Biel',
  N6: 'Biel · Bern · Wimmis',
  N9: 'Vallorbe · Lausanne · Simplon',
  N13: 'St. Margrethen · Chur · Bellinzona',
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requiredArgument(name) {
  const value = argument(name)
  if (!value) throw new Error(`Missing --${name}. See --help`)
  return value
}

function text(body, tag) {
  return body.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`))?.[1]
}

function coordinatePairs(body) {
  return [
    ...body.matchAll(
      /<COORD><C1>([^<]+)<\/C1><C2>([^<]+)<\/C2>(?:<C3>[^<]*<\/C3>)?<\/COORD>/g,
    ),
  ]
    .map((match) => [Number(match[1]), Number(match[2])])
    .filter((point) => point.every(Number.isFinite))
}

function pointSegmentProjection(point, first, second) {
  const deltaEast = second[0] - first[0]
  const deltaNorth = second[1] - first[1]
  const denominator = deltaEast * deltaEast + deltaNorth * deltaNorth
  const progress = denominator
    ? Math.max(
        0,
        Math.min(
          1,
          ((point[0] - first[0]) * deltaEast +
            (point[1] - first[1]) * deltaNorth) /
            denominator,
        ),
      )
    : 0
  const projected = [
    first[0] + deltaEast * progress,
    first[1] + deltaNorth * progress,
  ]
  return {
    distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]),
    projected,
  }
}

function perpendicularDistance(point, first, second) {
  return pointSegmentProjection(point, first, second).distance
}

export function simplifyRoadPath(points, toleranceMetres = 70) {
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
  const first = simplifyRoadPath(points.slice(0, furthestIndex + 1), toleranceMetres)
  const second = simplifyRoadPath(points.slice(furthestIndex), toleranceMetres)
  return [...first.slice(0, -1), ...second]
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
    Number(((longitudeSeconds * 100) / 36).toFixed(5)),
    Number(((latitudeSeconds * 100) / 36).toFixed(5)),
  ]
}

function roadName(axisName) {
  const number = axisName?.match(/^N(\d+)/)?.[1]
  return number ? `N${number}` : undefined
}

export function parseNationalRoadAxes(xml, toleranceMetres = 70) {
  const axes = new Map()
  const axisPattern =
    /<Axis_LV95_V1_1\.Axis\.Axis TID="([^"]+)">([\s\S]*?)<\/Axis_LV95_V1_1\.Axis\.Axis>/g
  for (const match of xml.matchAll(axisPattern)) {
    const axisName = text(match[2], 'AxisName')
    const road = roadName(axisName)
    if (!road) continue
    axes.set(match[1], {
      id: match[1],
      axisName,
      road,
      position: text(match[2], 'AxisPositionCode') ?? 'equal',
      mainline: axisName === road,
    })
  }

  const segments = []
  const segmentPattern =
    /<Axis_LV95_V1_1\.Axis\.AxisSegment TID="([^"]+)">([\s\S]*?)<\/Axis_LV95_V1_1\.Axis\.AxisSegment>/g
  for (const match of xml.matchAll(segmentPattern)) {
    const axisId = match[2].match(/<rAxisContainer REF="([^"]+)"/)?.[1]
    const axis = axes.get(axisId)
    const points = coordinatePairs(match[2])
    if (!axis || points.length < 2) continue
    segments.push({
      ...axis,
      axisId: axis.id,
      id: match[1],
      sequence: Number(text(match[2], 'Sequence')),
      points,
      displayPoints: simplifyRoadPath(points, toleranceMetres),
    })
  }
  return { axes, segments }
}

export function parseAstraMeasurementSites(xml) {
  const tableVersion = Number(
    xml.match(/<measurementSiteTable\b[^>]*\bversion="(\d+)"/)?.[1],
  )
  const publicationTime = text(xml, 'publicationTime')
  const records = []
  const recordPattern =
    /<measurementSiteRecord\b[^>]*\bid="(CH:[^"]+)"[^>]*>([\s\S]*?)<\/measurementSiteRecord>/g
  for (const match of xml.matchAll(recordPattern)) {
    const id = match[1]
    const direction = text(match[2], 'alertCDirectionCoded')
    const lane = text(match[2], 'lane')
    const latitude = Number(text(match[2], 'latitude'))
    const longitude = Number(text(match[2], 'longitude'))
    records.push({
      id,
      stationId: id.replace(/\.\d+$/, ''),
      direction,
      lane,
      carriageway: text(match[2], 'carriageway'),
      longitude,
      latitude,
      usable:
        (direction === 'positive' || direction === 'negative') &&
        lane !== 'emergencyLane' &&
        Number.isFinite(longitude) &&
        Number.isFinite(latitude),
    })
  }

  const grouped = new Map()
  for (const record of records.filter(({ usable }) => usable)) {
    const key = `${record.stationId}:${record.direction}`
    const group = grouped.get(key) ?? {
      id: key,
      stationId: record.stationId,
      direction: record.direction,
      detectorIds: [],
      carriageways: new Set(),
      coordinates: [],
    }
    group.detectorIds.push(record.id)
    if (record.carriageway) group.carriageways.add(record.carriageway)
    group.coordinates.push([record.longitude, record.latitude])
    grouped.set(key, group)
  }
  const groups = [...grouped.values()].map((group) => {
    const longitude =
      group.coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0) /
      group.coordinates.length
    const latitude =
      group.coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) /
      group.coordinates.length
    return {
      id: group.id,
      stationId: group.stationId,
      direction: group.direction,
      detectorIds: group.detectorIds.sort(),
      carriageways: [...group.carriageways].sort(),
      coordinate: [longitude, latitude],
      lv95: wgs84ToLv95(longitude, latitude),
    }
  })
  return {
    metadata: { tableVersion, publicationTime },
    records,
    groups,
  }
}

function gridKey(easting, northing) {
  return `${Math.floor(easting / GRID_SIZE)}:${Math.floor(northing / GRID_SIZE)}`
}

function createSegmentIndex(segments) {
  const grid = new Map()
  for (const segment of segments) {
    for (let index = 1; index < segment.points.length; index += 1) {
      const line = {
        segment,
        first: segment.points[index - 1],
        second: segment.points[index],
      }
      const key = gridKey(
        (line.first[0] + line.second[0]) / 2,
        (line.first[1] + line.second[1]) / 2,
      )
      const values = grid.get(key) ?? []
      values.push(line)
      grid.set(key, values)
    }
  }
  return grid
}

function candidateLines(grid, point) {
  const east = Math.floor(point[0] / GRID_SIZE)
  const north = Math.floor(point[1] / GRID_SIZE)
  const lines = []
  for (let x = east - 1; x <= east + 1; x += 1) {
    for (let y = north - 1; y <= north + 1; y += 1) {
      lines.push(...(grid.get(`${x}:${y}`) ?? []))
    }
  }
  return lines
}

export function matchCounterGroups(groups, segments) {
  const grid = createSegmentIndex(segments)
  return groups.map((group) => {
    const nearestByRoad = new Map()
    for (const line of candidateLines(grid, group.lv95)) {
      const projection = pointSegmentProjection(group.lv95, line.first, line.second)
      const previous = nearestByRoad.get(line.segment.road)
      if (previous && previous.distance <= projection.distance) continue
      nearestByRoad.set(line.segment.road, {
        distance: projection.distance,
        projected: projection.projected,
        segment: line.segment,
      })
    }
    const candidates = [...nearestByRoad.values()].sort(
      (left, right) => left.distance - right.distance,
    )
    const best = candidates[0]
    const second = candidates[1]
    const distance = best?.distance ?? Infinity
    const confidence =
      distance <= HIGH_CONFIDENCE_DISTANCE &&
      (!second || second.distance - distance >= AMBIGUITY_DISTANCE)
        ? 'high'
        : distance <= MAXIMUM_MATCH_DISTANCE
          ? 'review'
          : 'unmatched'
    const distanceMetres = Number.isFinite(distance)
      ? Math.round(distance)
      : undefined
    return {
      ...group,
      candidateMatches: candidates.slice(0, 3).map((candidate) => ({
        distance: candidate.distance,
        projected: candidate.projected,
        segment: candidate.segment,
      })),
      match:
        confidence === 'unmatched'
          ? { confidence, distanceMetres }
          : {
              confidence,
              distanceMetres,
              road: best.segment.road,
              axisName: best.segment.axisName,
              axisPosition: best.segment.position,
              segmentId: best.segment.id,
              mainline: best.segment.mainline,
              projectedCoordinate: lv95ToWgs84(best.projected),
              competingRoad: second?.segment.road,
              competingDistanceMetres: second
                ? Math.round(second.distance)
                : undefined,
            },
    }
  })
}

function candidateMatch(candidate, confidence, method) {
  return {
    confidence,
    method,
    distanceMetres: Math.round(candidate.distance),
    road: candidate.segment.road,
    axisName: candidate.segment.axisName,
    axisPosition: candidate.segment.position,
    segmentId: candidate.segment.id,
    mainline: candidate.segment.mainline,
    projectedCoordinate: lv95ToWgs84(candidate.projected),
  }
}

function continuityScore(group, road, anchors) {
  const nearbyStations = new Map()
  for (const anchor of anchors) {
    if (anchor.match.road !== road || anchor.stationId === group.stationId) continue
    const distance = Math.hypot(
      group.lv95[0] - anchor.lv95[0],
      group.lv95[1] - anchor.lv95[1],
    )
    if (distance > CONTINUITY_RADIUS) continue
    const current = nearbyStations.get(anchor.stationId)
    if (current === undefined || distance < current) {
      nearbyStations.set(anchor.stationId, distance)
    }
  }
  return [...nearbyStations.values()].reduce(
    (score, distance) => score + Math.exp(-distance / CONTINUITY_DECAY),
    0,
  )
}

export function resolveContinuityMatches(matches) {
  const anchors = matches.filter(({ match }) => match.confidence === 'high')
  return matches.map((group) => {
    if (group.match.confidence !== 'review') return group
    const scored = group.candidateMatches
      .filter(({ distance }) => distance <= MAXIMUM_MATCH_DISTANCE)
      .map((candidate) => ({
        candidate,
        score: continuityScore(group, candidate.segment.road, anchors),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.candidate.distance - right.candidate.distance,
      )
    const winner = scored[0]
    const runnerUp = scored[1]
    if (!winner || winner.score < CONTINUITY_MINIMUM_SCORE) return group
    if (
      runnerUp &&
      (winner.score < runnerUp.score * CONTINUITY_SCORE_RATIO ||
        winner.score - runnerUp.score < CONTINUITY_SCORE_MARGIN)
    ) {
      return group
    }
    return {
      ...group,
      match: candidateMatch(winner.candidate, 'continuity', 'neighbouring-counters'),
    }
  })
}

function coordinateDistanceKm(first, second) {
  const meanLatitude = ((first[1] + second[1]) / 2) * (Math.PI / 180)
  const longitudeKm = (second[0] - first[0]) * 111.32 * Math.cos(meanLatitude)
  const latitudeKm = (second[1] - first[1]) * 110.57
  return Math.hypot(longitudeKm, latitudeKm)
}

function buildCounterSections(road, roadGroups) {
  const nodesByStation = new Map()
  for (const group of roadGroups) {
    const coordinate = group.match.projectedCoordinate
    if (!coordinate) continue
    const node = nodesByStation.get(group.stationId) ?? {
      stationId: group.stationId,
      coordinate,
      directions: new Map(),
    }
    node.directions.set(group.direction, group.id)
    nodesByStation.set(group.stationId, node)
  }
  const nodes = [...nodesByStation.values()].sort((left, right) =>
    left.stationId.localeCompare(right.stationId),
  )
  if (nodes.length < 2) return []

  const visited = new Set([nodes[0].stationId])
  const edges = []
  while (visited.size < nodes.length) {
    let closest
    for (const from of nodes) {
      if (!visited.has(from.stationId)) continue
      for (const to of nodes) {
        if (visited.has(to.stationId)) continue
        const distanceKm = coordinateDistanceKm(from.coordinate, to.coordinate)
        if (!closest || distanceKm < closest.distanceKm) {
          closest = { from, to, distanceKm }
        }
      }
    }
    if (!closest || closest.distanceKm > MAXIMUM_SECTION_DISTANCE_KM) {
      const seed = nodes.find((node) => !visited.has(node.stationId))
      if (!seed) break
      visited.add(seed.stationId)
      continue
    }
    visited.add(closest.to.stationId)
    if (closest.distanceKm < 0.02) continue
    edges.push(closest)
  }

  return edges.flatMap(({ from, to, distanceKm }) =>
    ['positive', 'negative'].flatMap((direction) => {
      const fromSiteId = from.directions.get(direction)
      const toSiteId = to.directions.get(direction)
      if (!fromSiteId || !toSiteId) return []
      const reverse = direction === 'negative'
      return [
        {
          id: `${road}:${direction}:${from.stationId}:${to.stationId}`,
          road,
          direction,
          fromSiteId: reverse ? toSiteId : fromSiteId,
          toSiteId: reverse ? fromSiteId : toSiteId,
          fromCoordinate: reverse ? to.coordinate : from.coordinate,
          toCoordinate: reverse ? from.coordinate : to.coordinate,
          distanceKm: Number(distanceKm.toFixed(2)),
        },
      ]
    }),
  )
}

function roadBounds(paths) {
  const coordinates = paths.flatMap(({ points }) => points)
  const longitudes = coordinates.map(([longitude]) => longitude)
  const latitudes = coordinates.map(([, latitude]) => latitude)
  return {
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
  }
}

function cameraScaleForBounds(bounds) {
  const longitudeSpan = bounds.maxLongitude - bounds.minLongitude
  const latitudeSpan = bounds.maxLatitude - bounds.minLatitude
  return Number(Math.max(0.36, Math.min(0.95, Math.max(longitudeSpan / 4.3, latitudeSpan / 2.2))).toFixed(2))
}

function percentile(values, fraction) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

export function buildRoadTopologyArtifact(
  axes,
  sites,
  { sourceDate = '2026-08-01', sourceUpdated = '2026-09-01T03:32:13Z' } = {},
) {
  const matches = resolveContinuityMatches(
    matchCounterGroups(sites.groups, axes.segments),
  )
  const matched = matches.filter(({ match }) => match.confidence !== 'unmatched')
  const highConfidence = matches.filter(({ match }) => match.confidence === 'high')
  const continuityResolved = matches.filter(
    ({ match }) => match.confidence === 'continuity',
  )
  const review = matches.filter(({ match }) => match.confidence === 'review')
  const unmatched = matches.filter(({ match }) => match.confidence === 'unmatched')
  const distances = matched.map(({ match }) => match.distanceMetres)
  const stationIds = new Set(sites.records.map(({ stationId }) => stationId))
  const matchedStationIds = new Set(matched.map(({ stationId }) => stationId))
  const roads = [...new Set(axes.segments.map(({ road }) => road))].sort(
    (left, right) => Number(left.slice(1)) - Number(right.slice(1)),
  )
  const paths = axes.segments.map((segment) => ({
    id: segment.id,
    road: segment.road,
    axisName: segment.axisName,
    position: segment.position,
    mainline: segment.mainline,
    points: segment.displayPoints.map(lv95ToWgs84),
  }))
  const eligibleMatches = matches.filter(
    ({ match }) =>
      match.confidence === 'high' || match.confidence === 'continuity',
  )
  const sections = roads.flatMap((road) =>
    buildCounterSections(
      road,
      eligibleMatches.filter(({ match }) => match.road === road),
    ),
  )
  const roadSummaries = roads.map((road) => {
    const roadPaths = paths.filter((path) => path.road === road)
    const roadSites = eligibleMatches.filter(({ match }) => match.road === road)
    const bounds = roadBounds(roadPaths)
    return {
      id: road,
      label: `A${road.slice(1)}`,
      officialLabel: road,
      description: ROAD_DESCRIPTIONS[road],
      bounds,
      focus: [
        Number(((bounds.minLongitude + bounds.maxLongitude) / 2).toFixed(5)),
        Number(((bounds.minLatitude + bounds.maxLatitude) / 2).toFixed(5)),
      ],
      cameraScale: cameraScaleForBounds(bounds),
      pathCount: roadPaths.length,
      stationCount: new Set(roadSites.map(({ stationId }) => stationId)).size,
      directionalSiteCount: roadSites.length,
      sectionCount: sections.filter((section) => section.road === road).length,
    }
  })
  return {
    metadata: {
      publisher: 'Federal Roads Office (ASTRA / FEDRO)',
      sourceUrl: SOURCE_URL,
      sourceAsset: SOURCE_ASSET,
      sourceCrs: 'EPSG:2056',
      sourceDate,
      sourceUpdated,
      measurementSiteUrl: MEASUREMENT_SITE_URL,
      measurementSiteTableVersion: sites.metadata.tableVersion,
      measurementSitePublishedAt: sites.metadata.publicationTime,
      model: 'Measured counter topology / no vehicle tracking',
      coverage: {
        federalStations: stationIds.size,
        federalDetectorRecords: sites.records.length,
        usableDirectionalGroups: matches.length,
        matchedDirectionalGroups: matched.length,
        highConfidenceDirectionalGroups: highConfidence.length,
        continuityResolvedDirectionalGroups: continuityResolved.length,
        reviewDirectionalGroups: review.length,
        unmatchedDirectionalGroups: unmatched.length,
        matchedStations: matchedStationIds.size,
        medianMatchDistanceMetres: Math.round(percentile(distances, 0.5)),
        p95MatchDistanceMetres: Math.round(percentile(distances, 0.95)),
        roads: roads.length,
        axisSegments: axes.segments.length,
      },
      matching: {
        highConfidenceDistanceMetres: HIGH_CONFIDENCE_DISTANCE,
        ambiguityDistanceMetres: AMBIGUITY_DISTANCE,
        maximumDistanceMetres: MAXIMUM_MATCH_DISTANCE,
        note:
          'Counter coordinates are coarse. Continuity matches use nearby accepted counters on the same road; remaining review matches are retained for audit and cannot drive measured section flow.',
      },
    },
    roads: roadSummaries,
    paths,
    sections,
    sites: matches.map((group) => ({
      id: group.id,
      stationId: group.stationId,
      direction: group.direction,
      detectorIds: group.detectorIds,
      carriageways: group.carriageways,
      coordinate: group.coordinate.map((value) => Number(value.toFixed(5))),
      match: group.match,
    })),
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npm run data:road:topology -- --axes <nationalstrassenachsen.xtf> --measurement-sites <astra-mst.xml> [--output public/data/swiss-road-topology.json]',
    )
    return
  }
  const axesPath = resolve(requiredArgument('axes'))
  const measurementSitesPath = resolve(requiredArgument('measurement-sites'))
  const output = resolve(argument('output', DEFAULT_OUTPUT))
  const axes = parseNationalRoadAxes(await readFile(axesPath, 'utf8'))
  const sites = parseAstraMeasurementSites(
    await readFile(measurementSitesPath, 'utf8'),
  )
  const artifact = buildRoadTopologyArtifact(axes, sites)
  await writeFile(output, `${JSON.stringify(artifact)}\n`)
  const { coverage } = artifact.metadata
  console.log(
    `Wrote ${output}: ${coverage.matchedDirectionalGroups}/${coverage.usableDirectionalGroups} directional groups matched across ${coverage.roads} national roads (${coverage.highConfidenceDirectionalGroups} spatial, ${coverage.continuityResolvedDirectionalGroups} continuity, ${coverage.reviewDirectionalGroups} review, ${coverage.unmatchedDirectionalGroups} unmatched)`,
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await main()
}
