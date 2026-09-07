import { applyStationLabelRanks } from '@motionstudies/data/station-ranking'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

async function main() {
  const argv = process.argv.slice(2)
  const catalogueIndex = argv.indexOf('--catalogue')
  const cataloguePath = catalogueIndex < 0 ? undefined : argv[catalogueIndex + 1]
  const positional = argv.filter((_, index) =>
    catalogueIndex < 0 || (index !== catalogueIndex && index !== catalogueIndex + 1))
  const [input, output = input] = positional
  if (!input) throw new Error('Usage: node scripts/rank-network-stations.mjs input.json [output.json]')
  const catalogue = cataloguePath
    ? JSON.parse(await readFile(resolve(cataloguePath), 'utf8'))
    : undefined
  const ranked = applyStationLabelRanks(
    JSON.parse(await readFile(resolve(input), 'utf8')),
    { catalogue },
  )
  await mkdir(dirname(resolve(output)), { recursive: true })
  await writeFile(resolve(output), `${JSON.stringify(ranked)}\n`)
  console.log(`Wrote ${output}: ${ranked.metadata.labelHierarchy.stationCount} ranked station names`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
