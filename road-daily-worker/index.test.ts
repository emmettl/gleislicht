import { expect, it, vi } from 'vitest'
import { archiveIO } from './index.ts'

it('writes derived gzip objects and never accepts a raw recording write', async () => {
  const put = vi.fn(async () => ({}))
  const io = archiveIO({ put } as unknown as R2Bucket)
  await expect(io.write('astra/national/source.json', '{}')).rejects.toThrow('outside')
  expect(put).not.toHaveBeenCalled()
  await io.write('road-history/example.csv.gz', 'date,count\n2026-09-08,12\n')
  const [key, bytes, options] = put.mock.calls[0] as unknown as [string, ArrayBuffer, R2PutOptions]
  expect(key).toBe('road-history/example.csv.gz')
  expect(options.httpMetadata).toMatchObject({ contentType: 'text/csv', contentEncoding: 'gzip' })
  expect(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()).toBe('date,count\n2026-09-08,12\n')
})

const object = (date: string, etag: string) => ({ etag, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ serviceDate: date })).buffer })
it('uses an atomic conditional update and refuses to move latest backwards', async () => {
  const get = vi.fn(async () => object('2026-09-08', 'before'))
  const put = vi.fn(async () => ({}))
  const io = archiveIO({ get, put } as unknown as R2Bucket)
  await io.promote('road-history/latest.json', { serviceDate: '2026-09-07', manifestKey: 'old' })
  expect(put).not.toHaveBeenCalled()
  await io.promote('road-history/latest.json', { serviceDate: '2026-09-09', manifestKey: 'new' })
  expect(put).toHaveBeenCalledWith('road-history/latest.json', expect.any(String), expect.objectContaining({ onlyIf: { etagMatches: 'before' } }))
})

it('re-reads the pointer after a competing publication wins', async () => {
  const get = vi.fn().mockResolvedValueOnce(object('2026-09-07', 'before')).mockResolvedValueOnce(object('2026-09-10', 'newer'))
  const put = vi.fn(async () => null)
  const io = archiveIO({ get, put } as unknown as R2Bucket)
  await io.promote('road-history/latest.json', { serviceDate: '2026-09-08', manifestKey: 'older' })
  expect(put).toHaveBeenCalledOnce()
  expect(get).toHaveBeenCalledTimes(2)
})
