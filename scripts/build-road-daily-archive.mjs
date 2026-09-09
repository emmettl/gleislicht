import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { compileDailyArchive, previousSwissDate } from '../road-daily-worker/analysis.ts'

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/build-road-daily-archive.mjs [--date=YYYY-MM-DD] [--input=recordings/astra-national] [--output=recordings]')
} else {
  const input = resolve(argument('input') ?? 'recordings/astra-national')
  const output = resolve(argument('output') ?? 'recordings')
  const topology = JSON.parse(await readFile('public/data/swiss-road-topology.json', 'utf8'))
  const readJson = async key => {
    try {
      const bytes = await readFile(resolve(output, key))
      return JSON.parse(key.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString())
    } catch (error) { if (error.code === 'ENOENT') return null; throw error }
  }
  const write = async (key, text) => {
    const path = resolve(output, key)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(path, key.endsWith('.gz') ? gzipSync(text, { level: 9 }) : text, { mode: 0o600 })
  }
  const manifest = await compileDailyArchive({
    readJson, write,
    async readRecording(key) {
      const path = resolve(input, key.split('/').at(-1).replace(/\.gz$/, ''))
      try { return JSON.parse(await readFile(path, 'utf8')) }
      catch (error) { if (error.code === 'ENOENT') return null; throw error }
    },
    async promote(key, pointer) {
      const previous = await readJson(key)
      if (!previous || previous.serviceDate < pointer.serviceDate) await write(key, JSON.stringify(pointer) + '\n')
    },
  }, topology, argument('date') ?? previousSwissDate())
  console.log(JSON.stringify({ ...manifest.metadata, summary: resolve(output, manifest.summaryKey), hourlyCsv: resolve(output, manifest.hourlyKey) }, null, 2))
  if (!manifest.metadata.complete) process.exitCode = 2
}
