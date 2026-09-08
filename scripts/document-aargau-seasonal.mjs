import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { hashFile } from './inventory-aargau.mjs'
import { readJson, readGzipJson } from './aargau-seasonal.mjs'

const root = 'data/aargau-seasonal'
const summary = await readJson(`${root}/summary.json`)
const alignment = await readJson(`${root}/alignment-review.json`)
const platformPolicy = await readJson('data/aargau-platform-policy.json')
const crosswalk = await readJson('data/aargau-line-crosswalk.json')
const railPolicy = await readJson('data/aargau-rail-policy.json')
const railRoutes = new Set(railPolicy.routes.map(r => r.routeId))
const newPatterns = new Set(), gapRoutes = new Map(), categories = new Map(), unresolved = []
for (const day of summary.days) {
  const detail = await readGzipJson(`${root}/${day.patternsFile}`)
  assert.equal(await hashFile(`${root}/${day.patternsFile}`), day.patternsSha256)
  for (const p of detail.patterns) {
    if (p.newSinceSeptember) newPatterns.add(p.id)
    for (const [i, segment] of p.segments.entries()) {
      if (segment.pathIndex !== null) continue
      const platform = platformPolicy.patterns.find(rule => rule.agencyId === p.agencyId && rule.routeId === p.routeId && rule.directionId === p.gtfsDirectionId &&
        JSON.stringify(rule.stops.map(s => s[4])) === JSON.stringify(p.stopIds) && ((rule.fix === 'brugg-service-loop' && [6, 7].includes(i)) || (rule.fix === 'bern-platform-49' && i === p.segments.length - 1)))
      const gap = crosswalk.gapMappings.find(rule => rule.routeIds.includes(p.routeId) && rule.agencyId === p.agencyId && rule.directedPairs.some(([a, b]) => a === segment.fromId && b === segment.toId))
      const category = platform && platform.date !== day.date ? 'platform-evidence-limited-to-september' : gap && !gap.serviceDates.includes(day.date) ? 'border-evidence-limited-to-september' :
        segment.railFailure ? `rail:${segment.railFailure}` : segment.roadFailure ? `road:${segment.roadFailure}` : p.mode === 'rail' && !railRoutes.has(p.routeId) ? 'rail-route-outside-reviewed-policy' :
          p.mode === 'bus' ? 'bus-pattern-not-in-reviewed-road-cache' : `source:${segment.reason}`
      categories.set(category, (categories.get(category) ?? 0) + p.occurrences)
      const route = gapRoutes.get(p.routeId) ?? { routeId: p.routeId, agencyId: p.agencyId, line: p.line, mode: p.mode, missingOccurrences: 0, dates: new Set(), categories: new Set() }
      route.missingOccurrences += p.occurrences; route.dates.add(day.date); route.categories.add(category); gapRoutes.set(p.routeId, route)
      unresolved.push({ date: day.date, patternId: p.id, routeId: p.routeId, agencyId: p.agencyId, line: p.line, mode: p.mode, fromId: segment.fromId, toId: segment.toId,
        occurrences: p.occurrences, review: category, agisRejection: segment.reason, roadFailure: segment.roadFailure ?? null, railFailure: segment.railFailure ?? null })
    }
  }
}
assert.equal(unresolved.reduce((n, s) => n + s.occurrences, 0), summary.days.reduce((n, d) => n + d.missingOccurrences, 0))
const flags = new Map()
for (const day of alignment.days) {
  assert.equal(await hashFile(`${root}/${day.comparisonsFile}`), day.comparisonsSha256)
  for (const c of (await readGzipJson(`${root}/${day.comparisonsFile}`)).comparisons.filter(c => c.review === 'alignment-disagreement-over-30m')) {
    const key = JSON.stringify([c.routeId, c.fromId, c.toId])
    const prior = flags.get(key) ?? { routeId: c.routeId, agencyId: c.agencyId, line: c.line, fromId: c.fromId, toId: c.toId, from: c.from, to: c.to,
      maximumVertexSeparationMetres: 0, occurrencesAcrossTwoFixtures: 0, contexts: [] }
    prior.maximumVertexSeparationMetres = Math.max(prior.maximumVertexSeparationMetres, c.maximumVertexSeparationMetres)
    prior.occurrencesAcrossTwoFixtures += c.occurrences
    prior.contexts.push({ date: day.date, patternId: c.patternId, occurrences: c.occurrences })
    flags.set(key, prior)
  }
}
const release = { schemaVersion: 1, summarySha256: await hashFile(`${root}/summary.json`), alignmentReviewSha256: await hashFile(`${root}/alignment-review.json`),
  publicationReady: false, productionFeedsChanged: false,
  checks: { sampledSourceJourneys: true, septemberReplay: true, dateScopedExceptions: true, everySeasonalPatternHasGeometry: unresolved.length === 0,
    busAlignmentDisagreementsResolved: flags.size === 0, physicalRunningDirectionsCertified: false, dstRepeatedHourDisambiguated: false },
  uniqueNewDirectedPatterns: newPatterns.size,
  missingOccurrenceCategories: Object.fromEntries([...categories].sort((a, b) => b[1] - a[1])),
  gapRoutes: [...gapRoutes.values()].map(r => ({ ...r, dates: [...r.dates], categories: [...r.categories] })).sort((a, b) => b.missingOccurrences - a.missingOccurrences || a.routeId.localeCompare(b.routeId)),
  unresolved, alignmentFlags: [...flags.values()].sort((a, b) => b.maximumVertexSeparationMetres - a.maximumVertexSeparationMetres),
  remainingWork: [
    'Review AGIS/OSM bus disagreements against dated operator itineraries and legal direction evidence; the 30 m diagnostic alone cannot choose the correct source.',
    'Prepare and review exact missing seasonal bus patterns and rail route identities; retain all source calls and existing distance limits.',
    'Review Brugg, Bern and Waldshut evidence separately before extending their September-only scope.',
    'Find active witness dates for the 45 archived routes absent from all twelve samples; do not label them discontinued.',
    'Disambiguate the repeated local hour before promoting 25 October as an elapsed-time feed.',
    'Integrate reviewed fixtures into application study selection, date loading and attribution, then run browser release checks.'
  ] }
