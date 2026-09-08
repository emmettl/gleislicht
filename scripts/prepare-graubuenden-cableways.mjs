import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { readJson, saveJson } from './build-graubuenden-region.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
const raw = await readJson('data/graubuenden-audit/timetable.json.gz')
const inventory = raw.inventory.filter(r => r.mode === 'mountain'), ids = new Set(inventory.map(r => r.routeId))
const stops = new Set(raw.snapshots.flatMap(d => d.trains.filter(t => ids.has(t.routeId)).flatMap(t => t.calls.map(c => c.id))))
const inputs = 'data/graubuenden-cableway-inputs.json'
await saveJson(inputs, { dates: raw.dates, inventory, stops: raw.stops.filter(s => stops.has(s.stop_id)) })
const routes = [
  ['93-294-0-j26-1', '232', '2940', '585', '71.044', ['8509679', '8509680']],
  ['93-296-0-j26-1', '249', '2960', '1099', '71.118', ['8530598', '8530599']],
  ['93-62-Y-j26-1', '218', 'PB', '1029', '71.006', ['8509371', '8509372']],
  ['93-288-A-j26-1', '236', '2880', '1035', '71.013', ['8530545', '8530546']],
  ['93-292-2-j26-1', '252', '2922', '1176', '72.155', ['8530582', '8530583']],
  ['93-30-Y-j26-1', '238', 'GB', '1029', '72.004', ['8530604', '8509277']],
].map(([routeId, agencyId, line, sourceOperator, installation, stopNumbers]) => {
  assert(raw.inventory.some(r => r.routeId === routeId && r.agencyId === agencyId && r.line === line && r.routeType === 1300))
  return { routeId, agencyId, line, sourceOperator, segments: [{ installation, stopNumbers, sourceStationNumbers: stopNumbers }] }
})
const selected = new Set(routes.map(r => r.routeId))
const review = { schemaVersion: 1, supportingEvidenceSha256: sha256(await readFile('data/graubuenden-cableway-sources/evidence.json')), sourceDirectory: 'data/luzern-cableway-sources', sourceMetadataSha256: sha256(await readFile('data/luzern-cableway-sources/source.json')),
  initialPolicySha256: sha256(await readFile('data/graubuenden-cableway-sources/initial-policy.json')),
  expansionEvidenceSha256: sha256(await readFile('data/graubuenden-cableway-sources/expansion-evidence.json')),
  blockedRoutes: [{ routeId: '93-7J-Y-j26-1', agencyId: '3161', reason: 'cableway-summer-installation-conflict', installation: '71.098', note: 'Exact-number candidate is the 1995 Ravaisch II installation, consistent with Twinliner L1. Official operator says L1 is refurbished in summer 2026 and L2 operates instead. Do not assign this axis to the summer timetable route.' }],
  inputs, inputsSha256: sha256(await readFile(inputs)), dates: raw.dates, routes,
  patternIds: [...new Set(raw.snapshots.flatMap(d => d.trains.filter(t => selected.has(t.routeId)).map(t => sha256(directedPatternKey(t)).slice(0, 20))))].sort(),
  limits: { stationAttachmentMetres: 10, topologyAttachmentMetres: 1, detourRatio: 4.5, detourFloorMetres: 1200 },
  interpretation: 'Six exact station-number and operator crosswalks on complete federal 2D axes. No aliases, section splicing, cable sag, altitude, observed cabins or current operating guarantee. Timetable agency IDs and infrastructure operator numbers are separate namespaces.',
  sourceReuse: 'The Luzern directory holds the complete national federal archive, not a regional extract. Verify its catalogue checksum, ZIP member and all file hashes before use.' }
await saveJson('data/graubuenden-cableway-policy.json', review)
const policy = await readJson('data/graubuenden-policy.json')
policy.cablewayReview = { policySha256: sha256(await readFile('data/graubuenden-cableway-policy.json')) }
await writeFile('data/graubuenden-policy.json', JSON.stringify(policy, null, 2) + '\n')
console.log({ routes: routes.length, patterns: review.patternIds.length })
