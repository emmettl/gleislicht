import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { NetworkTrain, StationIndexEntry } from '@motionstudies/core/domain/network'
import { MapTapGesture, pickMapTarget } from './map-selection.ts'

const station: StationIndexEntry = { name: 'Waterloo', stopIndexes: [0], trainIds: [], routes: [] }
const train: NetworkTrain = { id: 'moving', route: 'Northern', shortName: '123', headsign: 'Morden', category: 'metro', start: 0, end: 100, stops: [] }
const rect = { left: 90, top: 40, width: 800, height: 600 }
const stations = new Map([[0, station]])

function setup() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(44, rect.width / rect.height, 0.1, 120)
  camera.position.set(0, 20, 15)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.085, 0, 8, 0, 0], 3))
  geometry.userData.pickTrains = [train, { ...train, id: 'stale' }]
  geometry.setDrawRange(0, 1)
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ sizeAttenuation: false }))
  scene.add(points)
  scene.updateMatrixWorld()
  const screen = (x: number, y: number, z: number) => {
    const p = new THREE.Vector3(x, y, z).project(camera)
    return [rect.left + (p.x * 0.5 + 0.5) * rect.width, rect.top + (0.5 - p.y * 0.5) * rect.height] as const
  }
  const pick = (x: number, y: number, touch = false) => pickMapTarget(scene, camera, rect, x, y, touch, stations)
  return { scene, camera, geometry, points, screen, pick }
}

describe('rendered map picking', () => {
  it('uses CSS pixels and a constant tolerance after pan and zoom', () => {
    const { camera, screen, pick } = setup()
    for (const distance of [30, 10, 2]) {
      camera.position.set(1, distance, distance * 0.6)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      const [x, y] = screen(0, 0.085, 0)
      expect(pick(x, y)).toEqual({ kind: 'train', value: train })
      expect(pick(x + 7, y)).toBeUndefined()
      expect(pick(x + 10, y, true)?.kind).toBe('train')
    }
  })

  it('follows the actual moving buffer and ignores unused capacity and hidden groups', () => {
    const { scene, geometry, points, screen, pick } = setup()
    expect(pick(...screen(8, 0, 0))).toBeUndefined()
    geometry.getAttribute('position').setXYZ(0, 3, 0.085, 0)
    expect(pick(...screen(0, 0.085, 0))).toBeUndefined()
    expect(pick(...screen(3, 0.085, 0))?.kind).toBe('train')
    const group = new THREE.Group()
    scene.add(group)
    group.add(points)
    group.visible = false
    expect(pick(...screen(3, 0.085, 0))).toBeUndefined()
  })

  it('raycasts the actual offset label and ignores culled and transparent labels', () => {
    const { scene, screen, pick } = setup()
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ opacity: 1 }))
    label.userData.pickTarget = { kind: 'station', value: station }
    label.position.set(4, 0.035, 0)
    label.scale.set(2, 0.5, 1)
    label.center.set(0, 0.5)
    scene.add(label)
    scene.updateMatrixWorld()
    const [x, y] = screen(4, 0.035, 0)
    expect(pick(x + 20, y)).toEqual({ kind: 'station', value: station })
    expect(pick(x - 20, y)).toBeUndefined()
    label.visible = false
    expect(pick(x + 20, y)).toBeUndefined()
    label.visible = true
    label.material.opacity = 0
    expect(pick(x + 20, y)).toBeUndefined()
  })

  it('selects unlabelled station markers at their transformed positions', () => {
    const { scene, points, geometry, screen, pick } = setup()
    delete geometry.userData.pickTrains
    geometry.userData.pickStops = [0]
    points.position.x = -2
    scene.updateMatrixWorld()
    expect(pick(...screen(-2, 0.085, 0))).toEqual({ kind: 'station', value: station })
  })

  it('selects the visible label instead of an unrelated marker directly underneath', () => {
    const { scene, screen, pick } = setup()
    const label = new THREE.Sprite(new THREE.SpriteMaterial())
    label.userData.pickTarget = { kind: 'station', value: station }
    label.position.set(0, 0.085, 0)
    label.scale.set(2, 0.5, 1)
    label.renderOrder = 20
    scene.add(label)
    scene.updateMatrixWorld()
    expect(pick(...screen(0, 0.085, 0))).toEqual({ kind: 'station', value: station })
    label.visible = false
    expect(pick(...screen(0, 0.085, 0))).toEqual({ kind: 'train', value: train })
  })

  it('prefers a train drawn over a station marker', () => {
    const { scene, geometry, points, screen, pick } = setup()
    points.renderOrder = 12
    const stationGeometry = geometry.clone()
    stationGeometry.userData = { pickStops: [0] }
    scene.add(new THREE.Points(stationGeometry, new THREE.PointsMaterial()))
    scene.updateMatrixWorld()
    expect(pick(...screen(0, 0.085, 0))).toEqual({ kind: 'train', value: train })
  })

  it('hits the interior of a diagram tick when zoom makes its vertices far apart', () => {
    const { scene, screen, pick } = setup()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([3, 0.14, -1, 5, 0.14, -1, 4, 0.14, 2], 3))
    geometry.userData.pickStops = [0, 0, 0]
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })))
    scene.updateMatrixWorld()
    expect(pick(...screen(4, 0.14, 0))).toEqual({ kind: 'station', value: station })
  })

  it('ignores filtered trains and points outside the camera clipping range', () => {
    const { geometry, screen, pick } = setup()
    geometry.userData.pickTrains[0] = undefined
    expect(pick(...screen(0, 0.085, 0))).toBeUndefined()
    geometry.userData.pickTrains[0] = train
    geometry.getAttribute('position').setXYZ(0, 0, 40, 30)
    expect(pick(...screen(0, 40, 30))).toBeUndefined()
  })
})

describe('map tap gestures', () => {
  it('accepts a click but rejects a drag that returns to its start', () => {
    const gesture = new MapTapGesture()
    gesture.down(1, 10, 10)
    expect(gesture.up(1, 11, 10)).toBe(true)
    gesture.down(1, 10, 10)
    gesture.move(1, 30, 10)
    expect(gesture.up(1, 10, 10)).toBe(false)
  })
  it('rejects both pinch fingers, cancellation, and capture loss without poisoning the next tap', () => {
    const gesture = new MapTapGesture()
    gesture.down(1, 0, 0)
    gesture.down(2, 10, 0)
    expect(gesture.up(1, 0, 0)).toBe(false)
    expect(gesture.up(2, 10, 0)).toBe(false)
    gesture.down(3, 0, 0)
    expect(gesture.up(3, 0, 0, true)).toBe(false)
    expect(gesture.up(3, 0, 0)).toBe(false)
    gesture.down(4, 0, 0)
    expect(gesture.up(4, 0, 0)).toBe(true)
  })
})
