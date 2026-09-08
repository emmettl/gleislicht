import type { NetworkTrain } from '@motionstudies/core/domain/network'
import { positionForTrain } from './train-position'

export type TrailPoint = readonly [number, number, number]
export interface TrailPath {
  readonly points: readonly TrailPoint[]
  readonly cumulativeDistances: readonly number[]
  readonly length: number
}
export interface TrailDataset {
  trains: readonly NetworkTrain[]
  stops: readonly TrailPoint[]
  paths: readonly TrailPath[]
  detours: readonly (readonly [string, TrailPath])[]
  colors: readonly (readonly number[])[]
}
export interface TrailBuffers {
  positions: Float32Array[]
  colors: Float32Array[]
  counts: number[]
}

/** Batch clones by record and geometry size; a single large record stays intact. */
export function* trailDataChunks(data: TrailDataset): Generator<Partial<TrailDataset>> {
  function* chunks<T>(values: readonly T[], weight: (value: T) => number) {
    let batch: T[] = [], size = 0
    for (const value of values) {
      const cost = weight(value)
      if (batch.length && (size + cost > 1024 || batch.length >= 128)) {
        yield batch
        batch = []; size = 0
      }
      batch.push(value); size += cost
    }
    if (batch.length) yield batch
  }
  for (const trains of chunks(data.trains, train => train.stops.length + 1)) yield { trains }
  for (const stops of chunks(data.stops, () => 1)) yield { stops }
  for (const paths of chunks(data.paths, path => path.points.length + 1)) yield { paths }
  for (const detours of chunks(data.detours, entry => entry[1].points.length + 1)) yield { detours }
  for (const colors of chunks(data.colors, () => 1)) yield { colors }
}

function pathPoint(path: TrailPath, progress: number): TrailPoint | undefined {
  if (!path.points.length) return
  if (path.points.length === 1 || path.length === 0) return path.points[0]
  const distance = Math.min(1, Math.max(0, progress)) * path.length
  let low = 1, high = path.cumulativeDistances.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (path.cumulativeDistances[middle] < distance) low = middle + 1
    else high = middle
  }
  const start = path.cumulativeDistances[low - 1], end = path.cumulativeDistances[low]
  const fraction = end === start ? 0 : (distance - start) / (end - start)
  const from = path.points[low - 1], to = path.points[low]
  return [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction, from[2] + (to[2] - from[2]) * fraction]
}

export function trailPosition(train: NetworkTrain, time: number, stops: readonly TrailPoint[], paths: readonly TrailPath[], detours: ReadonlyMap<string, TrailPath>): TrailPoint | undefined {
  const position = positionForTrain(train, time)
  if (!position) return
  const pathIndex = position.segmentIndex === undefined ? undefined : train.pathSegments?.[position.segmentIndex]
  const path = pathIndex == null ? undefined : paths[pathIndex]
  if (path) {
    const from = stops[position.fromStop]
    const first = path.points[0], last = path.points[path.points.length - 1]
    const distance = (point: TrailPoint) => from
      ? (point[0] - from[0]) ** 2 + (point[1] - from[1]) ** 2 + (point[2] - from[2]) ** 2 : 0
    const reverse = from && first && last && distance(first) > distance(last)
    const point = pathPoint(path, reverse ? 1 - position.progress : position.progress)
    if (point) return [point[0], 0.2, point[2]]
  }
  const detour = detours.get(`${position.fromStop}:${position.toStop}`)
  if (detour) {
    const point = pathPoint(detour, position.progress)
    if (point) return [point[0], 0.2, point[2]]
  }
  const from = stops[position.fromStop], to = stops[position.toStop]
  if (!from || !to) return
  const mix = position.progress
  return [(1 - mix) * from[0] + mix * to[0], 0.2, (1 - mix) * from[2] + mix * to[2]]
}

/** Keep filtering on the main thread, alongside its existing selection/zoom rules. */
export function createTrailBuilder(data: TrailDataset) {
  const trains = new Map(data.trains.map((train, i) => [train.id, { train, color: data.colors[i] }]))
  const detours = new Map(data.detours)
  return (time: number, ids: readonly string[]): TrailBuffers => {
    const positions = Array.from({ length: 3 }, () => new Float32Array(ids.length * 6))
    const colors = Array.from({ length: 3 }, () => new Float32Array(ids.length * 6))
    const counts = [0, 0, 0]
    for (const id of ids) {
      const entry = trains.get(id)
      if (!entry) continue
      const { train, color } = entry
      const samples = [0, 45, 90, 135].map(offset => trailPosition(train, time - offset, data.stops, data.paths, detours))
      for (let i = 0; i < 3; i++) {
        const current = samples[i], previous = samples[i + 1]
        if (!current || !previous || (current[0] - previous[0]) ** 2 + (current[2] - previous[2]) ** 2 < 0.000001) continue
        const offset = counts[i] * 6
        positions[i].set(current, offset)
        positions[i].set(previous, offset + 3)
        colors[i][offset] = colors[i][offset + 3] = color[0]
        colors[i][offset + 1] = colors[i][offset + 4] = color[1]
        colors[i][offset + 2] = colors[i][offset + 5] = color[2]
        counts[i]++
      }
    }
    return { positions, colors, counts }
  }
}
