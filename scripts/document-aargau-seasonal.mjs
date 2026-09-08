import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { hashFile } from './inventory-aargau.mjs'
import { readJson, readGzipJson } from './aargau-seasonal.mjs'

const root = 'data/aargau-seasonal'
const witnesses = await readJson('data/aargau-witnesses/inventory.json')
const witnessGeometry = await readJson('data/aargau-witnesses/edge-review-summary.json')
assert.equal(witnessGeometry.policySha256, await hashFile('data/aargau-witness-edge-policy.json'))
assert.equal(witnessGeometry.previousReviewSha256, await hashFile('data/aargau-witnesses/interlaken-review-summary.json'))
assert.equal(witnessGeometry.inventorySha256, await hashFile('data/aargau-witnesses/inventory.json'))
assert.equal(witnessGeometry.sourceVerificationSha256, await hashFile('data/aargau-witnesses/source-verification.json'))
assert.equal(witnesses.witnessedRoutes, witnesses.targetRoutes)
const summary = await readJson(`${root}/summary.json`)
const alignment = await readJson(`${root}/alignment-review.json`)
const correctionPolicy = await readJson('data/aargau-alignment-policy.json')
const line344Review = await readJson(`${root}/344-alignment-followup.json`)
assert.equal(line344Review.correctedOccurrences, 0)
assert.equal(line344Review.rows.length, 2)
for (const [file, sha] of Object.entries(line344Review.files)) assert.equal(await hashFile(file), sha)
const correctionRegression = await readJson(`${root}/alignment-correction-regression.json`)
assert(correctionRegression.passed)
assert.equal(correctionRegression.policySha256, await hashFile('data/aargau-alignment-policy.json'))
assert.equal(correctionRegression.candidateManifestSha256, await hashFile('fixtures/aargau-reviewed/2026-09-04/aargau-region-day-manifest.json'))
const addedRoadOccurrences = summary.days.reduce((n, d) => n + d.roadExtensionRegression.addedOccurrences, 0)
const addedSimplonOccurrences = summary.days.reduce((n, d) => n + d.simplonExtensionRegression.addedOccurrences, 0)
const addedScopedGapOccurrences = summary.days.reduce((n, d) => n + d.gapExtensionRegression.addedOccurrences, 0)
const scopedGapOccurrencesByKind = {}
for (const d of summary.days) for (const [kind, n] of Object.entries(d.scopedGapOccurrences)) scopedGapOccurrencesByKind[kind] = (scopedGapOccurrencesByKind[kind] ?? 0) + n
const seasonalGapPolicy = await readJson('data/aargau-seasonal-gap-policy.json')
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
    const correction = correctionPolicy.rules.find(r => r.date === day.date && r.patternId === c.patternId && r.stops[r.segmentIndex][4] === c.fromId && r.stops[r.segmentIndex + 1][4] === c.toId)
    prior.contexts.push({ date: day.date, patternId: c.patternId, occurrences: c.occurrences, correctionId: correction?.id ?? null })
    flags.set(key, prior)
  }
}
const pendingFlags = [...flags.values()].filter(f => f.contexts.some(c => !c.correctionId))
const release = { schemaVersion: 1, annualWitnessEdgeReviewSha256: await hashFile('data/aargau-witnesses/edge-review-summary.json'), annualWitnessEdgePolicySha256: await hashFile('data/aargau-witness-edge-policy.json'), annualWitnessInventorySha256: await hashFile('data/aargau-witnesses/inventory.json'), annualWitnessGeometrySha256: await hashFile('data/aargau-witnesses/geometry-summary.json'), annualWitnessRailReviewSha256: await hashFile('data/aargau-witnesses/rail-review-summary.json'), annualWitnessRailPolicySha256: await hashFile('data/aargau-witness-rail-policy.json'), annualWitnessInterlakenReviewSha256: await hashFile('data/aargau-witnesses/interlaken-review-summary.json'), annualWitnessInterlakenPolicySha256: await hashFile('data/aargau-witness-interlaken-policy.json'), witnessedPreviouslyUnsampledRoutes: witnesses.witnessedRoutes, witnessDates: witnesses.selectedDates.map(s => s.date), unresolvedWitnessTemplateOccurrences: witnessGeometry.missingOccurrences, line344ReviewSha256: await hashFile(`${root}/344-alignment-followup.json`), addedSimplonOccurrences, simplonPolicySha256: await hashFile('data/aargau-simplon-policy.json'), addedScopedGapOccurrences, scopedGapOccurrencesByKind, seasonalGapPolicySha256: await hashFile('data/aargau-seasonal-gap-policy.json'), correctionPolicySha256: await hashFile('data/aargau-alignment-policy.json'), correctionRegressionSha256: await hashFile(`${root}/alignment-correction-regression.json`),
  reviewCandidate: 'fixtures/aargau-reviewed/2026-09-04/aargau-region-day-manifest.json', addedRoadOccurrences, pendingAlignmentFlags: pendingFlags.length, summarySha256: await hashFile(`${root}/summary.json`), alignmentReviewSha256: await hashFile(`${root}/alignment-review.json`),
  publicationReady: false, productionFeedsChanged: false,
  checks: { annualRouteWitnessesFound: true, witnessPatternGeometryComplete: witnessGeometry.missingOccurrences === 0, sampledSourceJourneys: true, septemberReplay: true, dateScopedExceptions: true, everySeasonalPatternHasGeometry: unresolved.length === 0,
    busAlignmentDisagreementsResolved: pendingFlags.length === 0, physicalRunningDirectionsCertified: false, dstRepeatedHourDisambiguated: false },
  uniqueNewDirectedPatterns: newPatterns.size,
  missingOccurrenceCategories: Object.fromEntries([...categories].sort((a, b) => b[1] - a[1])),
  gapRoutes: [...gapRoutes.values()].map(r => ({ ...r, dates: [...r.dates], categories: [...r.categories] })).sort((a, b) => b.missingOccurrences - a.missingOccurrences || a.routeId.localeCompare(b.routeId)),
  unresolved, alignmentFlags: [...flags.values()].sort((a, b) => b.maximumVertexSeparationMetres - a.maximumVertexSeparationMetres),
  remainingWork: [
    'Review AGIS/OSM bus disagreements against dated operator itineraries and legal direction evidence; the 30 m diagnostic alone cannot choose the correct source.',
    'Resolve the remaining witness geometry: 7,187 bus template occurrences across 86 patterns; then extract and independently validate full civil days before extending the release scope.',
    'Disambiguate the repeated local hour before promoting 25 October as an elapsed-time feed.',
    'Integrate reviewed fixtures into application study selection, date loading and attribution, then run browser release checks.'
  ] }
