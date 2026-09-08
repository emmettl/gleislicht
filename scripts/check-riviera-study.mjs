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
  assert.equal(report.gate.passed, true)
  assert.deepEqual(manifest.metadata.funicularGeometry.routes, report.funicularGeometry)
  for (const chunk of chunks) assert.equal(createHash('sha256').update(await readFile(chunk.path)).digest('hex'), chunk.descriptor.sha256)
  for (const group of report.groups) {
    const selected = trains.filter(t => group.routes.includes(t.routeId))
    assert.equal(selected.length, group.trips)
    assert.equal(selected.reduce((n, t) => n + t.pathSegments.filter(i => i !== null).length, 0), group.acceptedSegments)
    assert.equal(group.coverage, 1)
    assert(selected.every(t => t.pathSegments.every(i => i !== null)))
  }
  console.log(`${report.date}: ${trains.length} complete journeys; 14 artifacts verified; all rail/bus/funicular geometry verified`)
}
