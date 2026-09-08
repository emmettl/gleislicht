import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { thurgauLineTokens } from './thurgau-line-geometry.mjs'

export function thurgauCrosswalk(timetable, source) {
  const operatorLabels = { '801': 'PostAuto', '138': 'Bus Ostschweiz', '896': 'REGO' }
  const stops = new Map(timetable.sourceStopInventory.map(s => [s.id, s]))
  const routes = timetable.routes.map(route => {
    const entry = { routeId: route.id, agencyId: route.agencyId, line: route.name, mode: route.mode, featureIds: [] }
    if (route.mode === 'rail' && ['11', '65', '22'].includes(route.agencyId)) {
      const narrow = route.agencyId === '22' && route.name === 'S15'
      entry.featureIds = source.layers.bahnlinie_takt.filter(f => narrow ? f.properties.liniennr === 'S15'
        : route.agencyId !== '22' && !f.properties.liniennr).map(f => f.id).sort()
      entry.method = narrow ? 'Exact AB S15 label; separate Frauenfeld–Wil graph'
        : 'SBB/THURBO regional rail corridor graph, excluding both labelled S15 sections; inferred routing, not line shapes'
      return entry
    }
    if (route.mode !== 'bus' || !operatorLabels[route.agencyId]) {
      entry.exclusionReason = route.mode === 'ferry' ? 'No water-compatible geometry in acquired sources'
        : 'No verified source operator/line identity (includes city, replacement and demand services)'
      return entry
    }
    const expectedCode = `${['605', '806'].includes(route.name) ? '70' : '80'}.${route.name}`
    const didoks = new Set(route.inCantonStops.map(id => stops.get(id)?.didok).filter(Boolean))
    const evidence = source.layers.bushalte.filter(f => f.properties.name_transport === operatorLabels[route.agencyId]
      && thurgauLineTokens(f.properties.linien_nummer).some(t => t.code === expectedCode)
      && didoks.has(f.properties.id_didok))
    entry.expectedCode = expectedCode
    entry.sourceOperatorLabel = operatorLabels[route.agencyId]
    entry.sharedDidoks = [...new Set(evidence.map(f => f.properties.id_didok))].sort()
    entry.evidenceStopIds = evidence.map(f => f.id).sort()
    if (entry.sharedDidoks.length < 2) {
      entry.exclusionReason = 'Fewer than two distinct shared DiDok stops with exact source line and operator label'
      return entry
    }
    const night = /^N\d/.test(route.name)
    entry.featureIds = source.layers.buslinie.filter(f => thurgauLineTokens(f.properties.liniennr_1)
      .some(t => t.code === expectedCode && !t.qualification)
      && (night ? f.properties.betriebszeiten?.includes('Nachtnetz') : f.properties.betriebszeiten?.includes('Tagnetz'))).map(f => f.id).sort()
    entry.method = 'Exact prefixed source number + reviewed operator label + >=2 distinct shared DiDok stops; complete ordered patterns tested separately'
    if (!entry.featureIds.length) entry.exclusionReason = 'No unqualified source geometry for verified identity and day/night class'
    return entry
  })
  return { schemaVersion: 1, expectedAgencyNames: Object.fromEntries(timetable.routes.map(r => [r.agencyId, r.agency])),
    policy: 'No correction of 20.207 or BN820; qualified (evening/occasional/Kantibus) tokens excluded without operating-time evidence. No agency inferred from bus line number alone.',
    routes }
}

if (process.argv[1]?.endsWith('/crosswalk-thurgau.mjs')) {
  const cache = JSON.parse(gunzipSync(await readFile(process.argv[2] ?? '/private/tmp/thurgau-timetable-cache.json.gz')))
  const bytes = await readFile('data/thurgau-sources/decoded.json.gz')
  assert.equal(cache.sourceHashes.source, createHash('sha256').update(bytes).digest('hex'))
  const result = thurgauCrosswalk(cache, JSON.parse(gunzipSync(bytes)))
  await writeFile('data/thurgau-line-crosswalk.json', JSON.stringify(result, null, 2) + '\n')
  console.log(`${result.routes.filter(r => r.featureIds.length).length}/${result.routes.length} routes have source candidates`)
}
