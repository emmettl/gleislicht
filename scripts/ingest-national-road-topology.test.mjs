import { describe, expect, it } from 'vitest'
import {
  buildRoadTopologyArtifact,
  matchCounterGroups,
  parseAstraMeasurementSites,
  parseNationalRoadAxes,
  resolveContinuityMatches,
} from './ingest-national-road-topology.mjs'

const axisXml = `<Axis_LV95_V1_1.Axis.Axis TID="axis-main"><AxisName>N1</AxisName><AxisPositionCode>plus</AxisPositionCode></Axis_LV95_V1_1.Axis.Axis><Axis_LV95_V1_1.Axis.AxisSegment TID="segment-main"><Sequence>1</Sequence><Geometry><POLYLINE><COORD><C1>2682500</C1><C2>1248000</C2><C3>0</C3></COORD><COORD><C1>2683500</C1><C2>1248000</C2><C3>0</C3></COORD></POLYLINE></Geometry><rAxisContainer REF="axis-main"></rAxisContainer></Axis_LV95_V1_1.Axis.AxisSegment>`

const siteXml = `<payloadPublication><publicationTime>2026-06-18T12:11:49Z</publicationTime><measurementSiteTable id="OTD:TrafficData" version="23"><measurementSiteRecord id="CH:0001.01"><measurementSiteLocation><affectedCarriagewayAndLanes><carriageway>mainCarriageway</carriageway><lane>lane1</lane></affectedCarriagewayAndLanes><alertCDirectionCoded>positive</alertCDirectionCoded><pointCoordinates><latitude>47.38</latitude><longitude>8.54</longitude></pointCoordinates></measurementSiteLocation></measurementSiteRecord><measurementSiteRecord id="CH:0001.02"><measurementSiteLocation><affectedCarriagewayAndLanes><carriageway>mainCarriageway</carriageway><lane>lane2</lane></affectedCarriagewayAndLanes><alertCDirectionCoded>positive</alertCDirectionCoded><pointCoordinates><latitude>47.38</latitude><longitude>8.54</longitude></pointCoordinates></measurementSiteLocation></measurementSiteRecord><measurementSiteRecord id="CH:0001.03"><measurementSiteLocation><affectedCarriagewayAndLanes><carriageway>mainCarriageway</carriageway><lane>emergencyLane</lane></affectedCarriagewayAndLanes><alertCDirectionCoded>positive</alertCDirectionCoded><pointCoordinates><latitude>47.38</latitude><longitude>8.54</longitude></pointCoordinates></measurementSiteLocation></measurementSiteRecord></measurementSiteTable></payloadPublication>`

describe('national AUTO topology ingestion', () => {
  it('parses official axes and groups usable counter lanes by direction', () => {
    const axes = parseNationalRoadAxes(axisXml)
    const sites = parseAstraMeasurementSites(siteXml)
    expect(axes.segments).toHaveLength(1)
    expect(axes.segments[0]).toMatchObject({ road: 'N1', mainline: true })
    expect(sites.records).toHaveLength(3)
    expect(sites.groups).toHaveLength(1)
    expect(sites.groups[0].detectorIds).toEqual(['CH:0001.01', 'CH:0001.02'])
  })

  it('matches a counter group onto the nearest official road axis', () => {
    const axes = parseNationalRoadAxes(axisXml)
    const sites = parseAstraMeasurementSites(siteXml)
    const matches = matchCounterGroups(sites.groups, axes.segments)
    expect(matches[0].match).toMatchObject({
      confidence: 'high',
      road: 'N1',
      segmentId: 'segment-main',
    })
  })

  it('publishes an explicit coverage audit with the compact geometry', () => {
    const artifact = buildRoadTopologyArtifact(
      parseNationalRoadAxes(axisXml),
      parseAstraMeasurementSites(siteXml),
    )
    expect(artifact.metadata.coverage).toMatchObject({
      federalStations: 1,
      federalDetectorRecords: 3,
      usableDirectionalGroups: 1,
      matchedDirectionalGroups: 1,
      roads: 1,
    })
    expect(artifact.paths[0].points).toHaveLength(2)
    expect(artifact.roads[0]).toMatchObject({ id: 'N1', label: 'A1' })
    expect(artifact.sections).toEqual([])
  })

  it('resolves a spatially ambiguous site only when neighbouring counters agree', () => {
    const segment = (road) => ({
      road,
      axisName: road,
      position: 'plus',
      id: `segment-${road}`,
      mainline: true,
    })
    const anchor = (stationId, lv95) => ({
      stationId,
      lv95,
      match: { confidence: 'high', road: 'N1' },
      candidateMatches: [],
    })
    const [resolved] = resolveContinuityMatches([
      {
        id: 'CH:0003:positive',
        stationId: 'CH:0003',
        direction: 'positive',
        lv95: [800, 100],
        match: { confidence: 'review' },
        candidateMatches: [
          { distance: 120, projected: [810, 100], segment: segment('N2') },
          { distance: 145, projected: [800, 90], segment: segment('N1') },
        ],
      },
      anchor('CH:0001', [0, 0]),
      anchor('CH:0002', [1_600, 0]),
    ])
    expect(resolved.match).toMatchObject({
      confidence: 'continuity',
      method: 'neighbouring-counters',
      road: 'N1',
    })
  })
})
