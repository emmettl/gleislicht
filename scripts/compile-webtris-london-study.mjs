#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const SITES_URL = 'https://webtris.nationalhighways.co.uk/api/v1.0/sites'
const REPORT_URL =
  'https://webtris.nationalhighways.co.uk/api/v1.0/reports/daily'
const BOUNDS = [-0.75, 51.2, 0.4, 51.75]
const BATCH_SIZE = 10
const SAMPLE_INTERVAL_SECONDS = 15 * 60

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function chainageFor(site) {
  const match = /\/(\d+)/.exec(site.Description)
  return match ? Number(match[1]) : Number.NaN
}

function suffixFor(site) {
  return /A$/.test(site.Description)
    ? 'A'
    : /B$/.test(site.Description)
      ? 'B'
      : undefined
}

function inBounds(site) {
  return (
    site.Longitude >= BOUNDS[0] &&
    site.Latitude >= BOUNDS[1] &&
    site.Longitude <= BOUNDS[2] &&
    site.Latitude <= BOUNDS[3]
  )
}

export function motorwaySites(sites, roads) {
  const configuration = new Map(roads.map((road) => [road.id, road]))
  return sites
    .map((site) => {
      const roadId = site.Description?.split('/')[0]
      return {
        ...site,
        roadId,
        configuration: configuration.get(roadId),
        chainage: chainageFor(site),
        suffix: suffixFor(site),
      }
    })
    .filter(
      (site) =>
        site.configuration &&
        site.Status === 'Active' &&
        site.suffix &&
        Number.isFinite(site.chainage) &&
        inBounds(site) &&
        (site.configuration.maximumChainage === undefined ||
          site.chainage < site.configuration.maximumChainage),
    )
}

export function sampledMotorwaySites(sites, roads) {
  const selected = []
  for (const road of roads) {
    for (const suffix of ['A', 'B']) {
      const candidates = sites
        .filter((site) => site.roadId === road.id && site.suffix === suffix)
        .sort((first, second) => first.chainage - second.chainage)
      let last
      for (const candidate of candidates) {
        if (
          !last ||
          candidate.chainage - last.chainage >= road.sampleSpacingChainage
        ) {
          selected.push(candidate)
          last = candidate
        }
      }
      const final = candidates.at(-1)
      if (final && last !== final) selected.push(final)
    }
  }
  return selected
}

function distanceKilometres(first, second) {
  const latitude = ((first[1] + second[1]) * Math.PI) / 360
  const east = (second[0] - first[0]) * 111.32 * Math.cos(latitude)
  const north = (second[1] - first[1]) * 111.32
  return Math.hypot(east, north)
}

function pathDistanceKilometres(path) {
  return path.reduce(
    (total, point, index) =>
      index ? total + distanceKilometres(path[index - 1], point) : total,
    0,
  )
}

function oriented(sites, suffix) {
  const ordered = [...sites].sort(
    (first, second) => first.chainage - second.chainage,
  )
  return suffix === 'A' ? ordered : ordered.reverse()
}

function uniqueCoordinates(sites) {
  const seen = new Set()
  return sites.flatMap((site) => {
    const key = `${site.Longitude.toFixed(6)},${site.Latitude.toFixed(6)}`
    if (seen.has(key)) return []
    seen.add(key)
    return [[site.Longitude, site.Latitude]]
  })
}

function pathBetween(allSites, first, second, closed) {
  const start = allSites.indexOf(first)
  const end = allSites.indexOf(second)
  if (start < 0 || end < 0) return []
  if (end > start) return uniqueCoordinates(allSites.slice(start, end + 1))
  if (!closed) return uniqueCoordinates([first, second])
  return uniqueCoordinates([
    ...allSites.slice(start),
    ...allSites.slice(0, end + 1),
  ])
}

