import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { corridorGap } from './solothurn-road-detours.mjs'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { hashFile } from './solothurn-timetable.mjs'

const json = async p => JSON.parse(await readFile(p))
const zipped = async p => JSON.parse(gunzipSync(await readFile(p)))
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const length = p => p.slice(1).reduce((sum, b, i) => sum + distanceMetres(p[i], b), 0)
const same = (a, b) => a[0] === b[0] && a[1] === b[1]
const dir = 'data/solothurn-station-access-sources'
const sources = await json(`${dir}/sources.json`)
for (const f of sources.files) assert.equal(await hashFile(`${dir}/${f.file}`), f.sha256)
const residualFile = 'data/solothurn-audit/residual-gap-review.json', residual = await json(residualFile)
assert.equal(residual.residualPairs.length, 7, 'Reassess station review after admission changes')
const context = await zipped('data/solothurn-pattern-contexts.json.gz')
assert.equal(await hashFile('data/solothurn-pattern-contexts.json.gz'), residual.contextSha256)
const seasonal = await zipped('data/solothurn-audit/seasonal-patterns.json.gz')
const access = await zipped('data/solothurn-access-roads/cache.json.gz')
const policy = await json('data/solothurn-access-policy.json')
assert.equal(await hashFile('data/solothurn-access-roads/cache.json.gz'), policy.cacheSha256)
const all = roadConsensus(access, policy.limits, access.metadata.source.osmSha256)
const ev4 = residual.residualPairs.find(p => p.line === 'EV4')
const key = JSON.stringify([ev4.routeId, ev4.from[4], ev4.to[4]])
assert.equal(all.get(key).reason, 'road-pattern-dependent-path')
const variants = all.get(key).roadPatternIds.map(id => {
  const stops = access.agencies.all.identities[id].stops
  const i = stops.findIndex((s, i) => s[4] === ev4.from[4] && stops[i + 1]?.[4] === ev4.to[4])
  assert(i >= 0)
  const path = access.agencies.all.cache.paths[access.agencies.all.cache.patterns[id][i]]
  return { id, stops, path, pathMetres: length(path), geometrySha256: hash(path) }
})
const comparisons = [...residual.completion.seasonalRoadAssessments.filter(p => !p.selected), { ...ev4, variants }].map(p => {
  assert.equal(p.variants.length, 2)
  const [a, b] = p.variants.map(v => v.path)
  assert.notEqual(hash(a), hash(b), 'Reassess converged full-context alternatives')
  for (const v of p.variants) {
    assert.equal(hash(v.path), v.geometrySha256)
    for (const [point, stop] of [[v.path[0], p.from], [v.path.at(-1), p.to]]) assert(distanceMetres(point, stop) < .15)
    assert(v.stops.some((s, i) => s[4] === p.from[4] && v.stops[i + 1]?.[4] === p.to[4]))
  }
  let prefix = 0, suffix = 0
  while (prefix < Math.min(a.length, b.length) && same(a[prefix], b[prefix])) prefix++
  while (suffix < Math.min(a.length, b.length) - prefix && same(a.at(-1 - suffix), b.at(-1 - suffix))) suffix++
  const divergent = p.variants.map(v => v.path.slice(Math.max(0, prefix - 1), suffix ? v.path.length - suffix + 1 : undefined))
  return { routeId: p.routeId, from: p.from, to: p.to, variants: p.variants,
    sharedPrefixVertices: prefix, sharedSuffixVertices: suffix,
    sharedPrefixMetres: length(a.slice(0, prefix)), sharedSuffixMetres: length(suffix ? a.slice(-suffix) : []),
    alternativeLengthsMetres: p.variants.map(v => length(v.path)),
    sampledSymmetricGapMetres: Math.max(corridorGap(a, b), corridorGap(b, a)),
    diagnosticSamplingMetres: 5, divergent, decision: 'Excluded: two distinct full-context paths remain; proximity alone does not select an operating itinerary.' }
})
const pairs = residual.residualPairs.map(p => {
  const dates = []
  for (const day of seasonal) {
    const failures = day.patterns.filter(t => t.routeId === p.routeId && t.stopIds.some((id, i) => id === p.from[4] && t.stopIds[i + 1] === p.to[4] && !t.matchedMask[i]))
    const n = failures.reduce((sum, t) => sum + t.trips, 0)
    assert.equal(n, p.occurrencesByDate[day.date] ?? 0)
    assert(failures.every(t => !t.admittedTrips && p.patternIds.includes(t.id)))
    if (n) dates.push({ date: day.date, journeys: n })
  }
  return { ...p, dates, decision: 'Excluded', needs: p.line === '10' ? 'Operator/platform evidence for the original Dorf E coordinate, within the unchanged tram attachment limit.'
    : p.line === '501' ? 'A dated bus itinerary and original boarding-position association, separately for winter and later platform identities.'
    : 'Direction-specific bus arrival/departure and terminal-turning evidence; walking access does not resolve the full-context disagreement.' }
})
const egerkingen = pairs.filter(p => p.line === '501')
const egerkingenCoordinateDifferencesMetres = { from: distanceMetres(egerkingen[0].from, egerkingen[1].from), to: distanceMetres(egerkingen[0].to, egerkingen[1].to) }
const days = seasonal.map(day => {
  const failed = day.patterns.filter(p => !p.admittedTrips)
  const excludedByRoute = Object.fromEntries([...new Set(failed.map(p => p.routeId))].map(id => [id, failed.filter(p => p.routeId === id).reduce((sum, p) => sum + p.trips, 0)]))
  assert.deepEqual(excludedByRoute, residual.days.find(d => d.date === day.date).excludedByRoute)
  return { date: day.date, excludedJourneys: failed.reduce((sum, p) => sum + p.trips, 0), excludedByRoute }
})
const result = { schemaVersion: 1, reviewDate: '2026-09-09', sources, sourceSha256: await hashFile(`${dir}/sources.json`),
  residualAuditSha256: await hashFile(residualFile), contextSha256: residual.contextSha256,
  seasonalPatternsSha256: await hashFile('data/solothurn-audit/seasonal-patterns.json.gz'), accessCacheSha256: policy.cacheSha256,
  newAdmittedJourneys: 0, pairs, days, comparisons, egerkingenCoordinateDifferencesMetres,
  limitations: 'Seven directed pairs are five bus pairs and two tram pairs. Pair occurrences overlap; unique excluded journeys are reconciled by complete pattern. Source plans do not establish physical direction, source-coordinate corrections or historical operating itineraries. All existing geometry and admissions remain unchanged.' }