const fmt = n => n.toLocaleString('en-US')
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}`
const routeMap = new Map(summary.routes.map(r => [r.routeId, r]))
const doc = `# Aargau seasonal compatibility and release audit

Checked **8 September 2026**, following the [Aargau canton inventory and source adapter](AARGAU-STUDY.md). The twelve-date sample independently verifies **${fmt(summary.days.reduce((n, d) => n + d.trips, 0))} complete journeys and ${fmt(summary.days.reduce((n, d) => n + d.sourceVerification.calls, 0))} calls** against pinned GTFS 20260902. It finds **${fmt(newPatterns.size)} directed patterns absent from the two September fixtures**, **${summary.newlyActiveRoutes.length} newly active route records**, and **${summary.stillInactiveRoutes.length} archived canton-calling routes still inactive on the sampled dates**.

**Application release checks have not passed.** September geometry and journeys replay exactly, but other sampled dates contain unresolved geometry and the bus comparison exposes source disagreements requiring itinerary review. No production feed, input hash, distance guard, date-scoped exception or application selection changed. These results measure compatibility with pinned geometry; they do not establish that an alignment applied historically or will apply on a future service date.

## Dates and complete-journey coverage

The sample covers winter weekdays/Sundays, Good Friday/Easter Sunday, summer weekdays/Sundays, National Day, autumn weekdays/Sundays and the final Friday of the timetable year. Every date includes intersecting preceding-service-day journeys. Full calls outside the canton and outside midnight are retained. All source calendar exceptions, identities, platform coordinates, boarding rules and shifted times passed the independent Python CSV/zip verifier. No frequency templates occur in these samples.

${table(['Date', 'Journeys', 'Compatible segments', 'All segments', 'Coverage', 'New directed patterns', 'Unresolved occurrences'], summary.days.map(d => [d.date, fmt(d.trips), fmt(d.matched), fmt(d.total), (d.coverage * 100).toFixed(3) + '%', fmt(d.newPatterns), fmt(d.missingOccurrences)]))}

Counts are adjacent calls over all complete retained journeys. New-pattern counts per day can overlap; the distinct union is ${fmt(newPatterns.size)}. Compatibility uses one AGIS part/orientation per full pattern, the exact existing OSM route/platform/coordinate cache, and the existing FOT route/operating-point policy. Additional dates are diagnostic inputs only: the publication builder's September fixture hashes are unchanged. Brugg, Bern and Waldshut exceptions remain unavailable on other dates. A failure caused by that limited evidence is not proof that the physical line is absent.

**25 October is a wall-clock source-order test only.** The repeated local hour at the DST fallback is not disambiguated; that date is not delivered as an elapsed-time day feed. A September 2026 archive replayed on earlier dates is the publisher's archived schedule, not evidence of actual historical operation.

## Newly active archived routes

${table(['GTFS route record', 'Operator / line', 'Sampled activity'], summary.newlyActiveRoutes.map(id => { const r = routeMap.get(id); return [id, r.operator + ' / ' + r.line, r.days.filter(d => d.trips).map(d => d.date + ': ' + d.trips).join('; ')] }))}

The [complete seasonal inventory](../data/aargau-seasonal/input/inventory.json) retains all 5,142 national routes, their archived canton membership and all twelve daily statuses. The [summary](../data/aargau-seasonal/summary.json) lists all 289 canton-calling route records, their geometry counts and the 45 still-inactive records. Inactivity in this sample is not discontinuation or an exclusion from the archived canton census.

## Geometry review priorities

