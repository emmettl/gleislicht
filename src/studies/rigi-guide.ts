import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
import weggisEvidence from '../../data/rigi-weggis-interchange-source.json'

// Coordinates are editorial schematic positions, never map or walking geometry.
export const RIGI_GUIDE_STOPS = [
  { id: 'kulm', source: 'ch:1:sloid:5069', x: 200, y: 25 },
  { id: 'staffel', source: 'ch:1:sloid:5068', x: 200, y: 90 },
  { id: 'kaltbadRail', source: 'ch:1:sloid:5074', x: 70, y: 160 },
  { id: 'klosterli', source: 'ch:1:sloid:5066', x: 330, y: 160 },
  { id: 'kaltbadCable', source: 'ch:1:sloid:30687', x: 200, y: 225 },
  { id: 'krabel', source: 'ch:1:sloid:5064', x: 330, y: 230 },
  { id: 'vitznau', source: 'ch:1:sloid:8464', x: 70, y: 300 },
  { id: 'weggisCable', source: 'ch:1:sloid:30388', x: 200, y: 300 },
  { id: 'arth', source: 'ch:1:sloid:5063', x: 330, y: 300 },
  { id: 'weggisPier', source: 'ch:1:sloid:8463', x: 200, y: 370 },
  { id: 'luzern', source: 'ch:1:sloid:8492', x: 70, y: 430 },
] as const
export type RigiGuideId = typeof RIGI_GUIDE_STOPS[number]['id']
type SourceTrain = NetworkTrain & { agencyId?: string; routeType?: number; routeId?: string }
type Link = { from: RigiGuideId; to: RigiGuideId; mode: 'vitznau' | 'arth' | 'boats' | 'cable' | 'walk'; path: string }
const links: Link[] = [
  { from: 'kulm', to: 'staffel', mode: 'vitznau', path: 'M197 25V90' },
  { from: 'kulm', to: 'staffel', mode: 'arth', path: 'M203 25V90' },
  { from: 'staffel', to: 'kaltbadRail', mode: 'vitznau', path: 'M197 90L70 160' },
  { from: 'kaltbadRail', to: 'vitznau', mode: 'vitznau', path: 'M70 160V300' },
  { from: 'staffel', to: 'klosterli', mode: 'arth', path: 'M203 90L330 160' },
  { from: 'klosterli', to: 'krabel', mode: 'arth', path: 'M330 160V230' },
  { from: 'krabel', to: 'arth', mode: 'arth', path: 'M330 230V300' },
  { from: 'kaltbadCable', to: 'weggisCable', mode: 'cable', path: 'M200 225V300' },
  { from: 'luzern', to: 'weggisPier', mode: 'boats', path: 'M70 430H200V370' },
  { from: 'weggisPier', to: 'vitznau', mode: 'boats', path: 'M200 370H70V300' },
  { from: 'kaltbadRail', to: 'kaltbadCable', mode: 'walk', path: 'M70 160L200 225' },
  { from: 'weggisCable', to: 'weggisPier', mode: 'walk', path: 'M200 300V370' },
]
function matchesSource(id: string | undefined, source: string) {
  return id === source || id?.startsWith(`${source}:`) || id?.startsWith(`${source}_gen:`)
}
function matchesMode(t: SourceTrain, mode: Link['mode']) {
  if (mode === 'boats') return t.agencyId === '185' && t.routeType === 1000
  if (mode === 'cable') return t.agencyId === '13700' && t.routeType === 1300
  return t.agencyId === '137' && t.routeType === 116 && (mode === 'arth' ? t.routeId === '93-81-j26-1' : ['93-82-j26-1', '93-88-j26-1'].includes(t.routeId ?? ''))
}
export function rigiGuide(network: NetworkSnapshot) {
  const nodes = RIGI_GUIDE_STOPS.flatMap(node => {
    const indices = network.stops.flatMap((stop, i) => matchesSource(stop[4], node.source) ? [i] : [])
    const trains = network.trains.filter(train => train.stops.some(stop => indices.includes(stop[0])))
    return indices.length && trains.length ? [{ ...node, name: network.stops[indices[0]][2], indices, calls: trains.length }] : []
  })
  const byId = new Map(nodes.map(n => [n.id, n]))
  const datedTransfers = network.metadata.serviceDate === weggisEvidence.serviceDate && network.metadata.feedVersion === weggisEvidence.feedVersion && (network.metadata as unknown as { sources?: { timetable?: { sha256?: string } } }).sources?.timetable?.sha256 === weggisEvidence.sha256
  return {
    nodes,
    links: links.filter(link => {
      const from = byId.get(link.from), to = byId.get(link.to)
      if (!from || !to) return false
      if (link.mode === 'walk') return datedTransfers
      return network.trains.some(train => matchesMode(train, link.mode) && train.stops.some(s => from.indices.includes(s[0])) && train.stops.some(s => to.indices.includes(s[0])))
    }),
  }
}
