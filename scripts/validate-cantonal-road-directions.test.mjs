import { describe, expect, it } from 'vitest'
import { buildDirectionTopology, destinationCandidates, directionDestination, orientDestination } from './validate-cantonal-road-directions.mjs'
import { lv95ToWgs84 } from './ingest-national-road-topology.mjs'
const origin = [2680000, 1250000]
const point = (x, y = 0) => [origin[0] + x, origin[1] + y]
const road = [point(-5000), point(10000)]
const place = (name, x, y = 0) => ({ name, coordinate: point(x, y) })
const west = place('Westtown', -4000), east = place('Easttown', 9000)
const places = { metadata: {}, entries: [{ name: west.name, candidates: [west] }, { name: east.name, candidates: [east] }] }
function fixture(offsets = [1000, 3000]) {
  const stations = offsets.map((offset, index) => ({ id: `ZH.CH:${index}`, coordinate: lv95ToWgs84(point(offset)), preciseLv95: point(offset), detectorIds: [`ZH.CH:${index}.01`, `ZH.CH:${index}.02`], match: { pathId: 'path', road: 'ZH:1' }, detectorDescriptions: [{ id: `ZH.CH:${index}.01`, description: 'Normalspur Richtung Easttown' }, { id: `ZH.CH:${index}.02`, description: 'Normalspur Richtung Westtown' }] }))
  const topology = { metadata: { recordingScope: 'zurich-cantonal' }, roads: [{ id: 'ZH:1' }], paths: [{ id: 'path', road: 'ZH:1', points: road.map(lv95ToWgs84) }], stations }
  const catalog = { metadata: { supplier: 'ZH.CH' }, detectors: stations.flatMap(s => s.detectorIds.map(id => ({ id, direction: 'negative', lane: 'lane1' }))) }
  return { topology, catalog }
}

describe('cantonal direction evidence', () => {
  it('only extracts plain travel destinations, not lane positions or compound junction descriptions', () => {
    expect(directionDestination('Normalspur Richtung Zürich')).toBe('Zürich')
    expect(directionDestination('Überholspur Richtung Zürich ')).toBe('Zürich')
    expect(directionDestination('Normalspur Ost Richtung Zürich')).toBeUndefined()
    expect(directionDestination('Normalspur Richtung A1/Regensdorf')).toBeUndefined()
  })
  it('requires complete exact settlement results and preserves homonyms', () => {
    const feature = { layerBodId: 'ch.swisstopo.swissnames3d', properties: { name: 'Town', objektklasse: 'TLM_SIEDLUNGSNAME' }, bbox: [2680000, 1250000, 2680100, 1250100] }
    expect(destinationCandidates('Town', { results: [feature, feature] })).toHaveLength(1)
    expect(destinationCandidates('Town', { results: [feature, { ...feature, bbox: [2690000, 1250000, 2690100, 1250100] }] })).toHaveLength(2)
    expect(destinationCandidates('Town', { results: Array(200).fill(feature) })).toEqual([])
    expect(destinationCandidates('Tow', { results: [feature] })).toEqual([])
  })
  it('flips orientation with path order and rejects nearby, ambiguous and off-axis destinations', () => {
    expect(orientDestination(point(0), road, [east]).direction).toBe('positive')
    expect(orientDestination(point(0), [...road].reverse(), [east]).direction).toBe('negative')
    expect(orientDestination(point(0), road, [place('Near', 500)]).status).toBe('destination-too-close')
    expect(orientDestination(point(0), road, [east, place('Easttown', 8000)]).status).toBe('ambiguous-destination')
    expect(orientDestination(point(0), road, [place('Far from road', 7000, 4000)]).status).toBe('destination-off-axis')
  })
  it('rejects curved-road bearings and settlement extents that cross the station', () => {
    const hairpin = [point(-5000), point(5000), point(5000, 100), point(-5000, 100)]
    expect(orientDestination(point(0), hairpin, [place('Other arm', -4000, 100)]).status).toBe('bearing-conflict')
    expect(orientDestination(point(0), road, [{ ...east, bounds: [origin[0] - 1000, origin[1] - 100, origin[0] + 19000, origin[1] + 100] }]).status).toBe('destination-extent-conflict')
  })
  it('builds opposite sections using validated axis direction, independent of Alert-C coding', () => {
    const { topology, catalog } = fixture()
    const result = buildDirectionTopology(topology, catalog, places)
    expect(result.sites).toHaveLength(4)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[1].path).toEqual([...result.sections[0].path].reverse())
    expect(result.sections[0].distanceKm).toBeCloseTo(2, 2)
    expect(result.sites.find(s => s.direction === 'positive').detectorIds).toEqual(['ZH.CH:0.01'])
    expect(result.metadata.publicationStatus).toBe('draft')
  })
  it('does not bridge unresolved intermediate counters, large gaps or disconnected paths', () => {
    const { topology, catalog } = fixture([1000, 2000, 3000])
    topology.stations[1].detectorDescriptions[0].description = 'Unknown'
    expect(buildDirectionTopology(topology, catalog, places).sections).toEqual([])
    topology.stations[1].match = null
    topology.stations[1].candidates = [{ pathId: 'path' }]
    expect(buildDirectionTopology(topology, catalog, places).sections).toEqual([])
    const gap = fixture([1000, 7000])
    expect(buildDirectionTopology(gap.topology, gap.catalog, places).sections).toEqual([])
    const split = fixture()
    split.topology.paths.push({ ...split.topology.paths[0], id: 'other' })
    split.topology.stations[1].match.pathId = 'other'
    expect(buildDirectionTopology(split.topology, split.catalog, places).sections).toEqual([])
  })
  it('requires all normal lanes to agree in complete opposing direction groups', () => {
    const { topology, catalog } = fixture()
    topology.stations[0].detectorDescriptions[1].description = 'Normalspur Richtung Easttown'
    expect(buildDirectionTopology(topology, catalog, places).stationAudit[0].status).toBe('unresolved-direction-pair')
  })
})
