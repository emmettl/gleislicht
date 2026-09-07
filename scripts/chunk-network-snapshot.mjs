import { chunkNetworkSnapshot, extractNetworkWindow } from '@motionstudies/data/network-chunks'

import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function argument(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : argv[index + 1]
}

function parseClock(value) {
  const [hours, minutes = 0] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid clock value ${value}`)
  }
  return hours * 3600 + minutes * 60
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(filePath)
    output.once('error', rejectPromise)
    output.once('finish', resolvePromise)
    output.end(JSON.stringify(value))
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const input = argument(argv, 'input')
  const manifestOutput = argument(argv, 'manifest')
  const openingOutput = argument(argv, 'opening')
  if (!input || !manifestOutput || !openingOutput) {
    throw new Error(
      'Usage: node scripts/chunk-network-snapshot.mjs --input day.json --manifest day-manifest.json --opening morning.json [--chunk-hours 2] [--opening-start 06:45] [--opening-end 08:45] [--focus 07:45]',
    )
  }
  const snapshot = JSON.parse(await readFile(resolve(input), 'utf8'))
  const manifestPath = resolve(manifestOutput)
  const outputDirectory = dirname(manifestPath)
  const outputStem = basename(manifestPath, extname(manifestPath)).replace(/-manifest$/, '')
  const chunkDirectoryName = `${outputStem}-chunks`
  const { manifest, chunks } = chunkNetworkSnapshot(
    snapshot,
    Number(argument(argv, 'chunk-hours', '2')) * 3600,
    chunkDirectoryName,
  )
  const opening = extractNetworkWindow(
    snapshot,
    parseClock(argument(argv, 'opening-start', '06:45')),
    parseClock(argument(argv, 'opening-end', '08:45')),
    parseClock(argument(argv, 'focus', '07:45')),
  )
  await Promise.all([
    writeJson(manifestPath, manifest),
    writeJson(resolve(openingOutput), opening),
    ...chunks.map(({ descriptor, payload }) =>
      writeJson(join(outputDirectory, descriptor.path), payload),
    ),
  ])
  console.log(
    `Wrote ${manifestOutput}, ${chunks.length} progressive chunks and ${opening.trains.length} opening journeys.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
