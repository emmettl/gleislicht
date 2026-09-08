import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

const decode = s => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'")
const field = (body, key) => { const s = body.match(new RegExp(`<${key}>([^<]*)</${key}>`))?.[1]; return s === undefined ? null : decode(s) }
const reference = (body, key) => body.match(new RegExp(`<${key} REF="([^"]+)"`))?.[1]
export function cablewayCoordinate(east, north) {
  assert(Number.isFinite(east) && Number.isFinite(north) && east > 2400000 && east < 2900000 && north > 1000000 && north < 1400000, 'Invalid LV95 coordinate')
  const y = (east - 2600000) / 1000000, x = (north - 1200000) / 1000000
  return [(2.6779094 + 4.728982 * y + .791484 * y * x + .1306 * y * x * x - .0436 * y ** 3) * 100 / 36,
    (16.9023892 + 3.238272 * x - .270978 * y * y - .002528 * x * x - .0447 * y * y * x - .014 * x ** 3) * 100 / 36].map(n => Number(n.toFixed(7)))
}
const points = body => [...body.matchAll(/<COORD><C1>([^<]+)<\/C1><C2>([^<]+)<\/C2><\/COORD>/g)].map(m => cablewayCoordinate(Number(m[1]), Number(m[2])))
function records(xml, name, parse) {
  const tag = `Seilbahnen_V2_0.Seilbahnen.${name}`.replaceAll('.', '\\.'), rows = [...xml.matchAll(new RegExp(`<${tag} TID="([^"]+)">([\\s\\S]*?)</${tag}>`, 'g'))]
  assert(rows.length > 0 && new Set(rows.map(r => r[1])).size === rows.length, `Empty or duplicate ${name}`)
  return rows.map(([, id, body]) => ({ id, ...parse(body) }))
}
export function parseLuzernCableways(xml) {
  const installations = records(xml, 'Anlage', b => ({ number: field(b, 'AnlageNr'), name: field(b, 'AnlageName'), type: field(b, 'Bahntyp'), vehicle: field(b, 'Fahrzeugtyp'), operator: field(b, 'TUNummer'), operatorAbbreviation: field(b, 'TUAbkuerzung'), sourceDate: field(b, 'Stand'), validFrom: field(b, 'BeginnGueltigkeit'), validUntil: field(b, 'EndeGueltigkeit') }))
  const stations = records(xml, 'Station', b => { const p = points(b); assert.equal(p.length, 1); return { number: field(b, 'Nummer'), name: field(b, 'Name'), type: field(b, 'Stationstyp'), installation: reference(b, 'rAnlage'), coordinate: p[0] } })
  const segments = records(xml, 'Seilbahnstrecke', b => ({ installation: reference(b, 'rAnlage'), lines: [...b.matchAll(/<POLYLINE>([\s\S]*?)<\/POLYLINE>/g)].map(m => points(m[1])), lengthInclinedMetres: field(b, 'LaengeSchief'), elevationDifferenceMetres: field(b, 'Hoehendifferenz') }))
  const ids = new Set(installations.map(i => i.id))
  for (const r of [...stations, ...segments]) assert(ids.has(r.installation), 'Unknown cableway installation reference')
  for (const s of segments) assert(s.lines.length && s.lines.every(l => l.length >= 2), 'Invalid cableway line')
  return { installations, stations, segments }
}

export function matchLuzernCableway(network, config, route, from, to, dates) {
  return matchFederalAxis(network, config, route, from, to, dates, 1300, 'Luftseilbahn', 'fot-cableway-inference')
}

export function matchFederalFunicular(network, config, route, from, to, dates) {
  return matchFederalAxis(network, config, route, from, to, dates, 1400, 'Standseilbahn', 'fot-funicular-inference')
}

