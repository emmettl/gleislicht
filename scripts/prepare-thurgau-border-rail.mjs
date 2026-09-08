import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { borderSha, thurgauBorderGraph } from './thurgau-border-rail.mjs'
const dir = 'data/thurgau-border-rail-sources', input = process.argv[2]
await mkdir(dir, { recursive: true })
const specs = [
  ['osm.json.gz', 'thurgau-bregenz-osm.json', 'https://overpass-api.de/api/interpreter'],
  ['query.txt', 'thurgau-bregenz-rail.overpass', null],
  ['vogis-capabilities.xml.gz', 'thurgau-vogis-capabilities.xml', 'https://vogis.cnv.at/geoserver/wfs?service=WFS&request=GetCapabilities&version=2.0.0'],
  ['vogis-rail.json.gz', 'thurgau-vogis-rail.json', 'https://vogis.cnv.at/geoserver/wfs?service=WFS&request=GetFeature&version=2.0.0&typeNames=vogis:bahnlinie&outputFormat=application/json&srsName=EPSG:4326&count=10000'],
  ['vogis-metadata.xml.gz', 'thurgau-vogis-metadata.xml', 'https://vogis.cnv.at/geonetwork/srv/eng/csw?request=GetRecordById&service=CSW&version=2.0.2&outputSchema=http://www.isotc211.org/2005/gmd&ElementSetName=full&id=2d77b3dd-9040-47d2-b1ce-8b738a236984'],
  ['oebb-geonet.html.gz', 'thurgau-oebb-geonet.html', 'https://data.oebb.at/de/datensaetze~geo-netz~'],
  ['oebb-upgrade.html.gz', 'thurgau-oebb-upgrade.html', 'https://infrastruktur.oebb.at/en/projekte-fuer-oesterreich/bahnstrecken/arlbergstrecke-innsbruck-bregenz/ausbau-st-margrethen-lauterach'],
]
const files = []
for (const [file, original, url] of specs) {
  if (input) { const bytes = await readFile(`${input}/${original}`); await writeFile(`${dir}/${file}`, file.endsWith('.gz') ? gzipSync(bytes, { mtime: 0 }) : bytes) }
  files.push({ file, url, sha256: borderSha(await readFile(`${dir}/${file}`)), retrieved: '2026-09-08' })
}
const source = { publisher: 'OpenStreetMap contributors', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0',
  termsUrl: 'https://www.openstreetmap.org/copyright', snapshot: '2026-09-02T00:00:00Z', acquired: '2026-09-08', files,
  model: 'Shortest connected standard-gauge main/branch and explicitly main-track crossover OSM rail path between exact UIC station identities and bounded original platform projections. Original OSM node IDs define connectivity. No sidings, yards, spurs, coordinate merges or running-track certification.',
  alternatives: { vogis: '136 original source records inventoried; CC BY 4.0 in dataset metadata, digitised from 2012 imagery. Known 2013 Rhine alignment change prevents treating this as verified contemporary border alignment.',
    oebb: 'GeoNetz 12-2024 catalogue states validity through 2025-12-13; no geometry admitted from that expired release.' } }
await writeFile(`${dir}/sources.json`, JSON.stringify(source, null, 2) + '\n')
const policy = { sourceSha256: borderSha(await readFile(`${dir}/sources.json`)), timetableSha256: borderSha(await readFile('data/thurgau-audit/timetable-cache.json.gz')),
  snapshot: source.snapshot, route: { routeId: '91-7-B-j26-1', agencyId: '65', line: 'S7' },
  stations: [{ nodeId: 4886725252, number: '8506314', name: 'St. Margrethen SG' }, { nodeId: 2459480034, number: '8102336', name: 'Bregenz' }],
  limits: { stationIdentityMetres: 350, trackAttachmentMetres: 60, projectionAlternativeMetres: 5, maximumPathMetres: 18000, maximumTurnDegrees: 120 },
  scope: 'Only the exact St. Margrethen–Bregenz pair within a reviewed whole S7 pattern. Preserve all successful FOT/SBB segments and every previously complete pattern. Each resulting full pattern must pass; keep original stops and timestamps.' }
await writeFile('data/thurgau-border-rail-policy.json', JSON.stringify(policy, null, 2) + '\n')
const network = thurgauBorderGraph(JSON.parse(gunzipSync(await readFile(`${dir}/osm.json.gz`))), policy)
const vogis = JSON.parse(gunzipSync(await readFile(`${dir}/vogis-rail.json.gz`)))
assert.equal(vogis.numberMatched, vogis.features.length); assert.equal(vogis.numberReturned, vogis.features.length)
const inventory = { osm: network.inventory, vogis: vogis.features.map(f => ({ id: f.id, properties: f.properties, decision: [2, 3, 4, 5, 6, 7, 8, 15, 16, 17].some(id => f.id === `bahnlinie.${id}`) ? 'excluded-unverified-post-2013-border-alignment' : 'outside-reviewed-border-corridor' })) }
await writeFile(`${dir}/inventory.json`, JSON.stringify(inventory, null, 2) + '\n')
console.log({ ways: inventory.osm.length, eligibleWays: inventory.osm.filter(w => !w.reason).length, vogisRecords: vogis.features.length })
