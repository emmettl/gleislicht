import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { destinationCandidates, orientDestination, DIRECTION_GATES } from './validate-cantonal-road-directions.mjs'
import { projectOnRoad } from './ingest-cantonal-road-topology.mjs'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const round = value => Math.round(value * 100) / 100
const inverse = direction => direction === 'positive' ? 'negative' : 'positive'
const countBy = (rows, key) => Object.fromEntries([...new Set(rows.map(key))].sort().map(k => [k, rows.filter(row => key(row) === k).length]))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const SOURCE_DIR = 'data/regional-road-direction-sources/2026-09-08'
const INPUTS = {
  geometry: 'data/regional-road-geometry.json.gz', audit: 'data/regional-road-geometry-audit.json',
  counts: 'data/regional-road-count-audit.json', manifest: `${SOURCE_DIR}/manifest.json`,
  basel: 'data/regional-road-geometry-sources/2026-09-08/basel-roads.json.gz',
}

export function orientLabel(label, point, points, places) {
  const match = label?.match(/^(nach|von) (.+)$/u)
  if (!match) return { status: 'unresolved-description' }
  const candidates = places.get(match[2])
  if (!candidates) return { status: 'unacquired-destination', destinationName: match[2] }
  const result = orientDestination(point, points, candidates)
  return { ...result, ...(result.direction ? { direction: match[1] === 'von' ? inverse(result.direction) : result.direction } : {}), relation: match[1], method: 'exact-settlement-and-axis-bearing' }
}

export function reviewPlan(counter, path, detector, review) {
  const details = detector?.details
  if (!details || !same(details.sourceDetectorIds, review.sourceDetectorIds) || details.signalId !== review.signalId || details.detectorCount !== review.detectorCount) throw new Error(`Plan detector mapping changed: ${counter.detectorId}`)
  if (Number(details.detectorCount) !== details.sourceDetectorIds.filter(id => id !== 'Unbekannt').length) throw new Error('Incomplete source detector mapping')
  const projection = projectOnRoad(counter.coordinateLv95, path.points)
  const edge = projection.edge
  const a = path.points[edge], b = path.points[edge + 1]
  const positiveBearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360
  if (!Number.isFinite(review.bearingDegrees) || review.maximumBearingDifferenceDegrees !== 20 || !['positive', 'negative'].includes(review.expectedDirection)) throw new Error('Invalid plan bearing review')
  const travelBearing = (positiveBearing + (review.expectedDirection === 'negative' ? 180 : 0)) % 360
  const difference = Math.abs(((travelBearing - review.bearingDegrees + 540) % 360) - 180)
  if (difference > review.maximumBearingDifferenceDegrees) throw new Error(`Plan bearing conflicts with axis: ${counter.detectorId}`)
  return { status: 'validated', method: review.method, direction: review.expectedDirection, evidence: { sourceFile: review.sourceFile, sourceSha256: review.sourceSha256, page: review.page, note: review.note, positiveAxisBearingDegrees: round(positiveBearing), reviewedTravelBearingDegrees: review.bearingDegrees, bearingDifferenceDegrees: round(difference) } }
}

export function reviewJunction(counter, path, review, baselRoads) {
  const roads = new Map(baselRoads.map(r => [r.id_strasse_weg, r]))
  const chain = review.roadChain.map(id => roads.get(id))
  const named = review.junctionRoadIds.map(id => roads.get(id))
  if (!chain.length || !named.length || chain.some(r => r?.strassenname !== review.roadName) || named.some(r => r?.strassenname !== review.namedRoad) || path.id !== `basel:${review.roadChain[0]}:0`) throw new Error('Named junction roads changed')
  const points = chain.map(r => r.geo_shape.geometry.coordinates)
  // This reviewed chain is explicitly ordered in source vertex order. No nearest-road jump.
  if (points.some((p, i) => i && distance(points[i - 1].at(-1), p[0]) > 1e-9) || distance(points.at(-1).at(-1), review.junctionWgs84) > 1e-9 || named.some(r => ![r.geo_shape.geometry.coordinates[0], r.geo_shape.geometry.coordinates.at(-1)].some(p => distance(p, review.junctionWgs84) < 1e-9))) throw new Error('Named junction chain disconnected')
  const first = points[0].map(p => wgs84ToLv95(...p))
  if (!same(first, path.points)) throw new Error('Reviewed junction path differs from source')
  const relation = counter.directionLabel.match(/\b(von|nach) Feldbergstrasse\b/u)?.[1]
  if (!relation || review.relation !== (relation === 'von' ? 'from' : 'toward')) throw new Error('Named junction relation changed')
  const direction = relation === 'von' ? 'negative' : 'positive'
  if (review.expectedDirection !== direction) throw new Error('Named junction direction conflicts')
  return { status: 'validated', method: review.method, direction, evidence: { roadChain: review.roadChain, junctionRoadIds: review.junctionRoadIds, junctionWgs84: review.junctionWgs84, note: review.note } }
}