const fmt = n => n.toLocaleString('en-US')
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}`
const routeMap = new Map(summary.routes.map(r => [r.routeId, r]))
const doc = `# Aargau seasonal compatibility and release audit

Checked **8 September 2026**, following the [Aargau canton inventory and source adapter](AARGAU-STUDY.md). The twelve-date sample independently verifies **${fmt(summary.days.reduce((n, d) => n + d.trips, 0))} complete journeys and ${fmt(summary.days.reduce((n, d) => n + d.sourceVerification.calls, 0))} calls** against pinned GTFS 20260902. It finds **${fmt(newPatterns.size)} directed patterns absent from the two September fixtures**, **${summary.newlyActiveRoutes.length} newly active route records**, and **${summary.stillInactiveRoutes.length} archived canton-calling routes still inactive on the sampled dates**.

**Application release checks have not passed.** The additional bus cache fills **${fmt(addedRoadOccurrences)} previously unresolved seasonal occurrences**, preserving every earlier path and complete journey. A separate finite policy fills **${fmt(addedScopedGapOccurrences)} further occurrences**, and a separately scoped Simplon fallback fills the final **${addedSimplonOccurrences} Brig–Domodossola occurrences**. Every adjacent-call occurrence now has geometry on all twelve sampled dates. The archived September feeds replay exactly. A separate [Friday review candidate](../fixtures/aargau-reviewed/2026-09-04/aargau-region-day-manifest.json) corrects four occurrences on two evidenced direct variants of lines 136 and 358; ${pendingFlags.length} distinct bus pairs still need alignment review. No original feed, publication input hash, general distance guard, September platform/border policy or application selection changed. These results measure compatibility with pinned geometry; they do not establish that an alignment applied historically or will apply on a future service date.

