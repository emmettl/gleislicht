import { createTrailBuilder, type TrailDataset } from './trail-worker-data'

let build: ReturnType<typeof createTrailBuilder> | undefined
type MutableDataset = { [K in keyof TrailDataset]: Array<TrailDataset[K][number]> }
const emptyDataset = (): MutableDataset => ({ trains: [], stops: [], paths: [], detours: [], colors: [] })
let incoming = emptyDataset()
self.onmessage = (event: MessageEvent<
  { type: 'init-start' | 'init-done' } |
  { type: 'init-part'; data: Partial<TrailDataset> } |
  { type: 'frame'; revision: number; time: number; ids: string[] }
>) => {
  const message = event.data
  if (message.type === 'init-start') {
    incoming = emptyDataset()
    build = undefined
  } else if (message.type === 'init-part') {
    incoming.trains.push(...(message.data.trains ?? []))
    incoming.stops.push(...(message.data.stops ?? []))
    incoming.paths.push(...(message.data.paths ?? []))
    incoming.detours.push(...(message.data.detours ?? []))
    incoming.colors.push(...(message.data.colors ?? []))
  } else if (message.type === 'init-done') {
    build = createTrailBuilder(incoming)
    incoming = emptyDataset()
    self.postMessage({ type: 'ready' })
  } else if (message.type === 'frame' && build) {
    const frame = build(message.time, message.ids)
    self.postMessage({ type: 'frame', revision: message.revision, time: message.time, frame },
      { transfer: [...frame.positions, ...frame.colors].map(array => array.buffer) })
  }
}