export function buildLondonRoadTopology(allSites, measuredSites, roads, sourceDate) {
  const acceptedIds = new Set(measuredSites.map(({ Id }) => Id))
  const paths = []
  const sections = []
  for (const road of roads) {
    for (const suffix of ['A', 'B']) {
      const all = oriented(
        allSites.filter(
          (site) => site.roadId === road.id && site.suffix === suffix,
        ),
        suffix,
      )
      const measured = all.filter((site) => acceptedIds.has(site.Id))
      const points = uniqueCoordinates(all)
      if (points.length > 1) {
        paths.push({
          id: `${road.id}-${suffix}`,
          road: road.id,
          axisName: road.description,
          position: suffix,
          mainline: true,
          points,
        })
      }
      const pairs = measured.slice(1).map((site, index) => [measured[index], site])
      if (road.closed && measured.length > 2) {
        pairs.push([measured.at(-1), measured[0]])
      }
      for (const [from, to] of pairs) {
        const path = pathBetween(all, from, to, road.closed)
        if (path.length < 2) continue
        sections.push({
          id: `${road.id}-${suffix}-${from.Id}-${to.Id}`,
          road: road.id,
          direction: suffix === 'A' ? 'positive' : 'negative',
          fromSiteId: from.Id,
          toSiteId: to.Id,
          fromCoordinate: path[0],
          toCoordinate: path.at(-1),
          path,
          distanceKm: Math.round(pathDistanceKilometres(path) * 100) / 100,
        })
      }
    }
  }

  const topologyRoads = roads.map((road) => {
    const roadPaths = paths.filter((path) => path.road === road.id)
    const roadSites = measuredSites.filter((site) => site.roadId === road.id)
    return {
      id: road.id,
      label: road.label,
      officialLabel: road.officialLabel,
      description: road.description,
      bounds: road.bounds,
      focus: road.focus,
      cameraScale: road.cameraScale,
      pathCount: roadPaths.length,
      stationCount: new Set(roadSites.map(({ Description }) => Description)).size,
      directionalSiteCount: roadSites.length,
      sectionCount: sections.filter((section) => section.road === road.id).length,
    }
  })
  return {
    metadata: {
      publisher: 'National Highways',
      sourceUrl: SITES_URL,
      sourceAsset: 'WebTRIS site inventory and historical daily reports',
      sourceCrs: 'WGS84',
      sourceDate,
      sourceUpdated: new Date().toISOString(),
      measurementSiteUrl: SITES_URL,
      measurementSiteTableVersion: 0,
      measurementSitePublishedAt: new Date().toISOString(),
      model: 'Motorway detector topology / sampled at 1–2 km spacing',
      coverage: {
        federalStations: measuredSites.length,
        federalDetectorRecords: allSites.length,
        usableDirectionalGroups: measuredSites.length,
        matchedDirectionalGroups: measuredSites.length,
        highConfidenceDirectionalGroups: measuredSites.length,
        continuityResolvedDirectionalGroups: 0,
        authoritativeResolvedDirectionalGroups: 0,
        reviewDirectionalGroups: 0,
        unmatchedDirectionalGroups: 0,
        matchedStations: measuredSites.length,
        medianMatchDistanceMetres: 0,
        p95MatchDistanceMetres: 0,
        roads: topologyRoads.length,
        axisSegments: paths.length,
      },
    },
    roads: topologyRoads,
    paths,
    sections,
    sites: measuredSites.map((site) => ({
      id: site.Id,
      stationId: site.Description,
      direction: site.suffix === 'A' ? 'positive' : 'negative',
      detectorIds: [site.Id],
      carriageways: [site.suffix],
      coordinate: [site.Longitude, site.Latitude],
      match: {
        confidence: 'high',
        distanceMetres: 0,
        road: site.roadId,
        axisName: site.configuration.description,
        axisPosition: site.suffix,
        segmentId: `${site.roadId}-${site.suffix}`,
        mainline: true,
        projectedCoordinate: [site.Longitude, site.Latitude],
      },
    })),
  }
}

