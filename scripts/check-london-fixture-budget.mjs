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
}

function kibibytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

let raw = 0
let gzip = 0
for (const file of FILES) {
  const bytes = await readFile(resolve(file))
  JSON.parse(bytes.toString('utf8'))
  raw += bytes.byteLength
  gzip += gzipSync(bytes, { level: 9 }).byteLength
}

console.log('All Change opening-study budget:')
console.log(`  raw        ${kibibytes(raw)} / ${kibibytes(BUDGETS.raw)}`)
console.log(`  gzip       ${kibibytes(gzip)} / ${kibibytes(BUDGETS.gzip)}`)

const failures = Object.entries({ raw, gzip }).filter(
  ([name, size]) => size > BUDGETS[name],
)
if (failures.length) {
  throw new Error(
    `London fixture budget exceeded: ${failures
      .map(([name, size]) => `${name} ${kibibytes(size)}`)
      .join(', ')}`,
  )
}
