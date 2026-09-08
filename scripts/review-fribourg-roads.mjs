import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { roadConsensus } from './luzern-road-geometry.mjs'
import { FRIBOURG_ROAD_LIMITS } from './fribourg-road-geometry.mjs'
import { bernWgs84 } from './bern-spatial.mjs'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const roads = roadConsensus(await json('data/fribourg-road-cache.json'), FRIBOURG_ROAD_LIMITS)
const report = await json('data/fribourg-audit/2026-09-04.json'), routes = await json('data/fribourg-audit/routes.json')
const source = JSON.parse(gunzipSync(await readFile('data/fribourg-sources/decoded.json.gz')))
const panels = ['1', '2', '3', '4'].map((line, i) => {
  const route = routes.find(r => r.agencyId === '834' && r.name === line)
  const official = source.lines.filter(f => route.sourceLines.includes(String(f.properties.OBJECTID))).flatMap(f => f.geometry.coordinates.map(p => p.map(bernWgs84)))
  const pairs = report.directedPairs.filter(p => p.routeId === route.id && p.geometrySource === 'osm-road-inference')
  const inferred = pairs.map(p => roads.get(JSON.stringify([p.routeId, p.fromId, p.toId])).path)
  const points = [...official, ...inferred].flat(), xs = points.map(p => p[0] * 0.684), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxY = Math.max(...ys), width = Math.max(...xs) - minX, height = maxY - Math.min(...ys)
  const scale = Math.min(510 / width, 335 / height), dx = 30 + (510 - width * scale) / 2, dy = 64 + (335 - height * scale) / 2
  const xy = p => [(p[0] * 0.684 - minX) * scale + dx, (maxY - p[1]) * scale + dy]
  const path = p => p.map((q, j) => `${j ? 'L' : 'M'}${xy(q).map(n => n.toFixed(2)).join(',')}`).join(' ')
  const draw = (paths, color, stroke) => paths.map(p => `<path d="${path(p)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`).join('')
  const day = route.days[0]
  const gap = report.directedPairs.filter(p => p.routeId === route.id && !p.matched)
  const markers = inferred.flatMap(p => [p[0], p.at(-1)]).map(p => `<circle cx="${xy(p)[0]}" cy="${xy(p)[1]}" r="2" fill="#ae4b12"/>`).join('')
  return `<g transform="translate(${20 + (i % 2) * 590},${98 + Math.floor(i / 2) * 465})"><rect width="570" height="445" rx="10" fill="white" stroke="#cbd5df"/><text x="24" y="32" font-size="21" font-weight="bold">TPF ${line}</text><text x="116" y="31" font-size="14">Friday: ${day.admittedTrips}/${day.trips} journeys admitted</text>${draw(official, '#9aaaba', 2.4)}${draw(inferred, '#e97924', 1.9)}${markers}<text x="24" y="426" font-size="13">${pairs.length} inferred directed pairs; ${gap.length} unresolved directed pairs</text></g>`
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="1060" viewBox="0 0 1220 1060"><rect width="1220" height="1060" fill="#edf2f6"/><g font-family="Arial, sans-serif" fill="#203246"><text x="24" y="35" font-size="25" font-weight="bold">Fribourg bus geometry review · 4 September 2026</text><text x="24" y="61" font-size="15">Grey: cantonal source lines. Orange: accepted road fallback, including pairs in excluded journeys.</text><text x="24" y="82" font-size="13">North up · separate panel scales · inferred paths and bounded platform connectors; physical direction is not certified.</text>${panels.join('')}<text x="24" y="1042" font-size="12">Source: Etat de Fribourg · © OpenStreetMap contributors / ODbL 1.0 · timetable: opentransportdata.swiss</text></g></svg>`
await mkdir('docs/assets', { recursive: true })
await writeFile('docs/assets/fribourg-road-review.svg', svg)
console.log('Generated four urban bus corridor review panels')