## Dates and complete-journey coverage

The sample covers winter weekdays/Sundays, Good Friday/Easter Sunday, summer weekdays/Sundays, National Day, autumn weekdays/Sundays and the final Friday of the timetable year. Every date includes intersecting preceding-service-day journeys. Full calls outside the canton and outside midnight are retained. All source calendar exceptions, identities, platform coordinates, boarding rules and shifted times passed the independent Python CSV/zip verifier. No frequency templates occur in these samples.

${table(['Date', 'Journeys', 'Compatible segments', 'All segments', 'Coverage', 'New directed patterns', 'Unresolved occurrences'], summary.days.map(d => [d.date, fmt(d.trips), fmt(d.matched), fmt(d.total), (d.coverage * 100).toFixed(3) + '%', fmt(d.newPatterns), fmt(d.missingOccurrences)]))}

Counts are adjacent calls over all complete retained journeys. New-pattern counts per day can overlap; the distinct union is ${fmt(newPatterns.size)}. Compatibility uses one AGIS part/orientation per full pattern, the preserved OSM route/platform/coordinate caches plus a new twelve-date cache for missing bus patterns, the existing FOT route/operating-point policy, 63 separately pinned seasonal gap rules, and two exact Simplon journey rules. Additional dates are diagnostic inputs only: the publication builder's September fixture hashes are unchanged. The original Brugg, Bern and Waldshut exceptions retain their September-only scope. The separate seasonal policy admits only the reviewed exact date/full-coordinate patterns and preserves every previously matched path.

**25 October is a wall-clock source-order test only.** The repeated local hour at the DST fallback is not disambiguated; that date is not delivered as an elapsed-time day feed. A September 2026 archive replayed on earlier dates is the publisher's archived schedule, not evidence of actual historical operation.

## Newly active archived routes

${table(['GTFS route record', 'Operator / line', 'Sampled activity'], summary.newlyActiveRoutes.map(id => { const r = routeMap.get(id); return [id, r.operator + ' / ' + r.line, r.days.filter(d => d.trips).map(d => d.date + ': ' + d.trips).join('; ')] }))}

The [complete seasonal inventory](../data/aargau-seasonal/input/inventory.json) retains all 5,142 national routes, their archived canton membership and all twelve daily statuses. The [summary](../data/aargau-seasonal/summary.json) lists all 289 canton-calling route records, their geometry counts and the 45 still-inactive records. Inactivity in this sample is not discontinuation or an exclusion from the archived canton census. The [annual witness audit](AARGAU-ANNUAL-WITNESSES.md) now finds active canton-calling journeys for all 45 routes, covered by 19 selected civil dates. It independently verifies 2,019 archived trip templates and 13,007 complete calls across all 364 feed dates. Those templates introduce 280 directed patterns; the exact-template FOT candidate added 3,616 segment occurrences, and a separately scoped Interlaken parent/track-group binding now adds another 162 while preserving all 3,628 earlier paths. A final exact-template Bern platform-50 projection and Waldshut corridor policy adds the last 11 rail occurrences, preserving all 3,790 prior paths. All 194 rail patterns now have geometry; the remaining 7,187 of 10,988 template occurrences are bus gaps across 86 patterns. These are separate audit counts, not additional complete regional feeds.

## Geometry review priorities

The [release review](../data/aargau-seasonal/release-review.json) enumerates every unresolved date/pattern/adjacent-platform context, with original AGIS and fallback rejection reasons. Occurrence totals below sum sampled dates; they are not annual volumes.

${unresolved.length ? table(['Review category', 'Missing sampled occurrences'], Object.entries(release.missingOccurrenceCategories).map(([reason, n]) => [reason, fmt(n)])) + '\n\n' + table(['Route record', 'Agency / line', 'Missing sampled occurrences'], release.gapRoutes.slice(0, 12).map(r => [r.routeId, r.agencyId + ' / ' + r.line, fmt(r.missingOccurrences)])) : 'No sampled geometry gaps remain. All complete journeys are retained; the bus alignment reviews below remain separate from automatic geometry coverage.'}