const format = n => n.toFixed(1)
const doc = `# Solothurn station-access follow-up\n\nReviewed 9 September 2026. All **seven residual directed pairs** were reconciled against the complete twelve-date audit. **No additional journeys are admitted.** The published feed remains **7,033 Friday / 5,695 Sunday**, with **123 / 124 exclusions**. All sampled rail geometry remains complete.\n\n## Bus approaches compared\n\nThe [reproducible audit](../data/solothurn-audit/station-access-review.json) retains both full stop chains, original calls, candidate paths and hashes for every comparison. Distances below measure disagreement between paths with samples every 5 m; they are diagnostics, not a new acceptance tolerance.\n\n| Directed pair | Candidate lengths | Maximum sampled separation | Shared prefix / suffix |\n| --- | --- | --- | --- |\n${comparisons.map(p => `| ${p.from[2]} → ${p.to[2]} | ${p.alternativeLengthsMetres.map(format).join(' / ')} m | ${format(p.sampledSymmetricGapMetres)} m | ${format(p.sharedPrefixMetres)} / ${format(p.sharedSuffixMetres)} m |`).join('\n')}\n\nDäniken → Dulliken has one terminating and one through-to-Olten context. Schönenwerd → Aarau has different complete origins. Pieterlen → Biel has different preceding Lengnau stops. Those context differences are retained: no candidate is chosen merely because it is shorter or nearly coincident.\n\n## New primary-source review\n\n- **Dulliken:** the [SBB replacement-stop plan](../data/solothurn-station-access-sources/dulliken-plan.pdf), **October 2024**, labels separate boarding positions towards Olten and towards Däniken/Aarau. Its red dotted lines show pedestrian access from the rail platforms. It supplies no bus approach or terminal-turnaround instruction.\n- **Däniken:** the [SBB replacement-stop plan](../data/solothurn-station-access-sources/daniken-plan.pdf), **October 2024**, confirms the replacement stop name Däniken, Post and distinguishes Däniken, Bahnhof. Pedestrian paths do not establish road direction or select a bus itinerary. Both plans credit SBB, OpenStreetMap contributors, imagico, trafimage.ch and mapset.ch. They predate the July 2026 fixture.\n- **Egerkingen:** the [ASTRA notice of 15 May 2026](${sources.files.find(f => f.file.startsWith('egerkingen')).url}) announces staged nearby road openings from May through July and continuing construction, subject to schedule changes. It does not specify BOGG 501 or its station approach. The winter and later original GTFS records differ by **${format(egerkingenCoordinateDifferencesMetres.from)} m at Gäu Park** and **${format(egerkingenCoordinateDifferencesMetres.to)} m at Bahnhof**. Neither identity is substituted for the other. The notice is regional construction context; no completion date is inferred.\n\nThe [source manifest](../data/solothurn-station-access-sources/sources.json) retains URLs, acquisition time, hashes, dates, attribution and decisions. PDFs and the notice are review evidence; no PDF geometry or inferred reuse licence enters the feed. Existing OSM candidate geometry is attributed to © OpenStreetMap contributors, ODbL-1.0, using the pinned 2 September 2026 extract.\n\n## Remaining directed pairs\n\n| Route | Original directed stop IDs | Sampled dates and failed-pair occurrences |\n| --- | --- | --- |\n${pairs.map(p => `| ${p.line} (${p.mode}) | ${p.from[4]} → ${p.to[4]} | ${p.dates.map(d => d.date + ': ' + d.journeys).join('; ')} |`).join('\n')}\n\nThe two Arlesheim tram pairs share platform E and mostly affect the same journeys. The retained official-line and historical-tram comparisons still exceed the 80 m attachment limit; no operator-supported coordinate correction was found. The previous [Pieterlen and Egerkingen review](SOLOTHURN-STUDY.md#summer-rail-and-winter-bus-follow-up) continues to apply. No geometry threshold changes or stop substitutions follow from these documents.\n\n| Date | Unique excluded journeys |\n| --- | --- |\n${days.map(d => `| ${d.date} | ${d.excludedJourneys} |`).join('\n')}\n\nReproduce offline with:\n\n\`\`\`sh\nnode scripts/review-solothurn-residual-gaps.mjs --check\nnode scripts/review-solothurn-station-access.mjs --check\n\`\`\`\n`
for (const [file, content] of [['data/solothurn-audit/station-access-review.json', JSON.stringify(result, null, 2) + '\n'], ['docs/SOLOTHURN-STATION-ACCESS.md', doc]]) {
  if (process.argv.includes('--check')) assert.equal(await readFile(file, 'utf8'), content)
  else await writeFile(file, content)
}
console.log(JSON.stringify({ verifiedDirectedPairs: pairs.length, dates: days.length, fullContextComparisons: comparisons.length, newAdmittedJourneys: 0 }))
