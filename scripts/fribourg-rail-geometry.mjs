import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { loadLuzernRail, luzernRailInputs } from './luzern-rail-geometry.mjs'
import { loadFribourgBernPlatforms } from './fribourg-bern-platforms.mjs'
import { loadFribourgRailReview } from './fribourg-rail-review.mjs'
import { sha256, hashFile } from './fribourg-timetable.mjs'

const json = async file => JSON.parse(await readFile(file, 'utf8'))
export const FRIBOURG_RAIL_LIMITS = { simplificationMetres: 5, stationAttachmentMetres: 350, topologyAttachmentMetres: 120, detourRatio: 2.5, detourFloorMetres: 3000 }

export function fribourgRailScope(timetable) {
  return timetable.routes.filter(r => r.mode === 'rail' && (['11', '33'].includes(r.agencyId)
    || r.agencyId === '53' && ['S20', 'S21', 'RE2', 'RE3'].includes(r.name)))
    .map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name, gauge: 'mm1435' })).sort((a, b) => a.routeId.localeCompare(b.routeId))
}

export function fribourgRailRaw(timetable) {
  const stops = new Map()
  for (const day of timetable.snapshots) for (const s of day.stops) {
    const stop = { stop_id: s[4], stop_name: s[2], platform_code: s[3], stop_lon: s[0], stop_lat: s[1] }
    if (stops.has(s[4])) assert.deepEqual(stops.get(s[4]), stop, 'Inconsistent rail platform identity across dates')
    stops.set(s[4], stop)
  }
  return { dates: timetable.snapshots.map(s => s.metadata.serviceDate), stops: [...stops.values()],
    inventory: timetable.routes.map(r => ({ routeId: r.id, agencyId: r.agencyId, line: r.name })),
    snapshots: timetable.snapshots.map(day => ({ date: day.metadata.serviceDate, trains: day.trains.map(t => ({ routeId: t.routeId, directionId: t.directionId,
      calls: t.stops.map(([i], j) => ({ id: day.stops[i][4], pickupType: String(t.callPermissions[j][0]), dropOffType: String(t.callPermissions[j][1]) })) })) })) }
}

export async function prepareFribourgRail(timetablePath) {
  const timetable = JSON.parse(gunzipSync(await readFile(timetablePath))), directory = 'data/fribourg-rail-sources'
  await mkdir(directory, { recursive: true })
  const source = await json('data/thurgau-rail-sources/source.json')
  for (const [file, hash] of Object.entries(source.files)) {
    assert.equal(await hashFile(join('data/thurgau-rail-sources', file)), hash)
    await copyFile(join('data/thurgau-rail-sources', file), join(directory, file))
  }
  const previous = await json(join(directory, 'source.json')).catch(error => { if (error.code !== 'ENOENT') throw error; return { supportingDocuments: [] } })
  const evidence = [
    { file: 'tpf-network-statement-2026-vn.pdf', dataUpdated: '2026-01-01', version: '3.5', url: 'https://www.tpf.ch/Portals/0/Images/Fichiers//A%20propos%20des%20TPF//activite%20infra/33000_20260101_network_statement%202026%20final%20VN_v3.5.pdf', purpose: 'TPF standard-gauge Fribourg–Ins and Broc–Romont corridors; gauge evidence, not geometry vintage.' },
    { file: 'tpf-verrerie-works.html', url: 'https://www.tpf.ch/fr/horaires-et-reseaux/perturbations-et-travaux/travaux-sur-le-troncon-ferroviaire-la-verrerie-vaulruz-sud', purpose: 'Sunday 6 September 2026 from 21:00: no S50/S51 trains Bulle–Semsales. Also identifies 2025–2027 metric-line rebuilding; no new FOT admission of that altered corridor.' },
  ]
  for (const record of evidence) {
    const file = join(directory, record.file), bytes = await readFile(file)
    if (record.file.endsWith('.pdf')) assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', 'Expected a PDF, not a soft-404 HTML page')
    else assert(bytes.toString().includes('Semsales') && bytes.toString().includes('2026'), 'Missing works notice content')
    record.sha256 = sha256(bytes)
    const retained = previous.supportingDocuments?.find(d => d.file === record.file && d.sha256 === record.sha256)
    record.retrievedAt = retained?.retrievedAt ?? (await stat(file)).mtime.toISOString()
  }
  const provenance = { ...source, catalogueLicense: source.license,
    reuseNote: 'Reused the hashed national FOT snapshot already acquired for Thurgau. No fresh acquisition or current-alignment claim. Explicit TPF gauge and dated works evidence accompany this Fribourg application.',
    supportingDocuments: evidence }
  delete provenance.license
  await writeFile(join(directory, 'source.json'), JSON.stringify(provenance, null, 2) + '\n')
  const policyPath = 'data/fribourg-policy.json', policy = await json(policyPath)
  const review = policy.rail?.review, bernPlatforms = policy.rail?.bernPlatforms
  policy.rail = { ...(review ? { review } : {}), ...(bernPlatforms ? { bernPlatforms } : {}), sourceDirectory: directory, sourceMetadataSha256: await hashFile(join(directory, 'source.json')), limits: FRIBOURG_RAIL_LIMITS,
    routes: fribourgRailScope(timetable),
    admission: 'Fill failed cantonal rail pairs using exact operating-point numbers and standard-gauge infrastructure. All full directed pattern contexts must agree; block other called stations out of order. Keep all original calls and existing accepted paths. No general nearest-station or operator-name substitution; only separately hashed Kerzers platform, SBB Däniken and Bern terminal reviews may fill the original failures. Meter-gauge, gauge-changing and unreviewed TPF special routes remain outside this supplement.',
    inputs: 'data/fribourg-rail-inputs.json', timetableSourceHashes: timetable.sourceHashes }
  const inputs = luzernRailInputs(fribourgRailRaw(timetable), policy.rail)
  await writeFile(policy.rail.inputs, JSON.stringify(inputs) + '\n')
  policy.rail.inputsSha256 = await hashFile(policy.rail.inputs)
  await writeFile(policyPath, JSON.stringify(policy, null, 2) + '\n')
  console.log({ routes: policy.rail.routes.length, fullPatterns: inputs.snapshots[0].trains.length, source: provenance.sha256 })
}

