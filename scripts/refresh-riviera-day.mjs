import { buildRivieraDay } from './build-riviera-day.mjs'
import { RIVIERA_REVIEWED_DATES } from './riviera-release-validation.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'

export async function refreshRivieraDay(options, { build = buildRivieraDay, restore = restorePublishedRegionalData } = {}) {
  if (RIVIERA_REVIEWED_DATES.includes(options.date)) {
    try { return { retained: false, ...await build(options) } }
    catch (error) { console.warn(`Riviera release failed validation: ${error.message}. Retaining a verified dated study.`) }
  } else console.warn(`Riviera: ${options.date} has no reviewed complete-journey audit. Retaining a verified dated study.`)
  const result = await restore(options.output, undefined, options.bootstrapDirectory ?? 'public/data', ['riviera-region'])
  return { retained: true, date: result.dates['riviera-region'] }
}
