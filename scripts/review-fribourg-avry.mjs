import { readFile, writeFile } from 'node:fs/promises'
import { loadFribourgRail } from './fribourg-rail-geometry.mjs'

const json = async f => JSON.parse(await readFile(f))
const config = await json('data/fribourg-policy.json'), rail = await loadFribourgRail(undefined, config.rail)
const { policy, admittedPairs } = rail.avry
const curves = (await json(`${policy.sourceDirectory}/linie-mit-polygon.json`)).results.map(r => r.geo_shape.geometry.coordinates)
const paths = admittedPairs.map(p => rail.pairs.get(p.key).path)
const all = paths.flat(), west = Math.min(...all.map(p => p[0])), north = Math.max(...all.map(p => p[1]))
const scale = Math.min(1050 / ((Math.max(...all.map(p => p[0])) - west) * 0.684), 375 / (north - Math.min(...all.map(p => p[1]))))
const offsetX = (1220 - (Math.max(...all.map(p => p[0])) - west) * 0.684 * scale) / 2
const xy = p => [offsetX + (p[0] - west) * 0.684 * scale, 150 + (north - p[1]) * scale]
const path = points => points.map((p, i) => `${i ? 'L' : 'M'}${xy(p).map(n => n.toFixed(2)).join(',')}`).join(' ')
const draw = (points, color, width) => `<path d="${path(points)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
const marker = (name, point, dx, dy, fill) => { const [x, y] = xy(point); return `<circle cx="${x}" cy="${y}" r="5" fill="${fill}" stroke="white" stroke-width="2"/><text x="${x + dx}" y="${y + dy}" font-size="16" font-weight="bold">${name}</text>` }
const labels = [marker('Neyruz FR · platform 1', paths[0][0], 12, 22, '#256c92'),
  marker('Villars-sur-Glâne · platform 1', paths[1].at(-1), 15, 5, '#256c92'),
  marker('Rosé · 8504028', policy.endpoints[0].coordinate, -28, -22, '#465c6a'),
  marker('Matran · 8504029', policy.endpoints[1].coordinate, -40, 32, '#465c6a'),
  marker('Avry-Matran · 8501632', policy.node.coordinate, -70, -40, '#de681b')].join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="670" viewBox="0 0 1220 670"><rect width="1220" height="670" fill="#f3f6f8"/><g font-family="Arial, sans-serif" fill="#243848"><text x="32" y="42" font-size="26" font-weight="bold">Avry-Matran · exact new operating point, detailed SBB curves</text><text x="32" y="73" font-size="16">Sunday 6 September 2026 · two added SN journeys · Neyruz → Avry → Villars-sur-Glâne</text><text x="32" y="101" font-size="14">North up · blue: admitted pair paths · grey: old FOT Rosé–Matran edge · orange: current SBB curves (287 vertices)</text>${draw(policy.replacedSegment.points, '#adb9c3', 9)}${paths.map(p => draw(p, '#256c92', 3)).join('')}${curves.map(p => draw(p, '#de681b', 3)).join('')}${labels}<text x="32" y="575" font-size="15">The old FOT edge is replaced only in the SN review graph. Rosé and Matran remain infrastructure nodes, not added calls.</text><text x="32" y="603" font-size="14">All original call identities and coordinates are retained. Centreline inference; running tracks and switches are not certified.</text><text x="32" y="637" font-size="12">SBB Infrastructure / data.sbb.ch · © Federal Office of Transport (FOT) · timetable: opentransportdata.swiss</text><text x="32" y="656" font-size="12">SBB curves processed 2026-09-02; FOT catalogue 2021-07-06 · individual geometry survey vintage unknown</text></g></svg>`
await writeFile('docs/assets/fribourg-avry.svg', svg)
console.log('Generated Avry-Matran source geometry review')
