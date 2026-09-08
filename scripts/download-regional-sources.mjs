import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { serviceDate } from './service-date.mjs'

const CATALOGUE = 'https://data.stadt-zuerich.ch/api/3/action/package_show?id=vbz_fahrplandaten_gtfs'
const TPG = 'https://vector.sitg.ge.ch/arcgis/rest/services/TPG_LIGNES/FeatureServer/0/query'
export function zvvResource(catalogue, year) {
  const resource = catalogue.result?.resources?.find(resource => resource.name === `${year}_google_transit.zip`)
  if (!catalogue.success || !resource) throw new Error(`ZVV has no timetable resource for ${year}`)
  const url = new URL(resource.url)
  if (url.protocol !== 'https:' || url.hostname !== 'data.stadt-zuerich.ch') throw new Error('Unexpected ZVV source host')
  return url.href
}
async function request(url, fetchData) {
  let error
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchData(url, { signal: AbortSignal.timeout(180_000) })
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (failure) { error = failure }
  }
  throw error
}
export async function downloadTpg(fetchData = fetch) {
  const query = params => `${TPG}?${new URLSearchParams({ where: '1=1', ...params })}`
  const ids = JSON.parse(await request(query({ returnIdsOnly: 'true', f: 'json' }), fetchData))
  if (!Array.isArray(ids.objectIds) || !ids.objectIds.length || !ids.objectIdFieldName) throw new Error('TPG source returned no feature IDs')
  const wanted = [...new Set(ids.objectIds)].sort((a, b) => a - b)
  const features = []
  // Explicit ID batches avoid silently truncated ArcGIS result pages.
  for (let i = 0; i < wanted.length; i += 200) {
    const result = JSON.parse(await request(query({ objectIds: wanted.slice(i, i + 200).join(','), outFields: '*', outSR: '4326', returnGeometry: 'true', f: 'geojson' }), fetchData))
    if (result.type !== 'FeatureCollection' || !Array.isArray(result.features) || result.exceededTransferLimit) throw new Error('Incomplete TPG geometry response')
    features.push(...result.features)
  }
  const actual = features.map(feature => feature.properties?.[ids.objectIdFieldName] ?? feature.id)
  if (actual.length !== wanted.length || new Set(actual).size !== wanted.length || wanted.some(id => !actual.includes(id))) throw new Error('TPG geometry is missing or duplicating features')
  if (features.some(feature => !['LineString', 'MultiLineString'].includes(feature.geometry?.type))) throw new Error('Unexpected TPG geometry')
  return Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }))
}
export async function downloadRegionalSources(output, date, fetchData = fetch) {
  const { timetableYear } = serviceDate(date)
  await mkdir(output, { recursive: true })
  const catalogue = JSON.parse(await request(CATALOGUE, fetchData))
  const sources = {
    'swiss-gtfs.zip': `https://data.opentransportdata.swiss/en/dataset/timetable-${timetableYear}-gtfs2020/permalink`,
    'zvv.zip': zvvResource(catalogue, timetableYear),
    'rail.xtf': 'https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf',
  }
  await Promise.all([
    ...Object.entries(sources).map(async ([name, url]) => writeFile(join(output, name), await request(url, fetchData))),
    downloadTpg(fetchData).then(bytes => writeFile(join(output, 'tpg.geojson'), bytes)),
  ])
  await writeFile(join(output, 'sources.json'), JSON.stringify({ ...sources, 'tpg.geojson': TPG }))
  console.log(`Downloaded official regional sources for ${date}`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: download-regional-sources.mjs OUTPUT_DIRECTORY YYYY-MM-DD')
  await downloadRegionalSources(resolve(process.argv[2]), process.argv[3])
}