function number(row, key) {
  const value = Number(row[key])
  return Number.isFinite(value) ? value : undefined
}

export function reportValue(row) {
  const speedMph = number(row, 'Avg mph')
  const short = number(row, '0 - 520 cm')
  const medium = number(row, '521 - 660 cm')
  const long = number(row, '661 - 1160 cm')
  const longest = number(row, '1160+ cm')
  const interval = number(row, 'Time Interval')
  if (
    speedMph === undefined ||
    short === undefined ||
    medium === undefined ||
    long === undefined ||
    longest === undefined ||
    interval === undefined
  ) return undefined
  const time = Math.min(86_400, (interval + 1) * SAMPLE_INTERVAL_SECONDS)
  const speedKmh = Math.round(speedMph * 1.60934 * 10) / 10
  return {
    time,
    value: [
      (short + medium) * 4,
      speedKmh,
      (long + longest) * 4,
      speedKmh,
    ],
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

async function fetchReports(sites, serviceDate) {
  const compactDate = serviceDate.split('-').reverse().join('')
  const rows = []
  for (let start = 0; start < sites.length; start += BATCH_SIZE) {
    const batch = sites.slice(start, start + BATCH_SIZE)
    const parameters = new URLSearchParams({
      sites: batch.map(({ Id }) => Id).join(','),
      start_date: compactDate,
      end_date: compactDate,
      page: '1',
      page_size: '1000',
    })
    const result = await fetchJson(
      `${REPORT_URL}?${parameters.toString().replaceAll('%2C', ',')}`,
    )
    rows.push(...(result.Rows ?? []))
    console.log(
      `Downloaded WebTRIS batch ${Math.floor(start / BATCH_SIZE) + 1}/${Math.ceil(sites.length / BATCH_SIZE)}`,
    )
  }
  return rows
}

export function compileLondonRoadStudy(topology, rows, serviceDate) {
  const siteByName = new Map(
    topology.sites.map((site, index) => [site.stationId, { site, index }]),
  )
  const byTime = new Map()
  const seenSites = new Set()
  for (const row of rows) {
    const target = siteByName.get(row['Site Name'])
    const report = reportValue(row)
    if (!target || !report) continue
    seenSites.add(target.site.id)
    const values = byTime.get(report.time) ?? []
    values.push([target.index, ...report.value])
    byTime.set(report.time, values)
  }
  const minutes = [...byTime.entries()]
    .map(([time, values]) => [time, values.sort((a, b) => a[0] - b[0])])
    .sort((a, b) => a[0] - b[0])
  if (!minutes.length) throw new Error('WebTRIS returned no usable observations')
  const acceptedSites = topology.sites.filter((site) => seenSites.has(site.id))
  const siteIndex = new Map(acceptedSites.map((site, index) => [site.id, index]))
  const originalIndex = new Map(topology.sites.map((site, index) => [index, site.id]))
  const remappedMinutes = minutes.map(([time, values]) => [
    time,
    values.flatMap((value) => {
      const id = originalIndex.get(value[0])
      const index = id ? siteIndex.get(id) : undefined
      return index === undefined ? [] : [[index, ...value.slice(1)]]
    }),
  ])
  const sections = topology.sections.flatMap((section) => {
    const fromSiteIndex = siteIndex.get(section.fromSiteId)
    const toSiteIndex = siteIndex.get(section.toSiteId)
    return fromSiteIndex === undefined || toSiteIndex === undefined
      ? []
      : [{
          id: section.id,
          road: section.road,
          direction: section.direction,
          fromSiteIndex,
          toSiteIndex,
          distanceKm: section.distanceKm,
        }]
  })
  const nextServiceDate = new Date(`${serviceDate}T12:00:00Z`)
  nextServiceDate.setUTCDate(nextServiceDate.getUTCDate() + 1)

  return {
    metadata: {
      publisher: 'National Highways',
      serviceDate,
      windowStart: 0,
      windowEnd: 86_400,
      sourceUrl: REPORT_URL,
      measurementSiteTableVersion: 0,
      measurementKind: 'recorded',
      model: '15-minute motorway traffic-flow reconstruction / no vehicle tracking',
      sampleIntervalSeconds: SAMPLE_INTERVAL_SECONDS,
      acceptedSites: acceptedSites.length,
      sections: sections.length,
      minimumSiteCoverage: Math.round(
        Math.min(...remappedMinutes.map(([, values]) => values.length / acceptedSites.length)) * 1000,
      ) / 1000,
      firstMeasurementTime: `${serviceDate}T00:15:00+01:00`,
      lastMeasurementTime: `${nextServiceDate.toISOString().slice(0, 10)}T00:00:00+01:00`,
      completeMinutes: remappedMinutes.length,
    },
    siteIds: acceptedSites.map(({ id }) => id),
    sections,
    minutes: remappedMinutes,
  }
}

export function splitLondonRoadStudy(study, chunkSeconds = 6 * 3600) {
  const chunks = []
  for (let windowStart = 0; windowStart < 86_400; windowStart += chunkSeconds) {
    const windowEnd = Math.min(86_400, windowStart + chunkSeconds)
    const id = `${String(windowStart / 3600).padStart(2, '0')}-${String(windowEnd / 3600).padStart(2, '0')}`
    const minutes = study.minutes.filter(
      ([time]) => time > windowStart && time <= windowEnd,
    )
    chunks.push({
      descriptor: {
        id,
        windowStart,
        windowEnd,
        path: `all-change-road-day/${id}.json`,
        minuteCount: minutes.length,
        valueCount: minutes.reduce((total, [, values]) => total + values.length, 0),
      },
      body: { windowStart, windowEnd, minutes },
    })
  }
  return {
    manifest: {
      metadata: study.metadata,
      siteIds: study.siteIds,
      sections: study.sections,
      chunks: chunks.map(({ descriptor }) => descriptor),
    },
    chunks,
  }
}

async function main() {
  const serviceDate = argumentValue('date', '2025-09-05')
  const configPath = argumentValue(
    'config',
    'fixtures/tfl/all-change-motorways.json',
  )
  const topologyPath = argumentValue(
    'topology',
    'public/data/all-change-road-topology.json',
  )
  const manifestPath = argumentValue(
    'manifest',
    'public/data/all-change-road-day-manifest.json',
  )
  const roads = JSON.parse(await readFile(configPath, 'utf8'))
  const inventory = await fetchJson(SITES_URL)
  const allSites = motorwaySites(inventory.sites ?? [], roads)
  const sampledSites = sampledMotorwaySites(allSites, roads)
  const rows = await fetchReports(sampledSites, serviceDate)
  const provisionalTopology = buildLondonRoadTopology(
    allSites,
    sampledSites,
    roads,
    serviceDate,
  )
  const study = compileLondonRoadStudy(provisionalTopology, rows, serviceDate)
  const accepted = new Set(study.siteIds)
  const topology = buildLondonRoadTopology(
    allSites,
    sampledSites.filter((site) => accepted.has(site.Id)),
    roads,
    serviceDate,
  )
  const split = splitLondonRoadStudy(study)
  await mkdir(dirname(topologyPath), { recursive: true })
  await writeFile(topologyPath, `${JSON.stringify(topology)}\n`)
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(split.manifest)}\n`)
  for (const chunk of split.chunks) {
    const path = join(dirname(manifestPath), chunk.descriptor.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(chunk.body)}\n`)
  }
  console.log(
    `Wrote ${topology.roads.length} motorways, ${study.siteIds.length} measured sites, ${study.sections.length} sections and ${study.minutes.length} observations`,
  )
}

if (process.argv[1]?.endsWith('compile-webtris-london-study.mjs')) {
  await main()
}
