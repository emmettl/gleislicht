import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { distanceMetres } from './enrich-postbus-roads.mjs'
import { sha256 } from './download-luzern-sources.mjs'

export function zugMountainGeometry(response, policy) {
  const features = response.results
  assert.equal(features.length, 3, 'Changed mountain source inventory')
  assert.equal(new Set(features.map(f => f.id)).size, 3)
  for (const f of features) {
    assert.equal(f.layerBodId, 'ch.bav.seilbahnen-bundeskonzession')
    assert.equal(f.properties.anlagenr, policy.installation)
    assert.equal(f.properties.betreiber_tuabkuerzung, policy.operator)
  }
  const line = features.find(f => f.id === policy.featureId)
  assert.equal(line?.geometry.type, 'LineString')
  assert.equal(line.properties.bahntyp, 'Standseilbahn')
  const coordinates = line.geometry.coordinates
  assert(coordinates.length >= 2 && coordinates.every(p => p.length === 2 && p.every(Number.isFinite)))
  const stations = policy.stationFeatureIds.map((id, i) => {
    const f = features.find(f => f.id === id)
    assert.equal(f?.geometry.type, 'Point')
    assert.equal(String(f.properties.bp_nummer), policy.operatingPointIds[i])
    assert.deepEqual(f.geometry.coordinates, i === 0 ? coordinates[0] : coordinates.at(-1), 'Station is not the source line endpoint')
    return f
  })
  assert.equal(new Set(policy.operatingPointIds).size, 2)
  return {
    inventory: features.map(f => ({ id: f.id, geometryType: f.geometry.type, properties: f.properties })),
    matchPair(route, from, to) {
      if (route.routeId !== policy.routeId || route.agencyId !== policy.agencyId || route.line !== policy.line || route.routeType !== policy.routeType) return { reason: 'no-reviewed-mountain-geometry' }
      const a = policy.operatingPointIds.indexOf(from.didok), b = policy.operatingPointIds.indexOf(to.didok)
      const evidence = { geometrySource: 'fot-funicular', sourceFeatures: [`cableway:${line.id}`], installation: policy.installation }
      if (a < 0 || b < 0 || a === b) return { ...evidence, reason: 'mountain-operating-point-identity' }
      const start = [Number(from.stop_lon), Number(from.stop_lat)], end = [Number(to.stop_lon), Number(to.stop_lat)]
      const attachments = [distanceMetres(start, stations[a].geometry.coordinates), distanceMetres(end, stations[b].geometry.coordinates)]
      if (!attachments.every(m => Number.isFinite(m) && m <= policy.stationAttachmentMetres)) return { ...evidence, reason: 'mountain-station-attachment', attachmentMetres: attachments }
      // Preserve the full official curve; only its order follows the source calls.
      const path = [start, ...(a === 0 ? coordinates : [...coordinates].reverse()), end].map(p => [...p])
      const lengthMetres = path.slice(1).reduce((n, p, i) => n + distanceMetres(path[i], p), 0), directMetres = distanceMetres(start, end)
      if (lengthMetres < 1 || lengthMetres > Math.max(policy.detourFloorMetres, policy.detourRatio * directMetres)) return { ...evidence, reason: 'mountain-detour' }
      return { ...evidence, path, lengthMetres, directMetres, attachmentMetres: attachments, operatingPointIds: [from.didok, to.didok] }
    },
  }
}

export async function loadZugMountain(policy) {
  const bytes = await readFile(join(policy.sourceDirectory, 'sources.json'))
  assert.equal(sha256(bytes), policy.sourceSha256, 'Changed mountain source catalogue')
  const source = JSON.parse(bytes)
  for (const file of source.files) assert.equal(sha256(await readFile(join(policy.sourceDirectory, file.file))), file.sha256, `Changed mountain source ${file.file}`)
  const response = JSON.parse(await readFile(join(policy.sourceDirectory, 'identify.json')))
  return { ...zugMountainGeometry(response, policy), source }
}
