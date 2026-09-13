import { useMemo, type ReactNode } from 'react'
import { formatServiceTime, type NetworkSnapshot, type NetworkTrain } from '@motionstudies/core/domain/network'
import { stationDepartures } from '@motionstudies/core/domain/station-departures'
import { RailStationHeroCard, type RailStationHeroCardProps } from '@motionstudies/web/components/RailStationHeroCard'
import { BusStopHeroCard, type BusStopHeroCardProps } from '@motionstudies/web/components/BusStopHeroCard'
import '@motionstudies/web/transport-hero-cards.css'
import './station-departures-card.css'

export default function StationDeparturesCard({ snapshot, name, time, note, presentation = 'dot-matrix', labels, busLabels, onSelect, selectedId, className, loading, error, until, footerLabel, statusLabels = { cancelled: 'Cancelled', adjusted: 'Updated' } }: {
 snapshot: NetworkSnapshot; name: string; time: number; note: ReactNode
 presentation?: RailStationHeroCardProps['presentation']; labels?: RailStationHeroCardProps['labels']; busLabels?: BusStopHeroCardProps['labels']
 onSelect?: (train: NetworkTrain) => void; selectedId?: string; className?: string; loading?: boolean; error?: string; until?: number; footerLabel?: string; statusLabels?: { cancelled: string; adjusted: string }
}) {
 const calls = useMemo(() => stationDepartures(snapshot, name), [snapshot, name])
 const end = Math.min(snapshot.metadata.windowEnd, until ?? Infinity, time + 3600)
 const rows = Number.isFinite(time) && time >= snapshot.metadata.windowStart && time < end ? calls.filter(row => row.time >= time && row.time < end).slice(0, 12) : []
 const modes = useMemo(() => { const indexes = new Set(snapshot.stops.flatMap((stop, index) => stop[2] === name ? [index] : [])); return snapshot.trains.filter(train => train.stops.some(([index]) => indexes.has(index))).map(train => train.category) }, [snapshot, name])
 const bus = modes.length > 0 && modes.every(mode => mode === 'bus')
 const select = onSelect ? (id: string) => { const row = rows.find(row => row.id === id); const train = snapshot.trains.find(train => train.id === row?.trainId); if (train) onSelect(train) } : undefined
 const common = { note, loading, error, className: `edition-departures-card ${className ?? ''}`, lineCount: 'auto' as const, minRowHeight: presentation === 'sbb' ? 48 : 34, boardHeight: 300, clockLabel: formatServiceTime(time), footerLabel: footerLabel ?? snapshot.metadata.serviceDate,
   onSelectDeparture: select, selectedDepartureId: rows.find(row => row.trainId === selectedId)?.id }
 if (bus) return <BusStopHeroCard {...common} stop={{ name }} labels={busLabels} departures={rows.map(row => ({ id: row.id, route: row.service, destination: row.destination,
   due: row.status === 'cancelled' ? '—' : formatServiceTime(row.time).slice(0, 5), via: row.status === 'scheduled' ? undefined : statusLabels[row.status], tone: row.status === 'cancelled' ? 'warning' : undefined }))} />
 return <RailStationHeroCard {...common} station={{ name }} presentation={presentation} labels={labels} departures={rows.map(row => ({ id: row.id, time: formatServiceTime(row.time).slice(0, 5), destination: row.destination, platform: row.platform, service: row.service,
   serviceCategory: row.category === 'intercity' ? 'intercity' : row.category === 'international' ? 'international' : row.category === 's-bahn' ? 'suburban' : 'regional',
   serviceNote: presentation === 'sbb' ? undefined : row.service,
   expected: row.status === 'scheduled' ? undefined : statusLabels[row.status], tone: row.status === 'cancelled' ? 'warning' : undefined }))} />
}
