import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const bytes = await readFile('fixtures/idfm/correspondances-morning.json')
const snapshot = JSON.parse(bytes.toString('utf8'))
const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength
const routes = new Set(snapshot.trains.map((train) => train.route))
const categories = new Set(snapshot.trains.map((train) => train.category))
const interchangeStudy = snapshot.metadata?.interchangeStudy
const geographyBytes = await readFile('fixtures/idfm/correspondances-geography.json')
const geography = JSON.parse(geographyBytes.toString('utf8'))
const geographyGzipBytes = gzipSync(geographyBytes, { level: 9 }).byteLength
const dayManifestBytes = await readFile('fixtures/idfm/correspondances-day-manifest.json')
const dayManifest = JSON.parse(dayManifestBytes.toString('utf8'))
const dayManifestGzipBytes = gzipSync(dayManifestBytes, { level: 9 }).byteLength
const scopeAudit = JSON.parse(
  await readFile('fixtures/idfm/correspondances-scope-audit.json', 'utf8'),
)

if (snapshot.metadata?.publisher !== 'Île-de-France Mobilités') {
  throw new Error('Paris proof has no authoritative publisher')
}
if (
  snapshot.metadata?.windowStart !== 25_200 ||
  snapshot.metadata?.windowEnd !== 32_400 ||
  snapshot.metadata?.serviceDate !== '2026-09-04'
) {
  throw new Error('Paris proof must retain its pinned Friday 07:00–09:00 window')
}
if (
  JSON.stringify([...routes].sort()) !== JSON.stringify(['Métro 1', 'RER A']) ||
  !categories.has('metro') ||
  !categories.has('regional-express')
) {
  throw new Error('Paris proof lost its Métro / RER distinction')
}
if (
  snapshot.stops?.length < 80 ||
  snapshot.paths?.length !== snapshot.edges?.length ||
  snapshot.edgePaths?.some((pathIndex) => !snapshot.paths[pathIndex]?.length)
) {
  throw new Error('Paris proof has incomplete line or shape coverage')
}
if (
  !snapshot.metadata?.sourceSha256 ||
  snapshot.metadata.geometry?.sourceSha256 !== snapshot.metadata.sourceSha256 ||
  !snapshot.metadata?.licenseUrl
) {
  throw new Error('Paris proof lost its source or licence provenance')
}
if (
  interchangeStudy?.complexes?.length !== 5 ||
  interchangeStudy.complexes.some(
    (complex) =>
      complex.links.length < 2 ||
      complex.links.some((link) => link.minimumTransferSeconds < 1),
  )
) {
  throw new Error('Paris proof lost its published Métro / RER transfer evidence')
}
if (bytes.byteLength > 300 * 1024 || gzipBytes > 82 * 1024) {
  throw new Error(
    `Paris proof exceeds its data budget: ${bytes.byteLength} raw / ${gzipBytes} gzip`,
  )
}
if (
  geography.metadata?.layers?.boundary?.publisher !==
    'Direction interministérielle du numérique' ||
  geography.metadata?.layers?.water?.publisher !==
    'Direction de l’Urbanisme · Ville de Paris' ||
  geography.metadata?.layers?.water?.license !== 'Open Database License (ODbL)' ||
  geography.metadata?.layers?.peripherique?.publisher !==
    'Direction de l’Urbanisme · Ville de Paris' ||
  geography.metadata?.layers?.peripherique?.license !==
    'Open Database License (ODbL)' ||
  geography.metadata?.pointCounts?.boundary?.compiled >=
    geography.metadata?.pointCounts?.boundary?.source ||
  geography.metadata?.pointCounts?.water?.compiled >=
    geography.metadata?.pointCounts?.water?.source ||
  geography.metadata?.pointCounts?.peripherique?.compiled >=
    geography.metadata?.pointCounts?.peripherique?.source ||
  geography.boundary?.length !== 1 ||
  geography.water?.[0]?.polygons?.length !== 60 ||
  geography.references?.[0]?.id !== 'boulevard-peripherique' ||
  geography.references?.[0]?.paths?.length !== 9 ||
  geographyGzipBytes > 8 * 1024
) {
  throw new Error('Paris geography lost its source, simplification or payload contract')
}
if (
  dayManifest.metadata?.windowStart !== 0 ||
  dayManifest.metadata?.windowEnd !== 86_400 ||
  dayManifest.tripCount !== 1_461 ||
  dayManifest.chunks?.length !== 12 ||
  dayManifestGzipBytes > 24 * 1024
) {
  throw new Error('Paris progressive day manifest lost its pinned 24-hour contract')
}
if (
  scopeAudit.metadata?.publisher !== 'Île-de-France Mobilités' ||
  scopeAudit.metadata?.sourceSha256 !== snapshot.metadata?.sourceSha256 ||
  scopeAudit.metadata?.serviceDate !== snapshot.metadata?.serviceDate ||
  scopeAudit.totals?.routeCount !== 21 ||
  scopeAudit.totals?.tripCount !== 2_503 ||
  scopeAudit.candidateLayers?.opening?.tripCount !== snapshot.trains.length ||
  scopeAudit.candidateLayers?.centralCross?.routeCount !== 3 ||
  scopeAudit.candidateLayers?.centralCross?.tripCount !== 372
) {
  throw new Error('Paris scope audit lost its source or candidate-layer contract')
}
for (const descriptor of dayManifest.chunks) {
  const chunkBytes = await readFile(resolve('fixtures/idfm', descriptor.path))
  const chunk = JSON.parse(chunkBytes.toString('utf8'))
  if (
    chunk.windowStart !== descriptor.windowStart ||
    chunk.windowEnd !== descriptor.windowEnd ||
    chunk.trains.length !== descriptor.tripCount ||
    chunkBytes.byteLength !== descriptor.bytes ||
    gzipSync(chunkBytes, { level: 9 }).byteLength > 58 * 1024
  ) {
    throw new Error(`Paris day chunk ${descriptor.id} violates its manifest or budget`)
  }
}

