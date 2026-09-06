import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const path = 'fixtures/mta/local-express-lexington-morning.json'
const bytes = await readFile(path)
const snapshot = JSON.parse(bytes.toString('utf8'))
const geographyBytes = await readFile('fixtures/mta/local-express-geography.json')
const geography = JSON.parse(geographyBytes.toString('utf8'))
const diagramBytes = await readFile('fixtures/mta/local-express-diagram.json')
const diagram = JSON.parse(diagramBytes.toString('utf8'))
const diagramOverridesBytes = await readFile(
  'fixtures/mta/local-express-diagram-overrides.json',
)
const diagramOverrides = JSON.parse(diagramOverridesBytes.toString('utf8'))
const dayManifestBytes = await readFile(
  'fixtures/mta/local-express-day-manifest.json',
)
const dayManifest = JSON.parse(dayManifestBytes.toString('utf8'))
const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength
const patterns = new Set(snapshot.trains.map((train) => train.servicePattern))
const routes = new Set(snapshot.trains.map((train) => train.shortName))
const study = snapshot.metadata?.servicePatternStudy

if (snapshot.metadata?.publisher !== 'MTA New York City Transit') {
  throw new Error('New York proof has no authoritative publisher')
}
if (snapshot.metadata?.windowStart !== 25_200 || snapshot.metadata?.windowEnd !== 32_400) {
  throw new Error('New York proof must retain its bounded 07:00–09:00 window')
}
if (snapshot.stops?.length !== 40 || !patterns.has('local') || !patterns.has('express')) {
  throw new Error('New York proof lost a direction or service-pattern class')
}
if (JSON.stringify([...routes].sort()) !== JSON.stringify(['4', '5', '6'])) {
  throw new Error('New York proof must contain only routes 4, 5 and 6')
}
if (
  snapshot.paths?.length !== snapshot.edges?.length ||
  snapshot.edgePaths?.some((pathIndex) => !snapshot.paths[pathIndex]?.length)
) {
  throw new Error('New York proof has incomplete MTA shape coverage')
}
if (!study || study.localTrips < 1 || study.expressTrips < 1 || study.passEvents.length < 1) {
  throw new Error('New York proof contains no defensible scheduled pass event')
}
for (const event of study.passEvents) {
  if (event.startDeltaSeconds < 0 || event.endDeltaSeconds >= 0) {
    throw new Error(`Invalid scheduled order reversal ${event.id}`)
  }
}
if (bytes.byteLength > 180 * 1024 || gzipBytes > 28 * 1024) {
  throw new Error(
    `New York proof exceeds its first payload budget: ${bytes.byteLength} raw / ${gzipBytes} gzip`,
  )
}
if (
  geography.metadata?.publisher !== 'NYC Department of City Planning' ||
  geography.boundary?.[0]?.length < 100 ||
  geography.water?.length !== 2
) {
  throw new Error('New York proof lost its official Manhattan shoreline context')
}
if (
  diagram.metadata?.kind !== 'topological' ||
  diagram.metadata?.overridesSource !== 'local-express-diagram-overrides.json' ||
  diagram.metadata?.overridesSha256 !==
    createHash('sha256').update(diagramOverridesBytes).digest('hex') ||
  diagram.stops?.length !== snapshot.stops.length ||
  diagram.paths?.length !== snapshot.paths.length ||
  diagram.paths.some((routePath) => routePath.length < 2) ||
  diagram.context?.waterPaths?.length !== 2 ||
  Object.keys(diagramOverrides.stations ?? {}).length !== 20
) {
  throw new Error('New York authored diagram no longer covers the complete corridor proof')
}
const supportingGzipBytes =
  gzipSync(geographyBytes, { level: 9 }).byteLength +
  gzipSync(diagramBytes, { level: 9 }).byteLength
if (supportingGzipBytes > 18 * 1024) {
  throw new Error(
    `New York supporting geography exceeds 18 KiB gzip: ${supportingGzipBytes}`,
  )
}