export function auditCorridors(counters, directions) {
  const results = new Map(directions.map(d => [d.detectorId, d]))
  const paths = new Map()
  for (const counter of counters) {
    // Ambiguous candidates participate too: excluding them could bridge unresolved sites.
    const candidates = new Map()
    for (const candidate of counter.match.candidates ?? []) {
      if (!candidates.has(candidate.pathId) || candidate.distanceMetres < candidates.get(candidate.pathId).distanceMetres) candidates.set(candidate.pathId, candidate)
    }
    if (counter.match.best) candidates.set(counter.match.best.pathId, counter.match.best)
    for (const [pathId, candidate] of candidates) {
      if (!paths.has(pathId)) paths.set(pathId, new Map())
      const stations = paths.get(pathId)
      if (!stations.has(counter.stationId)) stations.set(counter.stationId, [])
      stations.get(counter.stationId).push({ counter, offset: candidate.offsetMetres, result: results.get(counter.detectorId) })
    }
  }
  const sections = []
  for (const [pathId, stations] of [...paths].sort(([a], [b]) => a.localeCompare(b))) {
    const groups = [...stations].map(([stationId, members]) => ({ stationId, members, offset: members.reduce((sum, m) => sum + m.offset, 0) / members.length })).sort((a, b) => a.offset - b.offset || a.stationId.localeCompare(b.stationId))
    for (let i = 1; i < groups.length; i++) {
      const a = groups[i - 1], b = groups[i], length = b.offset - a.offset
      const rows = [...a.members, ...b.members]
      const reasons = []
      if (rows.some(m => m.result?.status !== 'validated' || m.result.pathId !== pathId)) reasons.push('unresolved-endpoint-or-axis')
      if ([a, b].some(g => new Set(g.members.filter(m => m.result?.status === 'validated' && m.result.pathId === pathId).map(m => m.result.direction)).size !== 2)) reasons.push('incomplete-opposing-directions')
      if (rows.some(m => !m.counter.completeMeasuredBothDays)) reasons.push('incomplete-measured-days')
      if (new Set(rows.map(m => m.counter.measurementBasis)).size !== 1) reasons.push('different-measurement-bases')
      if (length < 100) reasons.push('colocated-counters')
      if (length > DIRECTION_GATES.maximumSectionMetres) reasons.push('counter-gap')
      // A common polyline proves geometric continuity, not absence of turns or local junctions.
      reasons.push('junction-and-turn-movements-unreviewed')
      sections.push({ pathId, fromStationId: a.stationId, toStationId: b.stationId, distanceMetres: round(length), geometryContinuity: 'same-source-path', fromDetectorIds: a.members.map(m => m.counter.detectorId).sort(), toDetectorIds: b.members.map(m => m.counter.detectorId).sort(), holdReasons: reasons, playbackEligible: false })
    }
  }
  return sections
}

