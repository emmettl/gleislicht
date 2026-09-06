import { readFile } from 'node:fs/promises'
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
