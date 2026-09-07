export type GtfsRow = Record<string, string>
export type TransportMode = 'tram' | 'metro' | 'rail' | 'bus' | 'ferry' | 'cableway' | 'funicular'
export interface SourceStop { name: string; latitude: number; longitude: number; platformCode: string }
export function parseCsvLine(line: string): string[]
export function parseGtfsTime(value: string): number
export function weekdayField(date: string): string
export function transportModeForRouteType(value: string | number): TransportMode | undefined
/** Streams a ZIP entry using the host's unzip executable. */
export function rowsFromArchive(archive: string, fileName: string): AsyncGenerator<GtfsRow>
export function activeServices(archive: string, serviceDate: string): Promise<Set<string>>
export function stopsById(archive: string): Promise<Map<string, SourceStop>>
