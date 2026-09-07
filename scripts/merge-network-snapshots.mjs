#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// This command owns the authored provenance for the composite local timetable.
import { mergeNetworkSnapshots as mergeSnapshots } from '@motionstudies/data/merge-network'

export function mergeNetworkSnapshots(snapshots, options = {}) {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString()
  const feedVersion = `all-change-rail-led:${retrievedAt.slice(0, 10)}`
  return mergeSnapshots(snapshots, {
    ...options,
    retrievedAt,
    note: options.note ?? `${snapshots.length} representative rail-led studies merged into one contract. This proves cross-mode composition; it is not yet a complete or bidirectional London service claim.`,
    metadata: {
      publisher: 'Transport for London',
      feedVersion,
      sourceUrl: 'https://tfl.gov.uk/info-for/open-data-users/our-open-data',
      license: 'Transport for London Data Service terms and conditions',
      licenseUrl: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
      model: 'Composite TfL recurring timetable and public timetable-PDF interpolation / not realtime',
    },
    geometryMetadata: {
      publisher: 'Transport for London',
      feedVersion,
      sourceUrl: 'https://api.tfl.gov.uk',
      model: 'Deduplicated TfL branch paths from component fixtures',
    },
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const outputIndex = argv.indexOf('--output')
  if (outputIndex < 0 || !argv[outputIndex + 1]) {
    throw new Error('Usage: node scripts/merge-network-snapshots.mjs --output target.json input.json [input.json ...]')
  }
  const output = argv[outputIndex + 1]
  const retrievedAtIndex = argv.indexOf('--retrieved-at')
  const retrievedAt = retrievedAtIndex < 0 ? new Date().toISOString() : argv[retrievedAtIndex + 1]
  const noteIndex = argv.indexOf('--note')
  const note = noteIndex < 0 ? undefined : argv[noteIndex + 1]
  const optionIndexes = new Set([outputIndex, outputIndex + 1])
  if (retrievedAtIndex >= 0) {
    optionIndexes.add(retrievedAtIndex)
    optionIndexes.add(retrievedAtIndex + 1)
  }
  if (noteIndex >= 0) {
    optionIndexes.add(noteIndex)
    optionIndexes.add(noteIndex + 1)
  }
  const inputs = argv.filter((_, index) => !optionIndexes.has(index))
  if (!inputs.length) throw new Error('At least one input snapshot is required')
  const snapshots = await Promise.all(inputs.map(async (input) =>
    JSON.parse(await readFile(resolve(input), 'utf8'))))
  const merged = mergeNetworkSnapshots(snapshots, { retrievedAt, note })
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(merged)}\n`)
  console.log(`Wrote ${output}: ${merged.trains.length} journeys / ${merged.stops.length} stops / ${merged.paths.length} paths / ${merged.metadata.modes.length} modes`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
