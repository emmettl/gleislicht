import assert from 'node:assert/strict'
import { serviceDate } from './service-date.mjs'

export function previousServiceDate(date) {
  serviceDate(date)
  return new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

export function civilTripInstance(id, stops, metadata, offset, date) {
  assert(offset === 0 || offset === -86400, 'Unsupported service-day offset')
  assert(stops.every(stop => stop.arrival >= 0 && stop.departure < 172800), 'Civil-day import supports GTFS times below 48:00; more preceding service days are required')
  const sourceServiceDate = offset ? previousServiceDate(date) : date
  return {
    id: offset ? `service:${sourceServiceDate}:${encodeURIComponent(id)}` : id,
    stops: stops.map(stop => ({ ...stop, arrival: stop.arrival + offset, departure: stop.departure + offset })),
    metadata: { ...metadata, sourceTripId: metadata.frequency?.sourceTripId ?? id, sourceServiceDate,
      ...(metadata.frequency ? { frequency: { ...metadata.frequency, startTime: metadata.frequency.startTime + offset, endTime: metadata.frequency.endTime + offset } } : {}) },
  }
}
