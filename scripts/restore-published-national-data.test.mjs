import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readPublishedNationalData, restorePublishedNationalData } from './restore-published-national-data.mjs'

function published() {
  const metadata = { serviceDate: '2026-09-07', feedVersion: '20260905', windowStart: 0, windowEnd: 86_400 }
  const topology = { stops: [[0, 0, 'A']], edges: [[0, 0]], paths: [[[0, 0]]], edgePaths: [0] }
  const chunk = JSON.stringify({ windowStart: 0, windowEnd: 86_400, trains: [{ id: 'service', stops: [[0, 0, 0], [0, 60, 60]] }] })
  const descriptor = { path: 'swiss-rail-day-chunks/00-24.json', windowStart: 0, windowEnd: 86_400, tripCount: 1, bytes: Buffer.byteLength(chunk), sha256: createHash('sha256').update(chunk).digest('hex') }
  const documents = {
    'swiss-rail-morning.json': { metadata, ...topology, trains: [{ id: 'service' }] },
    'swiss-rail-day-manifest.json': { metadata, ...topology, chunks: [descriptor] },
    'swiss-hub-day.json': { metadata, hubs: Object.fromEntries(['zurich', 'bern', 'basel', 'geneva'].map((id) => [id, [{}]])) },
    [descriptor.path]: chunk,
  }
  // A small synthetic national dataset that passes the real production audit.
  const busStops = [[8, 47, 'A', '', 'a'], [8.01, 47, 'B', '', 'b']]
  const buses = Array.from({ length: 10001 }, (_, i) => ({ id: `bus-${i}`, category: 'bus',
    routeId: `route-${i % 501}`, start: 1, end: 61, stops: [[0, 1, 1], [1, 61, 61]], pathSegments: [0] }))
  const busChunks = Array.from({ length: 8 }, (_, i) => {
    const path = `postbus-national-day-chunks/${String(i * 3).padStart(2, '0')}-${String(i * 3 + 3).padStart(2, '0')}.json`
    const payload = { windowStart: i * 10800, windowEnd: (i + 1) * 10800, trains: i ? [] : buses }
    const bytes = JSON.stringify(payload)
    documents[path] = bytes
    return { id: String(i), path, windowStart: payload.windowStart, windowEnd: payload.windowEnd,
      tripCount: payload.trains.length, bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex') }
  })
  documents['postbus-national-day-manifest.json'] = {
    metadata: { ...metadata, localAgencyIds: ['801'], modes: ['bus'], geometry: {
      publisher: 'OpenStreetMap contributors', license: 'ODbL-1.0', sourceSha256: 'a'.repeat(64),
      matchedSegments: buses.length, totalSegments: buses.length,
    } },
    stops: busStops, edges: [[0, 1]], edgePaths: [0], tripCount: buses.length,
    paths: Array.from({ length: 10001 }, () => busStops.map(stop => stop.slice(0, 2))), chunks: busChunks,
  }
  const requested = []
  const fetchData = async (url) => {
    requested.push(url.href)
    const value = documents[url.pathname.replace('/gleislicht/data/', '')]
    return new Response(value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value), { status: value === undefined ? 404 : 200 })
  }
  return { documents, descriptor, fetchData, requested }
}

