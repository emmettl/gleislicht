import { afterEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { loadVerifiedJson } from './verified-json.ts'

const body = new TextEncoder().encode('{"value":0,"missing":null}')
const descriptor = { bytes: body.byteLength, sha256: createHash('sha256').update(body).digest('hex') }
const errors = { unavailable: 'Fixture unavailable', integrity: 'Fixture integrity failure' }
const options = (signal = new AbortController().signal, parse = vi.fn((value: unknown) => value)) => ({ signal, parse, errors })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(ready => { resolve = ready })
  return { promise, resolve }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('verifies the original bytes before caller validation, retaining zero and missingness', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(body)), config = options()
  vi.stubGlobal('fetch', fetch)
  expect(await loadVerifiedJson('/fixture.json', descriptor, config)).toEqual({ value: 0, missing: null })
  expect(config.parse).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledWith('/fixture.json', { signal: config.signal })
})

it('rejects a wrong size without hashing or validating it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  const digest = vi.spyOn(crypto.subtle, 'digest'), config = options()
  await expect(loadVerifiedJson('/fixture.json', { ...descriptor, bytes: body.byteLength + 1 }, config)).rejects.toThrow(errors.integrity)
  expect(digest).not.toHaveBeenCalled(); expect(config.parse).not.toHaveBeenCalled()
})

it('rejects same-length corruption before validation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new TextDecoder().decode(body).replace(':0', ':1'))))
  const config = options()
  await expect(loadVerifiedJson('/fixture.json', descriptor, config)).rejects.toThrow(errors.integrity)
  expect(config.parse).not.toHaveBeenCalled()
})

it.each([
  { ...descriptor, bytes: 0 }, { ...descriptor, bytes: NaN }, { ...descriptor, bytes: 1.5 },
  { ...descriptor, sha256: 'not-a-hash' },
])('rejects invalid integrity metadata before requesting data: %j', async invalid => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  await expect(loadVerifiedJson('/fixture.json', invalid, options())).rejects.toThrow(errors.integrity)
  expect(fetch).not.toHaveBeenCalled()
})

it('does not treat verified invalid JSON as valid data', async () => {
  const bytes = new TextEncoder().encode('not JSON')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)))
  const config = options()
  await expect(loadVerifiedJson('/fixture.json', { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }, config)).rejects.toBeInstanceOf(SyntaxError)
  expect(config.parse).not.toHaveBeenCalled()
})

it('preserves schema errors from the caller', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  const error = new Error('Unsupported source schema')
  await expect(loadVerifiedJson('/fixture.json', descriptor, { ...options(), parse: () => { throw error } })).rejects.toBe(error)
})

it('preserves caller HTTP errors and permits an explicit fresh retry', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response(body))
  vi.stubGlobal('fetch', fetch)
  await expect(loadVerifiedJson('/fixture.json', descriptor, options())).rejects.toThrow(errors.unavailable)
  expect(fetch).toHaveBeenCalledOnce()
  expect(await loadVerifiedJson('/fixture.json', descriptor, options())).toEqual({ value: 0, missing: null })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('propagates the original network failure', async () => {
  const error = new TypeError('Network failure')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
  await expect(loadVerifiedJson('/fixture.json', descriptor, options())).rejects.toBe(error)
})

it('does not request an already-cancelled asset', async () => {
  const controller = new AbortController(); controller.abort()
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  await expect(loadVerifiedJson('/fixture.json', descriptor, options(controller.signal))).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetch).not.toHaveBeenCalled()
})

it('ignores a late response even when the transport does not honour abort', async () => {
  const response = deferred<Response>(), controller = new AbortController(), config = options(controller.signal)
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))
  const result = loadVerifiedJson('/fixture.json', descriptor, config)
  controller.abort(); response.resolve(new Response(body))
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  expect(config.parse).not.toHaveBeenCalled()
})

it('stops before hashing if cancelled during body reading', async () => {
  const reading = deferred<ArrayBuffer>(), response = new Response(body), controller = new AbortController()
  const read = vi.spyOn(response, 'arrayBuffer').mockReturnValue(reading.promise), digest = vi.spyOn(crypto.subtle, 'digest')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  const result = loadVerifiedJson('/fixture.json', descriptor, options(controller.signal))
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
  controller.abort(); reading.resolve(body.buffer)
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  expect(digest).not.toHaveBeenCalled()
})

it('does not validate stale data if cancelled during asynchronous hashing', async () => {
  const hashing = deferred<ArrayBuffer>(), controller = new AbortController(), config = options(controller.signal)
  const digest = vi.spyOn(crypto.subtle, 'digest').mockReturnValue(hashing.promise)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
  const result = loadVerifiedJson('/fixture.json', descriptor, config)
  await vi.waitFor(() => expect(digest).toHaveBeenCalledOnce())
  controller.abort(); hashing.resolve(Uint8Array.from(Buffer.from(descriptor.sha256, 'hex')).buffer)
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  expect(config.parse).not.toHaveBeenCalled()
})
