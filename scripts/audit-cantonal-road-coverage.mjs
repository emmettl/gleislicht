import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { swissDateAndTime } from './compile-astra-road-study.mjs'
import { cantonalMeasurementIssues } from './cantonal-measurement-quality.mjs'

export function minuteRuns(times) {
  const runs = []
  for (const time of [...new Set(times)].sort((a, b) => a - b)) {
    const previous = runs.at(-1)
    if (previous && previous.end + 60 === time) { previous.end = time; previous.minutes++ }
    else runs.push({ start: time, end: time, minutes: 1 })
  }
  return runs
}
function summarize(times, expectedMinutes) {
  const runs = minuteRuns(times)
  return {
    completeMinutes: times.length,
    completePercent: Math.round(times.length / expectedMinutes * 10000) / 100,
    longestRunMinutes: Math.max(0, ...runs.map(r => r.minutes)),
    hourWindows: runs.filter(r => r.minutes >= 60),
  }
}

export function auditCantonalCoverage(snapshots, catalog, geometry, directions, options) {
  const { serviceDate } = options
  const byMinute = new Map()
  const detectors = new Map(catalog.detectors.map(d => [d.id, d]))
  const localTimes = new Map()
  for (const snapshot of snapshots) {
    if (snapshot.metadata?.recordingScope !== 'zurich-cantonal' || snapshot.metadata.measurementKind !== 'recorded') continue
    if (snapshot.metadata.measurementSiteTableVersion !== catalog.metadata.measurementSiteTableVersion) throw new Error('Cantonal catalog version mismatch')
    for (const m of snapshot.measurements) {
      if (!detectors.has(m.siteId)) throw new Error(`Unexpected detector ${m.siteId}`)
      if (!localTimes.has(m.measurementTime)) localTimes.set(m.measurementTime, swissDateAndTime(m.measurementTime))
      const local = localTimes.get(m.measurementTime)
      if (local.date !== serviceDate) continue
      if (local.seconds % 60) throw new Error('Observation is not minute aligned')
      if (local.seconds < (options.windowStart ?? 0) || local.seconds > (options.windowEnd ?? 86399)) continue
      const minute = byMinute.get(local.seconds) ?? new Map()
      if (minute.has(m.siteId) && JSON.stringify(minute.get(m.siteId)) !== JSON.stringify(m)) throw new Error('Conflicting duplicate cantonal measurement')
      minute.set(m.siteId, m)
      byMinute.set(local.seconds, minute)
    }
  }
  if (!byMinute.size) throw new Error('No cantonal observations in requested window')
  const windowStart = options.windowStart ?? Math.min(...byMinute.keys())
  const windowEnd = options.windowEnd ?? Math.max(...byMinute.keys())
  if (![windowStart, windowEnd].every(t => Number.isInteger(t) && t >= 0 && t < 86400 && t % 60 === 0) || windowEnd < windowStart) throw new Error('Invalid audit window')
  const times = Array.from({ length: (windowEnd - windowStart) / 60 + 1 }, (_, i) => windowStart + 60 * i)
  const completeByStation = new Map()
  const stationSummaries = catalog.stations.map(station => {
    const ids = station.detectorIds.filter(id => detectors.get(id)?.lane !== 'emergencyLane')
    const complete = [], failures = {}
    const missing = []
    for (const time of times) {
      const minute = byMinute.get(time)
      if (!minute) continue // An absent archive minute is not a detector failure.
      const issues = ids.flatMap(id => cantonalMeasurementIssues(minute.get(id)).map(reason => ({ id, reason })))
      if (ids.length && !issues.length) complete.push(time)
      else {
        missing.push(time)
        for (const { id, reason } of issues) {
          failures[id] ??= {}
          failures[id][reason] = (failures[id][reason] ?? 0) + 1
        }
      }
    }
    completeByStation.set(station.id, new Set(complete))
    return {
      id: station.id, name: geometry.stations.find(s => s.id === station.id)?.name,
      ...summarize(complete, times.length), incompleteRuns: minuteRuns(missing), detectorIssueMinutes: failures,
    }
  })
  const stationDirections = new Map(directions.stationAudit.map(s => [s.id, s]))
  const pairs = directions.sectionAudit.filter(s => s.distanceMetres >= 100 && s.distanceMetres <= 5000).map(pair => {
    const complete = times.filter(t => completeByStation.get(pair.from)?.has(t) && completeByStation.get(pair.to)?.has(t))
    const endpoints = [pair.from, pair.to].map(id => {
      const station = stationDirections.get(id)
      return {
        id, name: geometry.stations.find(s => s.id === id)?.name, status: station?.status,
        unresolvedDetectors: (station?.detectors ?? []).filter(d => d.status !== 'validated').map(d => ({ id: d.id, description: d.description, status: d.status })),
      }
    })
    return { ...pair, endpoints, ...summarize(complete, times.length) }
  }).sort((a, b) => b.longestRunMinutes - a.longestRunMinutes || b.completeMinutes - a.completeMinutes)
  const horgenIds = ['ZH.CH:4590', 'ZH.CH:4290']
  const complete = times.filter(t => horgenIds.every(id => completeByStation.get(id)?.has(t)))
  const horgenSections = directions.sections.filter(s => s.road === 'ZH:3' && horgenIds.every(id => s.fromSiteId.startsWith(`${id}:`) || s.toSiteId.startsWith(`${id}:`)))
  const endpointComparisons = horgenSections.map(section => {
    const from = directions.sites.find(s => s.id === section.fromSiteId)
    const to = directions.sites.find(s => s.id === section.toSiteId)
    const total = site => complete.reduce((sum, time) => sum + site.detectorIds.reduce((n, id) => {
      const m = byMinute.get(time).get(id)
      return n + (m.lightFlowPerHour + m.heavyFlowPerHour) / 60
    }, 0), 0)
    const fromCount = total(from), toCount = total(to)
    return { direction: section.direction, fromSiteId: from.id, toSiteId: to.id, commonMinutes: complete.length, fromCount, toCount, difference: toCount - fromCount }
  })
  return {
    metadata: { schemaVersion: 1, recordingScope: 'zurich-cantonal', serviceDate, windowStart, windowEnd, expectedMinutes: times.length, observedMinutes: byMinute.size, tableVersion: catalog.metadata.measurementSiteTableVersion, gate: 'Every non-emergency lane, both vehicle classes; positive flow requires positive speed. Zero flow may omit speed.' },
    archiveGaps: minuteRuns(times.filter(t => !byMinute.has(t))),
    horgen: { ...summarize(complete, times.length), completeRuns: minuteRuns(complete), incompleteRuns: minuteRuns(times.filter(t => byMinute.has(t) && !complete.includes(t))), stations: stationSummaries.filter(s => horgenIds.includes(s.id)), endpointComparisons, comparisonCaveat: 'Counts use simultaneous complete minute samples, not matched vehicles or travel-time-adjusted flows. Differences do not measure junction turning movements.' },
    stationSummaries, candidatePairs: pairs,
  }
}

