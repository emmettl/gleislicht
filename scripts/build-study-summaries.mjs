import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Same order as STUDY_IDS; named sources prevent dates being copied between studies.
export const STUDY_SOURCES = [
  ['national', 'swiss-rail-day-manifest.json'],
  ['postbus', 'postbus-national-day-manifest.json'],
  ['zvv-region', 'zvv-region-day-manifest.json'],
  ['geneva-tpg', 'geneva-tpg-day-manifest.json'],
  ['zurich-city', 'zurich-city-day-manifest.json'],
  ['rigi-lake', 'rigi-day.json'],
  ['contrast', 'zurich-tram-day-manifest.json'],
  ['jungfrau', 'jungfrau-day.json'],
  ['lausanne-region', 'lausanne-region-day-manifest.json'],
  ['basel-core', 'basel-core-day-manifest.json'],
  ['bern-region', 'bern-region-day-manifest.json'],
  ['gornergrat', 'gornergrat-day.json'],
  ['solothurn-region', 'solothurn-region-day-manifest.json'],
  ['nyon-region', 'nyon-region-day-manifest.json'],
]
export async function buildStudySummaries(directory = 'public/data') {
  return Promise.all(STUDY_SOURCES.map(async ([id, file]) => {
    const { metadata } = JSON.parse(await readFile(join(directory, file), 'utf8'))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata?.serviceDate ?? '') || metadata.windowStart !== 0 || metadata.windowEnd !== 86400) throw new Error(`${id}: invalid study metadata`)
    return { id, date: metadata.serviceDate, start: metadata.windowStart, end: metadata.windowEnd }
  }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeFile('src/studies/study-summaries.json', `${JSON.stringify(await buildStudySummaries())}\n`)
}