export async function loadFribourgRail(timetable, policy) {
  assert.deepEqual(policy.limits, FRIBOURG_RAIL_LIMITS)
  if (timetable) {
    assert.deepEqual(policy.routes, fribourgRailScope(timetable), 'Changed rail scope')
    assert.deepEqual(policy.timetableSourceHashes, timetable.sourceHashes)
  }
  const result = await loadLuzernRail(policy, timetable ? fribourgRailRaw(timetable) : undefined)
  for (const doc of result.source.supportingDocuments) assert.equal(await hashFile(join(policy.sourceDirectory, doc.file)), doc.sha256)
  const reviewed = policy.review ? await loadFribourgRailReview(policy, result) : {}
  const baseline = { ...result, ...reviewed, policy }
  return policy.bernPlatforms ? loadFribourgBernPlatforms(policy, baseline) : baseline
}

export function applyFribourgRail(result, rail) {
  const paths = new Map(result.paths.map((p, i) => [JSON.stringify(p), i]))
  const allowed = new Set(rail.policy.routes.map(r => r.routeId))
  const pairs = new Map(result.pairs.map(p => [JSON.stringify([p.routeId, p.fromId, p.toId]), p]))
  for (const [key, pair] of pairs) {
    if (pair.mode !== 'rail' || pair.pathIndex !== null || !allowed.has(pair.routeId)) continue
    const candidate = rail.pairs.get(key)
    assert(candidate, 'Missing full-pattern rail pair')
    const { path, ...assessment } = candidate, officialFailure = { ...pair }
    pair.railFallback = assessment
    if (!path) continue
    const signature = JSON.stringify(path)
    if (!paths.has(signature)) { paths.set(signature, result.paths.length); result.paths.push(path) }
    pair.officialFailure = officialFailure; delete pair.reason
    pair.pathIndex = paths.get(signature); pair.pathMetres = candidate.pathMetres
    pair.maximumSnapMetres = Math.max(...candidate.stationAttachmentsMetres)
    pair.geometrySource = 'fot-rail-inference'
    pair.geometrySha256 = sha256(signature)
  }
  const patterns = new Map(result.patterns.map(p => [p.id, p]))
  for (const p of result.patterns.filter(p => p.mode === 'rail')) {
    p.pathSegments = p.stopIds.slice(1).map((to, i) => pairs.get(JSON.stringify([p.routeId, p.stopIds[i], to])).pathIndex)
    p.matchedSegments = p.pathSegments.filter(i => i !== null).length
    p.railSegments = p.stopIds.slice(1).filter((to, i) => pairs.get(JSON.stringify([p.routeId, p.stopIds[i], to])).geometrySource === 'fot-rail-inference').length
    p.railReviewKinds = [...new Set(p.stopIds.slice(1).map((to, i) => pairs.get(JSON.stringify([p.routeId, p.stopIds[i], to])).railFallback?.railReview?.kind).filter(Boolean))].sort()
    p.admittedTrips = 0; p.decisions = {}
  }
  for (const pair of result.pairs.filter(p => p.mode === 'rail')) pair.admittedOccurrences = 0
  for (const train of result.trains) {
    const p = patterns.get(train.patternId)
    if (p.mode !== 'rail') continue
    train.pathSegments = p.pathSegments
    if (p.railSegments) {
      train.admission = train.reservationRequired ? 'reservation-or-demand-responsive' : p.matchedSegments === p.segmentCount ? 'admitted' : 'incomplete-directed-pattern'
      train.geometrySource = 'cantonal-lines-with-fot-rail-inference'; train.railSegmentCount = p.railSegments
    }
    if (p.railReviewKinds.length) {
      train.railReviewKinds = p.railReviewKinds
      train.geometrySource = 'cantonal-lines-with-reviewed-rail-inference'
    }
    const admitted = train.admission === 'admitted'
    p.admittedTrips += Number(admitted); p.decisions[train.admission] = (p.decisions[train.admission] ?? 0) + 1
    for (let i = 1; i < p.stopIds.length; i++) pairs.get(JSON.stringify([p.routeId, p.stopIds[i - 1], p.stopIds[i]])).admittedOccurrences += Number(admitted)
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepareFribourgRail(process.argv[2])
