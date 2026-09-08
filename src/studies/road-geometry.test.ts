import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
import { RoadPolyline, roadPathOnTopology } from './road-geometry.ts'

const topology = { paths: [
  { id: 'bend', road: 'N1', points: [[8, 47], [8.01, 47], [8.01, 47.01]] },
  { id: 'continuation', road: 'N1', points: [[8.01, 47.01], [8.02, 47.01]] },
  { id: 'gap', road: 'N1', points: [[8.03, 47.01], [8.04, 47.01]] },
  { id: 'other-road', road: 'N2', points: [[8.02, 47.01], [8.03, 47.01]] },
] } as unknown as RoadTopologySnapshot

describe('traffic follows published road geometry', () => {
  it('follows every corner at constant distance without smoothing or resampling chords', () => {
    const curve = new RoadPolyline([new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), new THREE.Vector3(10, 0, 30)])
    expect(curve.getPointAt(0.125).toArray()).toEqual([5, 0, 0])
    expect(curve.getPointAt(0.5).toArray()).toEqual([10, 0, 10])
    expect(curve.getPointAt(1).toArray()).toEqual([10, 0, 30])
    expect(curve.getPoints()).toHaveLength(3)
  })
  it('routes across connected axes and clips endpoints to the road', () => {
    const path = roadPathOnTopology(topology, 'N1', [8.005, 47.0001], [8.015, 47.01])!
    expect(path).toEqual([[8.005, 47], [8.01, 47], [8.01, 47.01], [8.015, 47.01]])
    expect(roadPathOnTopology(topology, 'N1', [8.015, 47.01], [8.005, 47])).toEqual([...path].reverse())
  })
  it('never bridges disconnected axes, switches roads, or snaps distant counters', () => {
    expect(roadPathOnTopology(topology, 'N1', [8.005, 47], [8.035, 47.01])).toBeUndefined()
    expect(roadPathOnTopology(topology, 'N1', [9, 47], [8.015, 47.01])).toBeUndefined()
  })
  it('honours the matched axis rather than a nearer unrelated branch', () => {
    expect(roadPathOnTopology(topology, 'N1', [8.005, 47], [8.015, 47.01], 'gap')).toBeUndefined()
  })
})
