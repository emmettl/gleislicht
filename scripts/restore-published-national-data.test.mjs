import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readPublishedNationalData } from './restore-published-national-data.mjs'

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
  const requested = []
  const fetchData = async (url) => {
    requested.push(url.href)
    const value = documents[url.pathname.replace('/gleislicht/data/', '')]
    return new Response(value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value), { status: value === undefined ? 404 : 200 })
  }
  return { documents, descriptor, fetchData, requested }
}

describe('published national timetable recovery', () => {
  it('preserves the original bytes, dates and feed while recovering the complete set', async () => {
    const fixture = published()
    const result = await readPublishedNationalData(fixture.fetchData)
    expect(result).toMatchObject({ serviceDate: '2026-09-07', feedVersion: '20260905' })
    expect(result.files.size).toBe(4)
    expect(result.files.get(fixture.descriptor.path).toString()).toBe(fixture.documents[fixture.descriptor.path])
  })

  it('rejects inconsistent metadata before loading chunks', async () => {
    const fixture = published()
    fixture.documents['swiss-hub-day.json'].metadata = { serviceDate: '2026-09-06', feedVersion: '20260905' }
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('mixed service dates')
    expect(fixture.requested).toHaveLength(3)
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
    expect(fixture.requested).toHaveLength(3)
    fixture.descriptor.path = 'swiss-rail-day-chunks/00-24.json'
    fixture.descriptor.windowEnd = 43_200
    await expect(readPublishedNationalData(fixture.fetchData)).rejects.toThrow('do not cover 24 hours')
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