## AGIS and OSM alignment comparison

Every AGIS bus segment in the September audit was checked for an accepted comparator from the exact full-pattern road cache. The road cache was originally prepared for fallback patterns, so most AGIS-only contexts have no comparator. This absence is not an alignment failure. Symmetric vertex-to-polyline separation in approximate LV95 metres flags a disagreement over 30 m. It is direction-insensitive, can be zero for a reversed path, and cannot certify one-way legality, lanes, operating tracks or temporary diversions. Neither source wins automatically.

${table(['Date', 'Within 30 m: contexts / occurrences', 'Over 30 m: contexts / occurrences', 'No comparator: contexts / occurrences'], alignment.days.map(d => [d.date, ...['within-30m-vertex-distance', 'alignment-disagreement-over-30m', 'no-accepted-full-pattern-comparator'].map(k => fmt(d.counters[k].contexts) + ' / ' + fmt(d.counters[k].occurrences))]))}

There were **${release.alignmentFlags.length} distinct directed route/platform pairs** flagged across both archived dates; reviewed corrections are available for ${release.alignmentFlags.length - pendingFlags.length} and **${pendingFlags.length} remain pending**; individual patterns and dates remain separate in the detailed reports. The largest separations are:

${table(['Agency / line', 'Directed stops', 'Maximum separation'], pendingFlags.sort((a, b) => b.maximumVertexSeparationMetres - a.maximumVertexSeparationMetres).slice(0, 10).map(r => [r.agencyId + ' / ' + r.line, r.from + ' → ' + r.to, fmt(Math.round(r.maximumVertexSeparationMetres)) + ' m']))}

The [comparison summary](../data/aargau-seasonal/alignment-review.json) binds both compressed per-context files to SHA-256 hashes. The ranked release review links each flag to its date and full directed pattern ID, so branch/short-working differences can be examined without replacing accepted geometry.

## Reviewed line 136 correction

The [correction policy](../data/aargau-alignment-policy.json) selects one exact Friday full pattern and its Gipf-Oberfrick, Rösslibrücke → Wölflinswil, Unterdorf segment. AGIS feature 43 follows the unserved Wittnau branch for **6,926.9 m**; pinned GTFS allows three minutes, implying **138.5 km/h**. The official timetable field 50.136 (3 December 2025, page 2, course 36051) and operator network map show the separate direct working. The timetable PDF is an earlier version: it has 11:48–11:51 where September GTFS has 11:50–11:53. Both allocate three minutes; no GTFS call time is changed.

The replacement uses the already accepted full-pattern OSM bypass, **3,586.8 m** and an implied **71.7 km/h**. It remains an infrastructure inference. The policy pins exact agency, route, direction, full platform IDs/coordinates, date, segment index and both old/new path hashes. It cannot apply to another date or a changed source path. This corrects one occurrence. The [candidate regression](../data/aargau-seasonal/alignment-correction-regression.json) verifies all 11,193 original journeys, ${fmt(correctionRegression.preservedOccurrences)} unchanged segment occurrences and exactly ${correctionRegression.correctedOccurrences} corrected occurrences across both reviewed variants. It also compares the archived prior policy and regression to prove this earlier line 136 correction remains identical. The archived Friday fixture and seasonal September replay are preserved; the corrected candidate is separate pending the remaining release reviews.

## Reviewed line 358 direct variant

