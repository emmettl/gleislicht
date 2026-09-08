import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseCsvLine } from '@motionstudies/data/gtfs'
import { reviewZugAnnual } from './review-zug-annual.mjs'

const audit = await reviewZugAnnual()
assert.deepEqual(JSON.parse(gunzipSync(await readFile('data/zug-annual-audit.json.gz'))), audit)
const s = audit.summary
const table = (headers, rows) => [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.join(' | ')} |`).join('\n')
const count = n => n.toLocaleString('en-CH')
const stopLines = gunzipSync(await readFile('data/zug-annual-sources/stops.txt.gz')).toString().trimEnd().split(/\r?\n/)
const header = parseCsvLine(stopLines.shift()), id = header.indexOf('stop_id'), name = header.indexOf('stop_name')
const names = new Map(stopLines.map(line => { const row = parseCsvLine(line); return [row[id], row[name]] }))
const routeById = new Map(audit.routes.map(r => [r.routeId, r]))
const busPatterns = audit.patterns.filter(p => routeById.get(p.routeId).mode === 'bus' && !p.fixtureDates.length)
const modes = [...new Set(audit.routes.map(r => r.mode))].map(mode => {
  const routes = audit.routes.filter(r => r.mode === mode)
  return [mode, routes.length, ...['patterns', 'representedOnFixtures', 'additionalActivePatterns', 'additionalParentStationPatterns'].map(key => count(routes.reduce((sum, r) => sum + r[key], 0)))]
})
const text = `# Zug: annual directed stop-pattern and calendar audit

Prepared **9 September 2026** from the same frozen national GTFS release as the [regional feed and geometry audit](ZUG-STUDY.md). This expands the annual inventory; it adds no feed dates or geometry admissions.

## Findings

All **${count(s.annualTripRecords)} annual trip records**, **${s.annualRoutes} routes** and **${count(s.serviceIds)} services** are now retained with their complete calls and calendars. They contain **${count(s.annualDirectedPatterns)} exact directed patterns**. The September 4/6 civil fixtures exercise **${s.representedOnFixtures}** distinct patterns across both dates; **${count(s.additionalActivePatterns)}** active patterns are absent. No pattern is inactive throughout the declared feed-validity window. Both complete fixture timetables reconstruct exactly, including previous-service-day carry-in, following-day tails, source IDs, call rules and all original times.

An exact pattern includes route ID, direction ID, every ordered GTFS stop/platform ID and every pickup/drop-off rule. Repeated stops stay repeated. A differing platform is a distinct pattern even when the station name is unchanged. Pattern identity does not include the trip's departure time.

${table(['Mode', 'Routes', 'Annual exact patterns', 'Seen on fixtures', 'Additional exact patterns', 'Additional parent-station patterns'], modes)}

### Platform changes versus station-sequence changes

Following only explicit GTFS **parent_station** references yields **${s.annualParentStationPatterns}** ordered parent-station patterns. **${s.additionalParentStationPatterns}** parent-station patterns are absent from the fixtures. Of the ${count(s.additionalActivePatterns)} additional exact patterns, **${count(s.additionalPatternsWithKnownParentSequence)}** share a route/direction/call-rule parent sequence with a fixture pattern; the remaining **${count(s.additionalActivePatterns - s.additionalPatternsWithKnownParentSequence)}** do not. This comparison retains call order, repeated calls and pickup/drop-off rules. It grants no permission to substitute platforms or reuse a fixture path on another date.

Rail accounts for most additional exact variants. The source still needs date-specific platform, path and timing validation; matching parent stations alone cannot certify running tracks or construction diversions. All ten annual lake patterns and both mountain patterns already occur on the fixtures, but their operation and geometry on other dates have not been validated.

## Calendar coverage and proposed review dates

The inventory expands weekly calendar flags and applies every retained calendar_dates addition/removal, including services with only exceptions. Expansion is bounded by feed_info validity **${audit.source.feed.feed_start_date}–${audit.source.feed.feed_end_date}**. It preserves **${count(audit.source.files.find(f => f.archiveEntry === 'calendar_dates.txt').rows)} exception rows**. There are **${s.frequencyTemplates} scoped frequency templates**; the extractor nevertheless preserves and checks the frequency table. Counts of service-trip records describe source records active on a service date, not expanded headway departures.

Among additional exact patterns, **${s.saturdayOnlyAdditionalPatterns}** operate only on Saturdays and **${s.sundayOnlyAdditionalPatterns}** only on Sundays. A weekday/Sunday-only sample cannot exercise the Saturday-only variants. **${count(s.singleServiceDatePatterns)}** additional patterns have only one active service date, spread over **${s.forcedSingleServiceDates} distinct dates**. Therefore at least that many source service dates are needed to exercise every exact annual pattern. The deterministic greedy cover selects **${audit.proposedServiceDates.length} dates**, with every additional exact pattern assigned once; it is not asserted to be minimal.

