import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

// Local / Express remains a fully tested local proof while the MTA feed's
// transformation and application-licensing clauses await written clarification.
// Keep this list explicit so enabling publication is a reviewable decision.
const excludedUntilCleared = [
  'dist/new-york.html',
  'dist/data/local-express-lexington-morning.json',
  'dist/data/local-express-geography.json',
  'dist/data/local-express-diagram.json',
  'dist/data/local-express-day-manifest.json',
  'dist/data/local-express-day-chunks',
]

for (const path of excludedUntilCleared) {
  await rm(resolve(path), { force: true, recursive: true })
}

console.log(
  `Prepared Pages artifact; withheld ${excludedUntilCleared.length} Local / Express files pending publication clearance.`,
)
