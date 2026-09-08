import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { serviceDate } from './service-date.mjs'
import { downloadTpg, zvvResource } from './download-regional-sources.mjs'
import { REGIONAL_IDS, readRegionalArtifacts } from './regional-artifacts.mjs'
import { restorePublishedRegionalData } from './restore-published-regional-data.mjs'
import { buildStudySummaries, STUDY_SOURCES } from './build-study-summaries.mjs'
import { STUDY_IDS } from '../src/studies/explore.ts'

function fixture(id = 'zurich-city') {
  const metadata = { serviceDate: '2026-09-08', feedVersion: '20260905', windowStart: 0, windowEnd: 86400,
    geometry: { matchedSegments: 100, totalSegments: 100 }, railGeometry: { matchedSegments: 100, totalSegments: 100, sha256: 'a'.repeat(64) }, sourceHashes: { archive: 'b'.repeat(64), zvv: 'c'.repeat(64) } }
  if (id === 'lausanne-region') Object.assign(metadata, { dayModel: 'civil day with preceding service-day spillover', sourceServiceDates: ['2026-09-07', '2026-09-08'], geometry: { ...metadata.geometry, license: 'ODbL-1.0' }, railGeometry: { ...metadata.railGeometry, maximumSnapMetres: 45 }, lausanneGeometry: ['tl-bus', 'm1', 'm2', 'leb', 'rail'].map(id => ({ id, totalSegments: 100, acceptedSegments: 100 })) })
  const topology = { stops: [[8, 47, 'A'], [8.01, 47.01, 'B']], paths: [[[8, 47], [8.01, 47.01]]], edges: [[0, 1]], edgePaths: [0] }
  const trains = Array.from({ length: 1001 }, (_, i) => ({ id: `${i}`, start: 0, end: 86400, stops: [[0, 0, 0], [1, 86400, 86400]], pathSegments: [0] }))
  const files = new Map()
  const chunks = Array.from({ length: 12 }, (_, i) => {
    const path = `${id}-day-chunks/${String(2 * i).padStart(2, '0')}-${String(2 * i + 2).padStart(2, '0')}.json`
    const chunk = { windowStart: i * 7200, windowEnd: (i + 1) * 7200, trains }
    const bytes = Buffer.from(JSON.stringify(chunk)); files.set(path, bytes)
    return { ...chunk, trains: undefined, path, tripCount: trains.length, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  })
  files.set(`${id}-day-manifest.json`, Buffer.from(JSON.stringify({ metadata, ...topology, chunks, tripCount: trains.length })))
  files.set(`${id}-morning.json`, Buffer.from(JSON.stringify({ metadata: { ...metadata, windowStart: 24300, windowEnd: 31500 }, ...topology, trains })))
  return files
}
const modify = (files, path, edit) => { const value = JSON.parse(files.get(path)); edit(value); files.set(path, Buffer.from(JSON.stringify(value))) }

describe('regional refresh', () => {
  it('uses Swiss civil time and the second Sunday of December for feed rollover', () => {
    expect(serviceDate(undefined, new Date('2026-09-08T23:30:00Z')).date).toBe('2026-09-09')
    expect(serviceDate('2026-12-12').timetableYear).toBe(2026)
    expect(serviceDate('2026-12-13').timetableYear).toBe(2027)
    expect(serviceDate('2027-12-11').timetableYear).toBe(2027)
    expect(serviceDate('2027-12-12').timetableYear).toBe(2028)
    expect(() => serviceDate('2026-02-30')).toThrow()
  })
  it('selects the matching annual ZVV resource and rejects absent or foreign resources', () => {
    const resource = { name: '2026_google_transit.zip', url: 'https://data.stadt-zuerich.ch/dataset/feed.zip' }
    const catalogue = { success: true, result: { resources: [resource] } }
    expect(zvvResource(catalogue, 2026)).toBe(resource.url)
    expect(() => zvvResource(catalogue, 2027)).toThrow('no timetable resource')
    resource.url = 'https://example.org/feed.zip'
    expect(() => zvvResource(catalogue, 2026)).toThrow('Unexpected ZVV source')
  })
  it('fetches every TPG feature in bounded ID batches and rejects partial geometry', async () => {
    let partial = false
    const batches = []
    const fetchData = async url => {
      const p = new URL(url).searchParams
      if (p.has('returnIdsOnly')) return Response.json({ objectIdFieldName: 'OBJECTID', objectIds: Array.from({ length: 201 }, (_, i) => i + 1) })
      const ids = p.get('objectIds').split(',').map(Number); batches.push(ids.length)
      expect(p.get('outSR')).toBe('4326')
      return Response.json({ type: 'FeatureCollection', features: (partial ? ids.slice(1) : ids).map(id => ({ properties: { OBJECTID: id }, geometry: { type: 'LineString', coordinates: [[8, 47], [8.1, 47.1]] } })) })
    }
    expect(JSON.parse(await downloadTpg(fetchData)).features).toHaveLength(201)
    expect(batches).toEqual([200, 1])
    partial = true
    await expect(downloadTpg(fetchData)).rejects.toThrow('missing or duplicating')
  })
  it('validates complete bytes and preserves the service date', async () => {
    const files = fixture()
    const result = await readRegionalArtifacts(path => files.get(path), ['zurich-city'], '2026-09-08')
    expect(result.dates).toEqual({ 'zurich-city': '2026-09-08' })
    // Compare binary contents directly instead of deeply traversing every byte.
    expect([...result.files.keys()].sort()).toEqual([...files.keys()].sort())
    for (const [path, bytes] of files) {
      expect(result.files.get(path).equals(bytes), path).toBe(true)
    }
    await expect(readRegionalArtifacts(path => files.get(path), ['zurich-city'], '2026-09-09')).rejects.toThrow('unexpected service date')
  })
  it('rejects mixed dates, unsafe chunk paths, damaged bytes and bad indices', async () => {
    for (const [path, edit, message] of [
      ['zurich-city-morning.json', v => { v.metadata.serviceDate = '2026-09-07' }, 'mixed service dates'],
      ['zurich-city-day-manifest.json', v => { v.chunks[0].path = '../private.json' }, 'unexpected chunk path'],
      ['zurich-city-day-manifest.json', v => { v.chunks[1].windowStart++ }, 'gaps or overlaps'],
      ['zurich-city-day-manifest.json', v => { v.edgePaths[0] = 99 }, 'invalid edge index'],
      ['zurich-city-day-chunks/00-02.json', v => { v.trains.pop() }, 'integrity mismatch'],
    ]) {
      const files = fixture(); modify(files, path, edit)
      await expect(readRegionalArtifacts(path => files.get(path), ['zurich-city'])).rejects.toThrow(message)
    }
  })
  it('does not overwrite any output when published recovery is incomplete', async () => {
    const output = await mkdtemp(join(tmpdir(), 'regional-recovery-test-'))
    try {
      await writeFile(join(output, 'keep.json'), 'previous bytes')
      const files = new Map(REGIONAL_IDS.flatMap(id => [...fixture(id)]))
      files.delete('geneva-tpg-day-chunks/22-24.json')
      await expect(restorePublishedRegionalData(output, async url => {
        const bytes = files.get(url.pathname.replace('/gleislicht/data/', ''))
        return new Response(bytes ?? '', { status: bytes ? 200 : 404 })
      })).rejects.toThrow('returned 404')
      expect(await readdir(output)).toEqual(['keep.json'])
      expect(await readFile(join(output, 'keep.json'), 'utf8')).toBe('previous bytes')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
  it('derives browser dates from each actual artifact, including an older retained region', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'study-summary-test-'))
    try {
      for (const [id, file] of STUDY_SOURCES) await writeFile(join(directory, file), JSON.stringify({ metadata: { serviceDate: id === 'geneva-tpg' ? '2026-09-04' : '2026-09-08', windowStart: 0, windowEnd: 86400 } }))
      const summaries = await buildStudySummaries(directory)
      expect(summaries.map(summary => summary.id)).toEqual([...STUDY_IDS])
      expect(summaries.find(summary => summary.id === 'geneva-tpg').date).toBe('2026-09-04')
      expect(summaries.find(summary => summary.id === 'national').date).toBe('2026-09-08')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('bootstraps an unpublished Lausanne from a complete dated fixture, but rejects a damaged published chunk', async () => {
    const output = await mkdtemp(join(tmpdir(), 'lausanne-bootstrap-test-'))
    try {
      const files = new Map(REGIONAL_IDS.filter(id => id !== 'lausanne-region').flatMap(id => [...fixture(id)]))
      const fetchData = async url => { const bytes = files.get(url.pathname.replace('/gleislicht/data/', '')); return new Response(bytes ?? '', { status: bytes ? 200 : 404 }) }
      const result = await restorePublishedRegionalData(output, fetchData)
      expect(result.dates['lausanne-region']).toBe(JSON.parse(await readFile('public/data/lausanne-region-day-manifest.json')).metadata.serviceDate)
      for (const [name, bytes] of fixture('lausanne-region')) files.set(name, bytes)
      files.delete('lausanne-region-day-chunks/22-24.json')
      await expect(restorePublishedRegionalData(output, fetchData)).rejects.toThrow('returned 404')
    } finally { await rm(output, { recursive: true, force: true }) }
  })
})
