import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { projectOnRoad } from './ingest-cantonal-road-topology.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const directory = 'data/regional-road-junction-sources/2026-09-08'
const pointKey = point => point.slice(0, 2).join(',')

export function checkRoundabout(review, features, path, from, to) {
  if (review.status !== 'intervening-roundabout' || new Set(review.cycleFeatureIds).size !== 3) throw new Error('Invalid roundabout review')
  const byId = new Map(features.map(f => [f.featureId, f]))
  const cycle = review.cycleFeatureIds.map(id => byId.get(id))
  if (cycle.some(f => f?.geometry?.type !== 'MultiLineString' || f.geometry.coordinates.length !== 1)) throw new Error('Missing cycle geometry')
  const nodes = new Map()
  for (const feature of cycle) {
    const points = feature.geometry.coordinates[0]
    const endpoints = [points[0], points.at(-1)].map(pointKey)
    if (endpoints[0] === endpoints[1]) throw new Error('Degenerate cycle edge')
    for (const endpoint of endpoints) nodes.set(endpoint, (nodes.get(endpoint) ?? 0) + 1)
    for (const point of points) {
      const hit = projectOnRoad(point, path.points)
      if (hit.distance > 20 || hit.offset <= from || hit.offset >= to) throw new Error('Cycle is outside reviewed counter interval')
    }
  }
  if (nodes.size !== 3 || [...nodes.values()].some(n => n !== 2)) throw new Error('Roundabout cycle disconnected')
  const branch = byId.get(review.branchFeatureId)
  if (branch?.properties?.strassenname !== review.branchName || branch.geometry?.type !== 'MultiLineString' || branch.geometry.coordinates.length !== 1) throw new Error('Named branch changed')
  const points = branch.geometry.coordinates[0]
  const joined = [points[0], points.at(-1)].filter(p => nodes.has(pointKey(p)))
  if (joined.length !== 1) throw new Error('Named branch does not join cycle')
  return { ...review, junctionCoordinateLv95: joined[0], junctionOffsetMetres: Math.round(projectOnRoad(joined[0], path.points).offset * 100) / 100, playbackEligible: false }
}

export async function compileJunctionAudit() {
  const reviewBytes = await readFile('data/regional-road-junction-reviews.json'), reviews = JSON.parse(reviewBytes)
  const directionBytes = await readFile('data/regional-road-direction-audit.json'), directions = JSON.parse(directionBytes)
  const manifestBytes = await readFile(`${directory}/manifest.json`), manifest = JSON.parse(manifestBytes)
  if (reviews.schemaVersion !== 1 || hash(directionBytes) !== reviews.directionAuditSha256 || hash(manifestBytes) !== reviews.sourceManifestSha256 || !manifest.complete) throw new Error('Junction review inputs changed')
  const geometryBytes = await readFile('data/regional-road-geometry.json.gz')
  if (hash(geometryBytes) !== directions.metadata.inputSha256['data/regional-road-geometry.json.gz']) throw new Error('Geometry input changed')
  const geometry = JSON.parse(gunzipSync(geometryBytes))
  const sources = new Map()
  for (const source of manifest.files) {
    if (source.path.includes('/') || source.path.includes('..') || sources.has(source.id)) throw new Error('Invalid source identity')
    const bytes = gunzipSync(await readFile(`${directory}/${source.path}`))
    const data = JSON.parse(bytes), url = new URL(source.url)
    if (hash(bytes) !== source.sha256 || bytes.length !== source.bytes || data.results?.length !== source.features || source.features >= 200 || url.origin !== 'https://api3.geo.admin.ch' || url.searchParams.get('layers') !== 'all:ch.swisstopo.swisstlm3d-strassen' || url.searchParams.get('sr') !== '2056' || data.results.some(f => f.layerBodId !== 'ch.swisstopo.swisstlm3d-strassen')) throw new Error('Invalid or saturated road response')
    sources.set(source.id, data.results)
  }
  const reviewed = reviews.entries.map(review => {
    const pair = directions.corridors.find(p => p.pathId === review.pathId && p.fromStationId === review.fromStationId && p.toStationId === review.toStationId)
    const path = geometry.paths.find(p => p.id === review.pathId)
    if (!pair || !path || !sources.has(review.sourceId)) throw new Error('Reviewed corridor missing')
    const offsets = station => directions.directions.filter(d => d.stationId === station && d.pathId === path.id && d.status === 'validated').map(d => d.offsetMetres)
    const from = offsets(pair.fromStationId), to = offsets(pair.toStationId)
    if (!from.length || !to.length) throw new Error('Unresolved reviewed endpoints')
    return checkRoundabout(review, sources.get(review.sourceId), path, Math.max(...from), Math.min(...to))
  })
  return { metadata: { schemaVersion: 1, directionAuditSha256: hash(directionBytes), reviewSha256: hash(reviewBytes), sourceManifestSha256: hash(manifestBytes), sourceManifest: `${directory}/manifest.json`, publisher: manifest.publisher, scope: 'Bounded intervening-junction review; no speed or turning-flow inference.' }, reviewed, corridors: directions.corridors.map(pair => {
    const review = reviewed.find(r => r.pathId === pair.pathId && r.fromStationId === pair.fromStationId && r.toStationId === pair.toStationId)
    return review ? { ...pair, holdReasons: pair.holdReasons.map(reason => reason === 'junction-and-turn-movements-unreviewed' ? review.status : reason), junctionReview: review.sourceId } : pair
  }) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await compileJunctionAudit()
  await writeFile('data/regional-road-junction-audit.json', `${JSON.stringify(result, null, 2)}\n`)
  console.log(`Reviewed ${result.reviewed.length} intervening junction; ${result.corridors.length} corridor pairs remain held.`)
}
