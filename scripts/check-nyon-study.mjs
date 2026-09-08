import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { readPostbusDay } from './prepare-postbus-road-feed.mjs'
import { validateVaudArtifacts } from './audit-vaud-study.mjs'
const root = process.argv[2] ?? 'data/nyon-region'
const report = JSON.parse(await readFile(join(root,'audit.json')))
for (const day of report.days) {
  const directory=join(root,day.date),{manifest,chunks,trains}=await readPostbusDay(join(directory,'nyon-region-day-manifest.json'))
  const morning=JSON.parse(await readFile(join(directory,'nyon-region-morning.json')))
  validateVaudArtifacts(manifest,chunks.map(c=>({descriptor:c.descriptor,payload:c.payload})),morning)
  assert.equal(trains.length,day.completeSourceJourneysChecked)
  assert.deepEqual(manifest.metadata.sourceHashes,day.sourceHashes)
  assert.deepEqual(morning.metadata.sourceHashes,day.sourceHashes)
  assert.deepEqual(manifest.metadata.agencyIds,report.agencies)
  assert.equal(manifest.metadata.serviceDate,day.date)
  assert(day.groups.length===3&&day.groups.every(g=>g.coverage===1&&g.acceptedDirectedPairs===g.directedPairs))
  assert(trains.every(t=>t.pathSegments.length===t.stops.length-1&&t.pathSegments.every(id=>id!==null)))
  for(const c of chunks)assert.equal(createHash('sha256').update(await readFile(c.path)).digest('hex'),c.descriptor.sha256)
  console.log(`${day.date}: ${trains.length} complete journeys; 14 artifacts and all directed paths verified`)
}
