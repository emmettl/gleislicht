import { buildBernDay } from './build-bern-day.mjs'
import { BERN_REVIEWED_DATES } from './bern-release-validation.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

export async function refreshBernDay(options, { build = buildBernDay, restore = restorePublishedRegionalData } = {}) {
  if (BERN_REVIEWED_DATES.includes(options.date)) {
    try { return { retained: false, ...await build(options) } }
    catch (error) { console.warn(`Bern release failed validation: ${error.message}. Retaining a verified dated study.`) }
  } else console.warn(`Bern: ${options.date} has no reviewed cantonal admission audit. Retaining a verified dated study.`)
  const result = await restore(options.output, undefined, options.bootstrapDirectory ?? 'public/data', ['bern-region'])
  return { retained: true, date: result.dates['bern-region'] }
}
