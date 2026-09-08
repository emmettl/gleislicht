import { buildNyonDay } from './build-nyon-day.mjs'
import { NYON_REVIEWED_DATES } from './nyon-release-validation.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

export async function refreshNyonDay(options, { build = buildNyonDay, restore = restorePublishedRegionalData } = {}) {
  if (NYON_REVIEWED_DATES.includes(options.date)) {
    try { return { retained: false, ...await build(options) } }
    catch (error) { console.warn(`Nyon release failed validation: ${error.message}. Retaining a verified dated study.`) }
  } else console.warn(`Nyon: ${options.date} has no reviewed complete-journey audit. Retaining a verified dated study.`)
  const result = await restore(options.output, undefined, options.bootstrapDirectory ?? 'public/data', ['nyon-region'])
  return { retained: true, date: result.dates['nyon-region'] }
}
