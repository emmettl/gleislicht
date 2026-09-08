import { afterEach, expect, it, vi } from 'vitest'
import { TrailWorkerClient } from './trail-worker-client'
import type { TrailBuffers, TrailDataset } from './trail-worker-data'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage?: (event: { data: unknown }) => void
  onerror?: (event: { preventDefault: () => void }) => void
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  receive(data: unknown) { this.onmessage?.({ data }) }
}
const data: TrailDataset = { trains: [], stops: [], paths: [], detours: [], colors: [] }
const frame: TrailBuffers = { positions: [new Float32Array([1, 2, 3])], colors: [], counts: [1, 0, 0] }

function start() {
  vi.useFakeTimers()
  vi.stubGlobal('Worker', FakeWorker)
  const client = new TrailWorkerClient()
  client.reset(() => data)
  vi.advanceTimersByTime(200)
  const worker = FakeWorker.instances.at(-1)!
  worker.receive({ type: 'ready' })
  worker.postMessage.mockClear()
  client.takeFrame()
  return { client, worker }
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); FakeWorker.instances = [] })

it('yields during initialization and cancels remaining chunks on teardown', () => {
  vi.useFakeTimers()
  vi.stubGlobal('Worker', FakeWorker)
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now += 5)
  const client = new TrailWorkerClient()
  client.reset(() => ({ ...data, stops: Array(300).fill([0, 0, 0]) }))
  vi.advanceTimersByTime(200)
  const worker = FakeWorker.instances[0]
  expect(worker.postMessage.mock.calls.map(call => call[0].type)).toEqual(['init-start', 'init-part'])
  client.dispose()
  vi.runAllTimers()
  expect(worker.postMessage).toHaveBeenCalledTimes(2)
  expect(worker.terminate).toHaveBeenCalledOnce()
})

it('keeps one in-flight job and only the latest pending time', () => {
  const { client, worker } = start()
  client.submit(100, ['a'])
  client.submit(101, ['a'])
  client.submit(102, ['b'])
  expect(worker.postMessage).toHaveBeenCalledTimes(1)
  const first = worker.postMessage.mock.calls[0][0]
  worker.receive({ type: 'frame', revision: first.revision, frame })
  expect(client.takeFrame()).toEqual(frame)
  expect(worker.postMessage.mock.calls[1][0]).toMatchObject({ time: 102, ids: ['b'] })
  client.submit(102, ['b'])
  expect(worker.postMessage).toHaveBeenCalledTimes(2)
})

it('rejects old selection and seek results and clears their geometry', () => {
  const { client, worker } = start()
  client.select({})
  client.submit(500, ['a'])
  const old = worker.postMessage.mock.calls[0][0]
  client.select({})
  client.submit(100, ['b'])
  worker.receive({ type: 'frame', revision: old.revision, frame })
  expect(client.takeFrame()?.counts).toEqual([0, 0, 0])
  const next = worker.postMessage.mock.calls[1][0]
  worker.receive({ type: 'frame', revision: next.revision, frame })
  expect(client.takeFrame()).toEqual(frame)
  client.submit(900, ['b'])
  expect(client.takeFrame()?.counts).toEqual([0, 0, 0])
})

it('debounces layout changes, ignores terminated workers and falls back on failure', () => {
  const { client, worker } = start()
  client.reset(() => data)
  client.reset(() => data)
  expect(worker.terminate).toHaveBeenCalledOnce()
  worker.receive({ type: 'ready' })
  expect(client.available).toBe(false)
  vi.advanceTimersByTime(200)
  expect(FakeWorker.instances).toHaveLength(2)
  const replacement = FakeWorker.instances[1]
  replacement.receive({ type: 'ready' })
  expect(client.available).toBe(true)
  replacement.onerror?.({ preventDefault: vi.fn() })
  expect(client.available).toBe(false)
  expect(replacement.terminate).toHaveBeenCalledOnce()
  client.dispose()
})
