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
  total: 790 * 1024,
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
      chunk.src === 'node_modules/@motionstudies/three/NationalNetworkScene.js' ||
      chunk.src?.endsWith('/node_modules/@motionstudies/three/NationalNetworkScene.js'),
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
// Vite's worker assets are not listed as imports in its main manifest, but the
// national scene starts this worker on first view, so include its transfer cost.
const workers = (await readdir(resolve(DIST_DIRECTORY, 'assets')))
  .filter(file => /^trail\.worker-[\w-]+\.js$/.test(file))
if (workers.length !== 1) throw new Error('Expected one bundled trail worker')
initial.scripts.push(...workers.map(file => `assets/${file}`))
const javaScript = await totalGzipSize(DIST_DIRECTORY, initial.scripts)
const css = await totalGzipSize(DIST_DIRECTORY, initial.styles)
// Measure the actual pinned first-view payload even when it lives outside dist.
const remote = (await readdir(DIST_DIRECTORY)).includes('_data-release.json')
const dataRoot = remote ? JSON.parse(await readFile(resolve(DIST_DIRECTORY, '_data-release.json'), 'utf8')).baseUrl : undefined
const data = remote
  ? (await Promise.all(INITIAL_DATA_FILES.map(async file => {
    const response = await fetch(new URL(file.slice(5), dataRoot), { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Data budget request failed: ${file} HTTP ${response.status}`)
    return gzipSync(Buffer.from(await response.arrayBuffer()), { level: 9 }).byteLength
  }))).reduce((sum, size) => sum + size, 0)
  : await totalGzipSize(DIST_DIRECTORY, INITIAL_DATA_FILES)
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
