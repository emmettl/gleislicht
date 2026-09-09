import type { AstraMeasurement, AstraSnapshot } from '../scripts/astra-measured-data.mjs'

export const POLICY_VERSION = 1
export const ARCHIVE_ROOT = `road-history/v${POLICY_VERSION}/national`
export const MINIMUM_SITE_COVERAGE = 0.6
const minuteMs = 60_000
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' })

export function previousSwissDate(now = new Date()): string {
  return new Date(Date.parse(`${dateFormatter.format(now)}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

/** Resolve actual UTC boundaries; spring has 1,380 minutes, autumn 1,500. */
export function swissDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid Swiss service date')
  const midnightUtc = Date.parse(`${date}T00:00:00Z`)
  const hours = []
  for (let time = midnightUtc - 3 * 3_600_000; time < midnightUtc + 26 * 3_600_000; time += 3_600_000) {
    if (dateFormatter.format(new Date(time)) === date) hours.push(time)
  }
  if (![23, 24, 25].includes(hours.length)) throw new Error('Unsupported Swiss civil day')
  return { date, start: hours[0], end: hours.at(-1)! + 3_600_000, expectedMinutes: hours.length * 60, hours }
}

export interface CounterSite {
  id: string
  stationId: string
  direction: string
  detectorIds: string[]
  match: { confidence: string; road?: string }
}
export interface Topology {
  metadata: { measurementSiteTableVersion: number }
  sites: CounterSite[]
  sections: { id: string; road: string; direction: string; fromSiteId: string; toSiteId: string; distanceKm: number }[]
}
export function acceptedSites(topology: Topology) {
  const sites = topology.sites.filter(site => ['high', 'continuity', 'authoritative'].includes(site.match.confidence))
  if (!sites.length || new Set(sites.map(site => site.id)).size !== sites.length || sites.some(site => !site.detectorIds.length || new Set(site.detectorIds).size !== site.detectorIds.length)) throw new Error('Invalid accepted counter topology')
  return sites
}
export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export function recordingKey(time: number) {
  const timestamp = new Date(time).toISOString()
  return `astra/national/${timestamp.slice(0, 10)}/${timestamp.replaceAll(':', '-').replaceAll('.', '-')}.json.gz`
}

export type SiteValue = [number, number, number, number, number]
export interface CounterTotals {
  observedMinutes: number
  lightVehicles: number
  heavyVehicles: number
  lightVehicleSpeedSum: number
  heavyVehicleSpeedSum: number
}
export const emptyTotals = (): CounterTotals => ({ observedMinutes: 0, lightVehicles: 0, heavyVehicles: 0, lightVehicleSpeedSum: 0, heavyVehicleSpeedSum: 0 })
export function addTotals(target: CounterTotals, source: CounterTotals) {
  for (const key of Object.keys(target) as (keyof CounterTotals)[]) target[key] += source[key]
}
const usable = (flow: number | undefined, speed: number | undefined): boolean =>
  Number.isFinite(flow) && flow! >= 0 && (flow === 0 || (Number.isFinite(speed) && speed! > 0))

/** Require every configured lane and both classes. Missing lanes never reduce a counter's apparent volume. */
export function minuteValues(snapshot: AstraSnapshot, time: number, topology: Topology, sites: CounterSite[]): SiteValue[] {
  if (snapshot.metadata.measurementKind !== 'recorded' || snapshot.metadata.recordingScope !== 'national' || snapshot.metadata.measurementSiteTableVersion !== topology.metadata.measurementSiteTableVersion) throw new Error('Recording scope or detector-table version mismatch')
  const measurements = new Map<string, AstraMeasurement>()
  for (const measurement of snapshot.measurements) {
    if (Date.parse(measurement.measurementTime) !== time) continue
    if (measurements.has(measurement.siteId)) throw new Error('Duplicate detector measurement')
    measurements.set(measurement.siteId, measurement)
  }
  return sites.flatMap((site, index) => {
    const lanes = site.detectorIds.map(id => measurements.get(id))
    if (lanes.some(lane => !lane || !usable(lane.lightFlowPerHour, lane.lightSpeedKmh) || !usable(lane.heavyFlowPerHour, lane.heavySpeedKmh))) return []
    const combine = (kind: 'light' | 'heavy') => {
      const flow = lanes.reduce((sum, lane) => sum + lane![`${kind}FlowPerHour`]!, 0)
      const weightedSpeed = lanes.reduce((sum, lane) => sum + (lane![`${kind}FlowPerHour`]! > 0 ? lane![`${kind}FlowPerHour`]! * lane![`${kind}SpeedKmh`]! : 0), 0)
      return [flow, flow ? weightedSpeed / flow : 0]
    }
    const [lightFlow, lightSpeed] = combine('light'), [heavyFlow, heavySpeed] = combine('heavy')
    return [[index, lightFlow, lightSpeed, heavyFlow, heavySpeed] as SiteValue]
  })
}

export function summarizeCounter(site: CounterSite, totals: CounterTotals, expectedMinutes: number) {
  const round = (value: number) => Math.round(value * 1000) / 1000
  const total = totals.lightVehicles + totals.heavyVehicles
  return {
    siteId: site.id, stationId: site.stationId, road: site.match.road ?? null, direction: site.direction,
    detectorIds: site.detectorIds,
    expectedMinutes, observedMinutes: totals.observedMinutes, coverage: totals.observedMinutes / expectedMinutes,
    // Null means no usable observations; zero means measured absence of vehicles.
    lightVehicles: totals.observedMinutes ? round(totals.lightVehicles) : null,
    heavyVehicles: totals.observedMinutes ? round(totals.heavyVehicles) : null,
    lightMeanSpeedKmh: totals.lightVehicles ? round(totals.lightVehicleSpeedSum / totals.lightVehicles) : null,
    heavyMeanSpeedKmh: totals.heavyVehicles ? round(totals.heavyVehicleSpeedSum / totals.heavyVehicles) : null,
    heavyShare: total ? totals.heavyVehicles / total : null,
  }
}
export type CounterSummary = ReturnType<typeof summarizeCounter>
export const CSV_COLUMNS = ['serviceDate', 'hourStartUtc', 'localHour', 'siteId', 'stationId', 'road', 'direction', 'expectedMinutes', 'observedMinutes', 'coverage', 'lightVehicles', 'heavyVehicles', 'lightMeanSpeedKmh', 'heavyMeanSpeedKmh', 'heavyShare'] as const
export function csvRow(row: Record<string, unknown>) {
  return CSV_COLUMNS.map(key => {
    const value = row[key] == null ? '' : String(row[key])
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  }).join(',') + '\n'
}
export const localHour = (time: number) => hourFormatter.format(new Date(time))

export interface ArchiveIO {
  readRecording(key: string): Promise<AstraSnapshot | null>
  readJson(key: string): Promise<any>
  write(key: string, value: string): Promise<void>
  promote(key: string, pointer: { serviceDate: string; manifestKey: string }): Promise<void>
}

/** Stream one hour at a time, with four raw responses in flight, keeping memory bounded. */
export async function compileDailyArchive(io: ArchiveIO, topology: Topology, serviceDate: string) {
  const day = swissDay(serviceDate), sites = acceptedSites(topology)
  const topologyHash = await sha256(JSON.stringify({ policyVersion: POLICY_VERSION, tableVersion: topology.metadata.measurementSiteTableVersion, sites, sections: topology.sections }))
  const prefix = `${ARCHIVE_ROOT}/${serviceDate}/${topologyHash}`
  const manifestKey = `${prefix}/manifest.json`
  const existing = await io.readJson(manifestKey)
  if (existing?.metadata?.complete === true) {
    await io.promote(`${ARCHIVE_ROOT}/latest.json`, { serviceDate, manifestKey })
    return existing
  }
  const dailyTotals = sites.map(emptyTotals), chunks = []
  const missingMinutes: string[] = [], sparseMinutes: string[] = []
  const versions = new Set<number>()
  let observedMinutes = 0, minimumCoverage = 1
  let csv = CSV_COLUMNS.join(',') + '\n'
  for (const hourStart of day.hours) {
    const totals = sites.map(emptyTotals)
    const minutes: [number, SiteValue[]][] = []
    for (let offset = 0; offset < 60; offset += 4) {
      const times = Array.from({ length: 4 }, (_, index) => hourStart + (offset + index) * minuteMs)
      const snapshots = await Promise.all(times.map(time => io.readRecording(recordingKey(time))))
      for (let index = 0; index < times.length; index++) {
        const time = times[index], snapshot = snapshots[index]
        if (!snapshot) { missingMinutes.push(new Date(time).toISOString()); minimumCoverage = 0; continue }
        versions.add(snapshot.metadata.measurementSiteTableVersion!)
        const values = minuteValues(snapshot, time, topology, sites)
        observedMinutes++
        const coverage = values.length / sites.length
        minimumCoverage = Math.min(minimumCoverage, coverage)
        if (coverage < MINIMUM_SITE_COVERAGE) sparseMinutes.push(new Date(time).toISOString())
        // Elapsed seconds from this civil day's actual UTC midnight: no DST collisions.
        minutes.push([(time - day.start) / 1000, values])
        for (const [site, lightFlow, lightSpeed, heavyFlow, heavySpeed] of values) {
          const lightVehicles = lightFlow / 60, heavyVehicles = heavyFlow / 60
          addTotals(totals[site], { observedMinutes: 1, lightVehicles, heavyVehicles, lightVehicleSpeedSum: lightVehicles * lightSpeed, heavyVehicleSpeedSum: heavyVehicles * heavySpeed })
        }
      }
    }
    const hourStartUtc = new Date(hourStart).toISOString()
    const id = String((hourStart - day.start) / 3_600_000).padStart(2, '0')
    const body = JSON.stringify({ hourStartUtc, localHour: localHour(hourStart), windowStart: (hourStart - day.start) / 1000, windowEnd: (hourStart - day.start) / 1000 + 3600, minutes }) + '\n'
    const key = `${prefix}/minutes/${id}.json.gz`
    await io.write(key, body)
    chunks.push({ key, hourStartUtc, localHour: localHour(hourStart), minuteCount: minutes.length, sha256: await sha256(body) })
    for (let index = 0; index < sites.length; index++) {
      addTotals(dailyTotals[index], totals[index])
      csv += csvRow({ serviceDate, hourStartUtc, localHour: localHour(hourStart), ...summarizeCounter(sites[index], totals[index], 60) })
    }
  }
  const summary = {
    metadata: {
      schemaVersion: POLICY_VERSION, serviceDate, timeZone: 'Europe/Zurich', topologyHash,
      measurementSiteTableVersion: [...versions][0] ?? topology.metadata.measurementSiteTableVersion,
      expectedMinutes: day.expectedMinutes, observedMinutes, minimumSiteCoverage: minimumCoverage,
      complete: !missingMinutes.length && !sparseMinutes.length,
      firstMeasurementTime: new Date(day.start).toISOString(), endExclusive: new Date(day.end).toISOString(),
      clock: 'elapsed-seconds-since-swiss-midnight',
      missingMinutes, sparseMinutes,
      policy: 'All configured lanes and both vehicle classes required per directional counter minute. Volumes integrate vehicles/hour over observed minutes only; no missing-minute extrapolation. Speeds are vehicle-weighted. Do not sum successive counters as unique vehicles. Compare identical detector sets and coverage.',
    },
    counters: sites.map((site, index) => summarizeCounter(site, dailyTotals[index], day.expectedMinutes)),
  }
  const summaryKey = `${prefix}/daily.json.gz`, hourlyKey = `${prefix}/hourly.csv.gz`, topologyKey = `${prefix}/topology.json.gz`
  await io.write(summaryKey, JSON.stringify(summary) + '\n')
  await io.write(hourlyKey, csv)
  await io.write(topologyKey, JSON.stringify({ sites, sections: topology.sections, metadata: topology.metadata }) + '\n')
  const manifest = { metadata: summary.metadata, summaryKey, hourlyKey, topologyKey, chunks }
  // Commit marker comes last; a failed run cannot replace the last complete day.
  await io.write(manifestKey, JSON.stringify(manifest) + '\n')
  if (summary.metadata.complete) await io.promote(`${ARCHIVE_ROOT}/latest.json`, { serviceDate, manifestKey })
  return manifest
}
