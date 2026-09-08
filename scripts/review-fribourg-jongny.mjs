import { readFile, writeFile } from 'node:fs/promises'
import { distanceMetres } from './enrich-postbus-roads.mjs'
const json = async f => JSON.parse(await readFile(f))
const audit = await json('data/fribourg-audit/jongny.json'), cache = (await json('data/fribourg-road-cache.json')).agencies['876']
const id = audit.assessments[0].contributingPatterns[0], identity = cache.identities[id]
const index = identity.stops.findIndex(s => s[4] === audit.policy.stops[0][4])
const rejected = cache.cache.paths[cache.cache.patterns[id][index]], reviewed = audit.geometry.path, cantonal = audit.cantonalComparison[0].diagnosticPath
const all = [...reviewed, ...rejected, ...cantonal], west = Math.min(...all.map(p => p[0])), north = Math.max(...all.map(p => p[1]))
const width = (Math.max(...all.map(p => p[0])) - west) * 0.684, height = north - Math.min(...all.map(p => p[1]))
const scale = Math.min(1060 / width, 340 / height), dx = (1220 - width * scale) / 2, dy = 155 + (340 - height * scale) / 2
const xy = p => [dx + (p[0] - west) * 0.684 * scale, dy + (north - p[1]) * scale]
const path = ps => ps.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
const draw = (ps, color, stroke, extra = '') => `<path d="${path(ps)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" ${extra}/>`
const markers = audit.policy.stops.map((s, i) => {
  const [x, y] = xy(s)
  return `<circle cx="${x}" cy="${y}" r="5" fill="#143c58" stroke="white" stroke-width="2"/><text x="${x - (i ? 215 : 110)}" y="${y + (i ? 28 : -16)}" font-size="17" font-weight="bold">${i ? 'Cure d’Attalens · platform 4' : 'Jongny, Châtillon · platform 2'}</text>`
}).join('')
const rejectedLength = rejected.slice(1).reduce((n, p, i) => n + distanceMetres(rejected[i], p), 0)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="685" viewBox="0 0 1220 685"><rect width="1220" height="685" fill="#f1f5f7"/><g font-family="Arial, sans-serif" fill="#253c4d"><text x="28" y="40" font-size="26" font-weight="bold">VMCV 213 / 216 / 217 · Jongny downhill source review</text><text x="28" y="72" font-size="16">Grey: cantonal curve, 2,003.7 m · blue: reviewed OSM route chain, ${audit.geometry.lengthMetres.toFixed(1)} m</text><text x="28" y="99" font-size="15">Red dashed: rejected pfaedle path, ${rejectedLength.toFixed(1)} m · north up · all original calls and coordinates retained</text>${draw(cantonal, '#b7c2ca', 8)}${draw(reviewed, '#19759a', 3)}${draw(rejected, '#c85f48', 2, 'stroke-dasharray="7 5"')}${markers}<text x="28" y="551" font-size="16">Ten connected road ways; all three j26 route relations agree. Twelve full patterns tested; seven contain this pair.</text><text x="28" y="580" font-size="14">Dedicated 2.05 km ceiling; general detour limits unchanged. Original cantonal and pfaedle failures remain in the audit.</text><text x="28" y="609" font-size="14">Inferred centreline geometry; road direction tags checked, but actual running lanes and temporary access are not certified.</text><text x="28" y="648" font-size="12">Source: Etat de Fribourg · © OpenStreetMap contributors / ODbL 1.0 · timetable: opentransportdata.swiss</text><text x="28" y="670" font-size="12">OSM API snapshot acquired 8 September 2026; individual edit timestamps are retained, and physical survey vintage remains unknown.</text></g></svg>`
await writeFile('docs/assets/fribourg-jongny.svg', svg)
console.log('Generated Jongny source and rejected-matcher comparison')
