import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { buildStudySummaries } from './build-study-summaries.mjs'

const root = resolve(process.argv[2] ?? 'public/data')
const { roads } = JSON.parse(await readFile(join(root, 'swiss-road-topology.json'), 'utf8'))
if (!Array.isArray(roads) || roads.length < 1) throw new Error('Missing road catalogue')
await writeFile('src/editions/switzerland-road-catalogue.json', JSON.stringify({ roads }) + '\n')
await writeFile('src/studies/study-summaries.json', JSON.stringify(await buildStudySummaries(root)) + '\n')
console.log('Prepared app catalogues from the selected data release')
