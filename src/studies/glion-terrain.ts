import type {NetworkSnapshot} from '@motionstudies/core/domain/network'
import {glionDirection, glionJourneys} from './glion.ts'
import {bindRochersTerrain} from './rochers-terrain.ts'
import {bindTerritetTerrain} from './territet-terrain.ts'
import type {MeasuredTerrainBinding} from './measured-terrain.ts'

/** Keep the funicular's own grid, camera scale, branch context and masks. */
export function bindGlionFunicularTerrain(value: unknown, funicular: NetworkSnapshot, railway: NetworkSnapshot, railwayTripId: string): MeasuredTerrainBinding | undefined {
 const direction = glionDirection(railwayTripId)
 if (!direction) return
 const journey = glionJourneys(funicular, railway, direction).find(j => j.connection.railwayTripId === railwayTripId)
 if (!journey) return
 const leg = journey.connection.legs.find(l => l.tripId !== railwayTripId)!
 const train = funicular.trains.find(t => t.id === leg.tripId)
 if (!train) return
 const full = bindTerritetTerrain(value, funicular, train)
 if (!full || full.routes[0].calls.length !== leg.calls.length || !full.routes[0].calls.every((c, i) => c.arrival === leg.calls[i].arrival && c.departure === leg.calls[i].departure)) return
 return full
}

/** Bind the complete source railway first, then retain only the checked combined leg. */
export function bindGlionTerrain(value: unknown, funicular: NetworkSnapshot, railway: NetworkSnapshot, railwayTripId: string): MeasuredTerrainBinding | undefined {
 const direction = glionDirection(railwayTripId)
 if (!direction) return
 const journey = glionJourneys(funicular, railway, direction).find(j => j.connection.railwayTripId === railwayTripId)
 if (!journey) return
 const train = railway.trains?.find(t => t.id === railwayTripId)
 if (!train) return
 const full = bindRochersTerrain(value, railway, train)
 if (!full) return
 const leg = journey.connection.legs.find(l => l.tripId === railwayTripId)!
 const first = train.stops.findIndex(([i]) => railway.stops[i][4] === leg.calls[0].stopId)
 const calls = full.routes[0].calls.slice(first, first + leg.calls.length)
 if (calls.length !== leg.calls.length || !calls.every((c, i) => c.arrival === leg.calls[i].arrival && c.departure === leg.calls[i].departure)) return
 const start = leg.calls[0].departure, end = leg.calls.at(-1)!.arrival
 const windows = full.windows.flatMap(w => {
  const clipped = {...w, start: Math.max(start, w.start), end: Math.min(end, w.end)}
  return clipped.start < clipped.end ? [clipped] : []
 })
 // Keep original progress, XYZ and masks. Re-normalising would change source heights and mask timing.
 return {...full, routes: [{route: full.routes[0].route, calls}], windows}
}
