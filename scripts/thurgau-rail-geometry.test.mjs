import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { applyThurgauGeometry } from './thurgau-line-geometry.mjs'
import { loadThurgauRail } from './thurgau-rail-geometry.mjs'
const load = path => JSON.parse(gunzipSync(readFileSync(path)))
const timetable = load('data/thurgau-audit/timetable-cache.json.gz')
const source = load('data/thurgau-sources/decoded.json.gz')
const crosswalk = JSON.parse(readFileSync('data/thurgau-line-crosswalk.json'))
const routes = new Map(timetable.routes.map(r => [r.id, r]))
const rail = await loadThurgauRail(timetable)
const match = (fixture, trains, context = rail) => applyThurgauGeometry({ ...fixture, trains }, routes, source, crosswalk, undefined, undefined, context)

it('admits weekday and Sunday rail categories with directed source topology and unchanged calls', () => {
  for (const fixture of timetable.snapshots) for (const direction of ['0', '1']) {
    const train = fixture.trains.find(t => t.agencyId === '65' && t.route === 'S29' && t.directionId === direction)
    expect(train).toBeDefined()
    expect(train.category).not.toBe('rail') // Category is s-bahn, not the inventory mode.
    const result = match(fixture, [train]), after = result.trains[0]
    expect(after.admission).toBe('admitted')
    expect(after.geometrySource).toBe('fot-rail-inference')
    expect(after.stops).toEqual(train.stops)
    expect(after.callPermissions).toEqual(train.callPermissions)
    for (const segment of result.patterns[0].railSupplement.segments) {
      expect(segment.gauge).toBe('mm1435')
      expect(segment.directedSourceSegments.length).toBeGreaterThan(0)
      expect(segment.stationAttachmentsMetres.every(m => m <= 350)).toBe(true)
      expect(segment.maximumTopologyAttachmentMetres).toBeLessThanOrEqual(120)
    }
  }
})
it('retains the entire cross-border pattern when the reviewed border supplement is unavailable', () => {
  for (const fixture of timetable.snapshots) {
    const train = fixture.trains.find(t => t.route === 'S7' && t.stops.some(([i]) => fixture.stops[i][4] === '8102336'))
    const result = match(fixture, [train], { ...rail, match(...args) { return rail.match(...args).map(s => s.geometrySource === 'fot-osm-border-rail-inference' ? { reason: 'border-unavailable' } : s) } })
    expect(result.trains[0].admission).not.toBe('admitted')
    expect(result.trains[0].stops).toEqual(train.stops)
    expect(result.patterns[0].railSupplement.status).toBe('rejected-incomplete-pattern')
    expect(result.patterns[0].railSupplement.segments.some(s => s.reason === 'border-unavailable')).toBe(true)
  }
})
it('uses the explicitly reviewed Interlaken tracks 5–8 node only for its exact IC81 platforms', () => {
  const raw = timetable.snapshots[0]
  for (const platform of ['5', '7']) {
    const train = raw.trains.find(t => t.route === 'IC81' && t.stops.some(([i]) => raw.stops[i][2] === 'Interlaken Ost' && raw.stops[i][3] === platform))
    const result = match(raw, [train])
    expect(result.trains[0].admission).toBe('admitted')
    expect(result.trains[0].stops).toEqual(train.stops)
    expect(result.patterns[0].railSupplement.operatingPointOverrides[0].targetNumber).toBe('8519309')
    const changed = structuredClone(raw)
    changed.stops[train.stops.at(-1)[0]] = [...changed.stops[train.stops.at(-1)[0]]]
    const stop = changed.stops.find(s => s[2] === 'Interlaken Ost' && s[3] === platform && train.stops.some(([i]) => changed.stops[i] === s))
    stop[3] = '3'
    expect(() => match(changed, [train])).toThrow('Changed reviewed Interlaken platform')
  }
})
it('keeps complete cantonal S10 and separate AB S15 geometry unchanged', () => {
  const raw = timetable.snapshots[0]
  const trains = raw.trains.filter(t => t.route === 'S10' || t.route === 'S15')
  const before = applyThurgauGeometry({ ...raw, trains }, routes, source, crosswalk), after = match(raw, trains)
  for (const [i, train] of after.trains.entries()) {
    expect(train.admission).toBe('admitted')
    expect(train.pathSegments.map(p => after.paths[p])).toEqual(before.trains[i].pathSegments.map(p => before.paths[p]))
    expect(train.geometrySource).not.toBe('fot-rail-inference')
  }
})
it('cannot admit an incomplete whole pattern or a reservation using successful rail segments', () => {
  const raw = timetable.snapshots[0], train = raw.trains.find(t => t.route === 'S29')
  const failed = { ...rail, match(...args) { const segments = rail.match(...args); return segments.map((s, i) => i ? s : { reason: 'rail-disconnected-detour-or-stop-order' }) } }
  expect(match(raw, [train], failed).trains[0].admission).not.toBe('admitted')
  expect(match(raw, [{ ...train, reservationRequired: true }]).trains[0].admission).toBe('reservation-or-demand-responsive')
})
it('rejects a wrong route identity and a distant platform without nearest-name reuse', () => {
  const raw = timetable.snapshots[0], train = raw.trains.find(t => t.route === 'S29')
  expect(() => match(raw, [{ ...train, agencyId: '11' }])).toThrow()
  const changed = structuredClone(raw); changed.stops[train.stops[0][0]][1] += 0.01
  const result = match(changed, [train])
  expect(result.trains[0].admission).not.toBe('admitted')
  expect(result.patterns[0].railSupplement.segments[0].reason).toBe('rail-station-attachment-too-far')
})