async function main() {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const input = arg('input') ?? 'recordings/astra-zurich-cantonal'
  const parseTime = value => {
    if (value === undefined) return undefined
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use HH:MM for --from and --to')
    const [h, m] = value.split(':').map(Number); return h * 3600 + m * 60
  }
  const options = { serviceDate: arg('date') ?? '2026-09-08', windowStart: parseTime(arg('from')), windowEnd: parseTime(arg('to')) }
  const sourceFiles = [], snapshots = []
  for (const name of (await readdir(input)).filter(f => f.endsWith('.json')).sort()) {
    const body = await readFile(resolve(input, name))
    const snapshot = JSON.parse(body)
    if (snapshot.metadata?.recordingScope !== 'zurich-cantonal' || snapshot.metadata.measurementKind !== 'recorded') continue
    if (![...new Set(snapshot.measurements.map(m => m.measurementTime))].some(time => {
      const local = swissDateAndTime(time)
      return local.date === options.serviceDate && local.seconds >= (options.windowStart ?? 0) && local.seconds <= (options.windowEnd ?? 86399)
    })) continue
    sourceFiles.push({ name, sha256: createHash('sha256').update(body).digest('hex') })
    snapshots.push(snapshot)
  }
  const read = async path => JSON.parse(await readFile(path, 'utf8'))
  const inputPaths = ['data/zurich-cantonal-road-counters.json', 'public/data/zurich-cantonal-road-topology.json', 'data/zurich-cantonal-road-directions.json']
  const report = auditCantonalCoverage(snapshots,
    await read(inputPaths[0]), await read(inputPaths[1]), await read(inputPaths[2]), options)
  report.metadata.inputs = await Promise.all(inputPaths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })))
  report.metadata.sourceFiles = sourceFiles
  report.metadata.sourceManifestSha256 = createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex')
  await writeFile(arg('output') ?? 'data/zurich-cantonal-road-coverage-audit.json', JSON.stringify(report) + '\n')
  console.log(JSON.stringify({ ...report.metadata, sourceFiles: sourceFiles.length, horgen: { ...report.horgen, stations: undefined }, candidates: report.candidatePairs.slice(0, 5) }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
