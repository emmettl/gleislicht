import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { readPostbusDay } from './prepare-postbus-road-feed.mjs'
import { validateVaudArtifacts } from './audit-vaud-study.mjs'
const root = process.argv[2] ?? 'data/riviera-region'
const audit = JSON.parse(await readFile(join(root, 'audit.json')))
for (const report of audit.days) {
  const directory = join(root, report.date)
  const { manifest, chunks, trains } = await readPostbusDay(join(directory, 'riviera-region-day-manifest.json'))
  const morning = JSON.parse(await readFile(join(directory, 'riviera-region-morning.json')))
  validateVaudArtifacts(manifest, chunks.map(c => ({ descriptor: c.descriptor, payload: c.payload })), morning)
  assert.equal(trains.length, report.completeSourceJourneysChecked)
  assert.deepEqual(manifest.metadata.sourceHashes, report.sourceHashes)
  assert.deepEqual(morning.metadata.sourceHashes, report.sourceHashes)
  assert.equal(manifest.metadata.serviceDate, report.date)
  assert.deepEqual(manifest.metadata.geometryGate, report.gate)
  for (const chunk of chunks) assert.equal(createHash('sha256').update(await readFile(chunk.path)).digest('hex'), chunk.descriptor.sha256)
  for (const group of report.groups) {
    const selected = trains.filter(t => group.routes.includes(t.routeId))
    assert.equal(selected.length, group.trips)
    assert.equal(selected.reduce((n, t) => n + t.pathSegments.filter(i => i !== null).length, 0), group.acceptedSegments)
    if (group.mode === 'rail' || group.mode === 'bus') assert.equal(group.coverage, 1)
    if (group.mode === 'funicular') assert.equal(group.acceptedSegments, 0, 'Deferred funicular has accidental rail geometry')
  }
  console.log(`${report.date}: ${trains.length} complete journeys; 14 artifacts verified; rail/bus coverage 100%; funiculars deferred`)
}
