import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const FILES = [
  'fixtures/tfl/all-change-rail-led-morning.json',
  'fixtures/tfl/all-change-geography.json',
]
const BUDGETS = {
  raw: 1_600 * 1024,
  gzip: 260 * 1024,
  javaScript: 340 * 1024,
  css: 14 * 1024,
  total: 650 * 1024,
  layoutRaw: 90 * 1024,
  layoutGzip: 16 * 1024,
  dayManifestGzip: 40 * 1024,
  dayChunkGzip: 190 * 1024,
  dayTotalGzip: 1_600 * 1024,
  airMorningGzip: 220 * 1024,
  airManifestGzip: 75 * 1024,
  airChunkGzip: 145 * 1024,
  airDayTotalGzip: 2_100 * 1024,
  roadTopologyGzip: 65 * 1024,
  roadManifestGzip: 8 * 1024,
  roadChunkGzip: 50 * 1024,
  roadDayTotalGzip: 250 * 1024,
  surfaceGzip: 32 * 1024,
}

const networkBytes = await readFile(
  resolve('fixtures/tfl/all-change-rail-led-morning.json'),
)
const network = JSON.parse(networkBytes.toString('utf8'))
const layoutBytes = await readFile(resolve('fixtures/tfl/all-change-diagram.json'))
const layout = JSON.parse(layoutBytes.toString('utf8'))
const layoutRaw = layoutBytes.byteLength
const layoutGzip = gzipSync(layoutBytes, { level: 9 }).byteLength
const expectedNetworkHash = createHash('sha256').update(networkBytes).digest('hex')
const overridesBytes = await readFile(
  resolve('fixtures/tfl/all-change-diagram-overrides.json'),
)
const expectedOverridesHash = createHash('sha256')
  .update(overridesBytes)
  .digest('hex')
if (layout.metadata?.sourceSha256 !== expectedNetworkHash) {
  throw new Error('London diagram was not compiled from the current opening network')
}
if (layout.metadata?.overridesSha256 !== expectedOverridesHash) {
  throw new Error('London diagram was not compiled with the current authored overrides')
}
if (layout.stops?.length !== network.stops.length) {
  throw new Error('London diagram does not cover every opening-network stop')
}
if (new Set(layout.stops.map(([sourceId]) => sourceId)).size !== network.stops.length) {
  throw new Error('London diagram stop identities are missing or duplicated')
}
if (layout.paths?.length !== network.paths.length) {
  throw new Error('London diagram path indexes do not match the opening network')
}
if (!layout.context?.waterPaths?.some((path) => path.length >= 2)) {
  throw new Error('London diagram is missing its authored Thames context path')
}

const dayManifestBytes = await readFile(
  resolve('fixtures/tfl/all-change-day-manifest.json'),
)
const dayManifest = JSON.parse(dayManifestBytes.toString('utf8'))
if (
  dayManifest.metadata?.windowStart !== 0 ||
  dayManifest.metadata?.windowEnd !== 86_400 ||
  dayManifest.chunks?.length !== 12
) {
  throw new Error('London day manifest must cover 24 hours in 12 chunks')
}
if (
  dayManifest.stops?.length !== network.stops.length ||
  dayManifest.paths?.length !== network.paths.length
) {
  throw new Error('London morning and day studies do not share one topology')
}
if (
  dayManifest.stops.some(
    (stop, index) => stop[4] !== network.stops[index]?.[4],
  )
) {
  throw new Error('London morning and day stop identities are not index-aligned')
}
let dayTotalGzip = gzipSync(dayManifestBytes, { level: 9 }).byteLength
let largestDayChunkGzip = 0
const dayTrainIds = new Set()
for (const [index, descriptor] of dayManifest.chunks.entries()) {
  const expectedStart = index * 2 * 3600
  if (
    descriptor.windowStart !== expectedStart ||
    descriptor.windowEnd !== expectedStart + 2 * 3600
  ) {
    throw new Error(`London day chunk ${descriptor.id} breaks the time sequence`)
  }
  const bytes = await readFile(resolve('fixtures/tfl', descriptor.path))
  if (descriptor.bytes !== bytes.byteLength) {
    throw new Error(`London day chunk ${descriptor.id} has stale size metadata`)
  }
  if (descriptor.sha256 !== createHash('sha256').update(bytes).digest('hex')) {
    throw new Error(`London day chunk ${descriptor.id} has stale integrity metadata`)
  }
  const chunk = JSON.parse(bytes.toString('utf8'))
  for (const train of chunk.trains) dayTrainIds.add(train.id)
  const compressed = gzipSync(bytes, { level: 9 }).byteLength
  dayTotalGzip += compressed
  largestDayChunkGzip = Math.max(largestDayChunkGzip, compressed)
}
if (dayTrainIds.size !== dayManifest.tripCount) {
  throw new Error(
    `London day chunks contain ${dayTrainIds.size} unique journeys, expected ${dayManifest.tripCount}`,
  )
}
for (const path of layout.paths) {
  if (path.length < 2) throw new Error('London diagram contains an empty path')
  for (let index = 1; index < path.length; index += 1) {
    const deltaX = path[index][0] - path[index - 1][0]
    const deltaY = path[index][1] - path[index - 1][1]
    const diagonal = Math.abs(Math.abs(deltaX) - Math.abs(deltaY)) < 0.000001
    if (deltaX !== 0 && deltaY !== 0 && !diagonal) {
      throw new Error('London diagram contains a non-octilinear segment')
    }
  }
}
const SERVICE_CATEGORIES = new Set([
  'international',
  'intercity',
  'interregio',
  'regional-express',
  's-bahn',
  'regional',
  'tram',
  'metro',
  'bus',
  'ferry',
  'cableway',
  'funicular',
  'other',
])

function kibibytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

let raw = 0
let dataGzip = 0
for (const file of FILES) {
  const bytes = await readFile(resolve(file))
  const snapshot = JSON.parse(bytes.toString('utf8'))
  for (const train of snapshot.trains ?? []) {
    if (!SERVICE_CATEGORIES.has(train.category)) {
      throw new Error(
        `${file} uses unsupported service category ${JSON.stringify(train.category)}`,
      )
    }
  }
  raw += bytes.byteLength
  dataGzip += gzipSync(bytes, { level: 9 }).byteLength
}

console.log('All Change opening-study budget:')
console.log(`  raw        ${kibibytes(raw)} / ${kibibytes(BUDGETS.raw)}`)
console.log(`  gzip       ${kibibytes(dataGzip)} / ${kibibytes(BUDGETS.gzip)}`)

const fixtureFailures = Object.entries({ raw, gzip: dataGzip }).filter(
  ([name, size]) => size > BUDGETS[name],
)
if (fixtureFailures.length) {
  throw new Error(
    `London fixture budget exceeded: ${fixtureFailures
      .map(([name, size]) => `${name} ${kibibytes(size)}`)
      .join(', ')}`,
  )
}

console.log('All Change lazy diagram budget:')
console.log(`  raw        ${kibibytes(layoutRaw)} / ${kibibytes(BUDGETS.layoutRaw)}`)
console.log(`  gzip       ${kibibytes(layoutGzip)} / ${kibibytes(BUDGETS.layoutGzip)}`)
if (layoutRaw > BUDGETS.layoutRaw || layoutGzip > BUDGETS.layoutGzip) {
  throw new Error(
    `London diagram budget exceeded: raw ${kibibytes(layoutRaw)}, gzip ${kibibytes(layoutGzip)}`,
  )
}

const dayManifestGzip = gzipSync(dayManifestBytes, { level: 9 }).byteLength
console.log('All Change progressive 24-hour budget:')
console.log(
  `  manifest   ${kibibytes(dayManifestGzip)} / ${kibibytes(BUDGETS.dayManifestGzip)}`,
)
console.log(
  `  max chunk  ${kibibytes(largestDayChunkGzip)} / ${kibibytes(BUDGETS.dayChunkGzip)}`,
)
console.log(
  `  full day   ${kibibytes(dayTotalGzip)} / ${kibibytes(BUDGETS.dayTotalGzip)}`,
)
if (
  dayManifestGzip > BUDGETS.dayManifestGzip ||
  largestDayChunkGzip > BUDGETS.dayChunkGzip ||
  dayTotalGzip > BUDGETS.dayTotalGzip
) {
  throw new Error('London progressive day budget exceeded')
}

const surfaceBytes = await readFile(
  resolve('fixtures/tfl/all-change-surface-day.json'),
)
const surface = JSON.parse(surfaceBytes.toString('utf8'))
const surfaceCategories = new Set(surface.trains.map(({ category }) => category))
if (
  surface.metadata?.windowStart !== 0 ||
  surface.metadata?.windowEnd !== 86_400 ||
  surface.metadata?.serviceDate !== dayManifest.metadata?.serviceDate ||
  !surfaceCategories.has('ferry') ||
  !surfaceCategories.has('cableway') ||
  surface.metadata?.modes?.some(
    (mode) => mode !== 'river-bus' && mode !== 'cable-car',
  )
) {
  throw new Error('London surface study violates its 24-hour mode contract')
}
const surfaceGzip = gzipSync(surfaceBytes, { level: 9 }).byteLength
console.log('All Change optional surface-study budget:')
console.log(
  `  full day   ${kibibytes(surfaceGzip)} / ${kibibytes(BUDGETS.surfaceGzip)}`,
)
if (surfaceGzip > BUDGETS.surfaceGzip) {
  throw new Error('London optional surface-study budget exceeded')
}

