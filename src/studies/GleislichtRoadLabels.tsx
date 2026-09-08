import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
import type { NetworkProjection } from '@motionstudies/three/NationalNetworkScene'
import { roadLabelAnchors, visibleRoadLabels } from './road-labels.ts'
import { MAP_SURFACE_Y } from './map-surface.ts'

const LABEL_WIDTH = 38
const LABEL_HEIGHT = 19

function routeBadge(road: string) {
  const width = road.startsWith('ZH ') ? 76 : LABEL_WIDTH
  const canvas = document.createElement('canvas')
  canvas.width = width * 3
  canvas.height = LABEL_HEIGHT * 3
  const context = canvas.getContext('2d')!
  context.scale(3, 3)
  context.beginPath()
  context.roundRect(0.75, 0.75, width - 1.5, LABEL_HEIGHT - 1.5, 4)
  context.fillStyle = '#171522'
  context.fill()
  context.strokeStyle = '#ab8463'
  context.lineWidth = 0.75
  context.stroke()
  context.font = '600 11px system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffe0b3'
  context.fillText(road, width / 2, LABEL_HEIGHT / 2 + 0.5)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Road labels fixed to road coordinates, thinned as the camera pulls back. */
export function GleislichtRoadLabels({ topology, projection, selectedRoadId, subdued = false }: {
  topology: RoadTopologySnapshot
  projection: NetworkProjection
  selectedRoadId?: string
  subdued?: boolean
}) {
  const lastView = useRef({ matrix: new THREE.Matrix4(), width: 0, height: 0, resources: undefined as object | undefined })
  const resources = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'motorway-labels'
    const roads = [...new Set(topology.paths.filter(path => path.mainline).map(path => path.road))]
    // Selection gets first refusal at junctions and overlapping carriageways.
    roads.sort((a, b) => Number(b === selectedRoadId) - Number(a === selectedRoadId))
    const entries = roads.map(road => {
      // Swiss topology uses official N identifiers; badges show the public A route.
      const texture = routeBadge(topology.roads.find(route => route.id === road)?.label ?? road)
      const material = new THREE.SpriteMaterial({
        map: texture, transparent: true, depthTest: false, depthWrite: false,
        sizeAttenuation: false, toneMapped: false, fog: false,
        opacity: selectedRoadId ? road === selectedRoadId ? 1 : 0.3 : subdued ? 0.35 : 0.9,
      })
      const paths = topology.paths.filter(path => path.mainline && path.road === road).map(path =>
        path.points.map(([longitude, latitude]) => new THREE.Vector3(
          (longitude - projection.centreLongitude) * projection.longitudeScale * projection.scale,
          MAP_SURFACE_Y,
          -(latitude - projection.centreLatitude) * projection.scale,
        )),
      )
      const roadPaths = topology.paths.filter(path => path.mainline && path.road === road)
      const anchors = paths.flatMap((points, index) =>
        roadLabelAnchors(roadPaths[index].id, road, points, projection.scale * 2 / 111.195),
      )
      const sprites = anchors.map(anchor => {
        const sprite = new THREE.Sprite(material)
        sprite.name = anchor.id
        sprite.userData.pickTarget = { kind: 'road', value: road }
        sprite.position.copy(anchor.position)
        sprite.visible = false
        sprite.renderOrder = 19
        return { anchor, sprite }
      })
      return { texture, material, sprites, anchors }
    })
    const anchors = entries.flatMap(entry => entry.anchors)
    // Keep canonical anchors available independently of which pooled sprites are
    // attached. Hidden badges must not incur scene-graph updates every frame.
    group.userData.anchors = anchors
    return { group, entries, anchors, visible: new Set<string>() }
  }, [projection, selectedRoadId, subdued, topology])

  useEffect(() => () => {
    for (const entry of resources.entries) {
      entry.texture.dispose()
      entry.material.dispose()
    }
  }, [resources])

  useFrame(({ camera, size }) => {
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const view = lastView.current
    if (view.resources === resources && matrix.equals(view.matrix) && size.width === view.width && size.height === view.height) return
    view.matrix.copy(matrix)
    view.width = size.width
    view.height = size.height
    view.resources = resources
    const visible = visibleRoadLabels(resources.anchors, camera, size, resources.visible, selectedRoadId)
    resources.visible.clear()
    for (const anchor of visible) resources.visible.add(anchor.id)
    const pixelScale = 2 / (camera.projectionMatrix.elements[5] * size.height)
    for (const entry of resources.entries) {
      for (const { anchor, sprite } of entry.sprites) {
        sprite.scale.set((anchor.road.startsWith('ZH:') ? 76 : LABEL_WIDTH) * pixelScale, LABEL_HEIGHT * pixelScale, 1)
        // oxlint-disable-next-line react/immutability -- Three.js scene objects are updated imperatively in useFrame.
        sprite.visible = resources.visible.has(anchor.id)
        if (sprite.visible && sprite.parent !== resources.group) resources.group.add(sprite)
        else if (!sprite.visible && sprite.parent === resources.group) resources.group.remove(sprite)
      }
    }
  })

  return <primitive object={resources.group} />
}
