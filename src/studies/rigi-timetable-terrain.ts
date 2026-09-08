import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { RigiSequence } from './rigi-sequence.ts'

export type RigiTerrainBinding = {
  corridor: CorridorSnapshot
  sequence: RigiSequence
  calls: { name: string; progress: number; arrival: number; departure: number }[]
}

export function bindRigiTerrain(corridor: CorridorSnapshot, network: NetworkSnapshot, sequence: RigiSequence): RigiTerrainBinding | undefined {
  const source = corridor.metadata?.railSource as { feedVersion?: string; serviceDate?: string; sources?: { timetable?: { sha256?: string } } } | undefined
  const metadata = network.metadata as typeof source
  if (corridor?.id !== 'vitznau-rigi' || !corridor.route?.points?.length || !corridor.terrain?.elevations?.length || source?.serviceDate !== metadata?.serviceDate || source?.feedVersion !== metadata?.feedVersion || !source?.sources?.timetable?.sha256 || source.sources.timetable.sha256 !== metadata?.sources?.timetable?.sha256) return
  if (!Array.isArray(corridor.route.points) || !Array.isArray(corridor.terrain.elevations) || !Array.isArray(corridor.route.stops) || !corridor.route.points.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) || corridor.terrain.elevations.length !== corridor.terrain.columns * corridor.terrain.rows || !corridor.terrain.elevations.every(Number.isFinite)) return
  const progress = new Map(corridor.route.stops.map(s => [s.name, s.progress]))
  const calls = sequence.rail.stops.map(([index, arrival, departure]) => ({ name: network.stops[index][2], progress: progress.get(network.stops[index][2])!, arrival, departure }))
  if (calls.length < 2 || calls[0].name !== 'Vitznau' || calls.at(-1)!.name !== 'Rigi Kulm' || calls.some((call, index) => !Number.isFinite(call.progress) || call.progress < 0 || call.progress > 1 || !Number.isFinite(call.arrival) || !Number.isFinite(call.departure) || call.arrival > call.departure || index > 0 && (call.progress <= calls[index - 1].progress || call.arrival <= calls[index - 1].departure))) return
  return { corridor, sequence, calls }
}

// Scheduled interpolation between mapped station fractions, with exact dwell holds.
// The renderer remains an interpretation of ground beneath the mapped railway.
export function rigiTerrainPosition(binding: RigiTerrainBinding, time: number) {
  const calls = binding.calls
  for (let index = 0; index < calls.length; index++) {
    const call = calls[index], next = calls[index + 1]
    if (time <= call.departure || !next) return { progress: call.progress, stopped: true, from: call.name, to: call.name }
    if (time < next.arrival) return { progress: call.progress + (next.progress - call.progress) * (time - call.departure) / (next.arrival - call.departure), stopped: false, from: call.name, to: next.name }
  }
  return { progress: 1, stopped: true, from: 'Rigi Kulm', to: 'Rigi Kulm' }
}

export function advanceRigiTerrainClock(time: number, elapsedSeconds: number, rate: number, end: number) {
  return Math.min(end, time + Math.max(0, Math.min(0.25, elapsedSeconds)) * rate)
}
