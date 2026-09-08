import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { NetworkTrain } from '@motionstudies/core/domain/network'
import { positionForTrain } from '../src/studies/train-position'
import { trailPosition, createTrailBuilder, trailDataChunks, type TrailDataset } from '../src/studies/trail-worker-data'

type Point = readonly [number, number, number]
type Path = { points: readonly Point[]; cumulativeDistances: number[]; length: number }
const pathsSource = readFileSync('node_modules/@motionstudies/three/network-paths.js', 'utf8')
const sceneSource = readFileSync('node_modules/@motionstudies/three/NationalNetworkScene.js', 'utf8')
const originalSource = sceneSource.slice(sceneSource.indexOf('function projectedTrainPosition('), sceneSource.indexOf('function NationalGround('))
const { prepareProjectedPath, original } = new Function('positionForTrain', `
  ${pathsSource.replaceAll('export ', '')}
  const EMPTY_LAKE_AVOIDING_PATHS = new Map();
  const THREE = { MathUtils: { lerp: (x, y, t) => (1 - t) * x + t * y } };
  const lakeAvoidingPathForStops = (paths, from, to) => paths.get(from + ':' + to);
  ${originalSource}
  return { prepareProjectedPath, original: projectedTrainPosition };
`)(positionForTrain) as {
  prepareProjectedPath: (points: readonly Point[]) => Path
  original: (train: NetworkTrain, time: number, stops: readonly Point[], paths: readonly Path[], detours: Map<string, Path>) => Point | undefined
}

function compare(train: NetworkTrain, stops: readonly Point[], paths: readonly Path[], times: number[], detours = new Map<string, Path>()) {
  const fallback = (t: NetworkTrain, time: number) => original(t, time, stops, paths, detours)
  const sample = (time: number) => trailPosition(train, time, stops, paths, detours)
  for (const time of times) {
    const expected = fallback(train, time), actual = sample(time)
    if (!expected) expect(actual, `time ${time}`).toBeUndefined()
    else {
      expect(actual, `time ${time}`).toBeDefined()
      for (let axis = 0; axis < 3; axis++) expect(actual![axis], `time ${time}, axis ${axis}`).toBeCloseTo(expected[axis], 8)
    }
  }
}

const train: NetworkTrain = { id: 't', route: '1', shortName: '1', headsign: '', category: 'bus', start: 0, end: 100,
  stops: [[0, 0, 10], [1, 40, 50], [2, 80, 90]], pathSegments: [0, 1] }
const stops: Point[] = [[0, 0, 0], [10, 0, 0], [20, 0, 0]]
const paths = [prepareProjectedPath([[0, 0, 0], [2, 1, 3], [5, 0, 4], [10, 0, 0]]),
  prepareProjectedPath([[20, 0, 0], [16, 0, 3], [10, 0, 0]])]

it('keeps the worker protocol aligned with the pinned renderer trail constants', () => {
  const source = readFileSync('node_modules/@motionstudies/three/vehicle-trails.js', 'utf8')
  const times = new Function(`${source.replaceAll('export ', '')}; return vehicleTrailSampleTimes(200);`)()
  expect(times).toEqual([200, 155, 110, 65])
})

it('splits initialization without changing record order, paths or colors', () => {
  const data: TrailDataset = { trains: Array(300).fill(train), stops: Array(500).fill(stops[0]),
    paths: Array(300).fill(paths[0]), detours: [['0:1', paths[0]]], colors: Array(300).fill([1, 0.5, 0]) }
  const assembled: Record<string, unknown[]> = { trains: [], stops: [], paths: [], detours: [], colors: [] }
  let count = 0
  for (const part of trailDataChunks(data)) {
    count++
    for (const [key, values] of Object.entries(part)) {
      expect(values.length).toBeLessThanOrEqual(128)
      assembled[key].push(...values)
    }
  }
  expect(count).toBeGreaterThan(5)
  expect(assembled).toEqual(data)
})

it('preserves curved and reversed paths, dwells, boundary instants and backwards seeks', () => {
  const times = [-1, 101, ...Array.from({ length: 501 }, (_, i) => i / 5), NaN]
  compare(train, stops, paths, times.reverse())
})

it('preserves missing geometry, detours, degenerate paths and unusual timetables', () => {
  const times = [-1, 0, 10, 10.01, 20, 40, 40.01, 50, 80, 90, 100, 101]
  compare(train, stops, [], times, new Map([['0:1', paths[0]]]))
  compare(train, stops, [prepareProjectedPath([]), prepareProjectedPath([[20, 0, 1]])], times)
  compare(train, stops, [prepareProjectedPath([[0, 0, 0], [0, 0, 0]])], times)
  compare({ ...train, stops: [[0, 0, 10], [1, 10, 10], [2, 10, 10]] }, stops, paths, times)
  compare({ ...train, stops: [[0, 0, 10], [1, 5, 8], [2, 11, 20]] }, stops, paths, times)
  compare({ ...train, stops: [[0, 0, 10], [1, 10.5, 11]] }, stops, paths, [...times, 10.2, 10.5])
  compare(train, stops.slice(0, 1), paths, times)
  compare({ ...train, realtime: { status: 'cancelled', delaySeconds: 0, skippedStops: 0, generatedAt: '' } }, stops, paths, times)
})

it('matches real PostBus trip geometry at stop boundaries and trail times', () => {
  const manifest = JSON.parse(readFileSync('public/data/postbus-national-day-manifest.json', 'utf8'))
  const chunk = JSON.parse(readFileSync('public/data/postbus-national-day-chunks/06-09.json', 'utf8'))
  const projectedStops = manifest.stops.map((stop: number[]) => [stop[0], 0, stop[1]] as Point)
  const projectedPaths = manifest.paths.map((path: number[][]) => prepareProjectedPath(path.map(point => [point[0], 0, point[1]])))
  for (const trip of (chunk.trains as NetworkTrain[]).filter((_, i) => i % 97 === 0)) {
    const times = trip.stops.flatMap(stop => [stop[1] - .01, stop[1], stop[1] + .01, stop[2], stop[2] + .01])
    for (let time = trip.start; time <= trip.end; time += 37) times.push(time, time - 45, time - 90, time - 135)
    compare(trip, projectedStops, projectedPaths, times.reverse())
  }
})

it('builds exactly the same three trail buffers as the installed renderer', () => {
  const data = { trains: [train], stops, paths, detours: [], colors: [[0.2, 0.5, 0.8]] }
  const longTrip = { ...train, start: 0, end: 1000, stops: [[0, 0, 10], [1, 400, 500], [2, 800, 900]] as const }
  data.trains = [longTrip]
  const build = createTrailBuilder(data)
  for (const time of [0, 60, 300, 500, 850, 990, 1100]) {
    const expected = { positions: Array.from({ length: 3 }, () => new Float32Array(6)), colors: Array.from({ length: 3 }, () => new Float32Array(6)), counts: [0, 0, 0] }
    const points = [0, 45, 90, 135].map(offset => original(longTrip, time - offset, stops, paths, new Map()))
    for (let i = 0; i < 3; i++) {
      const current = points[i], previous = points[i + 1]
      if (!current || !previous || (current[0] - previous[0]) ** 2 + (current[2] - previous[2]) ** 2 < 0.000001) continue
      expected.positions[i].set(current); expected.positions[i].set(previous, 3)
      expected.colors[i].set([0.2, 0.5, 0.8, 0.2, 0.5, 0.8])
      expected.counts[i]++
    }
    expect(build(time, [longTrip.id])).toEqual(expected)
  }
  expect(build(300, []).counts).toEqual([0, 0, 0])
})