if (
  dayManifest.metadata?.windowStart !== 0 ||
  dayManifest.metadata?.windowEnd !== 86_400 ||
  dayManifest.metadata?.sourceSha256 !== snapshot.metadata.sourceSha256 ||
  dayManifest.tripCount !== 1_063 ||
  dayManifest.chunks?.length !== 12
) {
  throw new Error('New York progressive day manifest lost its pinned service-day identity')
}
let dayChunkGzipBytes = 0
let largestDayChunkGzipBytes = 0
for (const [index, descriptor] of dayManifest.chunks.entries()) {
  if (
    descriptor.windowStart !== index * 7_200 ||
    descriptor.windowEnd !== (index + 1) * 7_200
  ) {
    throw new Error(`New York day chunk ${descriptor.id} is not a contiguous two-hour window`)
  }
  const chunkBytes = await readFile(resolve('fixtures/mta', descriptor.path))
  if (
    descriptor.bytes !== chunkBytes.byteLength ||
    descriptor.sha256 !== createHash('sha256').update(chunkBytes).digest('hex')
  ) {
    throw new Error(`New York day chunk ${descriptor.id} failed its integrity check`)
  }
  const chunkGzipBytes = gzipSync(chunkBytes, { level: 9 }).byteLength
  dayChunkGzipBytes += chunkGzipBytes
  largestDayChunkGzipBytes = Math.max(
    largestDayChunkGzipBytes,
    chunkGzipBytes,
  )
}
const dayManifestGzipBytes = gzipSync(dayManifestBytes, { level: 9 }).byteLength
if (
  dayManifestGzipBytes > 36 * 1024 ||
  largestDayChunkGzipBytes > 14 * 1024 ||
  dayChunkGzipBytes > 105 * 1024
) {
  throw new Error(
    `New York progressive day exceeds budget: ${dayManifestGzipBytes} manifest / ` +
      `${largestDayChunkGzipBytes} max chunk / ${dayChunkGzipBytes} complete day`,
  )
}

const manifest = JSON.parse(
  await readFile(resolve('dist/.vite/manifest.json'), 'utf8'),
)
const newYorkEntry = Object.entries(manifest).find(
  ([key, chunk]) => chunk.isEntry && key === 'new-york.html',
)
if (!newYorkEntry) throw new Error('Vite manifest has no Local / Express entry')
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
visit(newYorkEntry[0])
const totalGzipSize = async (files) => {
  let total = 0
  for (const file of files) {
    total += gzipSync(await readFile(resolve('dist', file)), { level: 9 }).byteLength
  }
  return total
}
const javaScriptGzip = await totalGzipSize(scripts)
const cssGzip = await totalGzipSize(styles)
const firstViewGzip = javaScriptGzip + cssGzip + gzipBytes + supportingGzipBytes
if (
  javaScriptGzip > 340 * 1024 ||
  cssGzip > 14 * 1024 ||
  firstViewGzip > 390 * 1024
) {
  throw new Error(
    `New York first view exceeds its mobile budget: ${javaScriptGzip} JS / ` +
      `${cssGzip} CSS / ${firstViewGzip} total`,
  )
}

console.log(
  `Local / Express proof: ${snapshot.trains.length} trips, ${study.passEvents.length} ` +
    `scheduled pass events, ${(bytes.byteLength / 1024).toFixed(1)} KiB raw / ` +
    `${(gzipBytes / 1024).toFixed(1)} KiB gzip; ` +
    `${(supportingGzipBytes / 1024).toFixed(1)} KiB supporting geography.`,
)
console.log(
  `Local / Express mobile first view: ${(javaScriptGzip / 1024).toFixed(1)} KiB JS / ` +
    `${(cssGzip / 1024).toFixed(1)} KiB CSS / ${(firstViewGzip / 1024).toFixed(1)} KiB total.`,
)
console.log(
  `Local / Express progressive day: ${(dayManifestGzipBytes / 1024).toFixed(1)} KiB manifest / ` +
    `${(largestDayChunkGzipBytes / 1024).toFixed(1)} KiB max chunk / ` +
    `${(dayChunkGzipBytes / 1024).toFixed(1)} KiB complete day.`,
)
