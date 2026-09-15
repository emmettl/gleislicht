import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_DIRECTORY = resolve(process.argv[2] ?? 'dist')
const INITIAL_DATA_FILES = [
  'data/swiss-rail-morning.json',
  'data/swiss-boundary.json',
  'data/swiss-lakes.json',
]
const BUDGETS = {
  // The national scene is requested immediately after the opening data resolves,
  // so its renderer and Three.js dependency count even though Vite emits them as
  // a dynamic chunk.
  javaScript: 360 * 1024,
  css: 10 * 1024,
  // The official timetable is regenerated twice weekly and its compressed
  // first-view payload naturally moves with the number and shape of services.
  // The official FOT rail paths add roughly 100 KiB compressed, buying real
  // alignment without a runtime map dependency. Keep enough headroom for feed
  // churn while retaining a hard mobile ceiling for accidental expansion.
  data: 450 * 1024,
  // Shared map styles add under 1 KiB to the national renderer. Keep the
  // individual 360/10/450 KiB ceilings and allow 2 KiB in the combined gate.
  total: 792 * 1024,
}

async function gzipSize(filePath) {
  return gzipSync(await readFile(filePath), { level: 9 }).byteLength
}

function collectInitialFiles(manifest) {
  const entry = Object.entries(manifest).find(
    ([key, chunk]) => chunk.isEntry && key === 'index.html',
  )
  if (!entry) throw new Error('Vite manifest has no application entry')

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
  }
  visit(entry[0])
  const openingScene = Object.entries(manifest).find(
    ([, chunk]) =>
      chunk.src === 'src/studies/GleislichtNetworkScene.tsx',
  )
  if (!openingScene) throw new Error('Vite manifest has no national network scene')
  visit(openingScene[0])
  return { scripts: [...scripts], styles: [...styles] }
}

function kibibytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

async function totalGzipSize(root, files) {
  let total = 0
  for (const file of files) total += await gzipSize(resolve(root, file))
  return total
}

const manifest = JSON.parse(
  await readFile(resolve(DIST_DIRECTORY, '.vite/manifest.json'), 'utf8'),
)
const initial = collectInitialFiles(manifest)
// The shared renderer computes trails from sampled history since alpha.16;
// no worker asset belongs to the opening transfer.
const workers = (await readdir(resolve(DIST_DIRECTORY, 'assets')))
  .filter(file => /\.worker-[\w-]+\.js$/.test(file))
if (workers.length) throw new Error(`Unexpected bundled workers: ${workers.join(', ')}`)
// Optional study helpers must stay outside the opening and retain bounded closures.
async function checkOptionalHelpers(key, label, limitKiB) {
  const entry = manifest[key]
  if (!entry?.isDynamicEntry || initial.scripts.includes(entry.file)) throw new Error(`${label} must remain optional`)
  const scripts = new Set(), visited = new Set()
  const visit = key => {
    if (visited.has(key)) return
    visited.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Missing ${label} dependency: ${key}`)
    if (initial.scripts.includes(chunk.file)) return
    if (chunk.dynamicImports?.length) throw new Error(`Unbudgeted dynamic ${label} dependency`)
    scripts.add(chunk.file)
    for (const dependency of chunk.imports ?? []) visit(dependency)
  }
  visit(key)
  const bytes = await totalGzipSize(DIST_DIRECTORY, scripts)
  if (bytes > limitKiB * 1024) throw new Error(`${label} exceed ${limitKiB} KiB gzip`)
  console.log(`${label}: ${bytes} bytes gzip / ${limitKiB} KiB`)
}
await checkOptionalHelpers('src/studies/road-traffic-summary.ts', 'Optional road helpers', 5)
await checkOptionalHelpers('src/studies/cogwheel-runtime.ts', 'Optional cogwheel helpers', 3)
await checkOptionalHelpers('src/editions/switzerland-corridor-journey.ts', 'Optional terrain journey helpers', 3)
const javaScript = await totalGzipSize(DIST_DIRECTORY, initial.scripts)
const css = await totalGzipSize(DIST_DIRECTORY, initial.styles)
// Measure the actual pinned first-view payload even when it lives outside dist.
const remote = (await readdir(DIST_DIRECTORY)).includes('_data-release.json')
const dataRoot = remote ? JSON.parse(await readFile(resolve(DIST_DIRECTORY, '_data-release.json'), 'utf8')).baseUrl : undefined
const calendar = remote && (await readdir(DIST_DIRECTORY)).includes('_timetable-calendar.json')
  ? JSON.parse(await readFile(resolve(DIST_DIRECTORY, '_timetable-calendar.json'), 'utf8')) : undefined
const dataDays = calendar?.days?.length ? calendar.days : [{ prefix: '', date: 'fixture' }]
const sizes = new Map()
const dataByDay = await Promise.all(dataDays.map(async day => {
  if (day.prefix && day.prefix !== `calendar/${day.date}/`) throw new Error('Unsafe budget calendar prefix')
  const files = INITIAL_DATA_FILES.map(file => file === 'data/swiss-rail-morning.json' ? `data/${day.prefix}swiss-rail-morning.json` : file)
  const bytes = remote ? (await Promise.all(files.map(file => {
    if (!sizes.has(file)) sizes.set(file, (async () => {
      const response = await fetch(new URL(file.slice(5), dataRoot), { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`Data budget request failed: ${file} HTTP ${response.status}`)
      return gzipSync(Buffer.from(await response.arrayBuffer()), { level: 9 }).byteLength
    })())
    return sizes.get(file)
  }))).reduce((sum, size) => sum + size, 0) : await totalGzipSize(DIST_DIRECTORY, files)
  return { date: day.date, bytes }
}))
// Tomorrow must fit the same first-view limit as today's opening scene.
const data = Math.max(...dataByDay.map(day => day.bytes))
if (calendar) for (const day of dataByDay) console.log(`  ${day.date} first-view data: ${kibibytes(day.bytes)}`)

const total = javaScript + css + data
const measurements = { javaScript, css, data, total }

console.log('Mobile first-view transfer budget (gzip):')
for (const [name, size] of Object.entries(measurements)) {
  console.log(
    `  ${name.padEnd(10)} ${kibibytes(size)} / ${kibibytes(BUDGETS[name])}`,
  )
}

const failures = Object.entries(measurements).filter(
  ([name, size]) => size > BUDGETS[name],
)
if (failures.length) {
  throw new Error(
    `Bundle budget exceeded: ${failures
      .map(([name, size]) => `${name} ${kibibytes(size)}`)
      .join(', ')}`,
  )
}
