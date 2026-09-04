export type ProjectedPathPoint = readonly [x: number, y: number, z: number]

export interface ProjectedNetworkPath {
  readonly points: readonly ProjectedPathPoint[]
  readonly cumulativeDistances: readonly number[]
  readonly length: number
}

export function prepareProjectedPath(
  points: readonly ProjectedPathPoint[],
): ProjectedNetworkPath {
  const cumulativeDistances = [0]
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    length += Math.hypot(
      current[0] - previous[0],
      current[1] - previous[1],
      current[2] - previous[2],
    )
    cumulativeDistances.push(length)
  }
  return { points, cumulativeDistances, length }
}

export function pointAlongProjectedPath(
  path: ProjectedNetworkPath,
  progress: number,
): ProjectedPathPoint | undefined {
  if (!path.points.length) return undefined
  if (path.points.length === 1 || path.length === 0) return path.points[0]

  const clampedProgress = Math.min(1, Math.max(0, progress))
  const targetDistance = clampedProgress * path.length
  let lowerBound = 1
  let upperBound = path.cumulativeDistances.length - 1
  while (lowerBound < upperBound) {
    const middle = Math.floor((lowerBound + upperBound) / 2)
    if (path.cumulativeDistances[middle] < targetDistance) {
      lowerBound = middle + 1
    } else {
      upperBound = middle
    }
  }
  const upperIndex = lowerBound

  const lowerIndex = upperIndex - 1
  const lowerDistance = path.cumulativeDistances[lowerIndex]
  const upperDistance = path.cumulativeDistances[upperIndex]
  const segmentProgress =
    upperDistance === lowerDistance
      ? 0
      : (targetDistance - lowerDistance) / (upperDistance - lowerDistance)
  const from = path.points[lowerIndex]
  const to = path.points[upperIndex]
  return [
    from[0] + (to[0] - from[0]) * segmentProgress,
    from[1] + (to[1] - from[1]) * segmentProgress,
    from[2] + (to[2] - from[2]) * segmentProgress,
  ]
}