function matchFederalAxis(network, config, route, from, to, dates, routeType, installationType, geometrySource) {
  const identity = config.routes.find(r => r.routeId === route.routeId)
  if (!identity) return { reason: 'cableway-unreviewed-route' }
  assert.equal(identity.agencyId, route.agencyId); assert.equal(identity.line, route.line); assert.equal(route.routeType, routeType)
  const binding = identity.segments.find(s => s.stopNumbers.includes(from.didok) && s.stopNumbers.includes(to.didok) && from.didok !== to.didok)
  if (!binding) return { reason: 'cableway-unreviewed-station-pair' }
  const installations = network.installations.filter(i => i.number === binding.installation)
  assert.equal(installations.length, 1, 'Ambiguous installation number')
  const installation = installations[0]
  assert.equal(installation.operator, identity.sourceOperator, 'Changed cableway operator')
  assert.equal(installation.type, installationType); assert.equal(installation.vehicle, 'Kabine')
  if (installation.validFrom > dates[0] || installation.validUntil && installation.validUntil < dates.at(-1)) return { reason: 'cableway-source-validity' }
  const orderedNumbers = [from.didok, to.didok].map(n => binding.sourceStationNumbers[binding.stopNumbers.indexOf(n)])
  const stations = orderedNumbers.map(number => network.stations.filter(s => s.installation === installation.id && s.number === number))
  assert(stations.every(s => s.length === 1), 'Missing or ambiguous installation station')
  const selected = stations.map(s => s[0]), segments = network.segments.filter(s => s.installation === installation.id)
  assert.equal(segments.length, 1, 'Unreviewed cableway sections'); assert.equal(segments[0].lines.length, 1, 'Disconnected cableway source')
  const original = segments[0].lines[0], coords = [from, to].map(s => [Number(s.stop_lon), Number(s.stop_lat)])
  const forward = distanceMetres(selected[0].coordinate, original[0]) + distanceMetres(selected[1].coordinate, original.at(-1)) <= distanceMetres(selected[0].coordinate, original.at(-1)) + distanceMetres(selected[1].coordinate, original[0])
  const line = forward ? original : [...original].reverse()
  const stationAttachmentsMetres = selected.map((s, i) => distanceMetres(coords[i], s.coordinate)), topologyAttachmentsMetres = selected.map((s, i) => distanceMetres(s.coordinate, i ? line.at(-1) : line[0]))
  const evidence = { geometrySource, installation: installation.number, installationId: installation.id, sourceSegmentId: segments[0].id, sourceStationNumbers: orderedNumbers, stationAttachmentsMetres, topologyAttachmentsMetres,
    stationAliases: [from.didok, to.didok].flatMap((n, i) => n === orderedNumbers[i] ? [] : [{ timetable: n, source: orderedNumbers[i], reason: binding.aliasReason }]), sourceDate: installation.sourceDate, sourceFeatures: [] }
  assert(evidence.stationAliases.every(a => a.reason), 'Unexplained station alias')
  if (Math.max(...stationAttachmentsMetres) > config.limits.stationAttachmentMetres || Math.max(...topologyAttachmentsMetres) > config.limits.topologyAttachmentMetres) return { ...evidence, reason: 'cableway-endpoint-gap' }
  const path = [coords[0], ...line, coords[1]].map(p => p.map(n => Number(n.toFixed(7)))).filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1])
  const pathMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0)
  if (pathMetres < 1 || pathMetres > Math.max(config.limits.detourFloorMetres, distanceMetres(...coords) * config.limits.detourRatio)) return { ...evidence, reason: 'cableway-collapsed-or-detour' }
  return { ...evidence, path, pathMetres }
}

export async function loadLuzernCableways(config, raw) {
  const bytes = await readFile(join(config.sourceDirectory, 'source.json'))
  assert.equal(sha256(bytes), config.sourceMetadataSha256, 'Changed cableway source metadata')
  const source = JSON.parse(bytes)
  for (const [file, hash] of Object.entries(source.files)) assert.equal(sha256(await readFile(join(config.sourceDirectory, file))), hash, `Changed cableway source ${file}`)
  const catalogue = JSON.parse(await readFile(join(config.sourceDirectory, 'catalogue.json'))), zip = await readFile(join(config.sourceDirectory, 'source.xtf.zip'))
  assert.equal(catalogue.features[0].assets['seilbahnen-bundeskonzession_2056_de.xtf.zip']['file:checksum'], `1220${sha256(zip)}`)
  const xml = gunzipSync(await readFile(join(config.sourceDirectory, 'network.xtf.gz')))
  assert.equal(sha256(execFileSync('unzip', ['-p', join(config.sourceDirectory, 'source.xtf.zip'), source.archiveMember], { maxBuffer: 32 * 1024 * 1024 })), sha256(xml), 'Cableway XML differs from published archive')
  assert.equal(sha256(xml), source.xmlSha256)
  const network = parseLuzernCableways(xml.toString())
  for (const name of ['installations', 'stations', 'segments']) assert.equal(network[name].length, source.counts[name])
  const inputBytes = await readFile(config.inputs)
  assert.equal(sha256(inputBytes), config.inputsSha256, 'Changed cableway timetable identities')
  const inputs = JSON.parse(inputBytes)
  if (raw) {
    const inventory = raw.inventory.filter(r => r.mode === 'mountain'), ids = new Set(inventory.map(r => r.routeId)), stops = new Set(raw.snapshots.flatMap(d => d.trains.filter(t => ids.has(t.routeId)).flatMap(t => t.calls.map(c => c.id))))
    assert.deepEqual(inputs, { dates: raw.dates, inventory, stops: raw.stops.filter(s => stops.has(s.stop_id)) }, 'Cableway identities do not match source timetable')
  }
  return { source, network, inputs }
}