describe('published national timetable recovery', () => {
  it('recovers an optional matching cogwheel catalogue and omits a mismatched one', async () => {
    const fixture = published()
    const catalogue = { metadata: fixture.documents['swiss-rail-morning.json'].metadata, routes: { rigi: { id: 'rigi', name: '81', routeType: 116, operator: 'Rigi Bahnen' } }, trips: { service: 'rigi' } }
    fixture.documents['swiss-cogwheel-catalogue.json'] = catalogue
    expect((await readPublishedNationalData(fixture.fetchData)).files.has('swiss-cogwheel-catalogue.json')).toBe(true)
    catalogue.metadata = { ...catalogue.metadata, serviceDate: '2000-01-01' }
    expect((await readPublishedNationalData(fixture.fetchData)).files.has('swiss-cogwheel-catalogue.json')).toBe(false)
  })
  it('preserves the original bytes, dates and feed while recovering the complete set', async () => {
    const fixture = published()
    const result = await readPublishedNationalData(fixture.fetchData)
    expect(result).toMatchObject({ serviceDate: '2026-09-07', feedVersion: '20260905' })
    expect(result.files.size).toBe(13)
    expect(result.files.get(fixture.descriptor.path).toString()).toBe(fixture.documents[fixture.descriptor.path])
  })

  it('rejects inconsistent metadata before loading chunks', async () => {
    const fixture = published()
    fixture.documents['swiss-hub-day.json'].metadata = { serviceDate: '2026-09-06', feedVersion: '20260905' }
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('mixed service dates')
    expect(fixture.requested).toHaveLength(4)
  })

  it('rejects corrupted chunks and missing downloads', async () => {
    const fixture = published()
    fixture.documents[fixture.descriptor.path] += ' '
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('integrity mismatch')
    delete fixture.documents[fixture.descriptor.path]
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('returned 404')
  })

  it('rejects unsafe paths and incomplete day coverage before requesting chunks', async () => {
    const fixture = published()
    fixture.descriptor.path = '../outside.json'
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('unexpected chunk path')
    expect(fixture.requested).toHaveLength(4)
    fixture.descriptor.path = 'swiss-rail-day-chunks/00-24.json'
    fixture.descriptor.windowEnd = 43_200
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('do not cover 24 hours')
  })


  it('rejects missing, mixed-date, unsafe and corrupt PostBus recovery', async () => {
    const fixture = published()
    const bus = fixture.documents['postbus-national-day-manifest.json']
    bus.metadata.serviceDate = '2026-09-08'
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('mixed service dates')
    bus.metadata.serviceDate = '2026-09-07'
    const path = bus.chunks[0].path
    bus.chunks[0].path = '../outside.json'
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('unexpected PostBus chunk path')
    bus.chunks[0].path = path
    fixture.documents[path] += ' '
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow()
    delete fixture.documents[path]
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('returned 404')
  })

  it('rejects published PostBus below 95% even when hashes and reported counts agree', async () => {
    const fixture = published()
    const bus = fixture.documents['postbus-national-day-manifest.json']
    const descriptor = bus.chunks[0]
    const payload = JSON.parse(fixture.documents[descriptor.path])
    for (const train of payload.trains.slice(0, 1000)) train.pathSegments = [null]
    const bytes = JSON.stringify(payload)
    fixture.documents[descriptor.path] = bytes
    descriptor.bytes = Buffer.byteLength(bytes)
    descriptor.sha256 = createHash('sha256').update(bytes).digest('hex')
    bus.metadata.geometry.matchedSegments -= 1000
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('below 95%')
  })

  it('replaces a partial candidate completely only after recovery validates, retaining original dates', async () => {
    const fixture = published()
    const directory = await mkdtemp(join(tmpdir(), 'national-recovery-'))
    try {
      const manifest = join(directory, 'postbus-national-day-manifest.json')
      await writeFile(manifest, 'candidate')
      await mkdir(join(directory, 'postbus-national-day-chunks'))
      await writeFile(join(directory, 'postbus-national-day-chunks/leftover.json'), 'candidate chunk')
      await writeFile(join(directory, 'swiss-cogwheel-catalogue.json'), 'candidate catalogue')
      const path = fixture.documents['postbus-national-day-manifest.json'].chunks[0].path
      const valid = fixture.documents[path]
      fixture.documents[path] += ' '
      await expect(restorePublishedNationalData(directory, fixture.fetchData)).rejects.toThrow()
      expect(await readFile(manifest, 'utf8')).toBe('candidate')
      expect(await readFile(join(directory, 'swiss-cogwheel-catalogue.json'), 'utf8')).toBe('candidate catalogue')
      fixture.documents[path] = valid
      const result = await restorePublishedNationalData(directory, fixture.fetchData)
      for (const [path, bytes] of result.files) expect(await readFile(join(directory, path))).toEqual(bytes)
      expect(JSON.parse(await readFile(manifest, 'utf8')).metadata.serviceDate).toBe('2026-09-07')
      expect(await readdir(join(directory, 'postbus-national-day-chunks'))).toHaveLength(8)
      await expect(readFile(join(directory, 'swiss-cogwheel-catalogue.json'))).rejects.toThrow('ENOENT')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('repairs only the verified legacy geometry transformation', async () => {
    const fixture = published()
    fixture.documents['swiss-rail-day-manifest.json'].metadata.geometry = { publisher: 'Federal Office of Transport (FOT)' }
    const payload = JSON.parse(fixture.documents[fixture.descriptor.path])
    payload.trains[0].pathSegments = [0]
    fixture.documents[fixture.descriptor.path] = JSON.stringify(payload)
    const result = await readPublishedNationalData(fixture.fetchData)
    expect(result.repaired).toBe(1)
    const repaired = JSON.parse(result.files.get('swiss-rail-day-manifest.json').toString()).chunks[0]
    expect(repaired.sha256).toBe(createHash('sha256').update(fixture.documents[fixture.descriptor.path]).digest('hex'))
    expect(repaired.bytes).toBe(Buffer.byteLength(fixture.documents[fixture.descriptor.path]))
    payload.trains[0].pathSegments = [99]
    fixture.documents[fixture.descriptor.path] = JSON.stringify(payload)
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('invalid geometry')
    payload.trains[0].pathSegments = [0]
    payload.trains[0].id = 'a different timetable'
    fixture.documents[fixture.descriptor.path] = JSON.stringify(payload)
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('integrity mismatch')
  })
})
