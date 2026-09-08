import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { compileCantonalRoadStudy, splitNationalRoadStudy } from './compile-astra-national-study.mjs'
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/compile-cantonal-road-study.mjs [--input=recordings/astra-zurich-cantonal] [--topology=data/zurich-cantonal-road-directions.json] [--road=ZH:1] [--output=recordings/astra-zurich-cantonal/compiled] [--date=YYYY-MM-DD] [--from=HH:MM] [--to=HH:MM] [--minimum-samples=60]')
  process.exit(0)
}
const timeArg = name => {
  const value = arg(name)
  if (value === undefined) return undefined
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${name} must be HH:MM`)
  const [hour, minute] = value.split(':').map(Number)
  return hour * 3600 + minute * 60
}
const input = arg('input') ?? 'recordings/astra-zurich-cantonal'
const output = arg('output') ?? 'recordings/astra-zurich-cantonal/compiled'
const topologySource = await readFile(arg('topology') ?? 'data/zurich-cantonal-road-directions.json', 'utf8')
const topology = JSON.parse(topologySource)
if (arg('road')) {
  topology.sections = topology.sections.filter(s => s.road === arg('road'))
  if (!topology.sections.length) throw new Error('Selected road has no validated sections')
}
const snapshots = await Promise.all((await readdir(input)).filter(f => f.endsWith('.json')).map(async file => JSON.parse(await readFile(resolve(input, file), 'utf8'))))
const study = compileCantonalRoadStudy(snapshots, topology, { serviceDate: arg('date'), minimumSamples: Number(arg('minimum-samples') ?? 60), windowStart: timeArg('from'), windowEnd: timeArg('to') })
const { manifest, chunks } = splitNationalRoadStudy(study, { chunkDirectoryName: 'chunks' })
manifest.metadata.publicationStatus = 'draft'
manifest.metadata.directionTopologySha256 = createHash('sha256').update(topologySource).digest('hex')
manifest.metadata.minimumRequiredSamples = Number(arg('minimum-samples') ?? 60)
manifest.metadata.requiredSiteCoverage = 1
manifest.metadata.directionModel = topology.metadata.directionModel
if (arg('road')) manifest.metadata.selectedRoad = arg('road')
if (topology.metadata.directionReviewSha256) manifest.metadata.directionReviewSha256 = topology.metadata.directionReviewSha256
manifest.metadata.note += ' Pilot sections interpolate conditions between counters; junction turn flows are not measured. This draft uses its actual afternoon observation window.'
await mkdir(resolve(output, 'chunks'), { recursive: true })
await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
for (const chunk of chunks) await writeFile(resolve(output, chunk.descriptor.path), `${JSON.stringify(chunk.body)}\n`)
console.log(JSON.stringify(manifest.metadata, null, 2))
