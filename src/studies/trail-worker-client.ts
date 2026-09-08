import { trailDataChunks, type TrailBuffers, type TrailDataset } from './trail-worker-data'

const emptyFrame = (): TrailBuffers => ({ positions: [], colors: [], counts: [0, 0, 0] })
type Request = { type: 'frame'; revision: number; time: number; ids: string[] }

/** One in-flight calculation and one latest request; never accumulate stale work. */
export class TrailWorkerClient {
  private worker?: Worker
  private timer?: ReturnType<typeof setTimeout>
  private ready = false
  private busy = false
  private revision = 0
  private key?: object
  private visibility = ''
  private time = -Infinity
  private pending?: Request
  private frame?: TrailBuffers

  get available() { return this.ready }

  reset(data: () => TrailDataset) {
    this.dispose()
    // Layout transitions replace projected paths repeatedly. Clone their data
    // once they settle, while the existing synchronous path remains available.
    this.timer = setTimeout(() => {
      try {
        const worker = new Worker(new URL('./trail.worker.ts', import.meta.url), { type: 'module' })
        this.worker = worker
        worker.onerror = event => {
          event.preventDefault()
          if (worker === this.worker) this.dispose()
        }
        worker.onmessage = (event: MessageEvent<{ type: string; revision: number; frame: TrailBuffers }>) => {
          if (worker !== this.worker) return
          if (event.data.type === 'ready') { this.ready = true; return }
          this.busy = false
          if (event.data.revision === this.revision) this.frame = event.data.frame
          this.dispatch()
        }
        worker.postMessage({ type: 'init-start' })
        const chunks = trailDataChunks(data())
        const send = () => {
          if (worker !== this.worker) return
          try {
            const start = performance.now()
            do {
              const part = chunks.next()
              if (part.done) { worker.postMessage({ type: 'init-done' }); return }
              worker.postMessage({ type: 'init-part', data: part.value })
            } while (performance.now() - start < 4)
            this.timer = setTimeout(send, 0)
          } catch { this.dispose() }
        }
        send()
      } catch {
        this.dispose()
      }
    }, 200)
  }

  select(key: object, visibility = '') {
    if (this.key === key && this.visibility === visibility) return
    this.key = key
    this.visibility = visibility
    this.invalidate()
  }

  private invalidate() {
    this.revision++
    this.pending = undefined
    this.frame = emptyFrame()
    this.time = -Infinity
  }

  submit(time: number, ids: string[]) {
    if (time === this.time) return
    // Backwards scrubbing / day wrap must not display a result from the future.
    // Large forward seeks also discard old work; ordinary playback stays smooth.
    if (time < this.time || time - this.time > 240) this.invalidate()
    this.time = time
    this.pending = { type: 'frame', revision: this.revision, time, ids }
    this.dispatch()
  }

  private dispatch() {
    if (!this.ready || this.busy || !this.pending || !this.worker) return
    const pending = this.pending
    this.pending = undefined
    this.busy = true
    try { this.worker.postMessage(pending) } catch { this.dispose() }
  }

  takeFrame() {
    const frame = this.frame
    this.frame = undefined
    return frame
  }

  dispose() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.worker?.terminate()
    this.worker = undefined
    this.ready = false
    this.busy = false
    this.invalidate()
  }
}
