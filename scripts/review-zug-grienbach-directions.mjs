import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { lineGraph } from './luzern-line-geometry.mjs'
import { matchBaselSegment } from './basel-line-geometry.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

export function grienbachPoster(text) {
  assert(text.includes('Gültig vom 14.12.2025 bis 12.12.2026') && text.includes('Richtung Zug, Bahnhofplatz'))
  assert(text.includes('Verkehrt nur am 04.06., 08.12.') && text.includes('*Zusätzliche Sonntage:'))
  const lines = text.split(/\r?\n/), heading = lines.findIndex(l => l.startsWith('h Montag - Freitag'))
  assert(heading >= 0)
  const saturday = lines[heading].indexOf('Samstag'), sunday = lines[heading].indexOf('Sonntag')
  const rows = lines.slice(heading + 1).filter(l => /^\s*\d{1,2}\s/.test(l)).map(l => {
    const hour = Number(l.match(/^\s*(\d+)/)[1])
    return { hour, weekday: l.slice(3, saturday).match(/\d{2}/g)?.map(Number) ?? [],
      saturday: l.slice(saturday, sunday).match(/\d{2}/g)?.map(Number) ?? [], sunday: l.slice(sunday).match(/\d{2}/g)?.map(Number) ?? [] }
  })
  assert.deepEqual(rows.map(r => r.hour), [...Array.from({ length: 19 }, (_, i) => i + 5), 0], 'Incomplete posted hour table')
  assert.deepEqual(rows[0].sunday, [44], 'Changed holiday-only departure')
  const serviceTimes = column => rows.flatMap(r => column === 'sunday' && r.hour === 5 ? [] : r[column].map(m => ((r.hour === 0 ? 24 : r.hour) * 60 + m) * 60))
  return { rows, weekday: serviceTimes('weekday'), saturday: serviceTimes('saturday'), sunday: serviceTimes('sunday'),
    holidayOnly: { seconds: 20640, monthDays: ['06-04', '12-08'] }, downstreamVzugMinutes: 1 }
}

export function compareGrienbachPoster(poster, raw, routeId) {
  return raw.snapshots.map(day => {
    assert(['2026-09-04', '2026-09-06'].includes(day.date), 'Poster comparison requires reviewed non-holiday fixtures')
    const calls = day.trains.filter(t => t.routeId === routeId).flatMap(t => t.calls.flatMap((c, i) => c.id === 'ch:1:sloid:93448:0:1' ? [{ tripId: t.id, sourceTripId: t.sourceTripId,
      sourceServiceDate: t.sourceServiceDate, departure: c.departure, nextStopId: t.calls[i + 1]?.id, downstreamSeconds: t.calls[i + 1]?.arrival - c.departure }] : []))
    assert(calls.every(c => c.nextStopId === 'ch:1:sloid:87279:0:1' && c.downstreamSeconds === poster.downstreamVzugMinutes * 60), 'Posted downstream interval differs')
    const current = calls.filter(c => c.sourceServiceDate === day.date), carryIn = calls.filter(c => c.sourceServiceDate !== day.date)
    const expected = day.date === '2026-09-04' ? poster.weekday : poster.sunday
    assert.deepEqual(current.map(c => c.departure).sort((a, b) => a - b), expected, 'Operator poster differs from source-day departures')
    assert.equal(carryIn.length, 1, 'Unexpected carry-in count')
    assert.equal(carryIn[0].sourceServiceDate, day.date === '2026-09-04' ? '2026-09-03' : '2026-09-05')
    const previous = day.date === '2026-09-04' ? poster.weekday : poster.saturday
    assert.deepEqual(carryIn.map(c => c.departure), previous.filter(t => t >= 86400).map(t => t - 86400), 'Wrong previous-service-day poster column')
    return { date: day.date, fullTrips: calls.length, sourceDayCalls: current.length, calls, carryIn,
      followingCivilDayCalls: current.filter(c => c.departure >= 86400), matchedPosterDepartures: true }
  })
}

