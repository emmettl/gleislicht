import assert from 'node:assert/strict'

// Reviewed SLOID operating points; never match replacement bus stops by name.
export const FRIBOURG_WORKS_STATIONS = ['4086', '4066', '4065', '4064', '4063']
const operatingPoint = id => /^ch:1:sloid:(\d+)(?::|$)/.exec(id)?.[1]

export function fribourgWorksInputs(timetable) {
  const routeIds = new Set(timetable.routes.filter(r => r.agencyId === '53' && ['S50', 'S51'].includes(r.name)).map(r => r.id))
  return timetable.snapshots.map(day => ({ date: day.metadata.serviceDate, trains: day.trains.filter(t => routeIds.has(t.routeId)).map(t => ({
    id: t.id, routeId: t.routeId, line: t.route, directionId: t.directionId, sourceServiceDate: t.sourceServiceDate,
    calls: t.stops.map(([i, arrival, departure]) => ({ id: day.stops[i][4], name: day.stops[i][2], arrival, departure })),
  })) }))
}

export function assessFribourgWorks(inputs) {
  const corridor = new Set(FRIBOURG_WORKS_STATIONS), start = 21 * 3600, end = 24 * 3600
  return inputs.map(day => {
    const segments = day.trains.flatMap(t => t.calls.slice(1).flatMap((b, i) => {
      const a = t.calls[i]
      return corridor.has(operatingPoint(a.id)) && corridor.has(operatingPoint(b.id))
        && a.departure < end && b.arrival > start
        ? [{ tripId: t.id, routeId: t.routeId, from: a.id, to: b.id, departure: a.departure, arrival: b.arrival }] : []
    }))
    return { date: day.date, testedTrips: day.trains.length, eveningCorridorTrips: new Set(segments.map(s => s.tripId)).size, eveningCorridorSegments: segments.length, segments }
  })
}

export function assertFribourgWorks(assessment) {
  const sunday = assessment.find(d => d.date === '2026-09-06')
  assert(sunday?.testedTrips > 0, 'Missing Sunday S50/S51 evidence')
  assert.equal(sunday.eveningCorridorSegments, 0, 'GTFS contradicts reviewed Sunday 21:00 Bulle–Semsales rail closure')
}