[PostAuto’s 2026 service-change notice](https://fahrplanwechsel.postauto.ch/de/mittelland/aargau), effective **14 December 2025**, explicitly identifies the Monday–Friday **14:45, 15:45 and 16:45** departures from Baldingen as direct **Bad Zurzach, Seesteg → Bahnhof** workings for the S27 connection. The page is undated and was checked on **8 September 2026**; its previously archived bytes remain pinned. Official field **50.358**, dated **7 November 2025**, pages 1–2, confirms courses **35836, 35840 and 35846**, with Seesteg departures at **14:53, 15:53 and 16:53** and station arrivals three minutes later. These call times agree exactly with the pinned September GTFS. The courses omit Oberflecken, Höfli and Thermalbad; the explicit operator notice establishes the direct itinerary.

AGIS feature **193**, part **1**, retains a **1,950.2 m** local-loop path. The review candidate replaces its final segment with the accepted full-pattern OSM direct path of **931.4 m** for exactly **three Friday occurrences**, all on route **96-167-7-j26-1**, direction **1**, pattern **ba67a6b897cd1bf0b14f**. The policy pins the complete platform coordinates, source trip IDs, service date, course numbers, full calls and old/new path hashes. Every journey is checked before shared-pattern geometry is reused. No Sunday occurrence is admitted by this rule. The Baden-Nord operator map, valid from **14 December 2025**, is schematic context; the OSM path remains an infrastructure inference, with OpenStreetMap contributor attribution and ODbL provenance retained.

The earlier **Baldingen, Unterdorf → Rekingen AG, Dorf** segment remains unchanged, including these same three courses and course 35810. Its sparse calls and short interval do not establish an exact road itinerary. The other line 358 branch disagreements also remain pending. The original September fixtures and all twelve seasonal compatibility results are unchanged.

## Remaining line 344 review

The two largest line 344 disagreements were also examined against field 50.344 (7 November 2025, page 1) and the Freiamt map. Those sources distinguish early direct, Benzenschwil spur and school workings, but do not by themselves settle the exact road used on every sparse-stop variant. The [course-level follow-up](../data/aargau-seasonal/344-alignment-followup.json) pins courses 34403/34405 and 34409 with matching PDF call times. For Muri Industriegebiet → Beinwil Unterdorf, AGIS is 6,974.8 m (83.7 km/h over five minutes) versus OSM 3,730.9 m (44.8 km/h). For Benzenschwil → Beinwil Unterdorf, the alternatives are 4,583.0 m (68.7 km/h over four minutes) and 2,502.3 m (37.5 km/h). Those differences warrant a dated operator road itinerary; they do not by themselves establish the exact road. All three occurrences retain their original geometry and both pairs remain in the ${pendingFlags.length} pending reviews.

## Seasonal road-cache evidence

The [new source bundle](../data/aargau-seasonal-roads/source.json) contains 460 complete routing patterns across 14 agencies, with all original matcher outputs and warnings compressed for offline replay. It uses the same pinned OSM extract, pfaedle binary and configuration as the earlier cache; no threshold changes were made. The three PostAuto rejected hops and 76 cross-border matcher rejections remain null in this cache; preserved earlier caches or date-scoped evidence handle already resolved contexts. All ${fmt(addedRoadOccurrences)} newly covered occurrences were prior gaps, including all 3,801 AVA EV1 summer replacement-bus occurrences missing from the old cache. This supplies geometric compatibility, not proof of the actual 2026 replacement-bus diversion.

## Scoped seasonal border, platform and rail review

The [seasonal gap policy](../data/aargau-seasonal-gap-policy.json) pins **${seasonalGapPolicy.rules.length} exact date/full-pattern rules** and ${fmt(addedScopedGapOccurrences)} additional occurrences: **364 Koblenz–Waldshut, 144 Brugg service-loop, seven Bern platform 49 and 68 on four additional SBB route records**. It binds the complete platform coordinates, route/agency/direction, segment indices, path hashes, source evidence and input hashes. It runs only in this compatibility audit after all earlier sources fail. The regression replays all prior geometry before applying these rules and verifies every earlier path remains identical.

The official [field 50.368](https://widgets.oev-info.ch/publikation/jahresfpl/50.368.pdf), dated **7 November 2025**, was archived and visually checked on page 1. It distinguishes the Wildischachen–Aare AG–Aquarena workings from the shorter variant. All four additional weekday coordinate chains equal the original reviewed Brugg pattern; the same ordered OSM relation and unchanged projection guards apply. This is dated itinerary evidence, not a date for the OSM geometry.

All seven selected Bern arrivals have the identical Baden–Brugg–Aarau–Olten–Bern tail. Zürich departure platforms 15, 17 and 18 are separately pinned. The [SBB station description](https://www.sbb.ch/en/travel-information/stations/find-station/bern-station/bern-station-description.html) corroborates the western platform extension; the exact FOT terminal segment still supplies the short 33.9 m projection. The undated description was rechecked on 8 September and does not certify historical track use.

[Thurbo's May 2026 notice](https://www.thurbo.ch/erkunden/ausblick/thurboleben/ki-baustellen/) was rechecked: the announced S36 crossing closure is **14 September–2 October**. All ten additional selected dates lie outside that interval. The entire ordered pattern must match one AGIS feature 364 part before either exact border pair is sliced. The closure interval is explicitly blocked as well as unselected dates; this is not a blanket date-range extension.

The four SBB identities are **91-26-E-j26-1 (RE26 Basel–Luzern), 91-5F-Y-j26-1 (IC Olten–Lugano via Freiamt), 91-2H-Y-j26-1 (IC Zürich–Lausanne/Genève-Aéroport) and 91-AP-Y-j26-1 (EXT Mühlau–Luzern in both directions)**. Nine complete patterns pass the same exact unique operating points, ordered source topology, 350 m station attachment, 120 m topology attachment and detour guards. These paths remain infrastructure inferences; admitting an exact source route ID does not certify its running tracks.

## Reviewed Simplon cross-border fallback

The [Simplon policy](../data/aargau-simplon-policy.json) now resolves the final two occurrences: **IC 1303, Brig platform 6 → Domodossola (I), on 3 April and 1 August**, route 91-29-Y-j26-1. The original FOT network still has no Domodossola node; its failure remains recorded. The fallback is OSM rail infrastructure, separately counted as rail geometry with source **osm-rail**, never attributed to FOT or a bus road cache.

The [official service-point record](https://data.sbb.ch/explore/dataset/dienststellen-gemass-opentransportdataswiss/) supplies the exact identity association: record **8501607**, Domodossola, explicitly states that its timetable is under **8301003**. That record was edited on **19 September 2024**, with validity from **15 December 2024**. The archived dataset metadata says data processed **29 July 2026**; neither date is presented as a track-geometry update. The [SBB border factsheet](https://company.sbb.ch/content/dam/internet/corporate/downloads/en/sbb-als-geschaeftspartner/flotte-unterhalt/onestopshop/Factsheet_Domodossola.pdf.sbbdownload.pdf), revised **6 August 2024**, page 3, independently distinguishes Domodossola FS **83-01003-3** from the FM and II operating points. No name-only or nearest-station alias is used, and the GTFS code stays unchanged.

The OSM snapshot is pinned to **8 September 2026, 00:00 UTC**, including versioned rail ways and all referenced nodes. The **40,781.8 m** inferred path follows connected 1435 mm main tracks and the individually reviewed Simplon passenger crossover **643956810**. Track attachments are **1.68 m at Brig / 33.98 m at Domodossola**, within the 120 m guard; station identity distances are **67.32 / 19.24 m**, within 350 m. The graph admits no yard, siding or spur, no coordinate-based joining of tracks and no reversal sharper than 90 degrees. The other tunnel crossover remains excluded. Removing the reviewed crossover leaves the selected station tracks disconnected and correctly fails the test.

The [official timetable field 145](https://widgets.oev-info.ch/publikation/jahresfpl/145.pdf), dated **26 May 2026**, page 1, corroborates SBB IC 1303 from Zürich and the non-stop Brig–Domodossola leg. That PDF panel covers 14 December–28 May and lists arrivals of 10:07/10:09; the pinned source calls remain **09:39–10:09 on 3 April and 09:39–10:16 on 1 August**. The [BLS construction page](https://www.bls.ch/de/unternehmen/projekte-und-hintergruende/bauprojekte/simplontunnel) is archived as operating context, not a general permission for all dates. Each rule pins date, exact source trip ID, train number, direction, full platform coordinates, every original call/time and the output path hash. It can fill only the original missing final segment. All previously accepted paths and the archived September feeds are regression-preserved; this is infrastructure compatibility, not certification of actual running tracks or historical operation.

Source bytes, query, dataset metadata, operator evidence and attribution are archived under [Simplon sources](../data/aargau-simplon-sources). Rail geometry attribution: **© OpenStreetMap contributors, ODbL-1.0**. Station identities: **SBB Infrastruktur / opentransportdata.swiss / FOT**.

## Sources, reproduction and release

Source bytes, dates and attribution remain those in the [main source audit](AARGAU-STUDY.md): GTFS 20260902 (opentransportdata.swiss), AGIS 23 April 2026 (**Daten des Kantons Aargau**), swissBOUNDARIES3D 2026-01 (© swisstopo), OSM base/supplement extracts dated 2/8 September 2026 (© OpenStreetMap contributors, ODbL-1.0), and FOT infrastructure with catalogue date 6 July 2021 and asset update 18 January 2025. FOT current validity is unconfirmed. The original Brugg and SBB Bern evidence and dated scopes remain in the platform policy. The separate seasonal policy adds the archived annual line 368 timetable and the explicitly bounded review above; original AGIS, OSM and FOT vintages and attributions remain unchanged. No new source vintage is inferred from this audit's execution date.

All twelve compressed extracted timetables, the complete inventory and independent verification are retained under [input](../data/aargau-seasonal/input). Each compressed pattern report contains every full ordered platform chain, source feature/orientation, segment decision and distinct directed pair. September paths are compared byte-for-byte as arrays with the committed regional manifests. Other dates receive only their separately reviewed seasonal rules; September-only policies remain unchanged. Source hashes, every recomputed path decision, occurrence totals and the diagnostic comparison are checked offline.

\`\`\`sh
# Recreate the input from the original pinned 232 MB archive.
node --max-old-space-size=8192 scripts/inventory-aargau.mjs \\
  --archive /path/GTFS_FP2026_20260902.zip --sources data/aargau-sources \\
  --dates ${summary.days.map(d => d.date).join(',')} \\
  --output /tmp/aargau-seasonal-input
python3 scripts/verify-aargau-source.py /path/GTFS_FP2026_20260902.zip /tmp/aargau-seasonal-input

# Prepare the twelve-date bus union and run the pinned matcher for each agency.
node scripts/prepare-aargau-roads.mjs --input data/aargau-seasonal/input --sources data/aargau-sources --crosswalk data/aargau-line-crosswalk.json --output /tmp/aargau-seasonal-road-feeds
for agency in 723 7231 7244 793 801 811 812 839 840 849 873 886 899 sbg034; do
  node scripts/match-postbus-roads.mjs --pfaedle /path/pfaedle --config /path/pfaedle.cfg --osm /path/pinned-postbus-roads.osm.pbf --feed /tmp/aargau-seasonal-road-feeds/$agency --output /tmp/aargau-seasonal-road-matched/$agency
done
node scripts/aargau-seasonal-roads.mjs /tmp/aargau-seasonal-road-feeds /tmp/aargau-seasonal-road-matched

# Rebuild the correction policy from the archived evidence and the review candidate.
node scripts/prepare-aargau-alignment-policy.mjs
node scripts/build-aargau-study.mjs --sources data/aargau-sources --inventory data/aargau --crosswalk data/aargau-line-crosswalk.json --road-cache data/aargau-road-cache.json --road-supplement data/aargau-rheinfelden-road-cache.json --rail-sources data/aargau-rail-sources --rail-policy data/aargau-rail-policy.json --platform-fixes --alignment-policy data/aargau-alignment-policy.json --date 2026-09-04 --output fixtures/aargau-reviewed/2026-09-04
node scripts/check-aargau-reviewed.mjs --write

# Rebuild or replay the shipped audit; no network access is required.
node scripts/prepare-aargau-seasonal-gaps.mjs --check
node scripts/prepare-aargau-simplon.mjs --check
node scripts/review-aargau-344.mjs --check
node scripts/audit-aargau-seasonal.mjs
node scripts/check-aargau-seasonal.mjs
node scripts/aargau-seasonal-roads.mjs --check
node scripts/prepare-aargau-alignment-policy.mjs --check
node scripts/check-aargau-reviewed.mjs
node scripts/review-aargau-alignments.mjs --check
node scripts/document-aargau-seasonal.mjs --check
node scripts/check-aargau-study.mjs
npx vitest run scripts/aargau-seasonal.test.mjs scripts/aargau-platform-geometry.test.mjs scripts/aargau-alignment-corrections.test.mjs
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
