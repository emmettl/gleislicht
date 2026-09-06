import type { NetworkTrain } from './network.ts'

const DEFAULT_BUCKET_SECONDS = 15 * 60

export interface TrainTimeIndex {
  readonly windowStart: number
  readonly windowEnd: number
  readonly bucketSeconds: number
  readonly buckets: readonly (readonly NetworkTrain[])[]
}

/**
 * Groups trips into coarse time buckets so a full-day renderer only examines
 * services near the current clock time. Padding keeps recent trail samples in
 * the candidate set around trip boundaries.
 */
export function buildTrainTimeIndex(
  trains: readonly NetworkTrain[],
  windowStart: number,
  windowEnd: number,
  paddingSeconds = 0,
  bucketSeconds = DEFAULT_BUCKET_SECONDS,
): TrainTimeIndex {
  const safeBucketSeconds = Math.max(60, bucketSeconds)
  const bucketCount = Math.max(
    1,
    Math.ceil((windowEnd - windowStart) / safeBucketSeconds),
  )
  const buckets = Array.from(
    { length: bucketCount },
    () => [] as NetworkTrain[],
  )

  for (const train of trains) {
    const firstBucket = Math.max(
      0,
      Math.floor((train.start - paddingSeconds - windowStart) / safeBucketSeconds),
    )
    const lastBucket = Math.min(
      bucketCount - 1,
      Math.floor((train.end + paddingSeconds - windowStart) / safeBucketSeconds),
    )
    for (let index = firstBucket; index <= lastBucket; index += 1) {
      buckets[index].push(train)
    }
  }

  return {
    windowStart,
    windowEnd,
    bucketSeconds: safeBucketSeconds,
    buckets,
  }
}

export function trainsNearTime(
  index: TrainTimeIndex,
  time: number,
): readonly NetworkTrain[] {
  const bucket = Math.min(
    index.buckets.length - 1,
    Math.max(0, Math.floor((time - index.windowStart) / index.bucketSeconds)),
  )
  return index.buckets[bucket] ?? []
}