const airMorningBytes = await readFile(
  resolve('public/data/all-change-air-morning.json'),
)
const airMorning = JSON.parse(airMorningBytes.toString('utf8'))
const airManifestBytes = await readFile(
  resolve('public/data/all-change-air-day-manifest.json'),
)
const airManifest = JSON.parse(airManifestBytes.toString('utf8'))
if (
  airMorning.metadata?.serviceDate !== network.metadata?.serviceDate ||
  airMorning.metadata?.windowStart !== network.metadata?.windowStart ||
  airMorning.metadata?.windowEnd !== network.metadata?.windowEnd ||
  airMorning.metadata?.license !== 'ODbL 1.0'
) {
  throw new Error('London opening air study does not match the rail clock or licence contract')
}
if (
  airManifest.metadata?.windowStart !== 0 ||
  airManifest.metadata?.windowEnd !== 86_400 ||
  airManifest.chunks?.length !== 24 ||
  airManifest.trackCount !== airManifest.aircraft?.length
) {
  throw new Error('London air manifest must index a complete 24-hour study')
}
const airMorningGzip = gzipSync(airMorningBytes, { level: 9 }).byteLength
const airManifestGzip = gzipSync(airManifestBytes, { level: 9 }).byteLength
let airDayTotalGzip = airManifestGzip
let largestAirChunkGzip = 0
for (const [index, descriptor] of airManifest.chunks.entries()) {
  if (
    descriptor.windowStart !== index * 3600 ||
    descriptor.windowEnd !== (index + 1) * 3600 ||
    descriptor.path !== `all-change-air-day-${String(index).padStart(2, '0')}.json`
  ) {
    throw new Error(`London air chunk ${descriptor.id} breaks the hourly sequence`)
  }
  const bytes = await readFile(resolve('public/data', descriptor.path))
  const chunk = JSON.parse(bytes.toString('utf8'))
  if (
    chunk.windowStart !== descriptor.windowStart ||
    chunk.windowEnd !== descriptor.windowEnd ||
    chunk.tracks.length !== descriptor.trackCount
  ) {
    throw new Error(`London air chunk ${descriptor.id} disagrees with its manifest`)
  }
  const compressed = gzipSync(bytes, { level: 9 }).byteLength
  airDayTotalGzip += compressed
  largestAirChunkGzip = Math.max(largestAirChunkGzip, compressed)
}
console.log('All Change optional air-study budget:')
console.log(
  `  morning    ${kibibytes(airMorningGzip)} / ${kibibytes(BUDGETS.airMorningGzip)}`,
)
console.log(
  `  manifest   ${kibibytes(airManifestGzip)} / ${kibibytes(BUDGETS.airManifestGzip)}`,
)
console.log(
  `  max chunk  ${kibibytes(largestAirChunkGzip)} / ${kibibytes(BUDGETS.airChunkGzip)}`,
)
console.log(
  `  full day   ${kibibytes(airDayTotalGzip)} / ${kibibytes(BUDGETS.airDayTotalGzip)}`,
)
if (
  airMorningGzip > BUDGETS.airMorningGzip ||
  airManifestGzip > BUDGETS.airManifestGzip ||
  largestAirChunkGzip > BUDGETS.airChunkGzip ||
  airDayTotalGzip > BUDGETS.airDayTotalGzip
) {
  throw new Error('London optional air-study budget exceeded')
}