// Read-only source comparison. OSM stop roles provide direction evidence but
// are not authority to move a SLOID. No diagnostic path enters the feed.
export async function reviewZugGrienbachDirections(policy, fullPolicy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed direction-review catalogue')
  const source = JSON.parse(bytes), files = new Map()
  assert.equal(source.timetableSha256, timetableHash, 'Changed direction-review timetable')
  assert.equal(source.priorReviewSha256, fullPolicy.grienbachReview.sourceSha256)
  assert.equal(source.atlasReviewSha256, fullPolicy.grienbachAtlasReview.sourceSha256)
  for (const f of source.files) {
    const b = await readFile(join(policy.sourceDirectory, f.file)); assert.equal(sha256(b), f.sha256, `Changed direction-review evidence ${f.file}`)
    files.set(f.file, f.file.endsWith('.gz') ? gunzipSync(b) : b)
  }
  // The engineering PDF is an end-state design, not evidence of a temporary
  // platform being in service on either fixture. Replay its publication context.
  const plan = source.projectPlan, item = JSON.parse(files.get('project-plan-item.json'))
  assert.equal(item.id, plan.itemId)
  assert.equal(item.size, files.get('project-plan.pdf').length)
  assert.equal(item.created, plan.itemCreated); assert.equal(item.modified, plan.itemModified)
  assert.equal(item.type, 'PDF'); assert.equal(item.access, 'public')
  assert.deepEqual(item.extent, [])
  assert(item.spatialReference === null && item.licenseInfo === null && item.accessInformation === null)
  const storyBytes = await readFile(join(fullPolicy.grienbachReview.sourceDirectory, plan.storyFile))
  assert.equal(sha256(storyBytes), plan.storySha256, 'Changed engineering-plan publication context')
  const story = JSON.parse(gunzipSync(storyBytes).toString().match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)[1]).props.publishedData
  assert.equal(story.nodes[plan.storyNode].data.url, plan.url)
  assert.equal(story.nodes[plan.storySectionNode].data.text, plan.storySection)
  const sequence = Object.values(story.nodes).find(n => n.type === 'story').children
  assert.equal(sequence.indexOf(plan.storyNode), sequence.indexOf(plan.storySectionNode) + 2, 'Plan moved out of end-state section')
  const planText = files.get('project-plan.txt').toString().replace(/\s+/g, ' ')
  assert(plan.stopLabels.every(label => planText.includes(label)))
  const compactPlanText = planText.replace(/\s/g, '')
  assert(compactPlanText.includes('04.08.2025') && compactPlanText.includes(plan.projectNumber) && planText.includes(plan.stage))
  assert(files.get('routes.overpass').toString().includes(`[date:"${source.snapshot}"]`))
  const osm = JSON.parse(files.get('routes.json.gz')), elements = new Map(osm.elements.map(e => [`${e.type}/${e.id}`, e]))
  assert(!osm.remark && osm.elements.length === source.elementCount && elements.size === source.elementCount, 'Incomplete direction extract')
  for (const e of osm.elements) {
    assert(e.timestamp <= source.snapshot && e.version > 0)
    if (e.type === 'way') assert(e.nodes.every(id => elements.has(`node/${id}`)))
    if (e.type === 'relation') assert(e.members.every(m => elements.has(`${m.type}/${m.ref}`)))
  }
  const route = raw.inventory.find(r => r.routeId === source.routeId)
  assert(route.agencyId === source.agencyId && route.line === source.line)
  const routes = osm.elements.filter(e => e.type === 'relation' && e.tags?.route === 'bus')
  assert.deepEqual(routes.map(r => r.id), source.relationIds, 'Changed full 604 relation inventory')
  const stops = new Map(raw.stops.map(s => [s.stop_id, s]))
  const relations = routes.map(r => {
    assert(r.tags.operator === source.operator && r.tags.ref === source.line && r.tags['gtfs:route_id'] === source.routeId)
    const stopNodes = r.members.filter(m => m.role === 'stop').map(m => elements.get(`${m.type}/${m.ref}`))
    assert(stopNodes.every(n => n.type === 'node' && n.tags?.uic_ref))
    return { id: r.id, version: r.version, timestamp: r.timestamp, tags: r.tags,
      stopNodeIds: stopNodes.map(n => n.id), stopUics: stopNodes.map(n => n.tags.uic_ref), wayIds: r.members.filter(m => m.type === 'way' && m.role === '').map(m => m.ref) }
  })
  const patterns = new Map()
  for (const day of raw.snapshots) for (const t of day.trains.filter(t => t.routeId === source.routeId)) {
    const uics = t.calls.map(c => stops.get(c.id).didok), matches = relations.filter(r => JSON.stringify(r.stopUics) === JSON.stringify(uics))
    assert.equal(matches.length, 1, 'Complete 604 stop sequence lacks unique relation')
    const r = matches[0], key = directedPatternKey(t), p = patterns.get(key) ?? { key, relationId: r.id, stopIds: t.calls.map(c => c.id), occurrences: [], platformComparisons: [] }
    if (!p.platformComparisons.length) p.platformComparisons = t.calls.flatMap((c, i) => {
      const s = stops.get(c.id)
      if (!source.stopNumbers.includes(s.didok)) return []
      const n = elements.get(`node/${r.stopNodeIds[i]}`), coordinates = [n.lon, n.lat]
      return [{ stopId: s.stop_id, nodeId: n.id, coordinates, gtfsCoordinates: [+s.stop_lon, +s.stop_lat], gapMetres: distanceMetres(coordinates, [+s.stop_lon, +s.stop_lat]) }]
    })
    p.occurrences.push({ date: day.date, tripId: t.id, sourceTripId: t.sourceTripId, sourceServiceDate: t.sourceServiceDate }); patterns.set(key, p)
  }
  assert.equal(patterns.size, 4)
  const localWays = source.localWayIds.map(id => elements.get(`way/${id}`))
  for (const r of relations) {
    const ids = r.id === 6260163 || r.id === 12044343 ? source.localWayIds : [...source.localWayIds].reverse()
    assert(r.wayIds.some((_, i) => ids.every((id, j) => r.wayIds[i + j] === id)), 'Changed directional local way sequence')
    const expectedStops = r.id === 6260163 || r.id === 12044343 ? source.inboundStopNodes : source.outboundStopNodes
    assert.deepEqual(r.stopNodeIds.filter(id => [...source.inboundStopNodes, ...source.outboundStopNodes].includes(id)), expectedStops, 'Changed directional platform roles')
  }
  let nodeIds = [...localWays[0].nodes]
  for (const w of localWays.slice(1)) {
    const n = nodeIds.at(-1) === w.nodes[0] ? w.nodes : [...w.nodes].reverse()
    assert.equal(nodeIds.at(-1), n[0], 'Disconnected local source chain'); nodeIds.push(...n.slice(1))
  }
  const indices = source.inboundStopNodes.map(id => nodeIds.indexOf(id))
  assert(indices.every((i, j) => i >= 0 && (j === 0 || i > indices[j - 1])), 'Wrong local inbound stop order')
  const path = nodeIds.slice(indices[0], indices[2] + 1).map(id => { const n = elements.get(`node/${id}`); return [n.lon, n.lat] })
  const graph = lineGraph([{ geometry: { type: 'LineString', coordinates: path } }])
  const pairs = fullPolicy.grienbachReview ? JSON.parse(await readFile(join(fullPolicy.grienbachReview.sourceDirectory, 'sources.json'))).pairs : []
  const trials = pairs.map(([fromId, toId]) => ({ fromId, toId, result: matchBaselSegment(graph, ...[fromId, toId].map(id => { const s = stops.get(id); return [+s.stop_lon, +s.stop_lat] }), fullPolicy.limits) }))
  assert(trials.length === 2 && trials.every(t => !t.result.path), 'New directed-chain admission candidate needs review')
  const restrictions = osm.elements.filter(e => e.type === 'relation' && e.tags.type === 'restriction').map(r => ({ id: r.id, version: r.version, timestamp: r.timestamp, tags: r.tags, members: r.members,
    touchesLocalWays: r.members.some(m => m.type === 'way' && source.localWayIds.includes(m.ref)) }))
  const poster = grienbachPoster(files.get('poster.txt').toString()), departures = compareGrienbachPoster(poster, raw, source.routeId)
  return { source, relations, patterns: [...patterns.values()], localWays, localPath: path, localPathSha256: sha256(JSON.stringify(path)), trials, restrictions, poster, departures,
    admittedFromReview: 0, coordinateCorrections: 0, conclusion: source.decision }
}
