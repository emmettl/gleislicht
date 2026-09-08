import assert from 'node:assert/strict'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseLuzernRail } from './luzern-rail-geometry.mjs'
import { sha256 } from './fribourg-timetable.mjs'
import { bernTerminalNetwork } from './fribourg-bern-platforms.mjs'

const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), inputs = await json(config.rail.inputs)
const source = await json(`${config.rail.sourceDirectory}/source.json`)
const network = parseLuzernRail(gunzipSync(await readFile(`${config.rail.sourceDirectory}/network.xtf.gz`)).toString(), config.rail.limits.simplificationMetres)
const file = 'data/fribourg-bern-platform-policy.json', previous = await json(file).catch(e => { if (e.code !== 'ENOENT') throw e; return { sources: [] } })
const directory = 'data/fribourg-bern-platform-sources', pdf = await readFile(`${directory}/sbb-bern-plan-2026-08.pdf`)
assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
const hash = sha256(pdf), sourceRecord = { file: 'sbb-bern-plan-2026-08.pdf', sha256: hash,
  url: 'https://company.sbb.ch/content/dam/infrastruktur/trafimage/bahnhofplaene/plan-bern-a4.pdf',
  retrievedAt: previous.sources.find(s => s.sha256 === hash)?.retrievedAt ?? (await stat(`${directory}/sbb-bern-plan-2026-08.pdf`)).mtime.toISOString(),
  documentDate: '2026-08', role: 'SBB station plan, exterior page 3: tracks 49/50 at western end of Bern. Visual identity/extent evidence only; source curves remain FOT.' }
const corridors = [
  { routeIds: ['91-15-B-j26-1', '91-1-D-j26-1', '91-1-E-j26-1', '91-2-A-j26-1'], segment: network.segments.find(s => s.id === 'ch14uvag00087328') },
  { routeIds: ['91-66-A-j26-1'], segment: network.segments.find(s => s.id === 'ch14uvag00087196') },
]
const policy = { schemaVersion: 1, id: 'bern-western-terminal', sourceDirectory: directory, sources: [sourceRecord],
  fotSha256: source.sha256, inputsSha256: config.rail.inputsSha256, previousReviewSha256: config.rail.review.sha256,
  node: network.nodes.get('ch14uvag00088813'),
  stops: ['ch:1:sloid:7000:55:49', 'ch:1:sloid:7000:55:50'].map(id => inputs.stops.find(s => s.stop_id === id)),
  maximumProjectionMetres: 75, minimumTrimMetres: 200, maximumTrimMetres: 600, corridors,
  routes: config.rail.routes.filter(r => corridors.some(c => c.routeIds.includes(r.routeId))),
  admission: 'Only a single terminal Bern call on the two exact reviewed platforms may project onto its pinned western approach. Clip the source curve at the projection and remove all other station-centre connections in that pattern-local graph. Preserve original stop identity, coordinates, times, source bytes and prior accepted paths. Full pattern consensus, 350 m station / 120 m topology / 2.5× detour guards remain; no inferred running-track or switch certification.',
  excludedEvidence: [{ url: 'https://www.sbb.ch/de/reiseinformationen/bahnhoefe/bahnhof-finden/bahnhof-bern/bahnhofsbeschrieb.html', reason: 'Direct acquisition returned HTTP 403; not used as retained evidence.' }] }
for (const corridor of corridors) for (const stop of policy.stops) {
  const { evidence } = bernTerminalNetwork(network, policy, stop, corridor)
  console.log(corridor.segment.id, stop.platform_code, evidence.projection.attachmentMetres.toFixed(1), evidence.projection.removedMetres.toFixed(1))
}
await writeFile(file, JSON.stringify(policy, null, 2) + '\n')
config.rail.admission = config.rail.admission.replace('Kerzers platform and SBB Däniken reviews', 'Kerzers platform, SBB Däniken and Bern terminal reviews')
config.rail.bernPlatforms = { file, sha256: sha256(await readFile(file)) }
await writeFile('data/fribourg-policy.json', JSON.stringify(config, null, 2) + '\n')
