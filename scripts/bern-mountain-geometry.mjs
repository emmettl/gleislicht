import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { bernWgs84 } from './bern-spatial.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { bernAdmission, BERN_LIMITS } from './bern-line-geometry.mjs'
const sha = b => createHash('sha256').update(b).digest('hex')
export async function loadBernMountains() {
  const policyBytes = await readFile('data/bern-mountain-policy.json'), policy = JSON.parse(policyBytes)
  const dir = policy.sourceDirectory, bytes = await readFile(`${dir}/source.json`), source = JSON.parse(bytes)
  assert.equal(sha(bytes), policy.sourceMetadataSha256)
  for (const [file, hash] of Object.entries(source.files)) assert.equal(sha(await readFile(`${dir}/${file}`)), hash)
  const catalogue = JSON.parse(await readFile(`${dir}/catalogue.json`))
  assert.equal(catalogue.features[0].assets['seilbahnen-bundeskonzession_2056_de.xtf.zip']['file:checksum'], `1220${source.sha256}`)
  const network = JSON.parse(gunzipSync(await readFile(`${dir}/decoded.json.gz`)))
  assert.deepEqual(JSON.parse(execFileSync('python3', ['scripts/prepare-bern-mountain-sources.py', `${dir}/source.xtf.zip`], { maxBuffer: 16 * 1024 * 1024 })), network)
  for (const [name, count] of Object.entries(source.counts)) assert.equal(network[name].length, count)
  return { policy, network, metadata: { policy, source, policySha256: sha(policyBytes) } }
}

export function matchBernMountain(from, to, route, date, mountain) {
  const { policy, network } = mountain
  const binding = policy.bindings.find(b => b.routeId === route.id && b.stops[from[4]] && b.stops[to[4]] && from[4] !== to[4])
  if (!binding) return { reason: 'unreviewed-mountain-pair' }
  assert.equal(route.agencyId, binding.agencyId); assert.equal(route.name, binding.line); assert.equal(route.mode, 'cableway')
  const installations = network.installations.filter(i => i.number === binding.installation)
  assert.equal(installations.length, 1)
  const installation = installations[0]
  assert.equal(installation.operator, binding.operator); assert.equal(installation.vehicle, binding.vehicle); assert.equal(installation.type, 'Luftseilbahn')
  if (installation.validFrom > date || installation.validUntil && installation.validUntil < date) return { reason: 'mountain-source-validity' }
  const stations = [from, to].map(s => network.stations.filter(n => n.installation === installation.id && n.number === binding.stops[s[4]]))
  assert(stations.every(s => s.length === 1))
  const segments = network.segments.filter(s => s.installation === installation.id)
  assert.equal(segments.length, 1); assert.equal(segments[0].lines.length, 1)
  const coords = stations.map(s => bernWgs84(s[0].coordinate)), axis = segments[0].lines[0].map(bernWgs84)
  const forward = distanceMetres(coords[0], axis[0]) + distanceMetres(coords[1], axis.at(-1)) <= distanceMetres(coords[0], axis.at(-1)) + distanceMetres(coords[1], axis[0])
  const line = forward ? axis : [...axis].reverse()
  const stationGaps = [from, to].map((s, i) => distanceMetres(s, coords[i]))
  const topologyGaps = coords.map((s, i) => distanceMetres(s, i ? line.at(-1) : line[0]))
  const evidence = { sourceKind: 'fot-cableway-axis', sourceId: binding.installation, sourceDate: installation.sourceDate,
    sourceStationNumbers: stations.map(s => s[0].number), maximumSnapMetres: Math.max(...stationGaps), stationGaps, topologyGaps }
  if (Math.max(...stationGaps) > policy.stationSnapMetres || Math.max(...topologyGaps) > policy.topologySnapMetres) return { ...evidence, reason: 'mountain-endpoint-gap' }
  const path = [from.slice(0, 2), ...line, to.slice(0, 2)].map(p => p.map(n => Number(n.toFixed(7))))
    .filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1])
  const length = path.slice(1).reduce((sum, p, i) => sum + distanceMetres(path[i], p), 0), limits = BERN_LIMITS.cableway
  if (length < 1 || length > Math.max(limits.detourFloorMetres, distanceMetres(from, to) * limits.detourRatio)) return { ...evidence, reason: 'mountain-detour-or-collapse' }
  return { ...evidence, path, pathMetres: length }
}

export function applyBernMountains(raw, result, routes, mountain) {
  const stops = new Map(raw.stops.map(s => [s[4], s])), changes = new Map(), signatures = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  for (const pair of result.pairs) {
    if (!mountain.policy.admittedRouteIds.includes(pair.routeId) || pair.pathIndex !== null) continue
    const match = matchBernMountain(stops.get(pair.fromId), stops.get(pair.toId), routes.get(pair.routeId), raw.metadata.serviceDate, mountain)
    if (!match.path) { pair.supplementRejection = match.reason; continue }
    const { path, ...assessment } = match, signature = JSON.stringify(path)
    if (!signatures.has(signature)) { signatures.set(signature, result.paths.length); result.paths.push(path) }
    const { pathIndex: _i, occurrences: _o, admittedOccurrences: _a, ...original } = pair
    Object.assign(pair, assessment, { pathIndex: signatures.get(signature), originalAssessment: original }); delete pair.reason
    changes.set(JSON.stringify([pair.routeId, pair.fromId, pair.toId]), pair)
  }
  for (const p of result.patterns) {
    if (!mountain.policy.admittedRouteIds.includes(p.routeId)) continue
    const pairs = p.stopIds.slice(1).map((id, i) => changes.get(JSON.stringify([p.routeId, p.stopIds[i], id])))
    p.pathSegments = p.pathSegments.map((index, i) => pairs[i]?.pathIndex ?? index)
    p.matchedSegments = p.pathSegments.filter(i => i !== null).length
    p.supplementalSources = [...new Set(pairs.filter(Boolean).map(p => p.sourceId))].sort()
    // A separate, explicit installation binding authorizes this source. Do not
    // insert a fictitious OEVTP line code into the original cantonal crosswalk.
    p.supplementalBinding = pairs.every(Boolean) && p.matchedSegments === p.segmentCount
    p.admittedTrips = 0; p.decisions = {}
  }
  const patterns = new Map(result.patterns.map(p => [p.id, p]))
  for (const t of result.trains) {
    if (!mountain.policy.admittedRouteIds.includes(t.routeId)) continue
    const p = patterns.get(t.patternId)
    t.pathSegments = p.pathSegments
    t.admission = t.reservationRequired ? 'reservation-or-demand-responsive' : p.supplementalBinding ? 'admitted' : bernAdmission(t, p)
    p.admittedTrips += Number(t.admission === 'admitted'); p.decisions[t.admission] = (p.decisions[t.admission] ?? 0) + 1
  }
  const pairMap = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  for (const p of result.pairs) p.admittedOccurrences = 0
  for (const p of result.patterns) for (let i = 1; i < p.stopIds.length; i++) pairMap.get(JSON.stringify([p.routeId, p.stopIds[i - 1], p.stopIds[i]])).admittedOccurrences += p.admittedTrips
  return result
}