const roadTopologyBytes = await readFile(
  resolve('public/data/all-change-road-topology.json'),
)
const roadTopology = JSON.parse(roadTopologyBytes.toString('utf8'))
const roadManifestBytes = await readFile(
  resolve('public/data/all-change-road-day-manifest.json'),
)
const roadManifest = JSON.parse(roadManifestBytes.toString('utf8'))
if (
  roadTopology.metadata?.publisher !== 'National Highways' ||
  roadTopology.roads?.length !== 7 ||
  roadTopology.sites?.length !== roadManifest.siteIds?.length ||
  roadManifest.metadata?.windowStart !== 0 ||
  roadManifest.metadata?.windowEnd !== 86_400 ||
  roadManifest.metadata?.measurementKind !== 'recorded' ||
  roadManifest.metadata?.minimumSiteCoverage !== 1 ||
  roadManifest.chunks?.length !== 4
) {
  throw new Error('London road topology and day manifest violate the study contract')
}
const roadTopologyGzip = gzipSync(roadTopologyBytes, { level: 9 }).byteLength
const roadManifestGzip = gzipSync(roadManifestBytes, { level: 9 }).byteLength
let roadDayTotalGzip = roadTopologyGzip + roadManifestGzip
let largestRoadChunkGzip = 0
for (const [index, descriptor] of roadManifest.chunks.entries()) {
  const expectedStart = index * 6 * 3600
  if (
    descriptor.windowStart !== expectedStart ||
    descriptor.windowEnd !== expectedStart + 6 * 3600 ||
    descriptor.path !== `all-change-road-day/${descriptor.id}.json`
  ) {
    throw new Error(`London road chunk ${descriptor.id} breaks the six-hour sequence`)
  }
  const bytes = await readFile(resolve('public/data', descriptor.path))
  const chunk = JSON.parse(bytes.toString('utf8'))
  const valueCount = chunk.minutes.reduce(
    (total, [, values]) => total + values.length,
    0,
  )
  if (
    chunk.windowStart !== descriptor.windowStart ||
    chunk.windowEnd !== descriptor.windowEnd ||
    chunk.minutes.length !== descriptor.minuteCount ||
    valueCount !== descriptor.valueCount
  ) {
    throw new Error(`London road chunk ${descriptor.id} disagrees with its manifest`)
  }
  const compressed = gzipSync(bytes, { level: 9 }).byteLength
  roadDayTotalGzip += compressed
  largestRoadChunkGzip = Math.max(largestRoadChunkGzip, compressed)
}
console.log('All Change optional road-study budget:')
console.log(
  `  topology   ${kibibytes(roadTopologyGzip)} / ${kibibytes(BUDGETS.roadTopologyGzip)}`,
)
console.log(
  `  manifest   ${kibibytes(roadManifestGzip)} / ${kibibytes(BUDGETS.roadManifestGzip)}`,
)
console.log(
  `  max chunk  ${kibibytes(largestRoadChunkGzip)} / ${kibibytes(BUDGETS.roadChunkGzip)}`,
)
console.log(
  `  full day   ${kibibytes(roadDayTotalGzip)} / ${kibibytes(BUDGETS.roadDayTotalGzip)}`,
)
if (
  roadTopologyGzip > BUDGETS.roadTopologyGzip ||
  roadManifestGzip > BUDGETS.roadManifestGzip ||
  largestRoadChunkGzip > BUDGETS.roadChunkGzip ||
  roadDayTotalGzip > BUDGETS.roadDayTotalGzip
) {
  throw new Error('London optional road-study budget exceeded')
}

const manifest = JSON.parse(
  await readFile(resolve('dist/.vite/manifest.json'), 'utf8'),
)
const londonEntry = Object.entries(manifest).find(
  ([key, chunk]) => chunk.isEntry && key === 'london.html',
)
if (!londonEntry) throw new Error('Vite manifest has no London entry')

const scripts = new Set()
const styles = new Set()
const visited = new Set()
const visit = (key) => {
  if (visited.has(key)) return
  visited.add(key)
  const chunk = manifest[key]
  if (!chunk) throw new Error(`Missing Vite manifest entry: ${key}`)
  if (chunk.file.endsWith('.js')) scripts.add(chunk.file)
  for (const cssFile of chunk.css ?? []) styles.add(cssFile)
  for (const importedKey of chunk.imports ?? []) visit(importedKey)
  for (const importedKey of chunk.dynamicImports ?? []) visit(importedKey)
}
visit(londonEntry[0])

async function totalGzipSize(files) {
  let total = 0
  for (const file of files) {
    total += gzipSync(await readFile(resolve('dist', file)), { level: 9 }).byteLength
  }
  return total
}

const javaScript = await totalGzipSize(scripts)
const css = await totalGzipSize(styles)
const total = javaScript + css + dataGzip
const transfer = { javaScript, css, total }

console.log('All Change mobile first-view budget (gzip):')
for (const [name, size] of Object.entries(transfer)) {
  console.log(
    `  ${name.padEnd(10)} ${kibibytes(size)} / ${kibibytes(BUDGETS[name])}`,
  )
}

const transferFailures = Object.entries(transfer).filter(
  ([name, size]) => size > BUDGETS[name],
)
if (transferFailures.length) {
  throw new Error(
    `London transfer budget exceeded: ${transferFailures
      .map(([name, size]) => `${name} ${kibibytes(size)}`)
      .join(', ')}`,
  )
}
