import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_DIRECTORY = resolve('dist')
const INITIAL_DATA_FILES = [
  'data/swiss-rail-morning.json',
  'data/swiss-boundary.json',
  'data/swiss-lakes.json',
]
const BUDGETS = {
  javaScript: 320 * 1024,
  css: 10 * 1024,
  // The official timetable is regenerated twice weekly and its compressed
  // first-view payload naturally moves with the number and shape of services.
  // Keep enough headroom for that feed churn while retaining a hard mobile
  // ceiling that will catch a genuinely accidental payload expansion.
  data: 360 * 1024,
  total: 700 * 1024,
}

async function gzipSize(filePath) {
  return gzipSync(await readFile(filePath), { level: 9 }).byteLength
}

function collectInitialFiles(manifest) {
  const entry = Object.entries(manifest).find(([, chunk]) => chunk.isEntry)
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
const javaScript = await totalGzipSize(DIST_DIRECTORY, initial.scripts)
const css = await totalGzipSize(DIST_DIRECTORY, initial.styles)
const data = await totalGzipSize(DIST_DIRECTORY, INITIAL_DATA_FILES)
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
