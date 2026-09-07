import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { roadLabelAnchors, visibleRoadLabels } from './road-labels.ts'

function camera(zoom: number, x = 0) {
  const camera = new THREE.OrthographicCamera(-12, 12, 5, -5, 0.1, 100)
  camera.position.set(x, 20, 0)
  camera.up.set(0, 0, -1)
  camera.lookAt(x, 0, 0)
  camera.zoom = zoom
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

const size = { width: 1200, height: 500 }

describe('road labels across camera changes', () => {
  it('adds detail on zoom while retaining visible labels at exactly the same road positions', () => {
    const anchors = roadLabelAnchors('N1-A', 'N1', [new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0)], 2)
    const original = anchors.map(anchor => anchor.position.toArray())
    let previous = new Set<string>()
    let labels = visibleRoadLabels(anchors, camera(1), size, previous)
    const overviewIds = labels.map(anchor => anchor.id)
    for (const zoom of [1.05, 1.2, 1.5, 2, 1.5, 1.2, 1]) {
      previous = new Set(labels.map(anchor => anchor.id))
      labels = visibleRoadLabels(anchors, camera(zoom), size, previous)
      for (const label of labels) expect(label).toBe(anchors.find(anchor => anchor.id === label.id))
      expect(anchors.map(anchor => anchor.position.toArray())).toEqual(original)
    }
    // Small zoom changes keep the existing visible set instead of redistributing it.
    const near = visibleRoadLabels(anchors, camera(1.05), size, new Set(overviewIds))
    expect(near.map(anchor => anchor.id)).toEqual(overviewIds)
    const close = visibleRoadLabels(anchors, camera(2), size, new Set(overviewIds))
    expect(close.some(anchor => !overviewIds.includes(anchor.id))).toBe(true)
    const panned = visibleRoadLabels(anchors, camera(2, 3), size, new Set(close.map(anchor => anchor.id)))
    expect(panned.length).toBeGreaterThan(0)
    expect(anchors.map(anchor => anchor.position.toArray())).toEqual(original)
  })

  it('samples bends and short roads without duplicating anchors at zero-length segments', () => {
    const anchors = roadLabelAnchors('bend', 'N4', [
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3, 0, 0), new THREE.Vector3(3, 0, 3),
    ], 2)
    expect(anchors.map(anchor => anchor.position.toArray())).toEqual([[1, 0, 0], [3, 0, 0], [3, 0, 2]])
    expect(roadLabelAnchors('short', 'N2', [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], 2)[0].position.x).toBe(0.5)
    expect(roadLabelAnchors('empty', 'N2', [new THREE.Vector3(), new THREE.Vector3()], 2)).toEqual([])
  })
})
