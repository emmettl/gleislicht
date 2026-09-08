import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadThurgauBoats } from './thurgau-boat-geometry.mjs'
import { loadThurgauShipping } from './thurgau-shipping.mjs'
import { loadThurgauBoatExclusions, reviewThurgauBoatExclusions } from './thurgau-boat-exclusions.mjs'
const zipped = p => JSON.parse(gunzipSync(readFileSync(p)))
const timetable = zipped('data/thurgau-audit/timetable-cache.json.gz')
const boats = await loadThurgauBoats(timetable), shipping = await loadThurgauShipping(timetable)
const review = await loadThurgauBoatExclusions(timetable, shipping, boats)
const osm = zipped('data/thurgau-shipping-sources/osm.json.gz'), docks = zipped('data/thurgau-boat-exclusion-sources/osm.json.gz')

it('keeps all excluded Friday and Sunday journey calls, times, permissions and directions', () => {
  expect(review.patterns).toHaveLength(6)
  expect(review.pairs).toHaveLength(12)
  for (const [i, day] of review.days.entries()) {
    expect(day.journeys).toHaveLength(12)
    for (const t of day.journeys) {
      const raw = timetable.snapshots[i], original = raw.trains.find(o => o.id === t.id)
      expect(t).toEqual({ ...original, stops: original.stops.map(([k, ...times]) => [raw.stops[k], ...times]) })
    }
  }
  expect(new Set(review.patterns.map(p => p.directionId))).toEqual(new Set(['0', '1']))
})
it('retains exclusions for dock conflicts and for geometry-only success with replacement-service uncertainty', () => {
  expect(review.dockIdentities.every(d => d.distanceMetres > 150)).toBe(true)
  expect(review.dockIdentities[0].node.tags.uic_ref).toBe(review.dockIdentities[0].stop[4])
  const screened = review.pairs.filter(p => p.diagnosticResult === 'geometry-screen-passed-only')
  expect(screened).toHaveLength(2)
  expect(screened.every(p => p.operatingCaveat && p.admission === 'excluded-full-pattern')).toBe(true)
  expect(review.pairs.every(p => p.diagnosticOnly && !p.path)).toBe(true)
})
it('fails closed on changed full stop chains, incomplete responses and conflicting historical terminal coordinates', () => {
  const changed = structuredClone(timetable), t = review.days[0].journeys[0]
  changed.snapshots[0].trains.find(o => o.id === t.id).stops.pop()
  expect(() => reviewThurgauBoatExclusions(changed, shipping, boats, osm, docks, review.source)).toThrow()
  expect(() => reviewThurgauBoatExclusions(timetable, shipping, boats, osm, { ...docks, remark: 'timeout' }, review.source)).toThrow('Incomplete')
  const moved = structuredClone(docks)
  for (const e of moved.elements) if (e.type === 'node' && e.id === 290061019) e.lon += .00001
  expect(() => reviewThurgauBoatExclusions(timetable, shipping, boats, osm, moved, review.source)).toThrow('snapshots disagree')
})
