import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { wgs84ToLv95 } from './ingest-corridor-terrain.mjs'
import { applyTerritetGeometry } from './territet-geometry.mjs'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const SOURCE_HASH = '3594a4be7a7d712258157da5477ab24596e81c207347a1de4f81b1a2e41ebe25'
const ARCHIVE_HASH = '75086b5aa7e721f5ad2ea080e14e9e3f42d5e0afdee31c2e3c162f412fab4114'
const STOP_IDS = ['ch:1:sloid:30673', 'ch:1:sloid:92618', 'ch:1:sloid:30031']
const STOP_COORDINATES = [[6.92344166, 46.42683088], [6.92351352, 46.42827977], [6.92376505, 46.43187086]]
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const key = p => p.join(',') // Exact XYZ endpoints: no snapping across different levels.

function project(point, points) {
  let nearest, travelled = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = distance(a, b)
    assert(length > 0, 'Collapsed XYZ segment')
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / length ** 2))
    const xyz = a.map((v, j) => v + (b[j] - v) * t)
    const offsetMetres = distance(point, xyz)
    if (!nearest || offsetMetres < nearest.offsetMetres) nearest = { xyz, offsetMetres, distanceMetres: travelled + length * t }
    travelled += length
  }
  return nearest
}

export function auditTerritetTerrain(source, network, evidence, fot) {
  assert.equal(source.sourceCrs, 'EPSG:2056 / LN02', 'Changed source CRS')
  assert.equal(source.source, 'swissTLM3D 2026-02', 'Changed source release')
  assert.equal(source.archiveSha256, ARCHIVE_HASH, 'Changed source archive')
  assert.equal(source.sourceUrl, 'https://data.geo.admin.ch/ch.swisstopo.swisstlm3d/swisstlm3d_2026-02/swisstlm3d_2026-02_2056_5728.shp.zip', 'Changed source URL')
  assert.deepEqual(source.bounds, [2560250, 1141780, 2560550, 1142450], 'Changed extraction bounds')
  assert.equal(hash(source.features), SOURCE_HASH, 'Changed bounded XYZ source; review required')
  // Recheck the separate installation identity and all original mapped call orders.
  applyTerritetGeometry(network, fot)
  STOP_IDS.forEach((id, i) => assert.deepEqual(network.stops.find(s => s[4] === id)?.slice(0, 2), STOP_COORDINATES[i], 'Changed original station coordinate'))
  assert.equal(network.metadata.serviceDate, '2026-09-04', 'Changed service date')
  assert.equal(evidence.metadata.serviceDate, network.metadata.serviceDate, 'Changed evidence date')
  assert.equal(network.metadata.sources.timetable.sha256, 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e', 'Changed timetable archive')
  assert.equal(evidence.metadata.sources.timetable.sha256, network.metadata.sources.timetable.sha256, 'Changed evidence archive')
  assert.equal(network.trains.length, 140, 'Expected 140 dated services')
  assert.equal(new Set(network.trains.map(t => t.id)).size, 140, 'Duplicate trip')
  for (const t of network.trains) {
    const calls = evidence.trips[t.id]?.calls
    assert(calls && calls.length === 3, 'Missing original calls')
    assert.deepEqual(t.stops.map(([i, a, d]) => [network.stops[i][4], a, d]), calls.map(c => [c.stopId, c.arrival, c.departure]), 'Changed original calls')
    assert(calls.every(c => c.pickup === '0' && c.dropOff === '0'), 'Changed boarding flags')
  }

  const features = source.features.filter(f => f.properties.STANDSEILB === 'Wahr')
  assert.equal(features.length, 12, 'Expected 12 funicular features')
  const nodes = new Map()
  for (const f of features) {
    const p = f.properties
    assert(p.OBJEKTART === 'Schmalspur' && p.AUSSER_BET === 'Falsch' && p.ZAHNRADBAH === 'Falsch' && p.BETRIEBSBA === 'Falsch', 'Unreviewed funicular class')
    assert(p.ACHSE_DKM === 'Falsch', 'Unexpected cartographic axis')
    assert(['Keine', 'Bruecke'].includes(p.KUNSTBAUTE), 'Unreviewed funicular structure')
    assert.equal(f.paths.length, 1, 'Multipart funicular record')
    const points = f.paths[0]
    assert(points.every(p => p.length === 3 && p.every(Number.isFinite)), 'Invalid XYZ')
    for (const point of [points[0], points.at(-1)]) {
      const id = key(point)
      if (!nodes.has(id)) nodes.set(id, { point, edges: [] })
      nodes.get(id).edges.push(f)
    }
  }
  const terminals = [...nodes.values()].filter(n => n.edges.length === 1).sort((a, b) => a.point[2] - b.point[2])
  const junctions = [...nodes.values()].filter(n => n.edges.length === 3).sort((a, b) => a.point[2] - b.point[2])
  assert.equal(terminals.length, 2, 'Expected two terminals')
  assert.equal(junctions.length, 2, 'Expected one passing loop')
  assert([...nodes.values()].every(n => [1, 2, 3].includes(n.edges.length)), 'Unexpected junction')
  const paths = []
  function visit(node, seen, edges, points) {
    if (node === key(terminals[1].point)) { paths.push({ edges, points }); return }
    for (const f of nodes.get(node).edges) {
      const original = f.paths[0], oriented = key(original[0]) === node ? original : [...original].reverse()
      const next = key(oriented.at(-1))
      if (!seen.has(next)) visit(next, new Set([...seen, next]), [...edges, f.id], [...points, ...oriented.slice(1)])
    }
  }
  visit(key(terminals[0].point), new Set([key(terminals[0].point)]), [], [terminals[0].point])
  assert.equal(paths.length, 2, 'Expected two complete route alternatives')
  assert.equal(new Set(paths.flatMap(p => p.edges)).size, features.length, 'Unconnected funicular source feature')
  paths.sort((a, b) => a.edges.join().localeCompare(b.edges.join()))
  const commonIds = paths[0].edges.filter(id => paths[1].edges.includes(id))
  assert.equal(commonIds.length, 6, 'Changed common track')
  const alternatives = paths.map((path, index) => {
    const points = path.points
    const planarLengthMetres = points.slice(1).reduce((sum, p, i) => sum + distance(p, points[i]), 0)
    const spatialLengthMetres = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(...p.map((v, j) => v - points[i][j])), 0)
    const stops = STOP_IDS.map(id => {
      const s = network.stops.find(s => s[4] === id), coordinate = wgs84ToLv95(s[0], s[1])
      const attachment = project(coordinate, points)
      assert(attachment.offsetMetres <= 15, 'Stop exceeds 15 m XYZ attachment gate')
      return { id, name: s[2], sourceCoordinate: s.slice(0, 2), ...attachment }
    })
    assert(stops[0].distanceMetres < stops[1].distanceMetres && stops[1].distanceMetres < stops[2].distanceMetres, 'Changed station order')
    const loop = junctions.map(n => project(n.point, points))
    assert(loop[0].distanceMetres > stops[1].distanceMetres && loop[1].distanceMetres < stops[2].distanceMetres, 'Loop outside reviewed station interval')
    const centreline = fot.results.find(f => f.id === 670).geometry.coordinates.map(p => [...wgs84ToLv95(...p), 0])
    const maxCentrelineOffsetMetres = Math.max(...points.map(p => project(p, centreline).offsetMetres))
    assert(maxCentrelineOffsetMetres < 15, 'XYZ route differs from official installation corridor')
    return { id: `alternative-${index + 1}`, featureIds: path.edges, branchFeatureIds: path.edges.filter(id => !commonIds.includes(id)), xyz: points, planarLengthMetres, spatialLengthMetres, riseMetres: points.at(-1)[2] - points[0][2], stops, loop, maxCentrelineOffsetMetres }
  })
  // Preserve both hypotheses. Their union is a possible future map-fallback
  // interval, not permission to assign either branch to either vehicle.
  const tripWindows = network.trains.map(t => {
    const windows = alternatives.map(route => {
      const timed = t.stops.map(([i, arrival, departure]) => ({ ...route.stops.find(s => s.id === network.stops[i][4]), arrival, departure }))
      const at = position => {
        for (let i = 1; i < timed.length; i++) {
          const a = timed[i - 1], b = timed[i]
          const f = (position - a.distanceMetres) / (b.distanceMetres - a.distanceMetres)
          if (f >= 0 && f <= 1) return a.departure + (b.arrival - a.departure) * f
        }
        throw new Error('Loop outside timed segment')
      }
      return route.loop.map(p => at(p.distanceMetres)).sort((a, b) => a - b)
    })
    return { tripId: t.id, direction: network.stops[t.stops[0][0]][4] === STOP_IDS[0] ? 'ascent' : 'descent', hypothesisWindows: windows, conservativeMapWindow: [Math.min(...windows.map(w => w[0])), Math.max(...windows.map(w => w[1]))] }
  })
  assert.equal(tripWindows.filter(t => t.direction === 'ascent').length, 70, 'Expected 70 ascents')
  assert.equal(tripWindows.filter(t => t.direction === 'descent').length, 70, 'Expected 70 descents')
  return {
    schemaVersion: 1, status: 'geometry-audited-playback-not-enabled', serviceDate: network.metadata.serviceDate,
    sources: { xyz: { url: source.sourceUrl, productUrl: source.productUrl, archiveSha256: ARCHIVE_HASH, featuresSha256: SOURCE_HASH, crs: source.sourceCrs, bounds: source.bounds }, installation: { id: '61.046', featureId: 670, sourceSha256: hash(fot) }, timetableSha256: network.metadata.sources.timetable.sha256 },
    counts: { boundedFeatures: source.features.length, funicularFeatures: features.length, excludedOtherRailFeatures: source.features.length - features.length, vertices: nodes.size, alternatives: alternatives.length, commonFeatures: commonIds.length, bridgeFeatures: features.filter(f => f.properties.KUNSTBAUTE === 'Bruecke').length, datedTrips: tripWindows.length },
    featureEvidence: features.map(f => ({ id: f.id, structure: f.properties.KUNSTBAUTE, modified: f.properties.DATUM_AEND, originYear: f.properties.HERKUNFT_J, revisionYear: f.properties.REVISION_J, cartographicAxis: f.properties.ACHSE_DKM })),
    commonFeatureIds: commonIds, junctions: junctions.map(n => n.point), alternatives, tripWindows,
    decision: 'Retain both measured passing-loop branches as context. Do not assign a branch to a direction or model cable mechanics. A future terrain view may follow common track and use the union of both timetable-interpolated loop windows as map fallback.',
    limits: ['No terrain raster is introduced by this audit.', 'No operational branch assignment or synchronized cable trajectory is supplied.', 'The 2026-02 product release is not an observation date; record dates are retained separately.', 'WGS84 stop attachments use the existing approximate LV95 conversion; offsets are model checks, not survey accuracy claims.', 'XYZ endpoints describe the retained source extent; they are not claims about passenger platform elevation.', 'Other operating dates and physical-device review remain separate.'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const read = async path => JSON.parse(await readFile(path, 'utf8'))
  const inputs = await Promise.all(['data/territet-terrain-source.json', 'public/data/territet-day.json', 'data/territet-journey-source.json', 'data/territet-funicular-source.json'].map(read))
  const audit = auditTerritetTerrain(...inputs)
  await writeFile(process.argv[2] ?? 'data/territet-terrain-audit.json', JSON.stringify(audit, null, 2) + '\n')
  console.log(JSON.stringify({ ...audit.counts, alternatives: audit.alternatives.map(a => ({ id: a.id, planarMetres: a.planarLengthMetres, spatialMetres: a.spatialLengthMetres, riseMetres: a.riseMetres, stops: a.stops, loop: a.loop, maxCentrelineOffsetMetres: a.maxCentrelineOffsetMetres })) }, null, 2))
}
