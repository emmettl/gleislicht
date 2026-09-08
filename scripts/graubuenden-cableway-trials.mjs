import assert from 'node:assert/strict'
import { directedPatternKey } from './zug-line-geometry.mjs'
import { sha256 } from './download-luzern-sources.mjs'
import { matchLuzernCableway } from './luzern-cableway-geometry.mjs'

// Review every remaining annual record. Station-number candidates are evidence,
// never an instruction to expand the runtime route allowlist.
export function graubuendenCablewayTrials(raw, network, initial, current) {
  const stops = new Map(raw.stops.map(s => [s.stop_id, s])), previousIds = new Set(initial.routes.map(r => r.routeId))
  return raw.inventory.filter(r => r.mode === 'mountain' && !previousIds.has(r.routeId)).map(route => {
    const trains = raw.snapshots.flatMap(d => d.trains.filter(t => t.routeId === route.routeId)), numbers = [...new Set(trains.flatMap(t => t.calls.map(c => stops.get(c.id).didok)))].sort()
    const candidates = network.installations.filter(i => i.type === 'Luftseilbahn' && i.vehicle === 'Kabine' && numbers.length === 2 && (() => {
      const ss = network.stations.filter(s => s.installation === i.id)
      return ss.length === 2 && numbers.every(n => ss.some(s => s.number === n))
    })())
    const base = { routeId: route.routeId, agencyId: route.agencyId, line: route.line, routeType: route.routeType, dates: raw.snapshots.map(d => ({ date: d.date, candidates: d.trains.filter(t => t.routeId === route.routeId).length })), stopNumbers: numbers, candidateInstallations: candidates.map(i => i.number) }
    if (!trains.length) return { ...base, disposition: 'inactive-on-both-fixtures', patterns: [] }
    if (route.routeType !== 1300 || candidates.length !== 1) return { ...base, disposition: 'needs-vehicle-section-or-station-identity-review', patterns: [] }
    const i = candidates[0], identity = { routeId: route.routeId, agencyId: route.agencyId, line: route.line, sourceOperator: i.operator, segments: [{ installation: i.number, stopNumbers: numbers, sourceStationNumbers: numbers }] }
    const config = { routes: [identity], limits: initial.limits }
    const patterns = [...new Map(trains.map(t => [directedPatternKey(t), t])).entries()].map(([key, t]) => ({ id: sha256(key).slice(0, 20), stopIds: t.calls.map(c => c.id), callRules: t.calls.map(c => [c.pickupType, c.dropOffType]),
      conditional: t.calls.some(c => ['2', '3'].includes(c.pickupType) || ['2', '3'].includes(c.dropOffType)), pairs: t.calls.slice(1).map((call, j) => matchLuzernCableway(network, config, route, stops.get(t.calls[j].id), stops.get(call.id), raw.dates)) }))
    const geometricPass = patterns.every(p => !p.conditional && p.pairs.every(p => p.path))
    const block = current.blockedRoutes.find(b => b.routeId === route.routeId), selected = current.routes.some(r => r.routeId === route.routeId)
    assert(!selected || geometricPass && !block, 'Admission exceeds reviewed geometry or operator context')
    return { ...base, identity, installation: i, patterns, geometricPass, maximumStationAttachmentMetres: Math.max(...patterns.flatMap(p => p.pairs.flatMap(p => p.stationAttachmentsMetres ?? []))),
      disposition: block ? block.reason : selected ? 'admitted-complete-patterns' : geometricPass ? 'numeric-pass-awaiting-operator-review' : 'rejected-unchanged-geometry-limits' }
  })
}
