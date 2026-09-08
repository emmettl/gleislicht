import { buildSolothurnDay } from './build-solothurn-day.mjs'
import { SOLOTHURN_REVIEWED_DATES } from './solothurn-release-validation.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

export async function refreshSolothurnDay(options, { build = buildSolothurnDay, restore = restorePublishedRegionalData } = {}) {
  if (SOLOTHURN_REVIEWED_DATES.includes(options.date)) {
    try { return { retained: false, ...await build(options) } }
    catch (error) { console.warn(`Solothurn release failed validation: ${error.message}. Retaining a verified dated study.`) }
  } else console.warn(`Solothurn: ${options.date} has no reviewed cantonal admission audit. Retaining a verified dated study.`)
  const result = await restore(options.output, undefined, options.bootstrapDirectory ?? 'public/data', ['solothurn-region'])
  return { retained: true, date: result.dates['solothurn-region'] }
}
