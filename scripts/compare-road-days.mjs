import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Conservative first comparison: identical topology, equal day length, fully observed counter days. */
export function compareRoadDays(baseline, current) {
  for (const day of [baseline, current]) {
    if (day?.metadata?.schemaVersion !== 1 || !Array.isArray(day.counters) || !day.metadata.topologyHash || ![1380, 1440, 1500].includes(day.metadata.expectedMinutes)) throw new Error('Expected a daily road archive summary')
  }
  if (baseline.metadata.topologyHash !== current.metadata.topologyHash) throw new Error('Counter topology changed; select a stable detector cohort before comparing')
  if (baseline.metadata.expectedMinutes !== current.metadata.expectedMinutes) throw new Error('Different civil-day lengths; compare matching UTC-offset hourly intervals instead')
  const previous = new Map(baseline.counters.map(counter => [counter.siteId, counter]))
  const excluded = [], counters = []
  for (const now of current.counters) {
    const before = previous.get(now.siteId)
    if (!before || before.observedMinutes !== baseline.metadata.expectedMinutes || now.observedMinutes !== current.metadata.expectedMinutes || JSON.stringify(before.detectorIds) !== JSON.stringify(now.detectorIds)) {
      excluded.push(now.siteId)
      continue
    }
    const beforeVolume = before.lightVehicles + before.heavyVehicles, volume = now.lightVehicles + now.heavyVehicles
    counters.push({
      siteId: now.siteId, road: now.road, direction: now.direction,
      baselineVehicles: beforeVolume, currentVehicles: volume,
      vehicleChange: volume - beforeVolume, vehicleChangePercent: beforeVolume ? (volume / beforeVolume - 1) * 100 : null,
      lightSpeedChangeKmh: before.lightMeanSpeedKmh != null && now.lightMeanSpeedKmh != null ? now.lightMeanSpeedKmh - before.lightMeanSpeedKmh : null,
      heavyShareChangePercentagePoints: before.heavyShare != null && now.heavyShare != null ? (now.heavyShare - before.heavyShare) * 100 : null,
    })
  }
  return { baseline: baseline.metadata.serviceDate, current: current.metadata.serviceDate, comparedCounters: counters.length, excludedCounters: excluded, counters,
    note: 'Observed directional counter passages, not unique network vehicles. Compare like weekdays and account for holidays before interpreting changes as a trend.' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/compare-road-days.mjs BASELINE_DAILY_JSON[.gz] CURRENT_DAILY_JSON[.gz]')
  const read = async path => {
    const bytes = await readFile(path)
    return JSON.parse(bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes).toString() : bytes.toString())
  }
  console.log(JSON.stringify(compareRoadDays(await read(process.argv[2]), await read(process.argv[3])), null, 2))
}
