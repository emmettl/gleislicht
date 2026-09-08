import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { loadThurgauBorderRail, thurgauBorderGraph } from './thurgau-border-rail.mjs'
const raw = JSON.parse(gunzipSync(await readFile('data/thurgau-audit/timetable-cache.json.gz'))), matcher = await loadThurgauBorderRail(raw)
const permissive = thurgauBorderGraph(JSON.parse(gunzipSync(await readFile('data/thurgau-border-rail-sources/osm.json.gz'))), { ...matcher.policy, reviewedWays: [], limits: { ...matcher.policy.limits, maximumTurnDegrees: 180 } })
const stop = id => { const s = raw.snapshots[0].stops.find(s => s[4] === id); return { stop_id: id, stop_lon: s[0], stop_lat: s[1] } }
const baseline = await loadThurgauBorderRail(raw, { reviewedWays: false })
const rows = []
for (const platform of ['2', '3']) for (const reverse of [false, true]) {
  const a = stop(`ch:1:sloid:6314:2:${platform}`), b = stop('8102336'), pair = reverse ? [b, a] : [a, b]
  rows.push({ platform, reverse, strict: matcher.match(...pair), baseline: baseline.match(...pair), permissive: permissive.match(...pair) })
}
await writeFile('data/thurgau-border-rail-sources/path-review.json', JSON.stringify({ policySha256: matcher.policySha256, attribution: matcher.source.attribution, license: matcher.source.license, rows }, null, 2) + '\n')
console.log(rows.map(r => ({ platform: r.platform, reverse: r.reverse, strict: r.strict.pathMetres ?? r.strict.reason, permissive: r.permissive.pathMetres })))