export function buildAudit(audit, geometry, counts, reviews, places, basel) {
  const paths = new Map(geometry.paths.map(p => [p.id, p]))
  const detectors = new Map(counts.detectors.map(d => [d.id, d]))
  const reviewMap = new Map(reviews.entries.map(r => [r.detectorId, r]))
  if (reviewMap.size !== reviews.entries.length || reviews.entries.some(r => !audit.counters.some(c => c.detectorId === r.detectorId))) throw new Error('Duplicate or unknown review')
  const directions = audit.counters.map(counter => {
    const review = reviewMap.get(counter.detectorId), best = counter.match.best
    let result = { status: 'unresolved-description' }
    if (counter.match.status !== 'axis-candidate') {
      if (review) throw new Error('Reviewed counter no longer has an axis candidate')
      result = { status: 'held-geometry', geometryStatus: counter.match.status }
    } else {
      const path = paths.get(best.pathId)
      if (!path) throw new Error('Missing candidate path')
      if (review) {
        if (best.pathId !== review.pathId || counter.directionLabel !== review.directionLabel) throw new Error('Reviewed axis or label changed')
        if (review.method === 'reviewed-detector-plan') result = reviewPlan(counter, path, detectors.get(counter.detectorId), review)
        else if (review.method === 'reviewed-named-junction') result = reviewJunction(counter, path, review, basel)
        else throw new Error('Unknown review method')
      } else if (counter.source === 'thurgau') result = orientLabel(counter.directionLabel, counter.coordinateLv95, path.points, places)
    }
    return { detectorId: counter.detectorId, stationId: counter.stationId, source: counter.source, directionLabel: counter.directionLabel, measurementBasis: counter.measurementBasis, coordinateLv95: counter.coordinateLv95, pathId: best?.pathId ?? null, offsetMetres: best ? round(best.offsetMetres) : null, ...result, completeMeasuredBothDays: counter.completeMeasuredBothDays, directionalVolumeCandidate: result.status === 'validated' && counter.completeMeasuredBothDays, playbackEligible: false }
  })
  const corridors = auditCorridors(audit.counters, directions)
  return { metadata: { schemaVersion: 1, reviewedOn: reviews.reviewedOn, inputSha256: reviews.pins, sources: geometry.metadata.sources, directionSourceManifest: `${SOURCE_DIR}/manifest.json`, directionConvention: 'Positive follows source path vertex order; inferred from published descriptions and reviewed plans, not vehicle tracking.', scope: reviews.scope, directionGates: DIRECTION_GATES, playbackEligible: false, corridorScope: 'Adjacent station groups on a shared source path, including unresolved candidate counters. Cross-path connectivity and junction movements remain unreviewed.' }, summary: ['basel', 'thurgau', 'zurich-city'].map(source => { const rows = directions.filter(d => d.source === source); return { source, series: rows.length, status: countBy(rows, d => d.status), directionallyResolved: rows.filter(d => d.status === 'validated').length, completeDirectionalVolumeCandidates: rows.filter(d => d.directionalVolumeCandidate).length } }), corridorSummary: { pairs: corridors.length, playbackEligible: 0, holdReasons: countBy(corridors.flatMap(c => c.holdReasons), r => r) }, directions, corridors }
}

export async function loadInputs(root = '.') {
  const reviewsBytes = await readFile(resolve(root, 'data/regional-road-direction-reviews.json'))
  const reviews = JSON.parse(reviewsBytes)
  if (reviews.schemaVersion !== 1) throw new Error('Unknown review schema')
  const values = {}
  for (const [key, file] of Object.entries(INPUTS)) {
    const bytes = await readFile(resolve(root, file))
    if (hash(bytes) !== reviews.pins[file]) throw new Error(`Pinned input changed: ${file}`)
    values[key] = JSON.parse(file.endsWith('.gz') ? gunzipSync(bytes) : bytes)
  }
  if (!values.manifest.complete || values.manifest.purpose !== 'regional-road-direction-evidence') throw new Error('Incomplete direction snapshot')
  const places = new Map(), sources = new Map()
  for (const entry of values.manifest.files) {
    if (sources.has(entry.id) || entry.path.includes('/') || entry.path.includes('..')) throw new Error('Invalid source identity')
    let bytes = await readFile(resolve(root, SOURCE_DIR, entry.path))
    if (entry.path.endsWith('.gz')) bytes = gunzipSync(bytes)
    if (hash(bytes) !== entry.sha256 || bytes.length !== entry.bytes || !Number.isFinite(Date.parse(entry.acquiredAt))) throw new Error(`Source integrity mismatch: ${entry.id}`)
    sources.set(entry.id, entry)
    if (entry.kind === 'settlement') {
      const url = new URL(entry.url)
      if (url.origin !== 'https://api3.geo.admin.ch' || url.searchParams.get('searchText') !== entry.id || url.searchParams.get('sr') !== '2056' || url.searchParams.get('contains') !== 'false' || url.searchParams.get('layer') !== 'ch.swisstopo.swissnames3d') throw new Error('Settlement provenance mismatch')
      places.set(entry.id, destinationCandidates(entry.id, JSON.parse(bytes)))
    } else if (entry.kind !== 'detector-plan' || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid plan source')
  }
  for (const review of reviews.entries.filter(r => r.method === 'reviewed-detector-plan')) {
    const source = sources.get(review.sourceFile)
    if (source?.kind !== 'detector-plan' || source.sha256 !== review.sourceSha256 || review.page !== 1) throw new Error('Review plan source changed')
  }
  return { ...values, reviews, places, reviewSha256: hash(reviewsBytes) }
}

export async function compile(root = '.') {
  const { audit, geometry, counts, reviews, places, basel, reviewSha256 } = await loadInputs(root)
  const result = buildAudit(audit, geometry, counts, reviews, places, basel)
  result.metadata.reviewSha256 = reviewSha256
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'data/regional-road-direction-audit.json'
  const result = await compile()
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({ summary: result.summary, corridorSummary: result.corridorSummary }, null, 2))
}