const manifest = JSON.parse(
  await readFile(resolve('dist/.vite/manifest.json'), 'utf8'),
)
const entry = Object.entries(manifest).find(
  ([key, chunk]) => chunk.isEntry && key === 'paris.html',
)
if (!entry) throw new Error('Vite manifest has no Correspondances entry')
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
visit(entry[0])
const totalGzipSize = async (files) => {
  let total = 0
  for (const file of files) {
    total += gzipSync(await readFile(resolve('dist', file)), { level: 9 }).byteLength
  }
  return total
}
const javaScriptGzip = await totalGzipSize(scripts)
const cssGzip = await totalGzipSize(styles)
const firstViewGzip =
  javaScriptGzip + cssGzip + gzipBytes + geographyGzipBytes
if (
  javaScriptGzip > 340 * 1024 ||
  cssGzip > 15 * 1024 ||
  firstViewGzip > 425 * 1024
) {
  throw new Error(
    `Paris first view exceeds its mobile budget: ${javaScriptGzip} JS / ` +
      `${cssGzip} CSS / ${firstViewGzip} total`,
  )
}

console.log(
  `Correspondances proof: ${snapshot.trains.length} trips, ${snapshot.stops.length} stops, ` +
    `${interchangeStudy.complexes.length} interchange complexes, ` +
    `${(bytes.byteLength / 1024).toFixed(1)} KiB raw / ${(gzipBytes / 1024).toFixed(1)} KiB gzip.`,
)
console.log(
  `Correspondances day: ${dayManifest.tripCount} trips in ${dayManifest.chunks.length} progressive chunks; ` +
    `${(geographyGzipBytes / 1024).toFixed(1)} KiB supporting geography.`,
)
console.log(
  `Correspondances scope: ${scopeAudit.totals.tripCount} morning trips across ` +
    `${scopeAudit.totals.routeCount} Métro/RER lines; central-cross candidate ` +
    `${scopeAudit.candidateLayers.centralCross.tripCount} trips across 3 lines.`,
)
console.log(
  `Correspondances mobile first view: ${(javaScriptGzip / 1024).toFixed(1)} KiB JS / ` +
    `${(cssGzip / 1024).toFixed(1)} KiB CSS / ${(firstViewGzip / 1024).toFixed(1)} KiB total.`,
)