The separate parent-station comparison requires **${audit.proposedParentStationServiceDates.length} proposed dates** under the same greedy method. The first twelve selections below prioritize station-sequence coverage. The machine audit retains the complete selections and exact pattern IDs, plus all eligible dates and the source trips for every pattern.

${table(['Source service date', 'Weekday', 'New parent-station patterns'], audit.proposedParentStationServiceDates.slice(0, 12).map(d => [d.date, d.weekday, d.newPatternIds.length]))}

These are **service dates**, not civil feed dates. A source departure at 24:xx belongs to the following civil day; some patterns active under a September 4/6 service ID consequently occur outside those civil fixtures. Proposed review dates can overlap a fixture service date for this reason. Before building more civil feeds, account for both source-day tails and preceding-day carry-in. The dates identify declared service in the September 2 release, not independently observed historic operation. Calendar exceptions are not automatically classified as public holidays.

## Every annual route

“Seen” means an exact complete pattern appears in either existing fixture, regardless of its admission result. “Additional” means active within feed validity and absent from both fixtures. Existing rejected 604 patterns remain rejected. Each route ID is kept separately even when display line names coincide.

${table(['Route ID', 'Agency / line', 'Mode', 'Annual trip records', 'Exact patterns', 'Seen', 'Additional', 'Additional parent sequences'], audit.routes.map(r => [r.routeId, r.agency + ' / ' + r.line, r.mode, count(r.sourceTripRecords), r.patterns, r.representedOnFixtures, r.additionalActivePatterns, r.additionalParentStationPatterns]))}

## Additional bus patterns

All **${busPatterns.length}** additional exact bus patterns are listed below in full stop order. The machine audit retains exact stop IDs and call rules as well as the original source-trip IDs; names here are for reading only. Active-date count and first/last dates do not imply continuous service between those dates. “Known parent sequence” remains a comparison, not geometry approval.

${table(['Pattern ID (prefix)', 'Route / direction', 'Active service dates', 'First / last', 'Known parent sequence', 'Complete ordered calls'], busPatterns.map(p => [p.id.slice(0, 16), p.routeId + ' / ' + p.directionId, p.activeDates.length, p.activeDates[0] + ' / ' + p.activeDates.at(-1), p.parentStationPatternSeenOnFixtures ? 'yes' : 'no', p.stopCalls.map(c => names.get(c.id).replaceAll('|', '\\|')).join(' → ')]))}

## Preserved sources, dates and attribution

- [Annual source catalogue](../data/zug-annual-sources/sources.json): SHA-256 **${audit.sourceSha256}**. CSV values are retained without changes; serialization and gzip encoding are deterministic. Each file records its retained and national row count, original ZIP entry size/CRC and retained-file SHA-256.
- [Annual machine audit](../data/zug-annual-audit.json.gz): every complete platform pattern, source trip/service membership, active dates, date counts, parent-station comparison, fixture admission results and proposed date assignments.
- [National GTFS archive](${audit.source.archiveUrl}): release **${audit.source.feed.feed_version}**, archive SHA-256 **${audit.source.archiveSha256}**. This is the same pinned archive used by the regional feed. It was reused from a verified local cache; preparation on September 9 is not a newer timetable release.
- [Official Zug boundary](../data/zug-sources/boundary.json): SHA-256 **${audit.source.boundarySha256}**. All national stop records are retained so the entire multipolygon census can be replayed offline; all ${audit.source.scope.cantonStopRecords} contained records and ${audit.source.scope.calledCantonStopRecords} annually called records agree with the original census.
- Credit: **${audit.source.attribution}**; [timetable reuse terms](${audit.source.termsUrl}). Polygon credit: **Quelle: GIS Kanton Zug**. The derived inventory is authored by Gleislicht. No new geometry is taken from these timetable files.

The extractor scans all **${count(audit.source.scope.annualStopTimeRows)} national stop-time rows**, without a route/operator whitelist, and then retains all **${count(audit.source.files.find(f => f.archiveEntry === 'stop_times.txt').rows)} calls** belonging to the selected ${count(s.annualTripRecords)} annual trips. The second pass preserves full cross-canton and foreign journeys and makes no assumption about contiguous trip rows. The checker verifies every route's annual trip count and canton-stop membership against the original inventory, validates original call order/times, and reconstructs both complete civil fixtures.

## Reproduction and limits

Run from the repository root:

\`\`\`sh
python3 scripts/prepare-zug-annual.py /path/to/gtfs_fp2026_20260902.zip data/zug-annual-sources
node scripts/review-zug-annual.mjs
node scripts/review-zug-annual.mjs --check
node scripts/write-zug-annual-audit.mjs
\`\`\`

The first command requires the exact hash-pinned national ZIP; the remaining commands run entirely from retained local evidence. The existing regional checker remains the authority for the two emitted feeds. This annual inventory does not expand their geometry certification, authorize broader platform matching, establish current temporary stops or imply that every service operated as declared.
`
await writeFile('docs/ZUG-ANNUAL-PATTERNS.md', text)
console.log('Wrote docs/ZUG-ANNUAL-PATTERNS.md after full annual source replay')
