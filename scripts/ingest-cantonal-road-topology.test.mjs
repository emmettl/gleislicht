import { describe, expect, it } from 'vitest'
import { buildCantonalRoadTopology, projectOnRoad, validateGeoCollection } from './ingest-cantonal-road-topology.mjs'
import { lv95ToWgs84 } from './ingest-national-road-topology.mjs'

const origin = [2_680_000, 1_250_000]
const point = (x, y = 0) => [origin[0] + x, origin[1] + y]
const collection = (features) => ({ type: 'FeatureCollection', numberMatched: features.length, crs: { properties: { name: 'urn:ogc:def:crs:EPSG::2056' } }, features })
const road = (number = '17', y = 0, properties = {}, coordinates = [point(0, y), point(1000, y)]) => ({
  properties: { achsnummer: number, achsname: `Route ${number}`, netzname: 'Hauptstrassen nach DgStrVO Kat A mit Nummerntafel', achstypnam: 'Kantonsstrassen', startdista: 0, enddistanz: 1000, ...properties },
  geometry: { type: 'LineString', coordinates },
})
const station = (number = 1019, coordinates = point(500, 2)) => ({ properties: { messst_nr: number, messst_typ: 'permanent' }, geometry: { type: 'Point', coordinates } })
const catalog = {
  metadata: { supplier: 'ZH.CH', sourceSha256: 'test', measurementSiteTableVersion: 23 },
  stations: [{ id: 'ZH.CH:1019', detectorIds: ['ZH.CH:1019.01'] }],
  detectors: [{ id: 'ZH.CH:1019.01', coordinate: null }],
}
const build = (roads, stations = [station()], options) => buildCantonalRoadTopology(catalog, collection(stations), collection(roads), options)

describe('cantonal road geometry and station matching', () => {
  it('uses exact station numbers to recover missing coarse geography without inventing directions', () => {
    const result = build([road()])
    expect(result.stations[0]).toMatchObject({ geometryStatus: 'matched', sourceStationNumber: 1019, match: { road: 'ZH:17', distanceMetres: 2, offsetMetres: 500, directionStatus: 'unresolved' } })
    expect(result.roads[0]).toMatchObject({ label: 'ZH 17', stationCount: 1, sectionCount: 0 })
    expect(result.sites).toEqual([])
    expect(result.sections).toEqual([])
  })

  it('does not snap a missing station ID to a nearby unrelated station', () => {
    expect(build([road()], [station(999) ]).stations[0].geometryStatus).toBe('missing-station')
  })

  it('keeps motorway competitors in the match audit while excluding their displayed geometry', () => {
    const result = build([road('17', 20), road('A1', 2, { netzname: 'Autobahnen und Autostrassen (inkl. Rampen)' })])
    expect(result.stations[0].geometryStatus).toBe('excluded-road-class')
    expect(result.paths.map(({ road: id }) => id)).toEqual(['ZH:17'])
  })

  it('rejects ambiguous parallel roads and large offsets', () => {
    expect(build([road('17'), road('18', 10)]).stations[0].geometryStatus).toBe('ambiguous-road')
    expect(build([road('17', 80)]).stations[0].geometryStatus).toBe('off-network')
  })

  it('rejects an exact ID when the two sources disagree geographically', () => {
    const conflicting = { ...catalog, detectors: [{ id: 'ZH.CH:1019.01', coordinate: lv95ToWgs84(point(9000)) }] }
    const result = buildCantonalRoadTopology(conflicting, collection([station()]), collection([road()]))
    expect(result.stations[0].geometryStatus).toBe('coordinate-conflict')
  })

  it('preserves disconnected parts and bends without manufacturing section links', () => {
    const result = build([road('17', 0, {}, [point(0), point(100, 100), point(200)]), road('17', 0, { startdista: 500, enddistanz: 900 }, [point(500), point(900)])])
    expect(result.paths).toHaveLength(2)
    expect(result.paths[0].points).toHaveLength(3)
    expect(result.sections).toEqual([])
    expect(projectOnRoad(point(100, 100), [point(0), point(100, 100), point(200)])?.offset).toBeCloseTo(Math.sqrt(20000))
  })

  it('fails on truncated downloads, wrong CRS, duplicate stations and invalid coordinates', () => {
    expect(() => validateGeoCollection({ ...collection([road()]), numberMatched: 2 }, 'roads')).toThrow('incomplete')
    expect(() => validateGeoCollection({ ...collection([road()]), crs: undefined }, 'roads')).toThrow('EPSG:2056')
    expect(() => build([road()], [station(), station()])).toThrow('Duplicate precise station')
    expect(() => build([road()], [station(1019, [8.5, 47.3])])).toThrow('Invalid precise station')
    expect(() => build([road(), road()])).toThrow('Duplicate road feature')
  })

  it('retains public lane descriptions by numeric station and detector ID, without interpreting them as bearings', () => {
    const result = build([road()], [station()], { collectors: [{ uID: { id: 'M1019' }, name: 'Town: Main road', collectorStatus: 'ACTIVE', detectors: [{ uID: { id: 'M1019', sub: { id: '1' } }, name: 'Normalspur Richtung Zürich' }] }] })
    expect(result.stations[0].detectorDescriptions).toEqual([{ id: 'ZH.CH:1019.01', description: 'Normalspur Richtung Zürich' }])
    expect(result.stations[0].match.directionStatus).toBe('unresolved')
  })
})