The [release review](../data/aargau-seasonal/release-review.json) enumerates every unresolved date/pattern/adjacent-platform context, with original AGIS and fallback rejection reasons. Occurrence totals below sum sampled dates; they are not annual volumes.

${table(['Review category', 'Missing sampled occurrences'], Object.entries(release.missingOccurrenceCategories).map(([reason, n]) => [reason, fmt(n)]))}

${table(['Route record', 'Agency / line', 'Missing sampled occurrences'], release.gapRoutes.slice(0, 12).map(r => [r.routeId, r.agencyId + ' / ' + r.line, fmt(r.missingOccurrences)]))}

## AGIS and OSM alignment comparison

Every AGIS bus segment in the September audit was checked for an accepted comparator from the exact full-pattern road cache. The road cache was originally prepared for fallback patterns, so most AGIS-only contexts have no comparator. This absence is not an alignment failure. Symmetric vertex-to-polyline separation in approximate LV95 metres flags a disagreement over 30 m. It is direction-insensitive, can be zero for a reversed path, and cannot certify one-way legality, lanes, operating tracks or temporary diversions. Neither source wins automatically.

${table(['Date', 'Within 30 m: contexts / occurrences', 'Over 30 m: contexts / occurrences', 'No comparator: contexts / occurrences'], alignment.days.map(d => [d.date, ...['within-30m-vertex-distance', 'alignment-disagreement-over-30m', 'no-accepted-full-pattern-comparator'].map(k => fmt(d.counters[k].contexts) + ' / ' + fmt(d.counters[k].occurrences))]))}

There are **${release.alignmentFlags.length} distinct directed route/platform pairs** flagged across both dates; individual patterns and dates remain separate in the detailed reports. The largest separations are:

${table(['Agency / line', 'Directed stops', 'Maximum separation'], release.alignmentFlags.slice(0, 10).map(r => [r.agencyId + ' / ' + r.line, r.from + ' → ' + r.to, fmt(Math.round(r.maximumVertexSeparationMetres)) + ' m']))}

The [comparison summary](../data/aargau-seasonal/alignment-review.json) binds both compressed per-context files to SHA-256 hashes. The ranked release review links each flag to its date and full directed pattern ID, so branch/short-working differences can be examined without replacing accepted geometry.

## Sources, reproduction and release

Source bytes, dates and attribution remain those in the [main source audit](AARGAU-STUDY.md): GTFS 20260902 (opentransportdata.swiss), AGIS 23 April 2026 (**Daten des Kantons Aargau**), swissBOUNDARIES3D 2026-01 (© swisstopo), OSM base/supplement extracts dated 2/8 September 2026 (© OpenStreetMap contributors, ODbL-1.0), and FOT infrastructure with catalogue date 6 July 2021 and asset update 18 January 2025. FOT current validity is unconfirmed. The Brugg and SBB Bern evidence and their exact dated scopes are preserved in the platform policy. No new source vintage is inferred from this audit's execution date.

All twelve compressed extracted timetables, the complete inventory and independent verification are retained under [input](../data/aargau-seasonal/input). Each compressed pattern report contains every full ordered platform chain, source feature/orientation, segment decision and distinct directed pair. September paths are compared byte-for-byte as arrays with the committed regional manifests. Other dates never receive September-only gap or platform exceptions. Source hashes, every recomputed path decision, occurrence totals and the diagnostic comparison are checked offline.

\`\`\`sh
# Recreate the input from the original pinned 232 MB archive.
node --max-old-space-size=8192 scripts/inventory-aargau.mjs \\
  --archive /path/GTFS_FP2026_20260902.zip --sources data/aargau-sources \\
  --dates ${summary.days.map(d => d.date).join(',')} \\
  --output /tmp/aargau-seasonal-input
python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip /tmp/aargau-seasonal-input

# Rebuild or replay the shipped audit; no network access is required.
node scripts/audit-aargau-seasonal.mjs
node scripts/check-aargau-seasonal.mjs
node scripts/review-aargau-alignments.mjs --check
node scripts/document-aargau-seasonal.mjs --check
node scripts/check-aargau-study.mjs
npx vitest run scripts/aargau-seasonal.test.mjs scripts/aargau-platform-geometry.test.mjs
\`\`\`

Next work, recorded in the release review:

${release.remainingWork.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`
if (process.argv.includes('--check')) {
  assert.deepEqual(await readJson(`${root}/release-review.json`), release)
  const { readFile } = await import('node:fs/promises')
  assert.equal(await readFile('docs/AARGAU-SEASONAL-AUDIT.md', 'utf8'), doc)
} else {
  await writeFile(`${root}/release-review.json`, JSON.stringify(release, null, 2) + '\n')
  await writeFile('docs/AARGAU-SEASONAL-AUDIT.md', doc)
}
console.log(`${newPatterns.size} new patterns; ${release.alignmentFlags.length} distinct flagged bus pairs; ${unresolved.length} unresolved seasonal segment contexts`)
