import type { NetworkSnapshot, NetworkTrain } from '@motionstudies/core/domain/network'
// Station roots and route identities are from the retained Jungfrau source audit.
// These are approach diagrams; they do not assert a timed or guaranteed connection.
const approaches = [
  { id: 'wengen', stops: ['7492','7384','7372','7374','7361','7364'], routes: ['91-62-j26-1','93-63-j26-1','93-63-j26-1','93-65-j26-1','93-65-j26-1'] },
  { id: 'grindelwald', stops: ['7492','7380','7376','7374','7361','7364'], routes: ['91-61-j26-1','93-64-j26-1','93-64-j26-1','93-65-j26-1','93-65-j26-1'] },
  { id: 'eiger', stops: ['7492','5226','7361','7364'], routes: ['91-61-j26-1','93-244-4-j26-1','93-65-j26-1'] },
] as const
const sourceRoutes: Record<string, [string, number]> = { '91-61-j26-1': ['35',106], '91-62-j26-1': ['35',106], '93-63-j26-1': ['157',116], '93-64-j26-1': ['157',116], '93-65-j26-1': ['124',116], '93-244-4-j26-1': ['200',1300] }
const root = (id: string | undefined) => id?.match(/^ch:1:sloid:(\d+)/)?.[1]
export function jungfrauGuide(network: NetworkSnapshot) {
  return approaches.map(approach => {
    const stops = approach.stops.map(id => {
      const indices = network.stops.flatMap((s,i) => root(s[4]) === id ? [i] : [])
      return { id, name: network.stops[indices[0]]?.[2], indices }
    })
    const available = stops.every(s => s.name) && approach.routes.every((route,i) => network.trains.some(t => {
      const source = t as NetworkTrain & { routeId?: string; agencyId?: string; routeType?: number }
      if (source.routeId !== route || source.agencyId !== sourceRoutes[route][0] || source.routeType !== sourceRoutes[route][1]) return false
      const from = t.stops.findIndex(s => stops[i].indices.includes(s[0])), to = t.stops.findIndex(s => stops[i+1].indices.includes(s[0]))
      return from >= 0 && to > from
    }))
    return { id: approach.id, stops, available }
  })
}
