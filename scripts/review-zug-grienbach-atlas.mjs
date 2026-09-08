import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './download-luzern-sources.mjs'
import { distanceMetres } from './enrich-postbus-roads.mjs'

// Atlas exports semicolon CSV, including quoted delimiters and line breaks.
// Stream records from the retained text; do not build the national object table.
export function* atlasCsvRecords(text) {
  let row = [], value = '', quoted = false, closed = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { value += '"'; i++ } else { quoted = false; closed = true }
      } else value += c
    } else if (c === ';' || c === '\n' || c === '\r') {
      row.push(value); value = ''; closed = false
      if (c !== ';') {
        if (c === '\r' && text[i + 1] === '\n') i++
        if (row.length > 1 || row[0] !== '') yield row
        row = []
      }
    } else if (c === '"') {
      assert(value === '' && !closed, 'Malformed atlas CSV quote'); quoted = true
    } else {
      assert(!closed, 'Text after closing atlas CSV quote'); value += c
    }
  }
  assert(!quoted, 'Unterminated atlas CSV quote')
  if (row.length || value !== '' || closed) { row.push(value); yield row }
}

export function selectAtlasPlatforms(text, source) {
  const records = atlasCsvRecords(text), header = records.next().value
  assert.deepEqual(header, source.fields, 'Changed atlas export fields')
  const stationIndex = header.indexOf('number'), selected = []
  assert(stationIndex >= 0)
  let rowCount = 0
  for (const values of records) {
    assert.equal(values.length, header.length, 'Incomplete atlas CSV record'); rowCount++
    if (source.stationNumbers.includes(values[stationIndex])) selected.push(Object.fromEntries(header.map((field, i) => [field, values[i]])))
  }
  assert.equal(rowCount, source.rowCount, 'Incomplete national atlas inventory')
  assert.equal(selected.length, source.selectedRows, 'Incomplete atlas station selection')
  return selected
}

export function compareAtlasPlatforms(rows, source, raw) {
  assert.deepEqual(raw.dates, source.dates, 'Changed atlas fixture dates')
  const stops = raw.stops.filter(s => source.stationNumbers.includes(s.didok)).sort((a, b) => a.stop_id.localeCompare(b.stop_id))
  assert.equal(stops.length, 6, 'Incomplete GTFS platform scope')
  assert.deepEqual([...new Set(rows.map(r => r.sloid))].sort(), stops.map(s => s.stop_id).sort(), 'Atlas/GTFS SLOID inventory differs')
  return stops.map(stop => {
    const versions = rows.filter(r => r.sloid === stop.stop_id).sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    assert.equal(versions.length, 2, 'Changed platform validity history')
    for (const r of versions) {
      assert(r.number === stop.didok && r.trafficPointElementType === 'BOARDING_PLATFORM' && r.status === 'VALIDATED', 'Wrong atlas platform identity/status')
      assert.equal(r.servicePointBusinessOrganisationNumber, '839', 'Wrong platform data owner')
      assert.equal(r.servicePointBusinessOrganisation, 'ch:1:sboid:100638')
      assert.equal(r.parentSloidServicePoint, stop.stop_id.split(':').slice(0, 4).join(':'))
      assert(r.wgs84East !== '' && r.wgs84North !== '' && Number.isFinite(+r.wgs84East) && Number.isFinite(+r.wgs84North))
      assert(/^\d{4}-\d{2}-\d{2}$/.test(r.validFrom) && /^\d{4}-\d{2}-\d{2}$/.test(r.validTo) && r.validFrom <= r.validTo)
    }
    const gtfsCoordinates = [+stop.stop_lon, +stop.stop_lat]
    const days = raw.dates.map(date => {
      const active = versions.filter(r => r.validFrom <= date && date <= r.validTo)
      assert.equal(active.length, 1, 'Ambiguous or absent date-valid atlas platform')
      const r = active[0], coordinates = [+r.wgs84East, +r.wgs84North], gapMetres = distanceMetres(gtfsCoordinates, coordinates)
      assert(gapMetres <= source.maximumGtfsGapMetres, 'Atlas coordinate agreement needs fresh review')
      return { date, validFrom: r.validFrom, validTo: r.validTo, creationDate: r.creationDate, editionDate: r.editionDate,
        editedBeforeFixture: r.editionDate.slice(0, 10) <= date, coordinates, gapMetres,
        compassDirection: r.compassDirection === '' ? null : Number(r.compassDirection) }
    })
    return { stopId: stop.stop_id, name: stop.stop_name, didok: stop.didok, gtfsCoordinates, versions, days,
      unchangedCoordinatesAcrossVersions: versions.every(r => r.wgs84East === versions[0].wgs84East && r.wgs84North === versions[0].wgs84North) }
  })
}

// Evidence only: no route matcher, corrected stop or admission API is exposed.
export async function reviewZugGrienbachAtlas(policy, previousPolicy, raw, timetableHash) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed atlas review catalogue')
  const source = JSON.parse(bytes), files = new Map()
  assert.equal(source.timetableSha256, timetableHash, 'Changed atlas review timetable')
  assert.equal(source.platformReviewSourceSha256, previousPolicy.sourceSha256, 'Changed preceding platform review')
  for (const file of source.files) {
    const content = await readFile(join(policy.sourceDirectory, file.file))
    assert.equal(sha256(content), file.sha256, `Changed atlas review evidence ${file.file}`)
    files.set(file.file, file.file.endsWith('.gz') ? gunzipSync(content) : content)
  }
  const full = files.get('full-world-traffic-point.csv.gz')
  assert.equal(full.length, source.fullExportBytes); assert.equal(sha256(full), source.fullExportSha256)
  const catalogue = files.get('catalogue.html.gz').toString()
  assert(catalogue.includes(source.downloadUrl) && catalogue.includes(source.resourceModified), 'Missing atlas publication evidence')
  const cookbook = files.get('cookbook.html.gz').toString()
  assert(cookbook.includes('compassDirection') && cookbook.includes('BOARDING_PLATFORM') && cookbook.includes('full'))
  const rows = selectAtlasPlatforms(full.toString(), source)
  assert.deepEqual(rows, JSON.parse(files.get('platform-rows.json')), 'Atlas extraction differs from full source')
  const platforms = compareAtlasPlatforms(rows, source, raw)
  assert(platforms.every(p => p.unchangedCoordinatesAcrossVersions && p.days.every(d => d.compassDirection === null && d.editedBeforeFixture)), 'Changed atlas finding needs review')
  const routeId = '92-604-B-j26-1', grienbach = 'ch:1:sloid:93448:0:1', vzug = 'ch:1:sloid:87279:0:1'
  const affected = raw.snapshots.map(day => ({ date: day.date, trips: day.trains.filter(t => t.routeId === routeId && t.calls.some((c, i) => c.id === grienbach && t.calls[i + 1]?.id === vzug)).length }))
  assert.deepEqual(affected.map(d => d.trips), [67, 38], 'Changed atlas unresolved trip scope')
  return { source, platforms, affected, maximumGapMetres: Math.max(...platforms.flatMap(p => p.days.map(d => d.gapMetres))),
    admittedFromReview: 0, coordinateCorrections: 0, conclusion: source.decision }
}
