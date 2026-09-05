import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  A1_ZURICH_DIRECTIONS,
  A1_ZURICH_PATH,
} from './astra-road-study-config.mjs'

const WINDOW_START = 6 * 3600 + 45 * 60
const WINDOW_END = 8 * 3600 + 45 * 60
const SAMPLE_INTERVAL_SECONDS = 60

// A1 detector sites from ASTRA/OTD Measurement Site Table v23 (2026-06-18).
// Values below are a representative visual calibration until authenticated
// one-minute snapshots can be accumulated into an honest historical study.
function gaussian(value, centre, width) {
  return Math.exp(-0.5 * ((value - centre) / width) ** 2)
}

function samples(direction) {
  return Array.from(
    { length: (WINDOW_END - WINDOW_START) / SAMPLE_INTERVAL_SECONDS + 1 },
    (_, index) => {
      const time = WINDOW_START + index * SAMPLE_INTERVAL_SECONDS
      const minutes = (time - WINDOW_START) / 60
      const rush = gaussian(minutes, direction === 'eastbound' ? 55 : 82, 31)
      const secondary = gaussian(minutes, direction === 'eastbound' ? 105 : 24, 22)
      const lightFlow = Math.round(1_180 + 1_520 * rush + 390 * secondary)
      const congestion = Math.min(1, (lightFlow - 1_100) / 2_050)
      const lightSpeed = Math.round(107 - congestion * 45 + 3 * Math.sin(index / 8))
      const heavyFlow = Math.round(120 + 105 * rush + 34 * secondary)
      const heavySpeed = Math.round(86 - congestion * 19 + 2 * Math.cos(index / 11))
      return [time, lightFlow, lightSpeed, heavyFlow, heavySpeed]
    },
  )
}

const snapshot = {
  metadata: {
    publisher: 'Federal Roads Office (ASTRA / FEDRO)',
    serviceDate: '2026-09-04',
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    sourceUrl:
      'https://opentransportdata.swiss/en/cookbook/road-traffic-cookbook/rt-road-traffic-counters/',
    measurementSiteUrl:
      'https://data.opentransportdata.swiss/en/dataset/trafficcounters',
    measurementSiteTableVersion: 23,
    measurementSitePublishedAt: '2026-06-18T12:11:49.461750Z',
    measurementKind: 'representative-calibration',
    model: 'Traffic-flow reconstruction / no vehicle tracking',
    note:
      'Detector geography is sourced from ASTRA. Flow and speed are representative calibration values, not historical ASTRA observations.',
    sampleIntervalSeconds: SAMPLE_INTERVAL_SECONDS,
    visualSampleRate: 0.055,
  },
  corridors: [
    {
      id: 'a1-zurich',
      name: 'A1 Zürich · Winterthur ↔ Aargau',
      road: 'A1',
      distanceKm: 41.8,
      path: A1_ZURICH_PATH,
      directions: A1_ZURICH_DIRECTIONS.map((direction) => ({
        id: direction.id,
        label: direction.label,
        reverse: direction.reverse,
        detectorIds: direction.detectorGroups.flat(),
        samples: samples(direction.id),
      })),
    },
  ],
}

const output = resolve('public/data/swiss-road-morning.json')
await writeFile(output, `${JSON.stringify(snapshot)}\n`)
console.log(
  `Wrote ${output} (${snapshot.corridors.length} corridor, ${snapshot.corridors[0].directions[0].samples.length} samples per direction)`,
)
