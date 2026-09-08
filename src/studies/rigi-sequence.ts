import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import evidence from '../../data/rigi-interchange-source.json'

export { evidence as rigiInterchangeEvidence }
export const MAX_INTERCHANGE_SECONDS = 30 * 60 // Editorial composition limit, not a transfer rule.
export type RigiSequence = {
  id: string; boat: NetworkTrain; rail: NetworkTrain
  start: number; arrival: number; departure: number; end: number
}
export type RigiSequencePhase = 'before' | 'boat' | 'interchange' | 'rail' | 'complete'

export function rigiSequences(network: NetworkSnapshot): RigiSequence[] {
  const metadata = network.metadata as NetworkSnapshot['metadata'] & { sources?: { timetable?: { sha256?: string } } }
  if (metadata.feedVersion !== evidence.feedVersion || metadata.serviceDate !== evidence.serviceDate || metadata.sources?.timetable?.sha256 !== evidence.sha256) return []
  const stopId = (index: number) => network.stops[index]?.[4]
  const valid = (train: NetworkTrain, type: number, agency: string) => {
    const source = train as NetworkTrain & { routeType?: number; agencyId?: string; frequency?: unknown }
    return source.routeType === type && source.agencyId === agency && !source.frequency &&
      train.pathSegments?.length === train.stops.length - 1 && train.pathSegments.every(p => p !== null && (network.paths?.[p]?.length ?? 0) >= 2)
  }
  const rail = network.trains.filter(t => valid(t, 116, '137') && stopId(t.stops[0][0]) === evidence.records[0].to_stop_id && network.stops[t.stops.at(-1)![0]][2] === 'Rigi Kulm').sort((a, b) => a.stops[0][2] - b.stops[0][2])
  return network.trains.filter(t => valid(t, 1000, '185')).flatMap(boat => {
    const boarding = boat.stops.findIndex(s => stopId(s[0])?.startsWith('ch:1:sloid:8492'))
    const alighting = boat.stops.findIndex(s => stopId(s[0]) === evidence.records[0].from_stop_id)
    if (boarding < 0 || alighting <= boarding) return []
    const start = boat.stops[boarding][2], arrival = boat.stops[alighting][1]
    const train = rail.find(t => t.stops[0][2] >= arrival + Number(evidence.records[0].min_transfer_time))
    if (!train || arrival <= start || train.stops[0][2] - arrival > MAX_INTERCHANGE_SECONDS) return []
    return [{ id: boat.id, boat, rail: train, start, arrival, departure: train.stops[0][2], end: train.stops.at(-1)![1] }]
  }).sort((a, b) => a.start - b.start)
}

export function sequencePhase(sequence: RigiSequence, time: number): RigiSequencePhase {
  if (time < sequence.start) return 'before'
  if (time < sequence.arrival) return 'boat'
  if (time < sequence.departure) return 'interchange'
  if (time < sequence.end) return 'rail'
  return 'complete'
}

export function sequenceFocus(sequence: RigiSequence, phase: RigiSequencePhase) {
  if (phase === 'boat') return { trainId: sequence.boat.id, station: undefined }
  if (phase === 'rail') return { trainId: sequence.rail.id, station: undefined }
  return { trainId: undefined, station: phase === 'before' ? 'Luzern Bahnhofquai' : phase === 'complete' ? 'Rigi Kulm' : 'Vitznau' }
}
