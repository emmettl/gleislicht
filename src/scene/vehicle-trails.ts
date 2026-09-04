export const VEHICLE_TRAIL_SEGMENTS = 3
export const VEHICLE_TRAIL_STEP_SECONDS = 45

export function vehicleTrailSampleTimes(
  time: number,
  segments = VEHICLE_TRAIL_SEGMENTS,
  stepSeconds = VEHICLE_TRAIL_STEP_SECONDS,
): readonly number[] {
  return Array.from({ length: segments + 1 }, (_, index) =>
    time - index * stepSeconds,
  )
}
