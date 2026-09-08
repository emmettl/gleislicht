import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { prepareRoadFeed } from './prepare-postbus-road-feed.mjs'
import { sha256 } from './download-luzern-sources.mjs'
const bytes = await readFile('data/graubuenden-audit/timetable.json.gz')
const raw = JSON.parse(gunzipSync(bytes)), routes = new Map(raw.inventory.map(r => [r.routeId, r]))
const stops = raw.stops.map(s => [Number(s.stop_lon), Number(s.stop_lat), s.stop_name, s.platform_code, s.stop_id])
const indexes = new Map(stops.map((s, i) => [s[4], i]))
// Include every bus candidate, including conditional/replacement service, in
// geometry diagnostics. Conditional calls remain excluded by final admission.
const trains = raw.snapshots.flatMap(d => d.trains.filter(t => routes.get(t.routeId).mode === 'bus').map(t => {
  const shift = -Math.floor(Math.min(0, t.calls[0].arrival) / 86400) * 86400
  return { ...t, route: routes.get(t.routeId).line, stops: t.calls.map(c => [indexes.get(c.id), c.arrival + shift, c.departure + shift]) }
}))
console.log(await prepareRoadFeed({ manifest: { stops, metadata: { serviceDate: raw.dates[0], serviceDates: raw.dates, feedVersion: raw.feed.feed_version,
  sourceUrl: 'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020', timetableSha256: sha256(bytes),
  note: 'Geometry-only union of every full bus pattern on both fixtures. Synthetic agency for routing only; real route and operator identities retained in the canton census. Shifted times are not passenger departures.' } }, trains,
  agency: { id: 'GR-routing', name: 'Graubünden all-operator routing union', url: 'https://www.gr.ch' }, output: '/private/tmp/graubuenden-road-feed' }))
