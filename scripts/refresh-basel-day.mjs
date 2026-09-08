import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildBaselDay } from './build-basel-day.mjs'
import { downloadBaselSources } from './download-basel-sources.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

export async function refreshBaselDay(options, { build = buildBaselDay, download = downloadBaselSources, restore = restorePublishedRegionalData } = {}) {
  const policy = JSON.parse(await readFile(options.policyPath ?? 'data/basel-core-policy.json'))
  const work = await mkdtemp(join(tmpdir(), 'basel-refresh-'))
  try {
    if (policy.serviceDates.includes(options.date)) {
      try {
        const sourceDirectory = options.sourceDirectory ?? join(work, 'sources')
        if (!options.sourceDirectory) await download(sourceDirectory)
        return { retained: false, ...await build({ ...options, sourceDirectory }) }
      } catch (error) {
        console.warn(`Basel refresh failed validation or source acquisition: ${error.message}. Retaining a verified dated study.`)
      }
    } else console.warn(`Basel: ${options.date} has no reviewed diversion policy. Retaining a verified dated study.`)
    const result = await restore(options.output, undefined, options.bootstrapDirectory ?? 'public/data', ['basel-core'])
    return { retained: true, date: result.dates['basel-core'] }
  } finally { await rm(work, { recursive: true, force: true }) }
}
